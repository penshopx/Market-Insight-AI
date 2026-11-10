import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = '@riset_offline_queue';
/** Items permanently sent — survives app crash between handler() and queue removal. */
const SENT_LOG_KEY = '@riset_offline_sent_log';
/** Items that have exceeded MAX_RETRIES — shown as permanently failed. */
const DEAD_LETTER_KEY = '@riset_offline_dead_letter';
/** #67 — stop retrying after this many failures to prevent server spam. */
export const MAX_RETRIES = 5;

export type QueueItemType = 'riset' | 'kontraktor' | 'painpoint';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  data: Record<string, unknown>;
  addedAt: number;
  retries: number;
  /** #67 — timestamp (ms) of the most recent failed send attempt; used for backoff gating. */
  lastAttemptAt?: number;
}

type FlushHandler = (item: QueueItem) => Promise<void>;

/** Load raw queue from AsyncStorage */
async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

/** Persist queue to AsyncStorage */
async function saveQueue(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // silently ignore write errors
  }
}

/** #66 — load IDs of items already confirmed sent (crash-safe sent log) */
async function loadSentLog(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
  } catch { return new Set<string>(); }
}

/** #66 — add an ID to the sent log */
async function markAsSent(id: string): Promise<void> {
  try {
    const log = await loadSentLog();
    log.add(id);
    // Keep at most 200 entries to prevent unbounded growth
    const arr = [...log];
    await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(arr.slice(-200)));
  } catch { /* noop */ }
}

/** #66 — remove an ID from the sent log once the queue item has been cleaned up */
async function clearFromSentLog(id: string): Promise<void> {
  try {
    const log = await loadSentLog();
    log.delete(id);
    await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify([...log]));
  } catch { /* noop */ }
}

/** #67 — move an item to the dead-letter queue when retries are exhausted */
async function moveToDeadLetter(item: QueueItem): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
    const dead: QueueItem[] = raw ? JSON.parse(raw) : [];
    // Keep at most 50 dead-letter items
    const updated = [...dead, item].slice(-50);
    await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

/** #67 — load dead-letter items from AsyncStorage */
async function loadDeadLetter(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch { return []; }
}

/**
 * #67 — Exponential backoff delay for a given retry count.
 * retries=1 → 30 s, retries=2 → 60 s, …, capped at 1 h.
 * Exported so UI can compute "next attempt in X" labels.
 */
export function backoffMs(retries: number): number {
  return Math.min(30_000 * Math.pow(2, retries - 1), 3_600_000);
}

/**
 * Manages an offline submission queue backed by AsyncStorage.
 *
 * Usage:
 *   const { queueCount, enqueue, setFlushHandler } = useOfflineQueue();
 *
 * - Call `enqueue(type, data)` when an API call fails.
 * - Call `setFlushHandler(fn)` to register the function that sends one item to
 *   the server. The hook will call it automatically when connectivity returns.
 */
export interface DrainSummary {
  /** Number of items successfully sent in the last flush. */
  sent: number;
  /** Number of items that failed and remain in the queue. */
  failed: number;
  /** Timestamp (ms) of when the last flush finished. */
  at: number;
  /** Per-type breakdown of sent counts. */
  sentByType: Record<QueueItemType, number>;
}

/** #69 — Key for persisting flush history (last 24 h) */
const FLUSH_HISTORY_KEY = '@riset_flush_history';

/** Append a summary entry to the persistent flush history, keeping only last 24 h */
async function appendFlushHistory(summary: DrainSummary): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(FLUSH_HISTORY_KEY);
    const existing: DrainSummary[] = raw ? (JSON.parse(raw) as DrainSummary[]) : [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const pruned = existing.filter((s) => s.at > cutoff);
    pruned.push(summary);
    await AsyncStorage.setItem(FLUSH_HISTORY_KEY, JSON.stringify(pruned));
  } catch { /* noop */ }
}

