/**
 * Module-level store for passing a pre-selected item from the "Baru Ditambahkan"
 * section on the home screen into the Cari tab's detail modal.
 *
 * Using a module variable (instead of URL params or AsyncStorage) ensures the
 * full typed item object is available immediately on mount in cari.tsx — no
 * list-lookup, no fetch, no pagination risk.
 */

import type { Contractor, ResearchItem } from '@workspace/api-client-react';

export type PendingDeepLinkItem =
  | { tab: 'riset'; item: ResearchItem }
  | { tab: 'kontraktor'; item: Contractor }
  | null;

let _pending: PendingDeepLinkItem = null;

export function setPendingDeepLinkItem(item: PendingDeepLinkItem): void {
  _pending = item;
}

/**
 * Read-and-clear: returns the pending item and immediately resets the store so
 * a subsequent screen mount doesn't re-open it.
 */
export function consumePendingDeepLinkItem(): PendingDeepLinkItem {
  const item = _pending;
  _pending = null;
  return item;
}
