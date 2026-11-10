/**
 * Tests for the crash-safe offline queue (Task #66) and
 * exponential-backoff / dead-letter behaviour (Task #67).
 *
 * Key guarantees:
 *   #66 — if the app crashes after the server confirms an item but before the
 *          queue entry is cleaned up, the item must NOT be re-sent.
 *   #67 — after a failure the item is not retried until the backoff window has
 *          elapsed (gated by lastAttemptAt); a fifth consecutive failure
 *          immediately moves the item to the dead-letter queue.
 */

import { renderHook, act } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cast to get access to the test helper added in our manual mock.
const MockAsyncStorage = AsyncStorage as typeof AsyncStorage & {
  __reset: () => void;
};

// Import after mocks are in place so the module picks up the mocked deps.
import { useOfflineQueue, backoffMs, MAX_RETRIES } from '../useOfflineQueue';

// AsyncStorage keys mirror the constants in useOfflineQueue.ts
const QUEUE_KEY = '@riset_offline_queue';
const SENT_LOG_KEY = '@riset_offline_sent_log';
const DEAD_LETTER_KEY = '@riset_offline_dead_letter';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, retries = 0, lastAttemptAt?: number) {
  return {
    id,
    type: 'painpoint' as const,
    data: { note: id },
    addedAt: 0,
    retries,
    ...(lastAttemptAt !== undefined ? { lastAttemptAt } : {}),
  };
}

async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw
    ? (JSON.parse(raw) as { id: string; retries: number; lastAttemptAt?: number }[])
    : [];
}

async function readSentLog() {
  const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function readDeadLetter() {
  const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
  return raw ? (JSON.parse(raw) as { id: string; retries: number }[]) : [];
}

/**
 * Drain the microtask queue enough times for the flush loop
 * (which has several layers of awaited AsyncStorage calls) to finish.
 */
async function drainAsync(ticks = 30) {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  MockAsyncStorage.__reset();
  jest.clearAllMocks();
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── backoffMs unit tests ─────────────────────────────────────────────────────

describe('backoffMs formula', () => {
  it('retries=1 → 30 s', () => {
    expect(backoffMs(1)).toBe(30_000);
  });

  it('retries=2 → 60 s', () => {
    expect(backoffMs(2)).toBe(60_000);
  });

  it('retries=3 → 120 s', () => {
    expect(backoffMs(3)).toBe(120_000);
  });

  it('caps at 1 h regardless of high retries', () => {
    expect(backoffMs(20)).toBe(3_600_000);
    expect(backoffMs(100)).toBe(3_600_000);
  });
});

// ─── crash-safe flush (Task #66) ─────────────────────────────────────────────

describe('crash-safe flush: item already in sent log is not re-sent', () => {
  it('skips item1 and sends item2 when item1 was in the sent-log at flush start', async () => {
    const item1 = makeItem('item-crash-1');
    const item2 = makeItem('item-crash-2');

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([item1, item2]));
    await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify([item1.id]));

    const handledIds: string[] = [];

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await drainAsync();
    });

    act(() => {
      result.current.setFlushHandler(async (item) => {
        handledIds.push(item.id);
      });
    });

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    expect(handledIds).not.toContain(item1.id);
    expect(handledIds).toContain(item2.id);

    const remaining = await readQueue();
    expect(remaining).toHaveLength(0);

    const sentLog = await readSentLog();
    expect(sentLog).not.toContain(item1.id);
  });

  it('item1 is not re-sent even when item2 throws mid-flush', async () => {
    const item1 = makeItem('item-partial-1');
    const item2 = makeItem('item-partial-2');

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([item1, item2]));
    await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify([item1.id]));

    const handledIds: string[] = [];

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => { await drainAsync(); });

    act(() => {
      result.current.setFlushHandler(async (item) => {
        handledIds.push(item.id);
        if (item.id === item2.id) throw new Error('network error');
      });
    });

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    expect(handledIds).not.toContain(item1.id);
    expect(handledIds).toContain(item2.id);

    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(item2.id);
  });
});

// ─── retry counter (basic) ────────────────────────────────────────────────────

describe('failed item: retry counter increments and item stays in queue', () => {
  it('increments retries by 1 and stamps lastAttemptAt after a single failed flush', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    await act(async () => {
      await result.current.enqueue('painpoint', { note: 'retry-test' });
    });

    act(() => {
      result.current.setFlushHandler(async () => {
        throw new Error('server unavailable');
      });
    });

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(1);
    expect(remaining[0].lastAttemptAt).toBe(1_000_000);
  });

  it('increments retries cumulatively across multiple flush attempts when backoff has elapsed', async () => {
    jest.useFakeTimers();
    // Start at t=0
    jest.setSystemTime(0);

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    await act(async () => {
      await result.current.enqueue('riset', { note: 'multi-retry' });
    });

    act(() => {
      result.current.setFlushHandler(async () => {
        throw new Error('always fails');
      });
    });

    // First flush at t=0 (retries=0, no backoff gate)
    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    // After first failure retries=1, backoffMs(1)=30 s. Advance past the window.
    jest.setSystemTime(31_000);

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    // After second failure retries=2, backoffMs(2)=60 s. Advance past the window.
    jest.setSystemTime(31_000 + 61_000);

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(3);
  });
});