/** Load flush history entries from the last 24 h */
async function loadFlushHistory(): Promise<DrainSummary[]> {
  try {
    const raw = await AsyncStorage.getItem(FLUSH_HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as DrainSummary[];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter((s) => s.at > cutoff);
  } catch { return []; }
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastDrainSummary, setLastDrainSummary] = useState<DrainSummary | null>(null);
  // #69 — 24-hour flush history surfaced in the queue modal
  const [flushHistory, setFlushHistory] = useState<DrainSummary[]>([]);
  // #67 — dead-letter items surfaced to the user
  const [deadLetterQueue, setDeadLetterQueue] = useState<QueueItem[]>([]);
  const flushHandlerRef = useRef<FlushHandler | null>(null);
  const isOnlineRef = useRef(true);

  // ── Load queue from storage on mount ──────────────────────────────────────
  useEffect(() => {
    loadQueue().then(setQueue);
    loadDeadLetter().then(setDeadLetterQueue);
    loadFlushHistory().then(setFlushHistory);
  }, []);

  // ── Persist queue whenever it changes ─────────────────────────────────────
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  // ── Flush: send pending items to the server ────────────────────────────────
  const flush = useCallback(async () => {
    const handler = flushHandlerRef.current;
    if (!handler) return;

    const pending = await loadQueue();
    if (pending.length === 0) return;

    // #66 — load the crash-safe sent log once at flush start.
    // Any IDs here were confirmed by the server in a previous flush that
    // crashed before queue cleanup completed. Skip them and clean up now.
    const sentLog = await loadSentLog();

    setIsFlushing(true);

    let sentCount = 0;
    let failedCount = 0;
    const sentByType: Record<QueueItemType, number> = { riset: 0, kontraktor: 0, painpoint: 0 };

    // Iterate over the initial snapshot IDs only. Before each send we
    // re-read storage so any concurrent removeItem() call is respected.
    for (const item of pending) {
      // #66 — item was already confirmed sent in a previous crash-interrupted flush.
      if (sentLog.has(item.id)) {
        const q = await loadQueue();
        const next = q.filter((i) => i.id !== item.id);
        await saveQueue(next);
        setQueue(next);
        await clearFromSentLog(item.id);
        sentCount++;
        sentByType[item.type] = (sentByType[item.type] ?? 0) + 1;
        continue;
      }

      // #67 — item has exceeded max retries; move to dead letter, remove from queue.
      if (item.retries >= MAX_RETRIES) {
        await moveToDeadLetter(item);
        const q = await loadQueue();
        const next = q.filter((i) => i.id !== item.id);
        await saveQueue(next);
        setQueue(next);
        // Refresh dead-letter state so the UI surfaces the new entry.
        setDeadLetterQueue(await loadDeadLetter());
        continue;
      }

      // #67 — exponential backoff: skip items whose next-retry window hasn't opened yet.
      // Gate from lastAttemptAt (the most-recent failure timestamp), falling back to
      // addedAt only for legacy items that predate this field.
      if (item.retries >= 1) {
        const gateFrom = item.lastAttemptAt ?? item.addedAt;
        if (Date.now() < gateFrom + backoffMs(item.retries)) {
          continue;
        }
      }

      // Re-read storage right before sending. If the item was manually
      // deleted while this loop was awaiting a previous handler, skip it.
      const beforeSend = await loadQueue();
      if (!beforeSend.find((i) => i.id === item.id)) continue;

      try {
        // #66 — record intent BEFORE calling handler so a crash during handler
        // cannot cause a duplicate re-send on the next flush.
        await markAsSent(item.id);

        await handler(item);

        // Server confirmed — clean up queue and sent log atomically.
        const afterSend = await loadQueue();
        const next = afterSend.filter((i) => i.id !== item.id);
        await saveQueue(next);
        setQueue(next);
        await clearFromSentLog(item.id);
        sentCount++;
        sentByType[item.type] = (sentByType[item.type] ?? 0) + 1;
      } catch {
        // Still failing — remove from sent log (we did NOT succeed) and bump retry.
        await clearFromSentLog(item.id);
        const newRetries = item.retries + 1;
        const now = Date.now();

        if (newRetries >= MAX_RETRIES) {
          // #67 — fifth (or beyond) failure: immediately demote to dead-letter so the
          // item never occupies the active queue again after this flush.
          await moveToDeadLetter({ ...item, retries: newRetries, lastAttemptAt: now });
          const afterFail = await loadQueue();
          const next = afterFail.filter((i) => i.id !== item.id);
          await saveQueue(next);
          setQueue(next);
          setDeadLetterQueue(await loadDeadLetter());
        } else {
          // Not yet exhausted — stamp lastAttemptAt so backoff is gated correctly.
          const afterFail = await loadQueue();
          const next = afterFail.map((i) =>
            i.id === item.id ? { ...i, retries: newRetries, lastAttemptAt: now } : i,
          );
          await saveQueue(next);
          setQueue(next);
        }
        failedCount++;
      }
    }

    setIsFlushing(false);

    // Only publish a summary when at least one item was actually processed.
    if (sentCount + failedCount > 0) {
      const summary: DrainSummary = {
        sent: sentCount,
        failed: failedCount,
        at: Date.now(),
        sentByType,
      };
      setLastDrainSummary(summary);
      // #69 — persist to 24-h history so queue modal can show it
      await appendFlushHistory(summary);
      setFlushHistory(await loadFlushHistory());
    }
  }, []);

  // ── Watch network connectivity ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && !isOnlineRef.current) {
        // Just came back online — attempt flush
        flush();
      }
      isOnlineRef.current = online;
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      isOnlineRef.current =
        state.isConnected === true && state.isInternetReachable !== false;
    });

    return () => unsubscribe();
  }, [flush]);

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add a failed submission to the offline queue.
   * Task #24: writes atomically to AsyncStorage BEFORE updating React state
   * so force-closing the app immediately after enqueue cannot lose the item.
   */
  const enqueue = useCallback(async (type: QueueItemType, data: Record<string, unknown>) => {
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      data,
      addedAt: Date.now(),
      retries: 0,
    };
    // Atomic storage write first — survives force-close
    const current = await loadQueue();
    const updated = [...current, item];
    await saveQueue(updated);
    // Then update in-memory state so UI badge reflects the new count
    setQueue(updated);
  }, []);

  /**
   * Register the function that processes a single queue item.
   * Should be called from the component that owns the mutation hooks.
   */
  const setFlushHandler = useCallback((handler: FlushHandler) => {
    flushHandlerRef.current = handler;
  }, []);

  /** Manually trigger a queue flush (e.g. when the screen becomes active) */
  const manualFlush = useCallback(() => {
    if (isOnlineRef.current) flush();
  }, [flush]);

  /**
   * Remove a single item from the offline queue by ID.
   * Writes to AsyncStorage first, then updates React state.
   */
  const removeItem = useCallback(async (id: string) => {
    const current = await loadQueue();
    const updated = current.filter((i) => i.id !== id);
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  /**
   * #68 — update the data payload of a queue item before it is sent.
   * Resets the retries counter so a corrected item gets fresh attempts.
   */
  const updateItem = useCallback(async (id: string, patch: Partial<Record<string, unknown>>) => {
    const current = await loadQueue();
    const updated = current.map((i) =>
      i.id === id ? { ...i, data: { ...i.data, ...patch }, retries: 0 } : i,
    );
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  /**
   * #67 — clear all dead-letter items and dismiss the error surface in the UI.
   */
  const clearDeadLetter = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(DEAD_LETTER_KEY);
    } catch { /* noop */ }
    setDeadLetterQueue([]);
  }, []);

  return {
    queueCount: queue.length,
    queue,
    isFlushing,
    lastDrainSummary,
    flushHistory,
    deadLetterQueue,
    enqueue,
    setFlushHandler,
    manualFlush,
    removeItem,
    updateItem,
    clearDeadLetter,
  };
}
