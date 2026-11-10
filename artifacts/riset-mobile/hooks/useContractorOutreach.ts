/**
 * Persists contractor outreach status to AsyncStorage AND syncs to the server
 * workroom API (PUT /workroom/notes/contractor/:id) so team members on other
 * devices see the same state.
 *
 * Task #163: Show contractor outreach status on mobile so field team can update
 * follow-ups on the go.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertWorkroomNote } from '@workspace/api-client-react';

export type OutreachStatus =
  | 'BELUM_DIHUBUNGI'
  | 'SUDAH_DIHUBUNGI'
  | 'SEDANG_NEGOSIASI'
  | 'DEAL'
  | 'TIDAK_TERTARIK';

export interface OutreachStatusConfig {
  label: string;
  color: string;     // badge background
  textColor: string;
  dotColor: string;
}

export const OUTREACH_STATUS_CONFIG: Record<OutreachStatus, OutreachStatusConfig> = {
  BELUM_DIHUBUNGI:  { label: 'Belum Dihubungi',  color: '#f1f5f9', textColor: '#64748b', dotColor: '#94a3b8' },
  SUDAH_DIHUBUNGI:  { label: 'Sudah Dihubungi',  color: '#dbeafe', textColor: '#1d4ed8', dotColor: '#3b82f6' },
  SEDANG_NEGOSIASI: { label: 'Negosiasi',         color: '#fef3c7', textColor: '#b45309', dotColor: '#f59e0b' },
  DEAL:             { label: 'Deal ✓',            color: '#d1fae5', textColor: '#065f46', dotColor: '#10b981' },
  TIDAK_TERTARIK:   { label: 'Tidak Tertarik',    color: '#fee2e2', textColor: '#b91c1c', dotColor: '#ef4444' },
};

export const OUTREACH_STATUS_ORDER: OutreachStatus[] = [
  'BELUM_DIHUBUNGI',
  'SUDAH_DIHUBUNGI',
  'SEDANG_NEGOSIASI',
  'DEAL',
  'TIDAK_TERTARIK',
];

const STORAGE_KEY = 'mkp-contractor-outreach-v1';

type OutreachMap = Record<string, OutreachStatus>;

export function useContractorOutreach(): {
  outreachMap: OutreachMap;
  getStatus: (contractorId: number) => OutreachStatus;
  setStatus: (contractorId: number, status: OutreachStatus) => void;
  isLoaded: boolean;
} {
  const [outreachMap, setOutreachMap] = useState<OutreachMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try { setOutreachMap(JSON.parse(raw)); } catch { /* ignore bad JSON */ }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Persist to AsyncStorage whenever map changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outreachMap)).catch(() => {});
  }, [outreachMap, isLoaded]);

  const getStatus = useCallback(
    (contractorId: number): OutreachStatus =>
      outreachMap[String(contractorId)] ?? 'BELUM_DIHUBUNGI',
    [outreachMap],
  );

  const setStatus = useCallback(
    (contractorId: number, status: OutreachStatus) => {
      setOutreachMap((prev) => ({ ...prev, [String(contractorId)]: status }));
      // #163 — sync to server workroom API so the web platform and other devices
      // see the same outreach status; failures are non-fatal (device is source of truth)
      upsertWorkroomNote(
        'contractor',
        contractorId,
        { status, note: '' },
      ).catch(() => { /* non-critical — AsyncStorage is the local fallback */ });
    },
    [],
  );

  return { outreachMap, getStatus, setStatus, isLoaded };
}
