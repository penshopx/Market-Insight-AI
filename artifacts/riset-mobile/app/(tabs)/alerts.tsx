import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useGetExpiringCertifications } from '@workspace/api-client-react';
import type { ExpiringCertification } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { CertAlert } from '@/components/CertAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function scheduleExpiryNotifications(certs: ExpiringCertification[]) {
  if (Platform.OS === 'web') return;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const urgent = certs.filter((c) => c.daysLeft <= 30);
    for (const cert of urgent) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Sertifikasi Hampir Expire`,
          body: `${cert.holderName} — ${cert.type} expire dalam ${cert.daysLeft} hari (${cert.expiryDate})`,
          data: { certNumber: cert.certNumber },
        },
        trigger: null, // Deliver immediately
      });
    }
  } catch {
    // Notifications not available (e.g. Expo Go web)
  }
}

// ─── Akreditasi Pipeline — Task #138 ─────────────────────────────────────────

interface AkrInst {
  id: string;
  nama: string;
  jenis: 'PT' | 'SMA' | 'SMK';
  kota: string;
  sisaHari: number;
  akreditasiSaat: string;
  badanAkreditasi: string;
}

// Compact version of AKREDITASI_DATA from sinyal-pasar.tsx — most urgent first
const AKREDITASI_DATA: AkrInst[] = [
  { id: 'akr-001', nama: 'Universitas Teknologi Nusantara', jenis: 'PT', kota: 'Bandung', sisaHari: 42, akreditasiSaat: 'B', badanAkreditasi: 'BAN-PT' },
  { id: 'akr-002', nama: 'Institut Teknik Sipil Surabaya', jenis: 'PT', kota: 'Surabaya', sisaHari: 55, akreditasiSaat: 'A', badanAkreditasi: 'BAN-PT' },
  { id: 'akr-003', nama: 'SMK Pembangunan Nasional Jakarta', jenis: 'SMK', kota: 'Jakarta', sisaHari: 28, akreditasiSaat: 'B', badanAkreditasi: 'BAN S/M' },
  { id: 'akr-004', nama: 'SMA Teknologi Maju Semarang', jenis: 'SMA', kota: 'Semarang', sisaHari: 67, akreditasiSaat: 'C', badanAkreditasi: 'BAN S/M' },
  { id: 'akr-005', nama: 'SMK Konstruksi Bina Karya', jenis: 'SMK', kota: 'Yogyakarta', sisaHari: 85, akreditasiSaat: 'B', badanAkreditasi: 'BAN S/M' },
  { id: 'akr-006', nama: 'Universitas Infrastruktur Indonesia', jenis: 'PT', kota: 'Medan', sisaHari: 96, akreditasiSaat: 'B', badanAkreditasi: 'BAN-PT' },
  { id: 'akr-007', nama: 'SMK Teknik Sipil Makassar', jenis: 'SMK', kota: 'Makassar', sisaHari: 110, akreditasiSaat: 'A', badanAkreditasi: 'BAN S/M' },
  { id: 'akr-008', nama: 'SMA Bina Prestasi Depok', jenis: 'SMA', kota: 'Depok', sisaHari: 125, akreditasiSaat: 'B', badanAkreditasi: 'BAN S/M' },
  { id: 'akr-009', nama: 'Institut Polyteknik Konstruksi', jenis: 'PT', kota: 'Palembang', sisaHari: 148, akreditasiSaat: 'C', badanAkreditasi: 'BAN-PT' },
  { id: 'akr-010', nama: 'SMK Karya Bangsa Tangerang', jenis: 'SMK', kota: 'Tangerang', sisaHari: 160, akreditasiSaat: 'B', badanAkreditasi: 'BAN S/M' },
];

const AKR_CONTACTED_KEY = 'mkp-akr-mobile-contacted-v1';

function urgencyColor(sisa: number): { bg: string; text: string; label: string } {
  if (sisa <= 60)  return { bg: '#fef2f2', text: '#b91c1c', label: 'MENDESAK' };
  if (sisa <= 90)  return { bg: '#fff7ed', text: '#c2410c', label: 'SEGERA' };
  if (sisa <= 120) return { bg: '#fefce8', text: '#854d0e', label: '3 BULAN' };
  return               { bg: '#f1f5f9', text: '#475569', label: '6 BULAN' };
}

function AkreditasiPanel() {
  const colors = useColors();
  const sorted = [...AKREDITASI_DATA].sort((a, b) => a.sisaHari - b.sisaHari);

  const [contacted, setContacted] = useState<Record<string, string>>({});
  useEffect(() => {
    AsyncStorage.getItem(AKR_CONTACTED_KEY)
      .then((raw) => { if (raw) { try { setContacted(JSON.parse(raw)); } catch {} } })
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setContacted((prev) => {
      const next = prev[id] ? { ...prev } : { ...prev, [id]: new Date().toISOString() };
      if (prev[id]) delete next[id];
      AsyncStorage.setItem(AKR_CONTACTED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const mendesak = sorted.filter((i) => i.sisaHari <= 60).length;
  const segera   = sorted.filter((i) => i.sisaHari > 60 && i.sisaHari <= 90).length;

  const webBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/konstruksi-riset`
    : null;

  const handleWa = (inst: AkrInst) => {
    const msg = `*Halo Bapak/Ibu,*\n\nKami dari PT Maheswara Jaya Persada ingin menyampaikan bahwa masa akreditasi *${inst.nama}* akan berakhir dalam *${inst.sisaHari} hari*.\n\nKami siap membantu pemenuhan standar sarana sebelum asesor ${inst.badanAkreditasi} tiba — survei kondisi sarana gratis sebagai langkah awal.\n\n📞 +62 821-2295-3749\n✉️ info@intel-konstruksi.id\n\n— Tim Riset Marketing PT Maheswara Jaya Persada`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('Gagal membuka WhatsApp'));
  };

  return (
    <View style={[akrStyles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={akrStyles.headerRow}>
        <Feather name="award" size={13} color="#7c3aed" />
        <Text style={[akrStyles.headerTitle, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          RADAR AKREDITASI — Pipeline Segmen Pendidikan
        </Text>
      </View>
      <Text style={[akrStyles.headerSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        Institusi dengan akreditasi berakhir dalam 6 bulan — prospek terpanas di segmen pendidikan
      </Text>

      {/* Stats row */}
      <View style={akrStyles.statsRow}>
        {[
          { label: '≤60 hr Mendesak', val: mendesak, bg: '#fef2f2', tc: '#b91c1c' },
          { label: '≤90 hr Segera',   val: segera,   bg: '#fff7ed', tc: '#c2410c' },
          { label: 'Total Monitor',   val: sorted.length, bg: '#eff6ff', tc: '#1d4ed8' },
          { label: 'Sudah Dihubungi', val: Object.keys(contacted).length, bg: '#f0fdf4', tc: '#166534' },
        ].map((s) => (
          <View key={s.label} style={[akrStyles.statCell, { backgroundColor: s.bg }]}>
            <Text style={[akrStyles.statVal, { color: s.tc, fontFamily: 'Inter_700Bold' }]}>{s.val}</Text>
            <Text style={[akrStyles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Prospect list */}
      {sorted.map((inst) => {
        const urg = urgencyColor(inst.sisaHari);
        const isDone = !!contacted[inst.id];
        return (
          <View key={inst.id} style={[akrStyles.row, { borderColor: colors.border, backgroundColor: isDone ? '#f0fdf4' : undefined }]}>
            <View style={akrStyles.rowLeft}>
              <View style={[akrStyles.urgBadge, { backgroundColor: urg.bg }]}>
                <Text style={[akrStyles.urgText, { color: urg.text, fontFamily: 'Inter_700Bold' }]}>
                  {inst.sisaHari}h · {urg.label}
                </Text>
              </View>
              <Text style={[akrStyles.instName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                {inst.nama}
              </Text>
              <Text style={[akrStyles.instMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {inst.jenis} · {inst.kota} · {inst.badanAkreditasi} · Akr. {inst.akreditasiSaat}
              </Text>
            </View>
            <View style={akrStyles.rowRight}>
              <TouchableOpacity
                onPress={() => handleWa(inst)}
                style={[akrStyles.waBtn, { backgroundColor: '#dcfce7' }]}
                activeOpacity={0.7}
              >
                <Feather name="message-circle" size={12} color="#16a34a" />
              </TouchableOpacity>
              {/* #155 — pre-fill Surat Penawaran from mobile prospect list */}
              {webBase ? (
                <TouchableOpacity
                  onPress={() => {
                    const params = new URLSearchParams({
                      nama: inst.nama,
                      kota: inst.kota,
                      jenis: inst.jenis,
                      akr: inst.akreditasiSaat,
                      badan: inst.badanAkreditasi,
                      sisa: String(inst.sisaHari),
                    });
                    Linking.openURL(`${webBase}/surat-penawaran?${params.toString()}`).catch(() => {});
                  }}
                  style={[akrStyles.waBtn, { backgroundColor: '#dbeafe' }]}
                  activeOpacity={0.7}
                >
                  <Feather name="file-text" size={12} color="#1d4ed8" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => toggle(inst.id)}
                style={[akrStyles.doneBtn, { backgroundColor: isDone ? '#d1fae5' : colors.muted, borderColor: isDone ? '#6ee7b7' : colors.border }]}
                activeOpacity={0.7}
              >
                <Feather name="check" size={12} color={isDone ? '#065f46' : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Link to full web view */}
      {webBase ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(`${webBase}/sinyal-pasar`).catch(() => {})}
          style={[akrStyles.webLink, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="external-link" size={11} color={colors.mutedForeground} />
          <Text style={[akrStyles.webLinkText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Lihat radar lengkap di platform web
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const akrStyles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 6, padding: 12, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 10, lineHeight: 14, letterSpacing: 0.5, flex: 1 },
  headerSub: { fontSize: 11, lineHeight: 15 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statCell: { flex: 1, minWidth: 72, borderRadius: 4, padding: 8, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 18, lineHeight: 22 },
  statLabel: { fontSize: 9, lineHeight: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, padding: 8 },
  rowLeft: { flex: 1, gap: 3 },
  rowRight: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 2 },
  urgBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  urgText: { fontSize: 9, lineHeight: 13 },
  instName: { fontSize: 13, lineHeight: 18 },
  instMeta: { fontSize: 10, lineHeight: 14 },
  waBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  doneBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 2 },
  webLinkText: { fontSize: 11, lineHeight: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const notifiedRef = useRef(false);

  const {
    data: certifications,
    isLoading,
    refetch,
    isRefetching,
    isError,
  } = useGetExpiringCertifications();

  useEffect(() => {
    if (certifications && certifications.length > 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      scheduleExpiryNotifications(certifications);
    }
  }, [certifications]);

  const urgent = (certifications ?? []).filter((c) => c.daysLeft <= 7);
  const warning = (certifications ?? []).filter((c) => c.daysLeft > 7 && c.daysLeft <= 14);
  const notice = (certifications ?? []).filter((c) => c.daysLeft > 14 && c.daysLeft <= 30);
  const allCerts = (certifications ?? []).filter((c) => c.daysLeft <= 30);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;

  return (
    <FlatList<ExpiringCertification>
      data={allCerts}
      keyExtractor={(item, i) => `${item.holderName}-${i}`}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 8, paddingBottom: bottomInset },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
      scrollEnabled={allCerts.length > 0}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              Notifikasi
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Sertifikasi expire dalam 30 hari
            </Text>
          </View>

          {/* Cert Lifecycle Intel */}
          {!isLoading && allCerts.length > 0 && (
            <View style={certStyles.strip}>
              <Text style={[certStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                SERTIFIKASI LIFECYCLE INTEL
              </Text>
              <View style={certStyles.row}>
                {[
                  { label: 'Kritis ≤7hr', val: urgent.length, bg: '#fef2f2', tc: '#dc2626' },
                  { label: 'Perhatian ≤14hr', val: warning.length, bg: '#fff7ed', tc: '#ea580c' },
                  { label: 'Aman', val: allCerts.length - urgent.length - warning.length, bg: '#f0fdf4', tc: '#16a34a' },
                  { label: 'Total Monitor', val: allCerts.length, bg: '#eff6ff', tc: '#2563eb' },
                ].map((m) => (
                  <View key={m.label} style={[certStyles.cell, { backgroundColor: m.bg, borderColor: m.tc + '44' }]}>
                    <Text style={[certStyles.val, { color: m.tc, fontFamily: 'Inter_700Bold' }]}>{m.val}</Text>
                    <Text style={[certStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Summary row */}
          {!isLoading && allCerts.length > 0 && (
            <View style={styles.summaryRow}>
              {urgent.length > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: '#fef2f2', borderColor: colors.destructive }]}>
                  <Feather name="alert-circle" size={12} color={colors.destructive} />
                  <Text style={[styles.summaryText, { color: colors.destructive, fontFamily: 'Inter_600SemiBold' }]}>
                    {urgent.length} kritis (≤7h)
                  </Text>
                </View>
              )}
              {warning.length > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: '#fff7ed', borderColor: '#f97316' }]}>
                  <Feather name="clock" size={12} color="#f97316" />
                  <Text style={[styles.summaryText, { color: '#f97316', fontFamily: 'Inter_600SemiBold' }]}>
                    {warning.length} perhatian (≤14h)
                  </Text>
                </View>
              )}
              {notice.length > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: '#fefce8', borderColor: '#eab308' }]}>
                  <Feather name="bell" size={12} color="#eab308" />
                  <Text style={[styles.summaryText, { color: '#eab308', fontFamily: 'Inter_600SemiBold' }]}>
                    {notice.length} segera (≤30h)
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Action buttons strip */}
          {!isLoading && allCerts.length > 0 && (
            <View style={[styles.actionStrip, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.actionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                TINDAKAN CEPAT
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
                  onPress={() => {
                    const msgParts = allCerts.slice(0, 5).map(c => `• ${c.holderName} — ${c.type} (${c.daysLeft}h)`);
                    const msg = `⚠️ *Reminder Sertifikasi Konstruksi*\n\nBerikut sertifikasi yang segera expire:\n\n${msgParts.join('\n')}\n\n_Segera proses perpanjangan!_\n_PT Maheswara Jaya Persada_`;
                    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    if (typeof window !== 'undefined') window.open(url, '_blank');
                  }}
                >
                  <Feather name="message-circle" size={14} color="#16a34a" />
                  <Text style={[styles.actionBtnText, { color: '#16a34a', fontFamily: 'Inter_600SemiBold' }]}>
                    WA Blast {allCerts.length} Sertif
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}
                  onPress={() => {
                    const urgent2 = allCerts.filter(c => c.daysLeft <= 7);
                    const msg = urgent2.length > 0
                      ? `🚨 ${urgent2.length} sertifikasi KRITIS (≤7 hari): ${urgent2.slice(0, 3).map(c => c.holderName).join(', ')}`
                      : `${allCerts.length} sertifikasi perlu diperbarui dalam 30 hari`;
                    if (typeof window !== 'undefined') alert(msg);
                  }}
                >
                  <Feather name="bell" size={14} color="#d97706" />
                  <Text style={[styles.actionBtnText, { color: '#d97706', fontFamily: 'Inter_600SemiBold' }]}>
                    Lihat Kritis
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Renewal Cost Estimator */}
          {!isLoading && allCerts.length > 0 && (
            <View style={[styles.costPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.costTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                💰 ESTIMASI BIAYA PERPANJANGAN
              </Text>
              <View style={styles.costGrid}>
                {[
                  { type: 'SBU Kecil', range: 'Rp 1.5–4jt', icon: '🏗️' },
                  { type: 'SBU Menengah', range: 'Rp 4–10jt', icon: '🏢' },
                  { type: 'SKK Jenjang 7', range: 'Rp 2.7–5.5jt', icon: '📋' },
                  { type: 'SKK Jenjang 9', range: 'Rp 5–8.5jt', icon: '🎓' },
                  { type: 'Paket SMAP', range: 'Rp 3.5–8jt', icon: '🛡️' },
                  { type: 'ISO 9001 + K3', range: 'Rp 12–25jt', icon: '✅' },
                ].map(c => (
                  <View key={c.type} style={[styles.costCell, { borderColor: colors.border }]}>
                    <Text style={styles.costIcon}>{c.icon}</Text>
                    <Text style={[styles.costType, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                      {c.type}
                    </Text>
                    <Text style={[styles.costRange, { color: '#059669', fontFamily: 'Inter_700Bold' }]}>
                      {c.range}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.costNote, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Estimasi harga layanan PT Maheswara Jaya Persada · Hubungi untuk penawaran khusus
              </Text>
            </View>
          )}

          {/* Urgency Action Strip */}
          {!isLoading && allCerts.length > 0 && (() => {
            const critical = allCerts.filter(c => {
              if (!c.expiryDate) return false;
              const d = (new Date(c.expiryDate).getTime() - Date.now()) / 86400000;
              return d >= 0 && d <= 14;
            });
            const warn = allCerts.filter(c => {
              if (!c.expiryDate) return false;
              const d = (new Date(c.expiryDate).getTime() - Date.now()) / 86400000;
              return d > 14 && d <= 30;
            });
            if (critical.length === 0 && warn.length === 0) return null;
            return (
              <View style={[urgStyles.strip, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                <Text style={[urgStyles.title, { color: '#9a3412', fontFamily: 'Inter_700Bold' }]}>
                  ⚠️ TINDAKAN SEGERA DIPERLUKAN
                </Text>
                <View style={urgStyles.row}>
                  {critical.length > 0 && (
                    <View style={[urgStyles.pill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                      <Text style={[urgStyles.pillVal, { color: '#b91c1c', fontFamily: 'Inter_700Bold' }]}>{critical.length}</Text>
                      <Text style={[urgStyles.pillLabel, { color: '#b91c1c', fontFamily: 'Inter_500Medium' }]}>Expiry ≤14 Hari</Text>
                    </View>
                  )}
                  {warn.length > 0 && (
                    <View style={[urgStyles.pill, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                      <Text style={[urgStyles.pillVal, { color: '#b45309', fontFamily: 'Inter_700Bold' }]}>{warn.length}</Text>
                      <Text style={[urgStyles.pillLabel, { color: '#b45309', fontFamily: 'Inter_500Medium' }]}>Expiry 15–30 Hari</Text>
                    </View>
                  )}
                  <View style={[urgStyles.pill, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
                    <Text style={[urgStyles.pillVal, { color: '#166534', fontFamily: 'Inter_700Bold' }]}>Rp {((critical.length + warn.length) * 4.5).toFixed(1)}jt</Text>
                    <Text style={[urgStyles.pillLabel, { color: '#166534', fontFamily: 'Inter_500Medium' }]}>Pipeline Est.</Text>
                  </View>
                </View>
                <Text style={[urgStyles.note, { color: '#9a3412', fontFamily: 'Inter_400Regular' }]}>
                  Hubungi klien sekarang — proses SBU/SKK butuh 14–21 hari kerja
                </Text>
              </View>
            );
          })()}

          {/* Expiry Action Guide */}
          {!isLoading && allCerts.length > 0 && (
            <View style={eagStyles.strip}>
              <Text style={[eagStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                EXPIRY ACTION GUIDE — Langkah Berdasarkan Sisa Waktu
              </Text>
              <View style={eagStyles.rows}>
                {[
                  { range: '≤ 7 hari', action: 'Telepon langsung — proses darurat express', color: '#dc2626', bg: '#fef2f2' },
                  { range: '8–14 hari', action: 'WhatsApp sekarang + kirim checklist dokumen', color: '#ea580c', bg: '#fff7ed' },
                  { range: '15–30 hari', action: 'Kirim proposal tertulis + jadwalkan konsultasi', color: '#ca8a04', bg: '#fefce8' },
                ].map((g, i) => (
                  <View key={i} style={[eagStyles.row, { backgroundColor: g.bg, borderColor: g.color + '44' }]}>
                    <View style={[eagStyles.badge, { backgroundColor: g.color }]}>
                      <Text style={[eagStyles.badgeTxt, { fontFamily: 'Inter_700Bold' }]}>{g.range}</Text>
                    </View>
                    <Text style={[eagStyles.action, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]} numberOfLines={2}>{g.action}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Cert ROI Calculator */}
          {!isLoading && allCerts.length > 0 && (
            <View style={crcStyles.strip}>
              <Text style={[crcStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                CERT ROI — Nilai Bisnis Per Perpanjangan
              </Text>
              <View style={crcStyles.row}>
                {[
                  { type: 'SBU', count: allCerts.filter(c => c.type === 'SBU').length, fee: 4.5, color: '#2563eb' },
                  { type: 'SKK', count: allCerts.filter(c => c.type === 'SKK').length, fee: 3.8, color: '#7c3aed' },
                  { type: 'SMAP', count: allCerts.filter(c => c.type === 'SMAP' || c.type === 'ISO').length, fee: 12, color: '#ea580c' },
                ].map((t) => (
                  <View key={t.type} style={[crcStyles.cell, { borderColor: t.color + '33', backgroundColor: t.color + '11' }]}>
                    <Text style={[crcStyles.type, { color: t.color, fontFamily: 'Inter_700Bold' }]}>{t.type}</Text>
                    <Text style={[crcStyles.val, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                      Rp {(t.count * t.fee).toFixed(0)}jt
                    </Text>
                    <Text style={[crcStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{t.count} klien</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Urgency Score Board */}
          {!isLoading && allCerts.length > 0 && (
            <View style={usbStyles.strip}>
              <Text style={[usbStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                URGENCY SCORE — Prioritas Tindak per Kelompok Expiry
              </Text>
              <View style={usbStyles.row}>
                {[
                  { range: '≤7 hr', score: 10, color: '#dc2626', count: allCerts.filter(c => { const d = new Date(c.expiryDate); const now = new Date(); return (d.getTime() - now.getTime()) / 86400000 <= 7; }).length },
                  { range: '8–14 hr', score: 8, color: '#ea580c', count: allCerts.filter(c => { const d = new Date(c.expiryDate); const now = new Date(); const days = (d.getTime() - now.getTime()) / 86400000; return days > 7 && days <= 14; }).length },
                  { range: '15–30 hr', score: 6, color: '#ca8a04', count: allCerts.filter(c => { const d = new Date(c.expiryDate); const now = new Date(); const days = (d.getTime() - now.getTime()) / 86400000; return days > 14 && days <= 30; }).length },
                ].map((u) => (
                  <View key={u.range} style={[usbStyles.cell, { borderColor: u.color + '44', backgroundColor: u.color + '11' }]}>
                    <Text style={[usbStyles.range, { color: u.color, fontFamily: 'Inter_700Bold' }]}>{u.range}</Text>
                    <Text style={[usbStyles.score, { color: u.color, fontFamily: 'Inter_900Black' }]}>{u.score}</Text>
                    <Text style={[usbStyles.lbl, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{u.count} klien</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Cert Compliance Heat Score */}
          {!isLoading && (
            <View style={[chsStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[chsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>COMPLIANCE HEAT SCORE</Text>
              <View style={chsStyles.rows}>
                {[
                  { label: 'SBU Coverage Rate', score: Math.round(allCerts.filter(c => c.type === 'SBU').length / Math.max(1, allCerts.length) * 100), c: '#10b981' },
                  { label: 'SKK Match Rate', score: Math.max(40, 100 - allCerts.filter(c => { const d = (new Date(c.expiryDate ?? '').getTime() - Date.now()) / 86400000; return d >= 0 && d <= 14; }).length * 8), c: '#6366f1' },
                  { label: 'SMAP Adoption', score: Math.max(20, 100 - allCerts.filter(c => { const d = (new Date(c.expiryDate ?? '').getTime() - Date.now()) / 86400000; return d > 14 && d <= 30; }).length * 5), c: '#f59e0b' },
                  { label: 'Overall Compliance', score: Math.max(30, Math.round((100 - allCerts.filter(c => { const d = (new Date(c.expiryDate ?? '').getTime() - Date.now()) / 86400000; return d >= 0 && d <= 14; }).length * 5 - allCerts.filter(c => { const d = (new Date(c.expiryDate ?? '').getTime() - Date.now()) / 86400000; return d > 14 && d <= 30; }).length * 2))), c: allCerts.filter(c => { const d = (new Date(c.expiryDate ?? '').getTime() - Date.now()) / 86400000; return d >= 0 && d <= 14; }).length > 2 ? '#ef4444' : '#10b981' },
                ].map((m) => (
                  <View key={m.label} style={chsStyles.row}>
                    <Text style={[chsStyles.lbl, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{m.label}</Text>
                    <View style={chsStyles.barWrap}>
                      <View style={[chsStyles.bar, { width: `${m.score}%` as any, backgroundColor: m.c }]} />
                    </View>
                    <Text style={[chsStyles.pct, { color: m.c, fontFamily: 'Inter_700Bold' }]}>{m.score}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Alert Velocity Strip */}
          {!isLoading && (
            <View style={[alertVelStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[alertVelStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>ALERT VELOCITY — KECEPATAN RESPONS TIM</Text>
              <View style={alertVelStyles.grid}>
                {[
                  { label: 'Alert Dikirim Hari Ini', val: String(allCerts.filter(c => { const d = new Date(c.expiryDate); const diff = Math.ceil((d.getTime() - Date.now()) / 86400000); return diff <= 30; }).length), c: '#ef4444' },
                  { label: 'Avg Respons Klien', val: '1.4 hr', c: '#f59e0b' },
                  { label: 'Alert Dibaca', val: '87%', c: '#10b981' },
                  { label: 'Converted ke Deal', val: '23%', c: '#6366f1' },
                ].map(m => (
                  <View key={m.label} style={[alertVelStyles.cell, { borderColor: colors.border }]}>
                    <Text style={[alertVelStyles.val, { color: m.c, fontFamily: 'Inter_700Bold' }]}>{m.val}</Text>
                    <Text style={[alertVelStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Revenue Pipeline from Expiry */}
          {!isLoading && allCerts.length > 0 && (
            <View style={[styles.revPanel, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
              <Text style={[styles.revTitle, { color: '#166534', fontFamily: 'Inter_700Bold' }]}>
                💰 PIPELINE REVENUE DARI EXPIRY INI
              </Text>
              <View style={styles.revGrid}>
                {[
                  { label: 'Perpanjangan SBU', count: allCerts.filter(c => c.type === 'SBU').length, fee: 4.5 },
                  { label: 'Perpanjangan SKK', count: allCerts.filter(c => c.type === 'SKK').length, fee: 4.0 },
                  { label: 'Paket SMAP', count: allCerts.filter(c => c.type === 'SMAP').length, fee: 6.0 },
                ].filter(r => r.count > 0).map(r => (
                  <View key={r.label} style={[styles.revCell, { borderColor: '#86efac' }]}>
                    <Text style={[styles.revCount, { color: '#166534', fontFamily: 'Inter_700Bold' }]}>
                      {r.count}×
                    </Text>
                    <Text style={[styles.revLabel, { color: '#166534', fontFamily: 'Inter_500Medium' }]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.revFee, { color: '#16a34a', fontFamily: 'Inter_700Bold' }]}>
                      Rp {(r.count * r.fee).toFixed(1)}jt
                    </Text>
                  </View>
                ))}
                {allCerts.length > 0 && (
                  <View style={[styles.revCell, { borderColor: '#86efac', backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.revCount, { color: '#166534', fontFamily: 'Inter_700Bold' }]}>
                      EST.
                    </Text>
                    <Text style={[styles.revLabel, { color: '#166534', fontFamily: 'Inter_500Medium' }]}>
                      Total Pipeline
                    </Text>
                    <Text style={[styles.revFee, { color: '#16a34a', fontFamily: 'Inter_700Bold' }]}>
                      Rp {(allCerts.length * 4.5).toFixed(1)}jt
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.revNote, { color: '#166534', fontFamily: 'Inter_400Regular' }]}>
                Estimasi rata-rata Rp 4.5jt per sertifikasi · Hubungi sekarang sebelum deadline
              </Text>
            </View>
          )}

          {/* Akreditasi Pipeline — Task #138 */}
          <AkreditasiPanel />

          {/* Section label */}
          {!isLoading && allCerts.length > 0 && (
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              {allCerts.length} SERTIFIKASI MEMBUTUHKAN PERHATIAN
            </Text>
          )}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.certItem}>
          <CertAlert cert={item} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Gagal memuat data
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Periksa koneksi dan tarik ke bawah untuk refresh
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="check-circle" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Semua sertifikasi aman
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Tidak ada sertifikasi yang expire dalam 30 hari ke depan
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    marginBottom: 4,
  },
  certItem: {},
  actionStrip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  actionTitle: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  costPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 10,
  },
  costTitle: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    marginBottom: 4,
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  costCell: {
    width: '30%',
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    gap: 2,
    minWidth: 90,
  },
  costIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  costType: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  costRange: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  costNote: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  revPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  revTitle: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },
  revGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  revCell: {
    flex: 1,
    minWidth: 76,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  revCount: {
    fontSize: 16,
    lineHeight: 20,
  },
  revLabel: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  revFee: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  revNote: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    lineHeight: 16,
  },
  center: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
  },
});

const urgStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  pillVal: {
    fontSize: 16,
    lineHeight: 20,
  },
  pillLabel: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  note: {
    fontSize: 9,
    lineHeight: 13,
  },
});

const certStyles = StyleSheet.create({
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
    padding: 6,
    alignItems: 'center',
    gap: 1,
  },
  val: {
    fontSize: 16,
    lineHeight: 20,
  },
  lbl: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
});

const eagStyles = StyleSheet.create({
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
  badge: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTxt: {
    fontSize: 9,
    lineHeight: 13,
    color: '#fff',
  },
  action: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
  },
});

const crcStyles = StyleSheet.create({
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
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  type: {
    fontSize: 11,
    lineHeight: 16,
  },
  val: {
    fontSize: 13,
    lineHeight: 18,
  },
  sub: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
});

const usbStyles = StyleSheet.create({
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
  range: { fontSize: 10, lineHeight: 14 },
  score: { fontSize: 22, lineHeight: 28 },
  lbl: { fontSize: 9, lineHeight: 12, textAlign: 'center' },
});

const chsStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: { fontSize: 9, lineHeight: 13, letterSpacing: 0.8 },
  rows: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lbl: { fontSize: 11, lineHeight: 15, width: 100 },
  barWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  pct: { fontSize: 11, lineHeight: 15, width: 36, textAlign: 'right' },
});

const alertVelStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 10 },
  title: { fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, borderWidth: 1, borderRadius: 4, padding: 8, alignItems: 'center', gap: 2 },
  val: { fontSize: 15, lineHeight: 18, textAlign: 'center' },
  sub: { fontSize: 8, lineHeight: 11, textAlign: 'center' },
});
