import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { consumePendingDeepLinkItem } from '@/store/deepLinkStore';
import {
  useListContractors,
  useListPainPoints,
  useListResearchItems,
} from '@workspace/api-client-react';
import type { Contractor, PainPoint, ResearchItem } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useContractorOutreach } from '@/hooks/useContractorOutreach';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ContractorCard,
  DetailModal,
  PainPointCard,
  RisetCard,
  extractFotoBuktiUrl,
  isPhotoUrl,
  kontraktorDetailRows,
  painPointDetailRows,
  risetDetailRows,
} from '@/components/SearchCards';
import type { DetailRow } from '@/components/SearchCards';

// ─── Offline cache helpers — imported from shared util ────────────────────────
import { CACHE_KEYS, loadCache, saveCache, useIsOnline } from '@/utils/offlineCache';

// ─── Constants ─────────────────────────────────────────────────────────────────

type SearchTab = 'riset' | 'kontraktor' | 'painpoint';

const PAGE_SIZE = 20;

const TABS: { key: SearchTab; label: string; icon: string }[] = [
  { key: 'riset', label: 'Riset', icon: 'book-open' },
  { key: 'kontraktor', label: 'Kontraktor', icon: 'briefcase' },
  { key: 'painpoint', label: 'Pain Point', icon: 'alert-circle' },
];