// ─── exponential backoff (Task #67) ──────────────────────────────────────────

describe('exponential backoff: items skipped until window elapses', () => {
  it('does NOT send an item whose backoff window has not yet elapsed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    // Pre-seed queue with an item that failed once at t=0
    const item = makeItem('back-1', 1, 0); // retries=1, lastAttemptAt=0
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([item]));

    const handledIds: string[] = [];

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    act(() => {
      result.current.setFlushHandler(async (i) => { handledIds.push(i.id); });
    });

    // Flush immediately — backoffMs(1)=30 s has NOT elapsed
    jest.setSystemTime(5_000); // only 5 s have passed

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    expect(handledIds).toHaveLength(0);

    // Queue must still contain the item, untouched
    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
  });

  it('DOES send the item once the backoff window has elapsed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const item = makeItem('back-2', 1, 0); // retries=1, lastAttemptAt=0
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([item]));

    const handledIds: string[] = [];

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    act(() => {
      result.current.setFlushHandler(async (i) => { handledIds.push(i.id); });
    });

    // Advance past backoffMs(1) = 30 s
    jest.setSystemTime(31_000);

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    expect(handledIds).toContain(item.id);

    const remaining = await readQueue();
    expect(remaining).toHaveLength(0);
  });

  it('backoff gates on lastAttemptAt, not addedAt', async () => {
    jest.useFakeTimers();
    // addedAt = 0 (long ago), lastAttemptAt = recent
    const recentFailure = 100_000;
    jest.setSystemTime(recentFailure + 5_000); // only 5 s after last attempt

    const item = {
      ...makeItem('back-3', 1),
      addedAt: 0,
      lastAttemptAt: recentFailure,
    };
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([item]));

    const handledIds: string[] = [];

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    act(() => {
      result.current.setFlushHandler(async (i) => { handledIds.push(i.id); });
    });

    await act(async () => {
      result.current.manualFlush();
      await drainAsync();
    });

    // Should be skipped: lastAttemptAt + 30 s > now
    expect(handledIds).toHaveLength(0);
  });
});

// ─── dead-letter demotion (Task #67) ─────────────────────────────────────────

describe('dead-letter: items demoted immediately when MAX_RETRIES is reached', () => {
  it(`demotes an item to dead-letter on the ${MAX_RETRIES}th failure, removing it from the active queue`, async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    await act(async () => {
      await result.current.enqueue('painpoint', { note: 'dead-letter-test' });
    });

    act(() => {
      result.current.setFlushHandler(async () => {
        throw new Error('always fails');
      });
    });

    // Run MAX_RETRIES flushes, advancing the clock past each backoff window
    for (let i = 0; i < MAX_RETRIES; i++) {
      // Advance well past backoffMs(i) after the first failure
      if (i > 0) {
        jest.setSystemTime(Date.now() + backoffMs(i) + 1_000);
      }
      await act(async () => {
        result.current.manualFlush();
        await drainAsync();
      });
    }

    // Active queue must be empty — item was demoted
    const remaining = await readQueue();
    expect(remaining).toHaveLength(0);

    // Dead-letter must contain the item
    const dead = await readDeadLetter();
    expect(dead).toHaveLength(1);
    expect(dead[0].retries).toBe(MAX_RETRIES);

    // React state must reflect demotion
    expect(result.current.deadLetterQueue).toHaveLength(1);
  });

  it('does NOT demote to dead-letter before MAX_RETRIES is reached', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    await act(async () => {
      await result.current.enqueue('riset', { note: 'not-dead-yet' });
    });

    act(() => {
      result.current.setFlushHandler(async () => {
        throw new Error('always fails');
      });
    });

    // One fewer than MAX_RETRIES flushes
    for (let i = 0; i < MAX_RETRIES - 1; i++) {
      if (i > 0) {
        jest.setSystemTime(Date.now() + backoffMs(i) + 1_000);
      }
      await act(async () => {
        result.current.manualFlush();
        await drainAsync();
      });
    }

    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(MAX_RETRIES - 1);

    const dead = await readDeadLetter();
    expect(dead).toHaveLength(0);
  });
});

// ─── clearDeadLetter (Task #67) ───────────────────────────────────────────────

describe('clearDeadLetter: wipes dead-letter storage and React state', () => {
  it('removes all entries from storage and empties deadLetterQueue state', async () => {
    // Pre-seed dead-letter storage
    const deadItem = makeItem('dl-1', MAX_RETRIES);
    await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify([deadItem]));

    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => { await drainAsync(); });

    // State should have been hydrated from storage
    expect(result.current.deadLetterQueue).toHaveLength(1);

    await act(async () => {
      await result.current.clearDeadLetter();
    });

    expect(result.current.deadLetterQueue).toHaveLength(0);

    const stored = await readDeadLetter();
    expect(stored).toHaveLength(0);
  });
});
