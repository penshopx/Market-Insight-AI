/**
 * Shared card components for displaying research items, contractors, and pain points.
 * Used by both the Search (cari) screen and the Dashboard home screen.
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Contractor, PainPoint, ResearchItem } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import {
  OUTREACH_STATUS_CONFIG,
  OUTREACH_STATUS_ORDER,
  type OutreachStatus,
} from '@/hooks/useContractorOutreach';

// ─── Platform web URL helper ────────────────────────────────────────────────────
const WEB_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/konstruksi-riset`
  : null;

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DetailRow {
  label: string;
  value: string | number | null | undefined;
}

// ─── Photo URL helpers ───────────────────────────────────────────────────────────
// Helpers live in a React-Native-free shared module so they can be tested in Node.js.
// Import locally for use within this component, and re-export for consumers.
import { isPhotoUrl, extractFotoBuktiUrl } from '../utils/fotoBuktiHelpers';
export { isPhotoUrl, extractFotoBuktiUrl };

// ─── Priority badge colour ───────────────────────────────────────────────────────

export function priorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH':     return '#f97316';
    case 'MEDIUM':   return '#eab308';
    case 'LOW':      return '#22c55e';
    default:         return '#94a3b8';
  }
}

// ─── Full-screen image viewer ────────────────────────────────────────────────────

function FullscreenImageModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string;
  onClose: () => void;
}) {
  const [error, setError] = useState(false);

  // Reset error state when uri changes
  React.useEffect(() => { setError(false); }, [uri]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={fsStyles.backdrop} onPress={onClose}>
        <Pressable style={fsStyles.container} onPress={(e) => e.stopPropagation()}>
          {/* Close button */}
          <TouchableOpacity style={fsStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>

          {error ? (
            <View style={fsStyles.errorBox}>
              <Feather name="image" size={40} color="#6b7280" />
              <Text style={fsStyles.errorText}>Foto tidak dapat ditampilkan</Text>
              <Text style={fsStyles.errorSub}>URL mungkin sudah tidak aktif</Text>
            </View>
          ) : (
            <Image
              source={{ uri }}
              style={fsStyles.image}
              resizeMode="contain"
              onError={() => setError(true)}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fsStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorBox: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  errorSub: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});

// ─── Photo thumbnail ─────────────────────────────────────────────────────────────

function PhotoThumbnail({ uri, onExpand }: { uri: string; onExpand: () => void }) {
  const colors = useColors();
  const [error, setError] = useState(false);

  return (
    <TouchableOpacity
      onPress={onExpand}
      activeOpacity={0.85}
      style={[thumbStyles.wrapper, { borderColor: colors.border }]}
    >
      {error ? (
        <View style={[thumbStyles.errorBox, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={22} color={colors.mutedForeground} />
          <Text style={[thumbStyles.errorText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Foto tidak tersedia
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={thumbStyles.image}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      )}
      {!error && (
        <View style={thumbStyles.tapHint}>
          <Feather name="maximize-2" size={12} color="#fff" />
          <Text style={thumbStyles.tapHintText}>Tap untuk perbesar</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const thumbStyles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
    height: 180,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 180,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  tapHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tapHintText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
});

// ─── Detail Modal ────────────────────────────────────────────────────────────────

function buildShareMessage(title: string, rows: DetailRow[]): string {
  const lines: string[] = [`*${title}*`, ''];
  rows
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== '')
    .forEach((r) => {
      lines.push(`${r.label}: ${String(r.value)}`);
    });
  lines.push('', '— Tim Riset Marketing Konstruksi');
  return lines.join('\n');
}

export function DetailModal({
  visible,
  title,
  rows,
  photoUrl,
  workroomUrl,
  onClose,
}: {
  visible: boolean;
  title: string;
  rows: DetailRow[];
  photoUrl?: string | null;
  workroomUrl?: string | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const message = buildShareMessage(title, rows);
      await Share.share({ message });
    } catch {
      // user cancelled or share unavailable — do nothing
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={[detailStyles.sheet, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
            <Text
              style={[detailStyles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View style={detailStyles.headerActions}>
              {workroomUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(workroomUrl).catch(() => {})}
                  style={[detailStyles.closeBtn, { backgroundColor: '#dbeafe' }]}
                  accessibilityLabel="Buka di Workroom"
                >
                  <Feather name="briefcase" size={16} color="#1d4ed8" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={handleShare} style={[detailStyles.closeBtn, { backgroundColor: '#dcfce7' }]}>
                <Feather name="share-2" size={17} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={[detailStyles.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rows */}
          <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>
            {/* Photo thumbnail (shown when photoUrl is present) */}
            {photoUrl ? (
              <View style={[detailStyles.photoSection, { borderBottomColor: colors.border }]}>
                <View style={detailStyles.photoLabelRow}>
                  <Feather name="camera" size={12} color={colors.mutedForeground} />
                  <Text style={[detailStyles.photoLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                    FOTO BUKTI
                  </Text>
                </View>
                <PhotoThumbnail uri={photoUrl} onExpand={() => setFullscreenOpen(true)} />
              </View>
            ) : null}

            {rows
              .filter((r) => r.value !== null && r.value !== undefined && r.value !== '')
              .map((row, i) => (
                <View
                  key={`${row.label}-${i}`}
                  style={[detailStyles.row, { borderBottomColor: colors.border }]}
                >
                  <Text
                    style={[detailStyles.rowLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={[detailStyles.rowValue, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                  >
                    {String(row.value)}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Fullscreen viewer — rendered outside the pageSheet modal */}
      {photoUrl ? (
        <FullscreenImageModal
          visible={fullscreenOpen}
          uri={photoUrl}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}
    </>
  );
}

const detailStyles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontSize: 17, lineHeight: 24 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  photoSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  photoLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  rowLabel: { fontSize: 11, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
  rowValue: { fontSize: 14, lineHeight: 20 },
});

// ─── Riset Card ──────────────────────────────────────────────────────────────────

export function RisetCard({ item, onPress }: { item: ResearchItem; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={cardStyles.top}>
        <View style={[cardStyles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[cardStyles.badgeText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
            {item.category}
          </Text>
        </View>
        {item.priority ? (
          <View style={[cardStyles.priorityDot, { backgroundColor: priorityColor(item.priority) }]} />
        ) : null}
        {isPhotoUrl(item.sourceUrl) ? (
          <View style={[cardStyles.badge, { backgroundColor: '#d1fae5' }]}>
            <Feather name="camera" size={9} color="#059669" />
            <Text style={[cardStyles.badgeText, { color: '#059669', fontFamily: 'Inter_600SemiBold' }]}>
              Foto
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[cardStyles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      {item.summary ? (
        <Text
          style={[cardStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={2}
        >
          {item.summary}
        </Text>
      ) : null}
      <View style={cardStyles.footer}>
        <Feather name="link" size={11} color={colors.mutedForeground} />
        <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {item.source}
        </Text>
        {item.createdAt ? (
          <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            · {new Date(item.createdAt).toLocaleDateString('id-ID')}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Contractor Card ─────────────────────────────────────────────────────────────

export function ContractorCard({
  item,
  onPress: onPressProp,
  outreachStatus,
  onChangeStatus,
}: {
  item: Contractor;
  onPress: () => void;
  outreachStatus?: OutreachStatus;
  onChangeStatus?: (status: OutreachStatus) => void;
}) {
  const colors = useColors();
  const onPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPressProp(); };
  const hasFoto = !!extractFotoBuktiUrl(item.notes);
  const status = outreachStatus ?? 'BELUM_DIHUBUNGI';
  const statusCfg = OUTREACH_STATUS_CONFIG[status];

  const handleStatusPress = () => {
    if (!onChangeStatus) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const buttons: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [
      ...OUTREACH_STATUS_ORDER.map((s) => ({
        text: (s === status ? '✓ ' : '') + OUTREACH_STATUS_CONFIG[s].label,
        onPress: () => onChangeStatus(s),
        style: (s === 'TIDAK_TERTARIK' ? 'destructive' : 'default') as 'default' | 'destructive',
      })),
      { text: 'Batal', onPress: () => {}, style: 'cancel' as const },
    ];
    Alert.alert('Status Follow-Up', item.name, buttons);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={cardStyles.top}>
        <View style={[cardStyles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[cardStyles.badgeText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
            {item.type}
          </Text>
        </View>
        <View style={[cardStyles.badge, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[cardStyles.badgeText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {item.sbuLevel}
          </Text>
        </View>
        {hasFoto ? (
          <View style={[cardStyles.badge, { backgroundColor: '#d1fae5' }]}>
            <Feather name="camera" size={9} color="#059669" />
            <Text style={[cardStyles.badgeText, { color: '#059669', fontFamily: 'Inter_600SemiBold' }]}>
              Foto
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[cardStyles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {item.bidangUsaha ? (
        <Text
          style={[cardStyles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={1}
        >
          {item.bidangUsaha}
        </Text>
      ) : null}
      <View style={cardStyles.footer}>
        {item.province ? (
          <>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {item.province}
            </Text>
          </>
        ) : null}
        {item.createdAt ? (
          <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {item.province ? '·' : ''} {new Date(item.createdAt).toLocaleDateString('id-ID')}
          </Text>
        ) : null}
      </View>
      {/* Outreach status row — Task #163 */}
      {onChangeStatus ? (
        <TouchableOpacity
          onPress={handleStatusPress}
          activeOpacity={0.7}
          style={[contractorStyles.statusRow, { backgroundColor: statusCfg.color }]}
        >
          <View style={[contractorStyles.dot, { backgroundColor: statusCfg.dotColor }]} />
          <Text style={[contractorStyles.statusLabel, { color: statusCfg.textColor, fontFamily: 'Inter_600SemiBold' }]}>
            {statusCfg.label}
          </Text>
          <Feather name="chevron-down" size={11} color={statusCfg.textColor} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const contractorStyles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 11, lineHeight: 15 },
});

// ─── Pain Point Card ─────────────────────────────────────────────────────────────

/** Build Surat Penawaran URL from pain point — Task #155 */
function buildSuratUrl(item: PainPoint): string | null {
  if (!WEB_BASE) return null;
  const perihal = item.serviceOpportunity
    ? `Penawaran Layanan — ${item.serviceOpportunity}`
    : item.description.length > 80
    ? item.description.slice(0, 80) + '…'
    : item.description;
  const params = new URLSearchParams({ perihal });
  if (item.domain) params.set('domain', item.domain);
  return `${WEB_BASE}/surat-penawaran?${params.toString()}`;
}

export function PainPointCard({ item, onPress: onPressProp }: { item: PainPoint; onPress: () => void }) {
  const colors = useColors();
  const pColor = priorityColor(item.priority);
  const onPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPressProp(); };

  const suratUrl = buildSuratUrl(item);
  const handleSurat = async () => {
    if (!suratUrl) {
      Alert.alert('Tidak Tersedia', 'URL platform web belum dikonfigurasi (EXPO_PUBLIC_DOMAIN).');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const canOpen = await Linking.canOpenURL(suratUrl);
    if (canOpen) {
      await Linking.openURL(suratUrl);
    } else {
      Alert.alert('Tidak Dapat Dibuka', 'Buka platform web secara manual dan akses halaman Surat Penawaran.');
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={cardStyles.top}>
        <View style={[cardStyles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[cardStyles.badgeText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
            {item.segment}
          </Text>
        </View>
        <View style={[cardStyles.badge, { backgroundColor: pColor + '22' }]}>
          <Text style={[cardStyles.badgeText, { color: pColor, fontFamily: 'Inter_600SemiBold' }]}>
            {item.priority}
          </Text>
        </View>
        {item.domain ? (
          <View style={[cardStyles.badge, { backgroundColor: colors.muted }]}>
            <Text style={[cardStyles.badgeText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              {item.domain}
            </Text>
          </View>
        ) : null}
        {item.evidencePhotoUrl ? (
          <View style={[cardStyles.badge, { backgroundColor: '#d1fae5' }]}>
            <Feather name="camera" size={9} color="#059669" />
            <Text style={[cardStyles.badgeText, { color: '#059669', fontFamily: 'Inter_600SemiBold' }]}>
              Foto
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[cardStyles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
        numberOfLines={3}
      >
        {item.description}
      </Text>
      <View style={cardStyles.footer}>
        <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {item.status}
        </Text>
        {item.createdAt ? (
          <Text style={[cardStyles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            · {new Date(item.createdAt).toLocaleDateString('id-ID')}
          </Text>
        ) : null}
      </View>
      {/* Surat Penawaran quick action — Task #155 */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); handleSurat(); }}
        activeOpacity={0.7}
        style={ppStyles.suratBtn}
      >
        <Feather name="file-text" size={11} color="#2563eb" />
        <Text style={[ppStyles.suratLabel, { fontFamily: 'Inter_600SemiBold' }]}>Buat Surat Penawaran</Text>
        <Feather name="external-link" size={10} color="#2563eb" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const ppStyles = StyleSheet.create({
  suratBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 2,
  },
  suratLabel: { fontSize: 11, lineHeight: 15, color: '#2563eb' },
});

// ─── Shared card styles ──────────────────────────────────────────────────────────

export const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    lineHeight: 16,
  },
});

// ─── Detail row builders ─────────────────────────────────────────────────────────

export function risetDetailRows(item: ResearchItem): DetailRow[] {
  return [
    { label: 'Kategori', value: item.category },
    { label: 'Status', value: item.status },
    { label: 'Prioritas', value: item.priority },
    { label: 'Sumber', value: item.source },
    // Only show URL Sumber as text when it is NOT a photo (photos shown as thumbnail)
    ...(!isPhotoUrl(item.sourceUrl) ? [{ label: 'URL Sumber', value: item.sourceUrl }] : []),
    { label: 'Situs Data', value: item.dataSourceSite },
    { label: 'Ringkasan', value: item.summary },
    { label: 'Tags', value: item.tags },
    { label: 'Dikumpulkan', value: item.collectedAt ? new Date(item.collectedAt).toLocaleDateString('id-ID') : undefined },
    { label: 'Dibuat', value: new Date(item.createdAt).toLocaleDateString('id-ID') },
  ];
}

export function kontraktorDetailRows(item: Contractor): DetailRow[] {
  // Strip [Foto bukti: ...] from notes display (photo shown as thumbnail instead)
  const cleanNotes = item.notes
    ? item.notes.replace(/\[Foto bukti:\s*(?:data:image\/[^;]+;base64,[^\]]+|https?:\/\/[^\]]+)\]/gi, '').trim()
    : undefined;

  return [
    { label: 'Tipe', value: item.type },
    { label: 'Level SBU', value: item.sbuLevel },
    { label: 'Kode SBU', value: item.sbuCode },
    { label: 'Bidang Usaha', value: item.bidangUsaha },
    { label: 'Sub Bidang', value: item.subBidang },
    { label: 'Klasifikasi', value: item.klasifikasi },
    { label: 'NPWP', value: item.npwp },
    { label: 'No. Registrasi', value: item.registrationNumber },
    { label: 'Provinsi', value: item.province },
    { label: 'Kota', value: item.city },
    { label: 'Alamat', value: item.address },
    { label: 'Telepon', value: item.phone },
    { label: 'Email', value: item.email },
    { label: 'Website', value: item.website },
    { label: 'Sumber Data', value: item.dataSource },
    { label: 'Catatan', value: cleanNotes || undefined },
    { label: 'SBU Kadaluarsa', value: item.sbuExpiry },
    { label: 'Dibuat', value: new Date(item.createdAt).toLocaleDateString('id-ID') },
  ];
}

export function painPointDetailRows(item: PainPoint): DetailRow[] {
  return [
    { label: 'Deskripsi', value: item.description },
    { label: 'Segmen', value: item.segment },
    { label: 'Prioritas', value: item.priority },
    { label: 'Domain', value: item.domain },
    { label: 'Subdomain', value: item.subdomain },
    { label: 'Status', value: item.status },
    { label: 'Kategori', value: item.category },
    { label: 'Frekuensi', value: item.frequency },
    { label: 'Pain Score', value: item.painScore },
    { label: 'Root Cause', value: item.rootCause },
    { label: 'Business Impact', value: item.businessImpact },
    { label: 'Solusi Digital', value: item.digitalSolution },
    { label: 'Solusi AI', value: item.aiSolution },
    { label: 'Peluang Jasa', value: item.serviceOpportunity },
    { label: 'Problem ID', value: item.problemId },
    { label: 'Dibuat', value: new Date(item.createdAt).toLocaleDateString('id-ID') },
  ];
}
