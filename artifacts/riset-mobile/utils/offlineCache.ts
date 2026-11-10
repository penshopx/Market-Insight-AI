/**
 * Shared offline cache helpers used by both cari.tsx and index.tsx.
 * Stores data in AsyncStorage with a 24-hour TTL.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// ─── Cache keys ────────────────────────────────────────────────────────────────

export const CACHE_KEYS = {
  riset: 'offline_cache_riset_v1',
  kontraktor: 'offline_cache_kontraktor_v1',
  painpoint: 'offline_cache_painpoint_v1',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    NetInfo.fetch().then((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);
  return online;
}
