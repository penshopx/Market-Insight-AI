import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useGetDashboardSummary,
  useGetExpiringCertifications,
  useGetTrendingTopics,
  useListContractors,
  useListResearchItems,
} from '@workspace/api-client-react';
import type { Contractor, ResearchItem } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { loadCache, saveCache, useIsOnline } from '@/utils/offlineCache';
import { StatCard } from '@/components/StatCard';
import { CertAlert } from '@/components/CertAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ContractorCard,
  RisetCard,
} from '@/components/SearchCards';
import { setPendingDeepLinkItem } from '@/store/deepLinkStore';

// Dashboard-specific cache keys — separate from Search tab's full-dataset cache keys
// so a 5-item home fetch never truncates the Search offline cache.
const DASHBOARD_CACHE_KEYS = {
  riset: 'offline_cache_dashboard_riset_v1',
  kontraktor: 'offline_cache_dashboard_kontraktor_v1',
} as const;

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching: summaryRefetching,
  } = useGetDashboardSummary();

  const {
    data: expiring,
    isLoading: expiringLoading,
    refetch: refetchExpiring,
    isRefetching: expiringRefetching,
  } = useGetExpiringCertifications();

  const {
    data: trending,
    isLoading: trendingLoading,
    refetch: refetchTrending,
  } = useGetTrendingTopics({ limit: 5 });

  // ── Offline support for "Baru Ditambahkan" ───────────────────────────────────
  const isOnline = useIsOnline();
  const [cachedRiset, setCachedRiset] = useState<ResearchItem[]>([]);
  const [cachedKontraktor, setCachedKontraktor] = useState<Contractor[]>([]);

  // Load caches on mount so offline view is ready immediately
  useEffect(() => {
    loadCache<ResearchItem[]>(DASHBOARD_CACHE_KEYS.riset).then((d) => d && setCachedRiset(d));
    loadCache<Contractor[]>(DASHBOARD_CACHE_KEYS.kontraktor).then((d) => d && setCachedKontraktor(d));
  }, []);

  // Latest 5 riset & kontraktor for "Baru Ditambahkan" section
  const {
    data: latestRiset,
    isLoading: latestRisetLoading,
    isRefetching: latestRisetRefetching,
    refetch: refetchLatestRiset,
  } = useListResearchItems({ limit: 5 });

  const {
    data: latestKontraktorAll,
    isLoading: latestKontraktorLoading,
    isRefetching: latestKontraktorRefetching,
    refetch: refetchLatestKontraktor,
  } = useListContractors();

  // Persist only after a confirmed online fetch — never renew TTL from cached data
  useEffect(() => {
    if (isOnline && latestRiset && latestRiset.length > 0) {
      setCachedRiset(latestRiset);
      saveCache(DASHBOARD_CACHE_KEYS.riset, latestRiset);
    }
  }, [isOnline, latestRiset]);

  useEffect(() => {
    if (isOnline && latestKontraktorAll && latestKontraktorAll.length > 0) {
      const top5 = latestKontraktorAll.slice(0, 5);
      setCachedKontraktor(top5);
      saveCache(DASHBOARD_CACHE_KEYS.kontraktor, top5);
    }
  }, [isOnline, latestKontraktorAll]);

  // When offline, fall back to cached items (last 5)
  const displayRiset: ResearchItem[] = isOnline
    ? (latestRiset ?? cachedRiset).slice(0, 5)
    : cachedRiset.slice(0, 5);
  const displayKontraktor: Contractor[] = isOnline
    ? (latestKontraktorAll ?? cachedKontraktor).slice(0, 5)
    : cachedKontraktor.slice(0, 5);

  // Count items added today for the "Baru Ditambahkan" badge (Task #57)
  const todayDateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const newTodayCount =
    displayRiset.filter((item: ResearchItem) => item.createdAt?.slice(0, 10) === todayDateStr).length +
    displayKontraktor.filter((item: Contractor) => item.createdAt?.slice(0, 10) === todayDateStr).length;

  const isRefreshing = summaryRefetching || expiringRefetching || latestRisetRefetching || latestKontraktorRefetching;

  const handleRefresh = () => {
    refetchSummary();
    refetchExpiring();
    refetchTrending();
    refetchLatestRiset();
    refetchLatestKontraktor();
  };

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const topExpiring = (expiring ?? []).filter((c) => c.daysLeft <= 30).slice(0, 4);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topInset + 8,
          paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {today}
          </Text>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Dashboard Riset
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Feather name="zap" size={16} color={colors.primaryForeground} />
        </View>
      </View>

      {/* Daily Ops Pulse */}
      <View style={opsStyles.strip}>
        <Text style={[opsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          DAILY OPS PULSE
        </Text>
        <View style={opsStyles.row}>
          {[
            { icon: 'activity', label: 'Scheduler', val: 'ON', bg: '#dcfce7', tc: '#16a34a' },
            { icon: 'bell', label: 'Alert Hari Ini', val: String(summary?.criticalPainPoints ?? '—'), bg: '#fef2f2', tc: '#dc2626' },
            { icon: 'download', label: 'Riset Masuk', val: String(summary?.todayCollected ?? '0'), bg: '#eff6ff', tc: '#2563eb' },
            { icon: 'users', label: 'Tim Aktif', val: '3', bg: '#f5f3ff', tc: '#7c3aed' },
          ].map((p) => (
            <View key={p.label} style={[opsStyles.pill, { backgroundColor: p.bg, borderColor: p.tc + '44' }]}>
              <Feather name={p.icon as any} size={11} color={p.tc} />
              <Text style={[opsStyles.pillVal, { color: p.tc, fontFamily: 'Inter_700Bold' }]}>{p.val}</Text>
              <Text style={[opsStyles.pillLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          STATISTIK HARI INI
        </Text>
        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Riset"
              value={summary?.totalResearchItems ?? 0}
              accent
              icon={<Feather name="database" size={18} color={summary ? '#000033' : colors.primary} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
            <StatCard
              label="Perlu Review"
              value={summary?.pendingReview ?? 0}
              warning={(summary?.pendingReview ?? 0) > 0}
              icon={<Feather name="eye" size={18} color={colors.mutedForeground} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
            <StatCard
              label="Kontraktor"
              value={summary?.totalContractors ?? 0}
              icon={<Feather name="briefcase" size={18} color={colors.mutedForeground} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
            <StatCard
              label="SKK Holders"
              value={summary?.totalSkkHolders ?? 0}
              icon={<Feather name="award" size={18} color={colors.mutedForeground} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
            <StatCard
              label="Pain Points Kritis"
              value={summary?.criticalPainPoints ?? 0}
              warning={(summary?.criticalPainPoints ?? 0) > 0}
              icon={<Feather name="alert-triangle" size={18} color={colors.mutedForeground} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
            <StatCard
              label="Tender Terbuka"
              value={summary?.openTenders ?? 0}
              icon={<Feather name="file-text" size={18} color={colors.mutedForeground} />}
              onPress={() => router.push('/(tabs)/cari')}
            />
          </View>
        )}
      </View>

      {/* Expiring Certifications */}
      {topExpiring.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              SERTIFIKASI HAMPIR EXPIRE
            </Text>
            <View style={[styles.countBadge, { backgroundColor: colors.destructive }]}>
              <Text style={[styles.countText, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>
                {topExpiring.length}
              </Text>
            </View>
          </View>
          <View style={styles.certList}>
            {expiringLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              topExpiring.map((cert, i) => (
                <CertAlert key={`${cert.holderName}-${i}`} cert={cert} compact />
              ))
            )}
          </View>
        </View>
      ) : null}

      {/* Field Intelligence Quick Bar */}
      <View style={[styles.section]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          FIELD INTELLIGENCE — SINYAL HARI INI
        </Text>
        <View style={[styles.fieldIntelGrid, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {[
            { icon: 'trending-up' as const, label: 'APBN Infrastruktur 2026', val: 'Rp 423T', sub: '+12% vs 2025', accent: '#059669' },
            { icon: 'shield' as const, label: 'BUJK Wajib SMAP', val: '200K+', sub: 'peluang layanan', accent: '#7c3aed' },
            { icon: 'award' as const, label: 'SKK Update Skema', val: '100K+', sub: 'tenaga ahli', accent: '#d97706' },
            { icon: 'file-text' as const, label: 'Target TKDN ≥40%', val: 'Semua', sub: 'tender APBN', accent: '#dc2626' },
          ].map((item, i) => (
            <View
              key={item.label}
              style={[
                styles.fieldIntelCell,
                { borderColor: colors.border },
                i % 2 === 0 ? styles.fieldIntelCellBorder : {},
                i < 2 ? styles.fieldIntelCellBottom : {},
              ]}
            >
              <Feather name={item.icon} size={14} color={item.accent} style={{ marginBottom: 4 }} />
              <Text style={[styles.fieldIntelVal, { color: item.accent, fontFamily: 'Inter_700Bold' }]}>
                {item.val}
              </Text>
              <Text style={[styles.fieldIntelLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                {item.label}
              </Text>
              <Text style={[styles.fieldIntelSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {item.sub}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trending Topics */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          TOPIK TRENDING
        </Text>
        {trendingLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (trending ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="trending-up" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Belum ada data trending
            </Text>
          </View>
        ) : (
          <View style={styles.topicList}>
            {(trending ?? []).map((topic, i) => (
              <View
                key={`${topic.topic}-${i}`}
                style={[styles.topicRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.topicRank, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.rankText, { color: colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>
                    {i + 1}
                  </Text>
                </View>
                <View style={styles.topicBody}>
                  <Text
                    style={[styles.topicName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
                    numberOfLines={1}
                  >
                    {topic.topic}
                  </Text>
                  <Text style={[styles.topicMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {topic.category} · {topic.count} item
                  </Text>
                </View>
                <View style={[styles.trendBadge, { backgroundColor: colors.muted }]}>
                  <Feather
                    name={topic.trend === 'UP' ? 'trending-up' : topic.trend === 'DOWN' ? 'trending-down' : 'minus'}
                    size={14}
                    color={topic.trend === 'UP' ? '#22c55e' : topic.trend === 'DOWN' ? colors.destructive : colors.mutedForeground}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Collected today */}
      {summary ? (
        <View style={[styles.todayRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="download-cloud" size={16} color={colors.primary} />
          <Text style={[styles.todayText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Dikumpulkan hari ini:{' '}
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {summary.todayCollected} item
            </Text>
          </Text>
        </View>
      ) : null}

      {/* Pain Point Alert Strip */}
      {(summary?.criticalPainPoints ?? 0) > 0 && (
        <View style={[styles.alertStrip, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
          <Feather name="alert-triangle" size={14} color="#dc2626" />
          <Text style={[styles.alertText, { color: '#dc2626', fontFamily: 'Inter_600SemiBold' }]}>
            {summary?.criticalPainPoints} pain point KRITIS menunggu tindak lanjut
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/cari')}>
            <Feather name="chevron-right" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      )}

      {/* Market Pulse */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          MARKET PULSE — SINYAL TERKINI
        </Text>
        <View style={[styles.pulseGrid, { borderColor: colors.border }]}>
          {[
            { label: 'SBU/SKK Expiry', val: summary?.expiringCertifications ?? '-', icon: 'shield' as const, urgent: (summary?.expiringCertifications ?? 0) > 0 },
            { label: 'Tender Aktif', val: summary?.openTenders ?? '-', icon: 'file-text' as const, urgent: false },
            { label: 'Data Hari Ini', val: summary?.todayCollected ?? '-', icon: 'download-cloud' as const, urgent: false },
            { label: 'Pain Kritis', val: summary?.criticalPainPoints ?? '-', icon: 'alert-circle' as const, urgent: (summary?.criticalPainPoints ?? 0) > 0 },
          ].map((p, i) => (
            <View key={p.label} style={[styles.pulseCell, i % 2 === 0 ? styles.pulseCellBorder : undefined, { borderColor: colors.border }]}>
              <Feather name={p.icon} size={16} color={p.urgent ? '#dc2626' : colors.primary} />
              <Text style={[styles.pulseVal, { color: p.urgent ? '#dc2626' : colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {p.val}
              </Text>
              <Text style={[styles.pulseLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {p.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Daily Target Tracker */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          TARGET HARIAN — PROGRESS TIM HARI INI
        </Text>
        <View style={[styles.dailyPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'Input Riset', current: summary?.todayCollected ?? 0, target: 5, icon: 'database' as const, color: '#3b82f6' },
            { label: 'Kontraktor', current: Math.min(summary?.totalContractors ?? 0, 3), target: 3, icon: 'briefcase' as const, color: '#059669' },
            { label: 'Pain Points', current: Math.min(summary?.criticalPainPoints ?? 0, 2), target: 2, icon: 'alert-circle' as const, color: '#dc2626' },
            { label: 'Review Data', current: Math.max(0, 5 - (summary?.pendingReview ?? 5)), target: 5, icon: 'check-square' as const, color: '#7c3aed' },
          ].map((item) => {
            const pct = Math.min(100, Math.round((item.current / item.target) * 100));
            const done = item.current >= item.target;
            return (
              <View key={item.label} style={[styles.dailyRow, { borderBottomColor: colors.border }]}>
                <Feather name={item.icon} size={13} color={done ? '#059669' : item.color} />
                <Text style={[styles.dailyLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{item.label}</Text>
                <View style={[styles.dailyBar, { backgroundColor: colors.muted }]}>
                  <View style={[styles.dailyFill, { width: `${pct}%` as any, backgroundColor: done ? '#059669' : item.color }]} />
                </View>
                <Text style={[styles.dailyCount, { color: done ? '#059669' : colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>
                  {item.current}/{item.target}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Revenue Signal Strip */}
      <View style={[styles.section]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          SINYAL REVENUE HARI INI
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { icon: 'shield' as const, label: 'SBU Expiry', val: 'Pipeline aktif', color: '#dc2626', bg: '#fef2f2' },
            { icon: 'zap' as const, label: 'Tender LPSE', val: 'Cek kualifikasi', color: '#d97706', bg: '#fffbeb' },
            { icon: 'award' as const, label: 'SKK Renewal', val: 'Jenjang 7/8/9', color: '#7c3aed', bg: '#f5f3ff' },
            { icon: 'trending-up' as const, label: 'SMAP Wajib', val: 'Per LPJK 2025', color: '#059669', bg: '#f0fdf4' },
          ].map((sig) => (
            <View key={sig.label} style={[revSigStyles.card, { backgroundColor: sig.bg, borderColor: sig.color + '40', flex: 1, minWidth: 120 }]}>
              <Feather name={sig.icon} size={12} color={sig.color} />
              <Text style={[revSigStyles.label, { color: sig.color, fontFamily: 'Inter_700Bold' }]}>{sig.label}</Text>
              <Text style={[revSigStyles.val, { color: '#374151', fontFamily: 'Inter_400Regular' }]}>{sig.val}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Target Today Strip */}
      <View style={tgtStyles.strip}>
        <Text style={[tgtStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          TARGET HARI INI
        </Text>
        <View style={tgtStyles.rows}>
          {[
            { task: '3 riset baru dari lapangan', done: false, icon: 'database' },
            { task: 'Follow-up 2 prospek SBU expiry', done: false, icon: 'phone' },
            { task: 'Update 1 pain point kritis', done: false, icon: 'alert-triangle' },
          ].map((t, i) => (
            <View key={i} style={[tgtStyles.row, { borderColor: colors.border }]}>
              <Feather name={t.icon as any} size={11} color={t.done ? '#16a34a' : colors.primary} />
              <Text style={[tgtStyles.task, { color: t.done ? '#16a34a' : colors.foreground, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>{t.task}</Text>
              {t.done && <Feather name="check-circle" size={11} color="#16a34a" />}
            </View>
          ))}
        </View>
      </View>

      {/* Intel Freshness Strip */}
      <View style={ifStyles.strip}>
        <Text style={[ifStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          INTEL FRESHNESS — Usia Data Terakhir
        </Text>
        <View style={ifStyles.row}>
          {[
            { label: 'Tender', freshness: '< 6 jam', dot: '#16a34a' },
            { label: 'Regulasi', freshness: '< 24 jam', dot: '#2563eb' },
            { label: 'SKK DB', freshness: '2 hari', dot: '#ca8a04' },
            { label: 'Kompetitor', freshness: '3 hari', dot: '#dc2626' },
          ].map((f) => (
            <View key={f.label} style={[ifStyles.cell, { borderColor: colors.border }]}>
              <View style={[ifStyles.dot, { backgroundColor: f.dot }]} />
              <Text style={[ifStyles.lbl, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{f.label}</Text>
              <Text style={[ifStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{f.freshness}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Revenue Alert Pulse */}
      <View style={rapStyles.strip}>
        <Text style={[rapStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          REVENUE ALERT — Peluang Perlu Aksi Sekarang
        </Text>
        <View style={rapStyles.rows}>
          {[
            { label: 'SBU jatuh tempo minggu ini', count: 3, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Tender tutup < 5 hari', count: 2, color: '#ea580c', bg: '#fff7ed' },
            { label: 'Proposal belum dibalas', count: 5, color: '#ca8a04', bg: '#fefce8' },
          ].map((a, i) => (
            <View key={i} style={[rapStyles.row, { backgroundColor: a.bg, borderColor: a.color + '44' }]}>
              <Text style={[rapStyles.label, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>{a.label}</Text>
              <View style={[rapStyles.badge, { backgroundColor: a.color }]}>
                <Text style={[rapStyles.badgeTxt, { fontFamily: 'Inter_700Bold' }]}>{a.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          AKSI CEPAT
        </Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'plus-circle', label: 'Input Riset', sub: 'Tambah temuan baru', route: '/(tabs)/input', color: '#f59e0b' },
            { icon: 'search', label: 'Cari Data', sub: 'Kontraktor & riset', route: '/(tabs)/cari', color: '#3b82f6' },
            { icon: 'bell', label: 'Notifikasi', sub: 'SKK hampir expire', route: '/(tabs)/alerts', color: '#ef4444' },
            { icon: 'edit-3', label: 'Pain Point', sub: 'Catat masalah baru', route: '/(tabs)/input', color: '#8b5cf6' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(action.route as '/(tabs)/input');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: action.color + '1a' }]}>
                <Feather name={action.icon as 'search'} size={18} color={action.color} />
              </View>
              <Text style={[styles.quickLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                {action.label}
              </Text>
              <Text style={[styles.quickSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {action.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Baru Ditambahkan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            BARU DITAMBAHKAN
          </Text>
          {newTodayCount > 0 && (
            <View style={[newlyAddedStyles.newTodayBadge, { backgroundColor: colors.primary }]}>
              <Text style={[newlyAddedStyles.newTodayText, { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }]}>
                {newTodayCount} baru hari ini
              </Text>
            </View>
          )}
          {!isOnline && (
            <View style={[newlyAddedStyles.offlinePill, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
              <Feather name="cloud-off" size={10} color="#d97706" />
              <Text style={[newlyAddedStyles.offlinePillText, { color: '#d97706', fontFamily: 'Inter_600SemiBold' }]}>
                OFFLINE
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/cari'); }}
            style={[newlyAddedStyles.seeAll, { backgroundColor: colors.muted }]}
          >
            <Text style={[newlyAddedStyles.seeAllText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              Lihat semua
            </Text>
            <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Sub-section: Riset */}
        <View style={newlyAddedStyles.subSection}>
          <View style={newlyAddedStyles.subHeader}>
            <Feather name="book-open" size={12} color={colors.primary} />
            <Text style={[newlyAddedStyles.subLabel, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              Riset Terbaru
            </Text>
          </View>
          {latestRisetLoading && isOnline && displayRiset.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : displayRiset.length === 0 ? (
            <View style={newlyAddedStyles.emptyRow}>
              <Text style={[newlyAddedStyles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Belum ada data riset
              </Text>
            </View>
          ) : (
            <View style={newlyAddedStyles.cardList}>
              {displayRiset.map((item: ResearchItem) => (
                <RisetCard
                  key={String(item.id)}
                  item={item}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPendingDeepLinkItem({ tab: 'riset', item });
                    router.push('/(tabs)/cari');
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Sub-section: Kontraktor */}
        <View style={newlyAddedStyles.subSection}>
          <View style={newlyAddedStyles.subHeader}>
            <Feather name="briefcase" size={12} color="#7c3aed" />
            <Text style={[newlyAddedStyles.subLabel, { color: '#7c3aed', fontFamily: 'Inter_600SemiBold' }]}>
              Kontraktor Terbaru
            </Text>
          </View>
          {latestKontraktorLoading && isOnline && displayKontraktor.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : displayKontraktor.length === 0 ? (
            <View style={newlyAddedStyles.emptyRow}>
              <Text style={[newlyAddedStyles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Belum ada data kontraktor
              </Text>
            </View>
          ) : (
            <View style={newlyAddedStyles.cardList}>
              {displayKontraktor.map((item: Contractor) => (
                <ContractorCard
                  key={String(item.id)}
                  item={item}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPendingDeepLinkItem({ tab: 'kontraktor', item });
                    router.push('/(tabs)/cari');
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Field Coverage Heatmap Strip */}
      <View style={[fchStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[fchStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>FIELD COVERAGE HEATMAP</Text>
        <View style={fchStyles.grid}>
          {[
            { region: 'DKI Jakarta', items: summary?.todayCollected ?? 0 + 120, c: '#10b981' },
            { region: 'Jawa Barat', items: 87, c: '#3b82f6' },
            { region: 'Jawa Tengah', items: 64, c: '#6366f1' },
            { region: 'Jawa Timur', items: 52, c: '#8b5cf6' },
            { region: 'Luar Jawa', items: 28, c: '#f59e0b' },
            { region: 'Kalimantan', items: 11, c: '#ef4444' },
          ].map(r => (
            <View key={r.region} style={fchStyles.cell}>
              <View style={[fchStyles.dot, { backgroundColor: r.c }]} />
              <Text style={[fchStyles.reg, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{r.region}</Text>
              <Text style={[fchStyles.cnt, { color: r.c, fontFamily: 'Inter_700Bold' }]}>{r.items}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Team Performance Pulse */}
      <View style={[tppStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[tppStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>TEAM PERFORMANCE PULSE</Text>
        <View style={tppStyles.cols}>
          {[
            { label: 'Input Hari Ini', val: `${summary?.todayCollected ?? 0} item`, c: '#10b981' },
            { label: 'Target Harian', val: '25 item', c: '#6366f1' },
            { label: 'Streak Tim', val: `${Math.min(7, Math.ceil((summary?.todayCollected ?? 0) / 3))} hari`, c: '#f59e0b' },
            { label: 'Ranking Tim', val: '#2 Minggu ini', c: '#ef4444' },
          ].map((m) => (
            <View key={m.label} style={[tppStyles.col, { borderColor: colors.border }]}>
              <Text style={[tppStyles.val, { color: m.c, fontFamily: 'Inter_700Bold' }]}>{m.val}</Text>
              <Text style={[tppStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Daily Goal Tracker Strip */}
      <View style={[dgtStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[dgtStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>DAILY GOAL TRACKER — TARGET HARI INI</Text>
        <View style={dgtStyles.goals}>
          {[
            { goal: 'Input 25 data baru', done: (summary?.todayCollected ?? 0) >= 25, progress: Math.min(100, Math.round(((summary?.todayCollected ?? 0) / 25) * 100)) },
            { goal: 'Foto bukti ≥ 80%', done: false, progress: 71 },
            { goal: 'Coverage 3+ wilayah', done: true, progress: 100 },
            { goal: 'Kirim laporan harian', done: false, progress: 0 },
          ].map((g, i) => (
            <View key={i} style={dgtStyles.goalRow}>
              <Text style={[dgtStyles.goalCheck, { color: g.done ? '#10b981' : colors.mutedForeground }]}>{g.done ? '✓' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[dgtStyles.goalText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{g.goal}</Text>
                <View style={dgtStyles.barWrap}>
                  <View style={[dgtStyles.bar, { width: `${g.progress}%`, backgroundColor: g.done ? '#10b981' : '#6366f1' }]} />
                </View>
              </View>
              <Text style={[dgtStyles.goalPct, { color: g.done ? '#10b981' : colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>{g.progress}%</Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>

    </>
  );
}
const newlyAddedStyles = StyleSheet.create({
  // Task #57: count badge for items added today
  newTodayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  newTodayText: {
    fontSize: 10,
    lineHeight: 14,
  },
  // Task #55: offline indicator pill
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  offlinePillText: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  seeAllText: {
    fontSize: 11,
    lineHeight: 15,
  },
  subSection: {
    gap: 8,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardList: {
    gap: 8,
  },
  emptyRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    marginTop: 2,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
  },
  countBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 10,
    lineHeight: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  loader: {
    paddingVertical: 20,
  },
  certList: {
    gap: 8,
  },
  topicList: {
    gap: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topicRank: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
  },
  topicBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  topicName: {
    fontSize: 14,
    lineHeight: 20,
  },
  topicMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  trendBadge: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  todayText: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  pulseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pulseCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: 1,
  },
  pulseCellBorder: {
    borderRightWidth: 1,
  },
  pulseVal: {
    fontSize: 24,
    lineHeight: 30,
  },
  pulseLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '47%',
    borderRadius: 6,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  quickSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  dailyPanel: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dailyLabel: {
    width: 76,
    fontSize: 11,
    lineHeight: 15,
  },
  dailyBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyFill: {
    height: '100%',
    borderRadius: 3,
  },
  dailyCount: {
    width: 36,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  fieldIntelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fieldIntelCell: {
    width: '50%',
    padding: 14,
    gap: 2,
  },
  fieldIntelCellBorder: {
    borderRightWidth: 1,
  },
  fieldIntelCellBottom: {
    borderBottomWidth: 1,
  },
  fieldIntelVal: {
    fontSize: 18,
    lineHeight: 24,
  },
  fieldIntelLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  fieldIntelSub: {
    fontSize: 10,
    lineHeight: 14,
  },
});

const revSigStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 3,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  val: {
    fontSize: 10,
    lineHeight: 14,
  },
});

const opsStyles = StyleSheet.create({
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
  pillVal: {
    fontSize: 13,
    lineHeight: 18,
  },
  pillLabel: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
});

const tgtStyles = StyleSheet.create({
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
  rows: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    padding: 7,
    gap: 8,
  },
  task: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});

const ifStyles = StyleSheet.create({
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
  cell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 7,
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lbl: {
    fontSize: 10,
    lineHeight: 14,
  },
  sub: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
});

const rapStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: { fontSize: 9, lineHeight: 13, letterSpacing: 0.8 },
  rows: { gap: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  label: { flex: 1, fontSize: 11, lineHeight: 15 },
  badge: { borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, lineHeight: 16, color: '#fff' },
});

const dgtStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 10 },
  title: { fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  goals: { gap: 7 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalCheck: { fontSize: 14, width: 18, textAlign: 'center' },
  goalText: { fontSize: 10, lineHeight: 13, marginBottom: 3 },
  barWrap: { height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 2 },
  goalPct: { fontSize: 10, lineHeight: 13, width: 32, textAlign: 'right' },
});

const fchStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 10 },
  title: { fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cell: { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reg: { flex: 1, fontSize: 9, lineHeight: 12 },
  cnt: { fontSize: 11, lineHeight: 14 },
});

const tppStyles = StyleSheet.create({
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
  val: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  lbl: { fontSize: 8, lineHeight: 11, textAlign: 'center' },
});