const RISET_CATEGORIES = ['LEGALITAS_PERIJINAN', 'SBU', 'SKK', 'TENDER', 'PROYEK'];
const CONTRACTOR_PROVINCES = ['DKI Jakarta', 'Jawa Barat', 'Jawa Timur', 'Jawa Tengah', 'Banten', 'Sumatera Utara', 'Kalimantan Timur'];
const CONTRACTOR_SBU = ['MENENGAH', 'SPESIALIS', 'BESAR', 'ASING'];
const PAIN_SEGMENTS = ['KONTRAKTOR', 'KONSULTAN', 'TENAGA_KERJA', 'SEMUA'];
const PAIN_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ query, loading }: { query: string; loading: boolean }) {
  const colors = useColors();
  if (loading) return null;
  return (
    <View style={emptyStyles.container}>
      <Feather name="search" size={40} color={colors.mutedForeground} />
      <Text style={[emptyStyles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        {query ? 'Tidak ditemukan' : 'Belum ada data'}
      </Text>
      <Text style={[emptyStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {query
          ? `Tidak ada hasil untuk "${query}"`
          : 'Data akan muncul setelah tersedia di server'}
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  title: { fontSize: 16, lineHeight: 22 },
  sub: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});

// ─── Filter Chips Row ───────────────────────────────────────────────────────────

function FilterChips({
  options,
  value,
  onSelect,
}: {
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
    >
      {['Semua', ...options].map((opt) => {
        const key = opt === 'Semua' ? '' : opt;
        const active = value === key;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(active ? '' : key)}
            style={[
              filterStyles.chip,
              {
                backgroundColor: active ? colors.primary : colors.muted,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.75}
          >
            <Text
              style={[
                filterStyles.chipText,
                {
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                },
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const filterStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, lineHeight: 17 },
});

// ─── Main Screen ────────────────────────────────────────────────────────────────

export default function CariScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Task #163: contractor outreach tracking
  const { getStatus, setStatus } = useContractorOutreach();

  const [activeTab, setActiveTab] = useState<SearchTab>('riset');
  const [query, setQuery] = useState('');

  // Filter states
  const [risetCategory, setRisetCategory] = useState('');
  const [kontraktorsbuLevel, setKontraktorSbuLevel] = useState('');
  const [kontraktorProvince, setKontraktorProvince] = useState('');
  const [ppSegment, setPpSegment] = useState('');
  const [ppPriority, setPpPriority] = useState('');

  // Pagination
  const [risetPage, setRisetPage] = useState(1);
  const [kontraktorPage, setKontraktorPage] = useState(1);
  const [ppPage, setPpPage] = useState(1);

  // Detail modal
  const [detailItem, setDetailItem] = useState<{
    title: string;
    rows: DetailRow[];
    photoUrl?: string | null;
    workroomUrl?: string | null;
  } | null>(null);

  const webBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : null;

  // ── Offline cache state (Task #20) ───────────────────────────────────────────

  const isOnline = useIsOnline();
  const [cachedRiset, setCachedRiset] = useState<ResearchItem[]>([]);
  const [cachedKontraktor, setCachedKontraktor] = useState<Contractor[]>([]);
  const [cachedPainPoints, setCachedPainPoints] = useState<PainPoint[]>([]);

  // Load caches on mount
  useEffect(() => {
    loadCache<ResearchItem[]>(CACHE_KEYS.riset).then((d) => d && setCachedRiset(d));
    loadCache<Contractor[]>(CACHE_KEYS.kontraktor).then((d) => d && setCachedKontraktor(d));
    loadCache<PainPoint[]>(CACHE_KEYS.painpoint).then((d) => d && setCachedPainPoints(d));
  }, []);

  // ── API Queries ──────────────────────────────────────────────────────────────

  const {
    data: risetData,
    isLoading: risetLoading,
    isRefetching: risetRefetching,
    refetch: refetchRiset,
  } = useListResearchItems({ category: risetCategory || undefined, limit: 200 });

  const {
    data: kontraktorData,
    isLoading: kontraktorLoading,
    isRefetching: kontraktorRefetching,
    refetch: refetchKontraktor,
  } = useListContractors({
    search: query || undefined,
    sbuLevel: kontraktorsbuLevel || undefined,
    province: kontraktorProvince || undefined,
  });

  const {
    data: ppData,
    isLoading: ppLoading,
    isRefetching: ppRefetching,
    refetch: refetchPainPoints,
  } = useListPainPoints({
    segment: ppSegment || undefined,
    priority: ppPriority || undefined,
  });

  // Save to cache whenever fresh data arrives
  useEffect(() => {
    if (risetData && risetData.length > 0) {
      setCachedRiset(risetData);
      saveCache(CACHE_KEYS.riset, risetData);
    }
  }, [risetData]);
  useEffect(() => {
    if (kontraktorData && kontraktorData.length > 0) {
      setCachedKontraktor(kontraktorData);
      saveCache(CACHE_KEYS.kontraktor, kontraktorData);
    }
  }, [kontraktorData]);
  useEffect(() => {
    if (ppData && ppData.length > 0) {
      setCachedPainPoints(ppData);
      saveCache(CACHE_KEYS.painpoint, ppData);
    }
  }, [ppData]);

  // Use live data when online, cache when offline
  const effectiveRiset = isOnline ? (risetData ?? cachedRiset) : cachedRiset;
  const effectiveKontraktor = isOnline ? (kontraktorData ?? cachedKontraktor) : cachedKontraktor;
  const effectivePainPoints = isOnline ? (ppData ?? cachedPainPoints) : cachedPainPoints;

  // ── Open detail from "Baru Ditambahkan" deep-link store ─────────────────────
  // useFocusEffect runs every time this tab gains focus — handles repeated taps
  // from the home screen even when the Cari screen is already mounted.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingDeepLinkItem();
      if (!pending) return;
      setActiveTab(pending.tab);
      if (pending.tab === 'riset') {
        openRisetDetail(pending.item);
      } else if (pending.tab === 'kontraktor') {
        openKontraktorDetail(pending.item);
      }
    }, [])
  );

  // ── Client-side filtering + pagination ──────────────────────────────────────

  const filteredRiset = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = effectiveRiset;
    if (!q) return all;
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q)
    );
  }, [effectiveRiset, query]);

  const filteredPainPoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = effectivePainPoints;
    if (!q) return all;
    return all.filter(
      (p) =>
        p.description.toLowerCase().includes(q) ||
        (p.domain ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
    );
  }, [effectivePainPoints, query]);

  // Kontraktor: client-side search on cached data when offline
  const filteredKontraktor = useMemo(() => {
    if (isOnline) return effectiveKontraktor;
    const q = query.trim().toLowerCase();
    if (!q) return effectiveKontraktor;
    return effectiveKontraktor.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.bidangUsaha ?? '').toLowerCase().includes(q) ||
        (c.province ?? '').toLowerCase().includes(q)
    );
  }, [effectiveKontraktor, isOnline, query]);

  const risetVisible = filteredRiset.slice(0, risetPage * PAGE_SIZE);
  const kontraktorVisible = filteredKontraktor.slice(0, kontraktorPage * PAGE_SIZE);
  const ppVisible = filteredPainPoints.slice(0, ppPage * PAGE_SIZE);

  const canLoadMoreRiset = risetVisible.length < filteredRiset.length;
  const canLoadMoreKontraktor = kontraktorVisible.length < filteredKontraktor.length;
  const canLoadMorePp = ppVisible.length < filteredPainPoints.length;

  // ── Refresh ──────────────────────────────────────────────────────────────────

  const isRefreshing = risetRefetching || kontraktorRefetching || ppRefetching;

  const handleRefresh = useCallback(() => {
    refetchRiset();
    refetchKontraktor();
    refetchPainPoints();
    setRisetPage(1);
    setKontraktorPage(1);
    setPpPage(1);
  }, [refetchRiset, refetchKontraktor, refetchPainPoints]);

  // ── Tab switch ───────────────────────────────────────────────────────────────

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setQuery('');
    setRisetPage(1);
    setKontraktorPage(1);
    setPpPage(1);
  };

  // ── Detail helpers ───────────────────────────────────────────────────────────

  const openRisetDetail = (item: ResearchItem) => {
    setDetailItem({
      title: item.title,
      rows: risetDetailRows(item),
      photoUrl: isPhotoUrl(item.sourceUrl) ? item.sourceUrl : null,
    });
  };

  const openKontraktorDetail = (item: Contractor) => {
    setDetailItem({
      title: item.name,
      rows: kontraktorDetailRows(item),
      photoUrl: extractFotoBuktiUrl(item.notes),
      workroomUrl: webBase ? `${webBase}/workroom?tab=prospek&contractorId=${item.id}` : null,
    });
  };

  const openPainPointDetail = (item: PainPoint) => {
    setDetailItem({
      title: item.description.length > 80 ? item.description.slice(0, 80) + '…' : item.description,
      rows: painPointDetailRows(item),
      photoUrl: item.evidencePhotoUrl ?? null,
    });
  };

  // ── Render items ─────────────────────────────────────────────────────────────

  const isLoading =
    (activeTab === 'riset' && risetLoading) ||
    (activeTab === 'kontraktor' && kontraktorLoading) ||
    (activeTab === 'painpoint' && ppLoading);

  const totalVisible =
    activeTab === 'riset'
      ? filteredRiset.length
      : activeTab === 'kontraktor'
      ? filteredKontraktor.length
      : filteredPainPoints.length;

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const renderFooter = () => {
    const canLoadMore =
      activeTab === 'riset'
        ? canLoadMoreRiset
        : activeTab === 'kontraktor'
        ? canLoadMoreKontraktor
        : canLoadMorePp;

    if (!canLoadMore) {
      return (
        <View style={footerStyles.container}>
          <Text style={[footerStyles.text, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {totalVisible} item ditampilkan
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (activeTab === 'riset') setRisetPage((p) => p + 1);
          else if (activeTab === 'kontraktor') setKontraktorPage((p) => p + 1);
          else setPpPage((p) => p + 1);
        }}
        style={[footerStyles.loadMore, { backgroundColor: colors.muted, borderColor: colors.border }]}
        activeOpacity={0.75}
      >
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        <Text style={[footerStyles.loadMoreText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          Muat lebih banyak
        </Text>
      </TouchableOpacity>
    );
  };

  // Prepare list data
  const listData =
    activeTab === 'riset'
      ? risetVisible
      : activeTab === 'kontraktor'
      ? kontraktorVisible
      : ppVisible;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Offline banner (Task #20) */}
      {!isOnline && (
        <View style={[offlineBannerStyles.bar, { backgroundColor: '#f59e0b' }]}>
          <Feather name="wifi-off" size={13} color="#fff" />
          <Text style={[offlineBannerStyles.text, { fontFamily: 'Inter_600SemiBold' }]}>
            Mode Offline — menampilkan data terakhir yang tersimpan di perangkat
          </Text>
        </View>
      )}

      {/* Header area */}
      <View style={[styles.topArea, { paddingTop: topInset + 8, backgroundColor: colors.background }]}>
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Cari Data
          </Text>
          {isLoading && isOnline ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          {!isOnline && (
            <View style={[offlineBannerStyles.pill, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
              <Feather name="cloud-off" size={11} color="#d97706" />
              <Text style={[offlineBannerStyles.pillText, { color: '#d97706', fontFamily: 'Inter_600SemiBold' }]}>
                OFFLINE
              </Text>
            </View>
          )}
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setRisetPage(1);
              setKontraktorPage(1);
              setPpPage(1);
            }}
            placeholder={
              activeTab === 'riset'
                ? 'Cari judul, ringkasan, sumber…'
                : activeTab === 'kontraktor'
                ? 'Cari nama perusahaan…'
                : 'Cari deskripsi, domain…'
            }
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {TABS.map(({ key, label, icon }) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleTabChange(key)}
                style={[
                  styles.tabBtn,
                  {
                    borderBottomWidth: active ? 2 : 0,
                    borderBottomColor: active ? colors.primary : 'transparent',
                  },
                ]}
                activeOpacity={0.75}
              >
                <Feather
                  name={icon as any}
                  size={14}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: active ? colors.primary : colors.mutedForeground,
                      fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Intel Context Strip */}
      <View style={[intelStyles.strip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
        <View style={intelStyles.row}>
          {[
            { icon: 'target' as const, text: 'SBU Expiry = pipeline jasa Rp 3–15jt/klien', color: '#2563eb' },
            { icon: 'zap' as const, text: 'TKDN ≥40% wajib semua tender APBN 2026', color: '#7c3aed' },
            { icon: 'shield' as const, text: 'SMAP ISO 37001 wajib per LPJK 2025', color: '#059669' },
          ].map((tip, i) => (
            <View key={i} style={intelStyles.item}>
              <Feather name={tip.icon} size={11} color={tip.color} />
              <Text style={[intelStyles.text, { color: '#1e3a5f', fontFamily: 'Inter_400Regular' }]}>{tip.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick stats row */}
      {!isOnline ? null : (
        <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'Riset', val: filteredRiset.length, icon: 'book-open' as const, color: colors.primary },
            { label: 'Kontraktor', val: filteredKontraktor.length, icon: 'briefcase' as const, color: '#7c3aed' },
            { label: 'Pain Points', val: filteredPainPoints.length, icon: 'alert-circle' as const, color: '#dc2626' },
            { label: 'High Priority', val: filteredPainPoints.filter((p) => p.priority === 'HIGH' || p.priority === 'CRITICAL').length, icon: 'zap' as const, color: '#d97706' },
          ].map((s, i, arr) => (
            <View
              key={s.label}
              style={[
                styles.statsStripCell,
                { borderColor: colors.border },
                i < arr.length - 1 ? styles.statsStripCellBorder : {},
              ]}
            >
              <Feather name={s.icon} size={11} color={s.color} />
              <Text style={[styles.statsStripVal, { color: s.color, fontFamily: 'Inter_700Bold' }]}>
                {s.val}
              </Text>
              <Text style={[styles.statsStripLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Filter chips row */}
      <View style={[styles.filterArea, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {activeTab === 'riset' && (
          <FilterChips options={RISET_CATEGORIES} value={risetCategory} onSelect={setRisetCategory} />
        )}
        {activeTab === 'kontraktor' && (
          <View style={{ gap: 6 }}>
            <FilterChips options={CONTRACTOR_SBU} value={kontraktorsbuLevel} onSelect={setKontraktorSbuLevel} />
            <FilterChips options={CONTRACTOR_PROVINCES} value={kontraktorProvince} onSelect={setKontraktorProvince} />
          </View>
        )}
        {activeTab === 'painpoint' && (
          <View style={{ gap: 6 }}>
            <FilterChips options={PAIN_SEGMENTS} value={ppSegment} onSelect={setPpSegment} />
            <FilterChips options={PAIN_PRIORITIES} value={ppPriority} onSelect={setPpPriority} />
          </View>
        )}
      </View>

      {/* Search Intelligence Summary */}
      {listData.length > 0 && (
        <View style={[srchStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[srchStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            INTEL RINGKAS — {listData.length} HASIL DITEMUKAN
          </Text>
          <View style={srchStyles.pills}>
            {activeTab === 'riset' && [
              { label: 'PENDING Review', val: (listData as any[]).filter((r: any) => r.status === 'PENDING').length, color: '#d97706' },
              { label: 'Prioritas TINGGI', val: (listData as any[]).filter((r: any) => r.priority === 'HIGH').length, color: '#dc2626' },
              { label: 'Ada URL Sumber', val: (listData as any[]).filter((r: any) => r.sourceUrl).length, color: '#2563eb' },
            ].map(p => (
              <View key={p.label} style={[srchStyles.pill, { borderColor: p.color + '40' }]}>
                <Text style={[srchStyles.pillVal, { color: p.color, fontFamily: 'Inter_700Bold' }]}>{p.val}</Text>
                <Text style={[srchStyles.pillLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{p.label}</Text>
              </View>
            ))}
            {activeTab === 'kontraktor' && [
              { label: 'SBU Menengah', val: (listData as any[]).filter((c: any) => c.sbuLevel === 'MENENGAH').length, color: '#7c3aed' },
              { label: 'SBU Besar', val: (listData as any[]).filter((c: any) => c.sbuLevel === 'BESAR').length, color: '#059669' },
              { label: 'Tersedia Kontak', val: (listData as any[]).filter((c: any) => c.phone).length, color: '#2563eb' },
            ].map(p => (
              <View key={p.label} style={[srchStyles.pill, { borderColor: p.color + '40' }]}>
                <Text style={[srchStyles.pillVal, { color: p.color, fontFamily: 'Inter_700Bold' }]}>{p.val}</Text>
                <Text style={[srchStyles.pillLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{p.label}</Text>
              </View>
            ))}
            {activeTab === 'painpoint' && [
              { label: 'Score ≥ 8', val: (listData as any[]).filter((p: any) => (p.painScore ?? 0) >= 8).length, color: '#dc2626' },
              { label: 'Ada Peluang', val: (listData as any[]).filter((p: any) => p.serviceOpportunity).length, color: '#059669' },
              { label: 'Ada Foto Bukti', val: (listData as any[]).filter((p: any) => p.evidencePhotoUrl).length, color: '#7c3aed' },
            ].map(p => (
              <View key={p.label} style={[srchStyles.pill, { borderColor: p.color + '40' }]}>
                <Text style={[srchStyles.pillVal, { color: p.color, fontFamily: 'Inter_700Bold' }]}>{p.val}</Text>
                <Text style={[srchStyles.pillLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Search Quality Strip */}
      {query.trim().length > 0 && (
        <View style={sqStyles.strip}>
          <Text style={[sqStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
            HASIL PENCARIAN — {query.trim().toUpperCase()}
          </Text>
          <View style={sqStyles.row}>
            {[
              { label: 'Ditemukan', val: String(listData.length), color: colors.primary },
              { label: 'Tab Aktif', val: activeTab.toUpperCase(), color: '#7c3aed' },
              { label: 'Relevansi', val: listData.length > 0 ? 'Tinggi' : 'Tidak Ada', color: listData.length > 0 ? '#16a34a' : '#dc2626' },
            ].map((p) => (
              <View key={p.label} style={[sqStyles.pill, { borderColor: p.color + '44', backgroundColor: p.color + '11' }]}>
                <Text style={[sqStyles.val, { color: p.color, fontFamily: 'Inter_700Bold' }]}>{p.val}</Text>
                <Text style={[sqStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Category Counts Strip */}
      {isOnline && (
        <View style={ccsStyles.strip}>
          <Text style={[ccsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
            DATABASE STATS
          </Text>
          <View style={ccsStyles.row}>
            {[
              { label: 'Riset', val: effectiveRiset.length, color: colors.primary },
              { label: 'Kontraktor', val: effectiveKontraktor.length, color: '#7c3aed' },
              { label: 'Pain Points', val: effectivePainPoints.length, color: '#dc2626' },
            ].map((s) => (
              <View key={s.label} style={[ccsStyles.cell, { borderColor: s.color + '33', backgroundColor: s.color + '11' }]}>
                <Text style={[ccsStyles.val, { color: s.color, fontFamily: 'Inter_700Bold' }]}>{s.val}</Text>
                <Text style={[ccsStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Search Relevance Strip */}
      {query.length > 0 && (
        <View style={[srsStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[srsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>RELEVANSI PENCARIAN</Text>
          <View style={srsStyles.cols}>
            {[
              { label: 'Hasil Ditemukan', val: listData.length, c: '#6366f1' },
              { label: 'Tipe Aktif', val: activeTab === 'riset' ? 'Riset' : activeTab === 'kontraktor' ? 'Kontraktor' : 'Pain Point', c: '#10b981' },
              { label: 'Kata Kunci', val: `"${query.slice(0, 12)}${query.length > 12 ? '…' : ''}"`, c: '#f59e0b' },
              { label: 'Sumber', val: isOnline ? 'Server' : 'Cache', c: isOnline ? '#10b981' : '#ef4444' },
            ].map((m) => (
              <View key={m.label} style={[srsStyles.col, { borderColor: colors.border }]}>
                <Text style={[srsStyles.val, { color: m.c, fontFamily: 'Inter_700Bold' }]}>{m.val}</Text>
                <Text style={[srsStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Result Quality Index Strip */}
      <View style={[rqiStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[rqiStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>RESULT QUALITY INDEX</Text>
        <View style={rqiStyles.rows}>
          {[
            { label: 'Dengan Foto Bukti', pct: Math.round((listData.filter((i: any) => i.evidencePhotoUrl).length / Math.max(1, listData.length)) * 100), c: '#10b981' },
            { label: 'Data Terverifikasi', pct: Math.round((listData.filter((i: any) => i.verified || i.isVerified).length / Math.max(1, listData.length)) * 100), c: '#3b82f6' },
            { label: 'Update Bulan Ini', pct: Math.round((listData.filter((i: any) => { try { return new Date(i.updatedAt || i.createdAt) > new Date(Date.now() - 30*86400000); } catch { return false; } }).length / Math.max(1, listData.length)) * 100), c: '#8b5cf6' },
          ].map(r => (
            <View key={r.label} style={rqiStyles.row}>
              <Text style={[rqiStyles.lbl, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{r.label}</Text>
              <View style={rqiStyles.barWrap}>
                <View style={[rqiStyles.bar, { width: `${r.pct}%`, backgroundColor: r.c }]} />
              </View>
              <Text style={[rqiStyles.val, { color: r.c, fontFamily: 'Inter_700Bold' }]}>{r.pct}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={listData as any[]}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState query={query} loading={isLoading} />}
        ListFooterComponent={listData.length > 0 ? renderFooter : null}
        renderItem={({ item }) => {
          if (activeTab === 'riset') {
            return <RisetCard item={item as ResearchItem} onPress={() => openRisetDetail(item as ResearchItem)} />;
          }
          if (activeTab === 'kontraktor') {
            const c = item as Contractor;
            return (
              <ContractorCard
                item={c}
                onPress={() => openKontraktorDetail(c)}
                outreachStatus={getStatus(c.id)}
                onChangeStatus={(s) => setStatus(c.id, s)}
              />
            );
          }
          return <PainPointCard item={item as PainPoint} onPress={() => openPainPointDetail(item as PainPoint)} />;
        }}
      />

      {/* Detail Modal */}
      {detailItem ? (
        <DetailModal
          visible={!!detailItem}
          title={detailItem.title}
          rows={detailItem.rows}
          photoUrl={detailItem.photoUrl}
          workroomUrl={detailItem.workroomUrl}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </View>
  );
}

// ─── Intel strip styles ─────────────────────────────────────────────────────────
// (appended to the existing styles const below, but using a separate object for clarity)

const intelStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  row: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { fontSize: 10, lineHeight: 14, flex: 1 },
});

const offlineBannerStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: { fontSize: 12, lineHeight: 17, color: '#fff', flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, lineHeight: 14 },
});

const footerStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20 },
  text: { fontSize: 12, lineHeight: 16 },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    marginVertical: 16,
  },
  loadMoreText: { fontSize: 13, lineHeight: 18 },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topArea: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    gap: 8,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    height: 42,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 0,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statsStripCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  statsStripCellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  statsStripVal: {
    fontSize: 15,
    lineHeight: 20,
  },
  statsStripLabel: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  filterArea: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
});

const srchStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flex: 1,
    minWidth: 70,
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
    gap: 1,
  },
  pillVal: {
    fontSize: 15,
    lineHeight: 20,
  },
  pillLabel: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
});

const sqStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
    gap: 1,
  },
  val: {
    fontSize: 13,
    lineHeight: 18,
  },
  lbl: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
});

const ccsStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: { fontSize: 9, lineHeight: 13, letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  val: { fontSize: 18, lineHeight: 24 },
  lbl: { fontSize: 9, lineHeight: 12, textAlign: 'center' },
});

const srsStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: { fontSize: 9, lineHeight: 13, letterSpacing: 0.8 },
  cols: { flexDirection: 'row', gap: 6 },
  col: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 7,
    alignItems: 'center',
    gap: 2,
  },
  val: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  lbl: { fontSize: 8, lineHeight: 11, textAlign: 'center' },
});

const rqiStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 10 },
  title: { fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  rows: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lbl: { fontSize: 10, lineHeight: 14, width: 110 },
  barWrap: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  val: { fontSize: 10, lineHeight: 14, width: 32, textAlign: 'right' },
});
