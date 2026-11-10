/**
 * OfflineQueueContext
 *
 * Provides a shared offline submission queue (backed by AsyncStorage) across
 * the app.  The provider lives in the root layout so both the tab badge and
 * the input form can read/write the same queue state.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import { useOfflineQueue, type QueueItem, type QueueItemType, type DrainSummary } from '@/hooks/useOfflineQueue';

type OfflineQueueContextValue = ReturnType<typeof useOfflineQueue>;

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const value = useOfflineQueue();
  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueueContext(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueueContext must be used inside OfflineQueueProvider');
  return ctx;
}

export type { QueueItem, QueueItemType, DrainSummary };
