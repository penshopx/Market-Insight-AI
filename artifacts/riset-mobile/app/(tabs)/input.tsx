import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useCreateContractor,
  useCreatePainPoint,
  useCreateResearchItem,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { ChipSelect, ImageField, ImageFieldHandle, UploadResult, TextField } from '@/components/FormField';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQueueContext, type QueueItem, type DrainSummary } from '@/contexts/OfflineQueueContext';
import { MAX_RETRIES } from '@/hooks/useOfflineQueue';
import { uploadLocalUri, isNetworkError } from '@/utils/uploadLocalUri';

type DataType = 'riset' | 'kontraktor' | 'painpoint';

const DATA_TYPES: { key: DataType; label: string; icon: string }[] = [
  { key: 'riset', label: 'Riset', icon: 'search' },
  { key: 'kontraktor', label: 'Kontraktor', icon: 'briefcase' },
  { key: 'painpoint', label: 'Pain Point', icon: 'alert-circle' },
];

const CATEGORIES = ['LEGALITAS_PERIJINAN', 'SBU', 'SKK', 'TENDER', 'PROYEK'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SEGMENTS = ['KONTRAKTOR', 'KONSULTAN', 'TENAGA_KERJA', 'SEMUA'];
const SBU_LEVELS = ['MENENGAH', 'SPESIALIS', 'BESAR', 'ASING'];
const CONTRACTOR_TYPES = ['KONTRAKTOR', 'KONSULTAN'];
const DOMAINS = ['LEGALITAS_PERIJINAN', 'SBU', 'SKK', 'TENDER', 'PROYEK'];

export default function InputScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { queueCount, queue, isFlushing, lastDrainSummary, flushHistory, deadLetterQueue, enqueue, setFlushHandler, manualFlush, removeItem, updateItem, clearDeadLetter } =
    useOfflineQueueContext();

  const [selectedType, setSelectedType] = useState<DataType>('riset');
  const [showQueueModal, setShowQueueModal] = useState(false);
  // #68 — inline editing of queue items
  const [editingItem, setEditingItem] = useState<{ id: string; type: string; fieldKey: string; label: string; value: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Riset fields ──────────────────────────────────────────────────────────
  const [risetTitle, setRisetTitle] = useState('');
  const [risetCategory, setRisetCategory] = useState('');
  const [risetSource, setRisetSource] = useState('');
  const [risetSummary, setRisetSummary] = useState('');
  const [risetPriority, setRisetPriority] = useState('');
  const [risetPhotoUrl, setRisetPhotoUrl] = useState<string | undefined>();

  // ── Kontraktor fields ─────────────────────────────────────────────────────
  const [konName, setKonName] = useState('');
  const [konType, setKonType] = useState('');
  const [konSbuLevel, setKonSbuLevel] = useState('');
  const [konProvince, setKonProvince] = useState('');
  const [konBidang, setKonBidang] = useState('');
  const [konNotes, setKonNotes] = useState('');
  const [konPhotoUrl, setKonPhotoUrl] = useState<string | undefined>();

  // ── Pain Point fields ─────────────────────────────────────────────────────
  const [ppDescription, setPpDescription] = useState('');
  const [ppSegment, setPpSegment] = useState('');
  const [ppPriority, setPpPriority] = useState('');
  const [ppDomain, setPpDomain] = useState('');
  const [ppCategory, setPpCategory] = useState('');
  const [ppPhotoUrl, setPpPhotoUrl] = useState<string | undefined>();

  // ── Image field refs — upload is deferred to submit time ──────────────────
  const risetImageRef = useRef<ImageFieldHandle>(null);
  const konImageRef = useRef<ImageFieldHandle>(null);
  const ppImageRef = useRef<ImageFieldHandle>(null);

  // ── Submission lock — prevents double-tap and re-entry during async upload ─
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const risetMutation = useCreateResearchItem();
  const kontraktorMutation = useCreateContractor();
  const painPointMutation = useCreatePainPoint();

  const isPending =
    risetMutation.isPending || kontraktorMutation.isPending || painPointMutation.isPending;

  const resetForm = () => {
    setRisetTitle(''); setRisetCategory(''); setRisetSource('');
    setRisetSummary(''); setRisetPriority(''); setRisetPhotoUrl(undefined);
    setKonName(''); setKonType(''); setKonSbuLevel('');
    setKonProvince(''); setKonBidang(''); setKonNotes(''); setKonPhotoUrl(undefined);
    setPpDescription(''); setPpSegment(''); setPpPriority('');
    setPpDomain(''); setPpCategory(''); setPpPhotoUrl(undefined);
    setSubmitted(false);
  };

  const validateRiset = () => risetTitle.trim() && risetCategory && risetSource.trim();
  const validateKontraktor = () => konName.trim() && konType && konSbuLevel;
  const validatePainPoint = () => ppDescription.trim() && ppSegment && ppPriority;

  // ── Flush handler — called by useOfflineQueue when connection returns ──────
  const processQueueItem = useCallback(
    async (item: QueueItem): Promise<void> => {
      // Resolve the final data payload — upload pending photo if needed.
      // `_pendingPhotoUri` is set when the device was offline at enqueue time
      // and the photo could not be uploaded then. Now that we're online, upload
      // it first and inject the resulting serving URL into the appropriate field.
      let data = { ...item.data };
      const pendingUri = data._pendingPhotoUri as string | undefined;
      if (pendingUri) {
        // Throws on network / server failure → queue retries with backoff.
        const servingUrl = await uploadLocalUri(pendingUri);
        delete data._pendingPhotoUri;
        if (item.type === 'riset') {
          data = { ...data, sourceUrl: servingUrl };
        } else if (item.type === 'kontraktor') {
          const baseNotes = (data.notes as string | undefined) ?? '';
          data = {
            ...data,
            notes: baseNotes
              ? `${baseNotes}\n[Foto bukti: ${servingUrl}]`
              : `[Foto bukti: ${servingUrl}]`,
          };
        } else {
          data = { ...data, evidencePhotoUrl: servingUrl };
        }
      }

      return new Promise((resolve, reject) => {
        if (item.type === 'riset') {
          risetMutation.mutate(
            { data: data as unknown as Parameters<typeof risetMutation.mutate>[0]['data'] },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        } else if (item.type === 'kontraktor') {
          kontraktorMutation.mutate(
            { data: data as unknown as Parameters<typeof kontraktorMutation.mutate>[0]['data'] },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        } else {
          painPointMutation.mutate(
            { data: data as unknown as Parameters<typeof painPointMutation.mutate>[0]['data'] },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        }
      });
    },
    [risetMutation, kontraktorMutation, painPointMutation]
  );

  // Register the flush handler so the hook can call it on reconnect
  useEffect(() => {
    setFlushHandler(processQueueItem);
  }, [setFlushHandler, processQueueItem]);

  // Attempt flush when screen becomes active (in case items were queued earlier)
  useEffect(() => {
    manualFlush();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show drain summary after a flush completes.
  // We track the lastDrainSummary.at timestamp to fire exactly once per flush.
  const prevDrainAtRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (!lastDrainSummary) return;
    if (prevDrainAtRef.current === lastDrainSummary.at) return;
    prevDrainAtRef.current = lastDrainSummary.at;

    const { sent, failed, sentByType } = lastDrainSummary;
    if (sent === 0 && failed === 0) return;

    // Build type breakdown string, e.g. "2 Riset, 1 Kontraktor"
    const typeParts: string[] = [];
    if (sentByType.riset > 0) typeParts.push(`${sentByType.riset} Riset`);
    if (sentByType.kontraktor > 0) typeParts.push(`${sentByType.kontraktor} Kontraktor`);
    if (sentByType.painpoint > 0) typeParts.push(`${sentByType.painpoint} Pain Point`);
    const breakdown = typeParts.length > 0 ? ` (${typeParts.join(', ')})` : '';

    if (failed === 0) {
      // Full success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Antrian Terkirim',
        `${sent} item berhasil dikirim ke server${breakdown}.`,
      );
    } else if (sent > 0) {
      // Partial success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        '⚠️ Sebagian Terkirim',
        `${sent} berhasil${breakdown}, ${failed} gagal — buka antrian untuk lihat detail.\nItem yang gagal akan dicoba ulang saat koneksi kembali stabil.`,
        [
          { text: 'Tutup', style: 'cancel' },
          { text: 'Lihat Antrian', onPress: () => setShowQueueModal(true) },
        ],
      );
    } else {
      // All failed
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        '✗ Pengiriman Gagal',
        `${failed} item tidak berhasil dikirim dan tetap dalam antrian. Periksa koneksi internet Anda.`,
        [
          { text: 'Tutup', style: 'cancel' },
          { text: 'Lihat Antrian', onPress: () => setShowQueueModal(true) },
        ],
      );
    }
  }, [lastDrainSummary]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Synchronous re-entry guard — prevents double-tap races that setState
    // alone cannot catch (React batches state updates asynchronously).
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitted(true);

    try {
      if (selectedType === 'riset') {
        if (!validateRiset()) return;

        // Capture local URI BEFORE attempting upload so we can include it in
        // the offline queue if the upload fails due to network unavailability.
        const risetPendingUri = risetImageRef.current?.getPendingLocalUri();

        // Step 1: upload photo at submit time (deferred from pick to prevent orphans).
        let uploadResult: UploadResult | undefined;
        try {
          uploadResult = await risetImageRef.current?.uploadPending();
        } catch (e) {
          if (!isNetworkError(e)) {
            // Real upload error (server-side) — abort and let the user retry.
            Alert.alert('Upload Gagal', 'Gagal mengupload foto. Hapus foto atau coba lagi.');
            return;
          }
          // Network error: device is offline. Fall through so the record is
          // queued with the local URI and the upload is retried on reconnect.
        }

        const data = {
          title: risetTitle.trim(),
          category: risetCategory,
          source: risetSource.trim(),
          summary: risetSummary.trim() || undefined,
          priority: risetPriority || undefined,
          sourceUrl: uploadResult?.servingUrl,
        };

        // Step 2: create record — submission lock is held until mutateAsync settles.
        try {
          await risetMutation.mutateAsync({ data });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Berhasil', 'Data riset berhasil disimpan.', [
            { text: 'OK', onPress: resetForm },
          ]);
        } catch {
          // Mutation failed (offline or transient server error).
          // If the upload already succeeded, sourceUrl is in data and will be
          // preserved in the queue. If the upload failed offline, attach the
          // local URI so the flush handler uploads it automatically on reconnect.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const queueData: Record<string, unknown> = { ...data };
          if (risetPendingUri && !uploadResult) {
            queueData._pendingPhotoUri = risetPendingUri;
            delete queueData.sourceUrl; // not uploaded yet; flush handler will set it
          }
          void enqueue('riset', queueData);
          const photoNote = risetPendingUri && !uploadResult
            ? ' Foto akan diupload otomatis saat online.'
            : uploadResult ? ' Foto bukti sudah tersimpan.' : '';
          Alert.alert(
            'Tersimpan Offline',
            `Koneksi tidak tersedia. Data disimpan dan akan dikirim otomatis saat online.${photoNote}`,
            [{ text: 'OK', onPress: resetForm }]
          );
        }

      } else if (selectedType === 'kontraktor') {
        if (!validateKontraktor()) return;

        // Capture local URI before upload attempt (see riset block comment above).
        const konPendingUri = konImageRef.current?.getPendingLocalUri();

        let uploadResult: UploadResult | undefined;
        try {
          uploadResult = await konImageRef.current?.uploadPending();
        } catch (e) {
          if (!isNetworkError(e)) {
            Alert.alert('Upload Gagal', 'Gagal mengupload foto. Hapus foto atau coba lagi.');
            return;
          }
          // Network error: fall through and queue with _pendingPhotoUri.
        }

        const photoUrl = uploadResult?.servingUrl;
        const notesBase = konNotes.trim();
        // Only embed the photo URL in notes when the upload has already succeeded.
        // If still pending (_pendingPhotoUri), the flush handler injects it later.
        const notesFull = photoUrl
          ? notesBase
            ? `${notesBase}\n[Foto bukti: ${photoUrl}]`
            : `[Foto bukti: ${photoUrl}]`
          : notesBase || undefined;
        const data = {
          name: konName.trim(),
          type: konType,
          sbuLevel: konSbuLevel,
          province: konProvince.trim() || undefined,
          bidangUsaha: konBidang.trim() || undefined,
          notes: notesFull,
        };

        try {
          await kontraktorMutation.mutateAsync({ data });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Berhasil', 'Data kontraktor berhasil disimpan.', [
            { text: 'OK', onPress: resetForm },
          ]);
        } catch {
          // Orphan GCS object (if any) handled by server-side cleanup job within 2 hours.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          // If upload succeeded, notes already contain the photo URL — preserve it.
          // If upload failed offline, store the local URI for flush-time upload.
          const queueData: Record<string, unknown> = { ...data };
          if (konPendingUri && !uploadResult) {
            queueData._pendingPhotoUri = konPendingUri;
            // notes currently has no photo line; flush handler will append it.
          }
          void enqueue('kontraktor', queueData);
          const photoNote = konPendingUri && !uploadResult
            ? ' Foto akan diupload otomatis saat online.'
            : uploadResult ? ' Foto bukti sudah tersimpan.' : '';
          Alert.alert(
            'Tersimpan Offline',
            `Koneksi tidak tersedia. Data disimpan dan akan dikirim otomatis saat online.${photoNote}`,
            [{ text: 'OK', onPress: resetForm }]
          );
        }

      } else {
        if (!validatePainPoint()) return;

        // Capture local URI before upload attempt (see riset block comment above).
        const ppPendingUri = ppImageRef.current?.getPendingLocalUri();

        let uploadResult: UploadResult | undefined;
        try {
          uploadResult = await ppImageRef.current?.uploadPending();
        } catch (e) {
          if (!isNetworkError(e)) {
            Alert.alert('Upload Gagal', 'Gagal mengupload foto. Hapus foto atau coba lagi.');
            return;
          }
          // Network error: fall through and queue with _pendingPhotoUri.
        }

        const data = {
          description: ppDescription.trim(),
          segment: ppSegment,
          priority: ppPriority,
          domain: ppDomain || undefined,
          category: ppCategory.trim() || undefined,
          evidencePhotoUrl: uploadResult?.servingUrl,
        };

        try {
          await painPointMutation.mutateAsync({ data });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Berhasil', 'Pain point berhasil disimpan.', [
            { text: 'OK', onPress: resetForm },
          ]);
        } catch {
          // If the photo upload already succeeded, evidencePhotoUrl is in data — keep it.
          // If the upload failed offline, attach the local URI for flush-time upload.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const queueData: Record<string, unknown> = { ...data };
          if (ppPendingUri && !uploadResult) {
            queueData._pendingPhotoUri = ppPendingUri;
            delete queueData.evidencePhotoUrl; // not uploaded yet; flush handler will set it
          }
          void enqueue('painpoint', queueData);
          const photoNote = ppPendingUri && !uploadResult
            ? ' Foto akan diupload otomatis saat online.'
            : uploadResult ? ' Foto bukti sudah tersimpan.' : '';
          Alert.alert(
            'Tersimpan Offline',
            `Koneksi tidak tersedia. Data disimpan dan akan dikirim otomatis saat online.${photoNote}`,
            [{ text: 'OK', onPress: resetForm }]
          );
        }
      }
    } finally {
      // Release the lock only after the full upload + mutateAsync round-trip settles.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Queue helpers ─────────────────────────────────────────────────────────
  const formatRelativeTime = (ts: number): string => {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    return `${Math.floor(diffHr / 24)} hari lalu`;
  };

  const getItemLabel = (type: string): string => {
    if (type === 'riset') return 'Riset';
    if (type === 'kontraktor') return 'Kontraktor';
    return 'Pain Point';
  };

  const getItemSummary = (item: QueueItem): string => {
    const d = item.data;
    if (item.type === 'riset') return (d.title as string) || '(tanpa judul)';
    if (item.type === 'kontraktor') return (d.name as string) || '(tanpa nama)';
    const desc = (d.description as string) || '(tanpa deskripsi)';
    return desc.length > 60 ? desc.slice(0, 57) + '…' : desc;
  };

  const getTypeColor = (type: string): string => {
    if (type === 'riset') return '#2563eb';
    if (type === 'kontraktor') return '#7c3aed';
    return '#dc2626';
  };

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      'Hapus Item',
      'Yakin ingin menghapus item ini dari antrian?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => void removeItem(id),
        },
      ]
    );
  };

  // #68 — open the inline edit modal for the main text field of a queue item
  const handleEditItem = (item: QueueItem) => {
    const fieldKey = item.type === 'riset' ? 'title' : item.type === 'kontraktor' ? 'name' : 'description';
    const label = item.type === 'riset' ? 'Judul' : item.type === 'kontraktor' ? 'Nama Kontraktor' : 'Deskripsi';
    const value = String(item.data[fieldKey] ?? '');
    setEditingItem({ id: item.id, type: item.type, fieldKey, label, value });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    void updateItem(editingItem.id, { [editingItem.fieldKey]: editingItem.value });
    setEditingItem(null);
  };

  const handleSendNow = () => {
    setShowQueueModal(false);
    manualFlush();
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <>
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topInset + 8,
          paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          Input Data
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Catat temuan dari lapangan
        </Text>
      </View>

      {/* Offline queue banner — tappable to open queue detail */}
      {(queueCount > 0 || isFlushing) && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowQueueModal(true)}
          style={[
            styles.queueBanner,
            {
              backgroundColor: isFlushing ? '#f0fdf4' : '#fefce8',
              borderColor: isFlushing ? '#86efac' : '#fde047',
            },
          ]}
        >
          <Feather
            name={isFlushing ? 'upload-cloud' : 'wifi-off'}
            size={16}
            color={isFlushing ? '#16a34a' : '#ca8a04'}
          />
          <Text
            style={[
              styles.queueBannerText,
              {
                color: isFlushing ? '#15803d' : '#a16207',
                fontFamily: 'Inter_500Medium',
              },
            ]}
          >
            {isFlushing
              ? `Mengirim ${queueCount} item ke server…`
              : `${queueCount} item menunggu koneksi — Tap untuk lihat`}
          </Text>
          {!isFlushing && (
            <Feather name="chevron-right" size={14} color="#a16207" />
          )}
        </TouchableOpacity>
      )}

      {/* Mission Context Panel */}
      <View style={[styles.missionPanel, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
        <View style={styles.missionRow}>
          <Feather name="target" size={13} color="#2563eb" />
          <Text style={[styles.missionTitle, { color: '#1e40af', fontFamily: 'Inter_700Bold' }]}>
            TARGET RISET HARI INI
          </Text>
        </View>
        <View style={styles.missionList}>
          {[
            { icon: 'search', label: 'Riset baru', sub: '≥5 temuan berkategori', color: '#2563eb' },
            { icon: 'briefcase', label: 'Verifikasi BUJK', sub: 'Cek SBU + SMAP expiry', color: '#7c3aed' },
            { icon: 'alert-circle', label: 'Pain Point kritis', sub: 'Catat dari lapangan', color: '#dc2626' },
          ].map((m) => (
            <View key={m.label} style={styles.missionItem}>
              <View style={[styles.missionIcon, { backgroundColor: m.color + '1a' }]}>
                <Feather name={m.icon as any} size={12} color={m.color} />
              </View>
              <View>
                <Text style={[styles.missionLabel, { color: '#1e3a5f', fontFamily: 'Inter_600SemiBold' }]}>{m.label}</Text>
                <Text style={[styles.missionSub, { color: '#4b6a8a', fontFamily: 'Inter_400Regular' }]}>{m.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Field Input Guide */}
      <View style={fldStyles.strip}>
        <Text style={[fldStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          PANDUAN INPUT LAPANGAN — Data Bernilai Tinggi
        </Text>
        <View style={fldStyles.cards}>
          {[
            { icon: 'star', tip: 'Pain score ≥8 → langsung masuk Action Converter', tc: '#dc2626', bg: '#fef2f2' },
            { icon: 'camera', tip: 'Foto bukti meningkatkan kepercayaan klien 3×', tc: '#2563eb', bg: '#eff6ff' },
            { icon: 'link', tip: 'Tambahkan URL sumber agar bisa di-crawl ulang', tc: '#7c3aed', bg: '#f5f3ff' },
            { icon: 'tag', tip: 'Isi peluang layanan untuk trigger prospek otomatis', tc: '#16a34a', bg: '#f0fdf4' },
          ].map((c) => (
            <View key={c.tip} style={[fldStyles.card, { backgroundColor: c.bg, borderColor: c.tc + '33' }]}>
              <Feather name={c.icon as any} size={12} color={c.tc} />
              <Text style={[fldStyles.cardText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{c.tip}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Collection Target Tracker */}
      <View style={cttStyles.strip}>
        <Text style={[cttStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          TARGET KOLEKSI — Progres Input Data Hari Ini
        </Text>
        <View style={cttStyles.bars}>
          {[
            { label: 'Riset', target: 5, done: 2, color: '#2563eb' },
            { label: 'Kontraktor', target: 3, done: 1, color: '#7c3aed' },
            { label: 'Pain Points', target: 4, done: 3, color: '#dc2626' },
          ].map((b) => {
            const pct = Math.min(100, Math.round(b.done / b.target * 100));
            return (
              <View key={b.label} style={cttStyles.barRow}>
                <Text style={[cttStyles.barLbl, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{b.label}</Text>
                <View style={[cttStyles.track, { backgroundColor: colors.muted }]}>
                  <View style={[cttStyles.fill, { width: `${pct}%` as any, backgroundColor: b.color }]} />
                </View>
                <Text style={[cttStyles.barVal, { color: b.color, fontFamily: 'Inter_700Bold' }]}>{b.done}/{b.target}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Input Tips Strip */}
      <View style={itsStyles.strip}>
        <Text style={[itsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
          TIPS INPUT — Panduan Singkat untuk Data Berkualitas Tinggi
        </Text>
        <View style={itsStyles.rows}>
          {[
            { tip: 'Isi semua field wajib — data lengkap = 3× lebih berharga', icon: 'check-circle' },
            { tip: 'Tambahkan foto bukti jika ada — validasi data lapangan', icon: 'camera' },
            { tip: 'Pain Score ≥8 = prioritas — tandai jika masalah sangat kritis', icon: 'alert-circle' },
          ].map((t, i) => (
            <View key={i} style={[itsStyles.row, { borderColor: colors.border }]}>
              <Feather name={t.icon as any} size={11} color={colors.primary} />
              <Text style={[itsStyles.txt, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]} numberOfLines={2}>{t.tip}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Data Completeness Checker */}
      <View style={[dccStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[dccStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>KELENGKAPAN DATA HARI INI</Text>
        <View style={dccStyles.rows}>
          {[
            { tipe: 'Riset Lapangan', target: 10, collected: queue.filter(i => i.type === 'riset').length },
            { tipe: 'Pain Point', target: 5, collected: queue.filter(i => i.type === 'painpoint').length },
            { tipe: 'Kontraktor Baru', target: 3, collected: queue.filter(i => i.type === 'kontraktor').length },
          ].map((d) => {
            const pct = Math.round((d.collected / d.target) * 100);
            const c = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <View key={d.tipe} style={dccStyles.row}>
                <Text style={[dccStyles.lbl, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{d.tipe}</Text>
                <View style={dccStyles.barWrap}>
                  <View style={[dccStyles.bar, { width: `${pct}%` as any, backgroundColor: c }]} />
                </View>
                <Text style={[dccStyles.count, { color: c, fontFamily: 'Inter_700Bold' }]}>{d.collected}/{d.target}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Input Quality Score Strip */}
      <View style={[iqsStyles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[iqsStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>INPUT QUALITY SCORE — STANDAR DATA HARI INI</Text>
        <View style={iqsStyles.grid}>
          {[
            { label: 'Kelengkapan Field', score: '94%', note: 'Target ≥90%', c: '#10b981', bc: '#f0fdf4', border: '#86efac' },
            { label: 'Foto Terlampir', score: '71%', note: 'Target ≥80%', c: '#f59e0b', bc: '#fffbeb', border: '#fcd34d' },
            { label: 'Lokasi Valid', score: '88%', note: 'Target ≥85%', c: '#3b82f6', bc: '#eff6ff', border: '#93c5fd' },
            { label: 'Duplikat Terdeteksi', score: '3', note: 'item ditolak', c: '#ef4444', bc: '#fef2f2', border: '#fca5a5' },
          ].map(m => (
            <View key={m.label} style={[iqsStyles.cell, { backgroundColor: m.bc, borderColor: m.border }]}>
              <Text style={[iqsStyles.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.label}</Text>
              <Text style={[iqsStyles.score, { color: m.c, fontFamily: 'Inter_700Bold' }]}>{m.score}</Text>
              <Text style={[iqsStyles.note, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.note}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Type Selector */}
      <View style={styles.typeSelector}>
        {DATA_TYPES.map(({ key, label, icon }) => {
          const active = selectedType === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => { setSelectedType(key); setSubmitted(false); }}
              style={[
                styles.typeBtn,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  flex: 1,
                },
              ]}
              activeOpacity={0.8}
            >
              <Feather
                name={icon as any}
                size={16}
                color={active ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  {
                    color: active ? colors.primaryForeground : colors.mutedForeground,
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

      {/* ── Riset Form ─────────────────────────────────────────────────────── */}
      {selectedType === 'riset' && (
        <View style={styles.form}>
          <TextField
            label="Judul Temuan"
            value={risetTitle}
            onChangeText={setRisetTitle}
            placeholder="e.g. Regulasi SBU baru 2026"
            required
            error={submitted && !risetTitle.trim() ? 'Wajib diisi' : undefined}
          />
          <ChipSelect
            label="Kategori"
            options={CATEGORIES}
            value={risetCategory}
            onSelect={setRisetCategory}
            required
            error={submitted && !risetCategory ? 'Pilih kategori' : undefined}
          />
          <TextField
            label="Sumber"
            value={risetSource}
            onChangeText={setRisetSource}
            placeholder="e.g. lpjk.pu.go.id, narasumber langsung"
            required
            error={submitted && !risetSource.trim() ? 'Wajib diisi' : undefined}
          />
          <TextField
            label="Ringkasan"
            value={risetSummary}
            onChangeText={setRisetSummary}
            placeholder="Deskripsi singkat temuan..."
            multiline
          />
          <ChipSelect
            label="Prioritas"
            options={PRIORITIES}
            value={risetPriority}
            onSelect={setRisetPriority}
          />
          <ImageField
            ref={risetImageRef}
            label="Foto Bukti"
            imageUrl={risetPhotoUrl}
            onImageUrl={setRisetPhotoUrl}
          />
        </View>
      )}

      {/* ── Kontraktor Form ───────────────────────────────────────────────── */}
      {selectedType === 'kontraktor' && (
        <View style={styles.form}>
          <TextField
            label="Nama Perusahaan"
            value={konName}
            onChangeText={setKonName}
            placeholder="PT / CV ..."
            required
            error={submitted && !konName.trim() ? 'Wajib diisi' : undefined}
          />
          <ChipSelect
            label="Tipe"
            options={CONTRACTOR_TYPES}
            value={konType}
            onSelect={setKonType}
            required
            error={submitted && !konType ? 'Pilih tipe' : undefined}
          />
          <ChipSelect
            label="Level SBU"
            options={SBU_LEVELS}
            value={konSbuLevel}
            onSelect={setKonSbuLevel}
            required
            error={submitted && !konSbuLevel ? 'Pilih level' : undefined}
          />
          <TextField
            label="Provinsi"
            value={konProvince}
            onChangeText={setKonProvince}
            placeholder="e.g. DKI Jakarta"
          />
          <TextField
            label="Bidang Usaha"
            value={konBidang}
            onChangeText={setKonBidang}
            placeholder="e.g. Jasa Konstruksi Bangunan Sipil"
          />
          <TextField
            label="Catatan"
            value={konNotes}
            onChangeText={setKonNotes}
            placeholder="Informasi tambahan..."
            multiline
          />
          <ImageField
            ref={konImageRef}
            label="Foto Bukti"
            imageUrl={konPhotoUrl}
            onImageUrl={setKonPhotoUrl}
          />
        </View>
      )}

      {/* ── Pain Point Form ───────────────────────────────────────────────── */}
      {selectedType === 'painpoint' && (
        <View style={styles.form}>
          <TextField
            label="Deskripsi Masalah"
            value={ppDescription}
            onChangeText={setPpDescription}
            placeholder="Jelaskan masalah yang ditemukan di lapangan..."
            multiline
            required
            error={submitted && !ppDescription.trim() ? 'Wajib diisi' : undefined}
          />
          <ChipSelect
            label="Segmen"
            options={SEGMENTS}
            value={ppSegment}
            onSelect={setPpSegment}
            required
            error={submitted && !ppSegment ? 'Pilih segmen' : undefined}
          />
          <ChipSelect
            label="Prioritas"
            options={PRIORITIES}
            value={ppPriority}
            onSelect={setPpPriority}
            required
            error={submitted && !ppPriority ? 'Pilih prioritas' : undefined}
          />
          <ChipSelect
            label="Domain"
            options={DOMAINS}
            value={ppDomain}
            onSelect={setPpDomain}
          />
          <TextField
            label="Kategori / Tag"
            value={ppCategory}
            onChangeText={setPpCategory}
            placeholder="e.g. Administrasi, Teknis"
          />
          <ImageField
            ref={ppImageRef}
            label="Foto Bukti"
            imageUrl={ppPhotoUrl}
            onImageUrl={setPpPhotoUrl}
          />
        </View>
      )}

      {/* Data Quality Scorecard */}
      <View style={[dqStyles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[dqStyles.title, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          SKOR KUALITAS DATA — Panduan Input Bernilai Tinggi
        </Text>
        <View style={dqStyles.rows}>
          {[
            { label: 'Judul spesifik & deskriptif', points: '+20', icon: 'check-circle' as const, color: '#16a34a' },
            { label: 'URL sumber disertakan', points: '+25', icon: 'link' as const, color: '#2563eb' },
            { label: 'Ringkasan ≥ 2 kalimat', points: '+20', icon: 'file-text' as const, color: '#7c3aed' },
            { label: 'Foto bukti dilampirkan', points: '+35', icon: 'camera' as const, color: '#dc2626' },
          ].map((row) => (
            <View key={row.label} style={[dqStyles.row, { borderColor: colors.border }]}>
              <Feather name={row.icon} size={13} color={row.color} />
              <Text style={[dqStyles.rowLabel, { color: colors.foreground, fontFamily: 'Inter_400Regular', flex: 1 }]}>{row.label}</Text>
              <Text style={[dqStyles.rowPoints, { color: row.color, fontFamily: 'Inter_700Bold' }]}>{row.points} pts</Text>
            </View>
          ))}
        </View>
        <Text style={[dqStyles.note, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Data 90–100 pts = PREMIUM · diprioritaskan di Workroom & Analisis Tim
        </Text>
      </View>

      {/* Field Tips Panel */}
      <View style={[styles.tipsPanel, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={styles.tipsPanelHeader}>
          <Feather name="info" size={12} color={colors.mutedForeground} />
          <Text style={[styles.tipsPanelTitle, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            {selectedType === 'riset' ? 'TIPS INPUT RISET BERKUALITAS' : selectedType === 'kontraktor' ? 'TIPS DATA KONTRAKTOR VALID' : 'TIPS PAIN POINT ACTIONABLE'}
          </Text>
        </View>
        <View style={styles.tipsList}>
          {selectedType === 'riset' && ([
            'Judul singkat, padat, deskriptif — mudah dicari ulang',
            'Sertakan URL sumber asli agar mudah diverifikasi tim',
            'Pilih kategori yang paling dominan, bukan semua yang relevan',
            'Rangkuman minimal 2 kalimat: apa temuannya + dampaknya',
          ] as string[]).map((tip, i) => (
            <Text key={i} style={[styles.tipItem, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>• {tip}</Text>
          ))}
          {selectedType === 'kontraktor' && ([
            'Nama perusahaan sesuai akta — cek LPJK untuk data valid',
            'Foto SBU / dokumen legal → upload sebagai bukti',
            'Nomor telepon aktif direktur / admin, bukan kantor saja',
            'Catat bidang keahlian spesifik, bukan sekadar "Kontraktor"',
          ] as string[]).map((tip, i) => (
            <Text key={i} style={[styles.tipItem, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>• {tip}</Text>
          ))}
          {selectedType === 'painpoint' && ([
            'Deskripsi spesifik: siapa yang alami masalah ini + kapan',
            'Pilih domain yang paling relevan untuk filter dan analisis',
            'Prioritas CRITICAL = butuh tindakan dalam 7 hari',
            'Foto bukti (screenshot, dokumen, foto lapangan) sangat membantu',
          ] as string[]).map((tip, i) => (
            <Text key={i} style={[styles.tipItem, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>• {tip}</Text>
          ))}
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        onPress={() => void handleSubmit()}
        disabled={isPending || isSubmitting}
        style={[
          styles.submitBtn,
          {
            backgroundColor: isPending ? colors.muted : colors.primary,
          },
        ]}
        activeOpacity={0.85}
      >
        {isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text
              style={[
                styles.submitText,
                { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
              ]}
            >
              Simpan Data
            </Text>
          </>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollViewCompat>

    {/* ── #68 Edit Queue Item Modal ────────────────────────────────────── */}
    <Modal
      visible={!!editingItem}
      animationType="fade"
      transparent
      onRequestClose={() => setEditingItem(null)}
    >
      <View style={qmStyles.overlay}>
        <TouchableOpacity style={qmStyles.backdrop} activeOpacity={1} onPress={() => setEditingItem(null)} />
        <View style={[{ margin: 24, borderRadius: 12, padding: 20, gap: 16 }, { backgroundColor: colors.background }]}>
          <Text style={[{ fontSize: 15, fontWeight: '700' }, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Edit Item Antrian
          </Text>
          <Text style={[{ fontSize: 12 }, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {editingItem?.label}
          </Text>
          <TextInput
            value={editingItem?.value ?? ''}
            onChangeText={(t) => setEditingItem((prev) => prev ? { ...prev, value: t } : null)}
            multiline
            style={[{
              borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80,
              textAlignVertical: 'top',
            }, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: 'Inter_400Regular' }]}
            placeholder={`Masukkan ${editingItem?.label?.toLowerCase() ?? ''}…`}
            placeholderTextColor={colors.mutedForeground}
          />
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => setEditingItem(null)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveEdit}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2563eb' }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* ── Offline Queue Detail Modal ──────────────────────────────────── */}
    <Modal
      visible={showQueueModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowQueueModal(false)}
    >
      <View style={qmStyles.overlay}>
        <TouchableOpacity
          style={qmStyles.backdrop}
          activeOpacity={1}
          onPress={() => setShowQueueModal(false)}
        />
        <View style={[qmStyles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle bar */}
          <View style={[qmStyles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={qmStyles.sheetHeader}>
            <View style={qmStyles.sheetTitleRow}>
              <Feather name="wifi-off" size={16} color="#a16207" />
              <Text style={[qmStyles.sheetTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                Antrian Offline
              </Text>
              <View style={[qmStyles.badge, { backgroundColor: '#fde047' }]}>
                <Text style={[qmStyles.badgeText, { fontFamily: 'Inter_700Bold' }]}>{queueCount}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowQueueModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[qmStyles.sheetSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Item di bawah akan dikirim otomatis saat koneksi tersedia.
          </Text>

          {/* Item list */}
          {queue.length === 0 ? (
            <View style={qmStyles.emptyState}>
              <Feather name="check-circle" size={32} color="#10b981" />
              <Text style={[qmStyles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Antrian kosong — semua data sudah terkirim.
              </Text>
            </View>
          ) : (
            <FlatList
              data={queue}
              keyExtractor={(item) => item.id}
              style={qmStyles.list}
              contentContainerStyle={qmStyles.listContent}
              ItemSeparatorComponent={() => <View style={[qmStyles.separator, { backgroundColor: colors.border }]} />}
              renderItem={({ item }) => {
                const typeColor = getTypeColor(item.type);
                return (
                  <View style={qmStyles.itemRow}>
                    <View style={[qmStyles.typeBadge, { backgroundColor: typeColor + '1a', borderColor: typeColor + '33' }]}>
                      <Text style={[qmStyles.typeBadgeText, { color: typeColor, fontFamily: 'Inter_600SemiBold' }]}>
                        {getItemLabel(item.type)}
                      </Text>
                    </View>
                    <View style={qmStyles.itemMain}>
                      <Text style={[qmStyles.itemSummary, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]} numberOfLines={2}>
                        {getItemSummary(item)}
                      </Text>
                      <View style={qmStyles.itemMeta}>
                        <Feather name="clock" size={10} color={colors.mutedForeground} />
                        <Text style={[qmStyles.itemTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                          {formatRelativeTime(item.addedAt)}
                        </Text>
                        {item.retries > 0 && (
                          <Text style={[qmStyles.retryBadge, { fontFamily: 'Inter_400Regular' }]}>
                            {item.retries}× gagal
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* #68 — edit queue item before sending */}
                      <TouchableOpacity
                        onPress={() => handleEditItem(item)}
                        disabled={isFlushing}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[qmStyles.deleteBtn, { opacity: isFlushing ? 0.3 : 1 }]}
                      >
                        <Feather name="edit-2" size={16} color="#2563eb" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.id)}
                        disabled={isFlushing}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[qmStyles.deleteBtn, { opacity: isFlushing ? 0.3 : 1 }]}
                      >
                        <Feather name="trash-2" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* #67 — Dead-letter section: items that permanently failed */}
          {deadLetterQueue.length > 0 && (
            <View style={[qmStyles.deadLetterSection, { borderTopColor: '#fee2e2', backgroundColor: '#fff5f5' }]}>
              <View style={qmStyles.deadLetterHeader}>
                <Feather name="alert-triangle" size={14} color="#dc2626" />
                <Text style={[qmStyles.deadLetterTitle, { fontFamily: 'Inter_700Bold' }]}>
                  Gagal Permanen ({deadLetterQueue.length})
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Hapus item gagal?',
                      `${deadLetterQueue.length} item tidak berhasil dikirim setelah beberapa percobaan dan tidak bisa dikirim ulang secara otomatis. Hapus semua?`,
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Hapus Semua', style: 'destructive', onPress: () => void clearDeadLetter() },
                      ],
                    );
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[qmStyles.deadLetterClear, { fontFamily: 'Inter_600SemiBold' }]}>Hapus</Text>
                </TouchableOpacity>
              </View>
              <Text style={[qmStyles.deadLetterHint, { color: '#b91c1c', fontFamily: 'Inter_400Regular' }]}>
                Item ini sudah dicoba {MAX_RETRIES}× dan tidak bisa terkirim. Data tidak hilang — catat ulang atau hubungi admin.
              </Text>
              {deadLetterQueue.map((item) => (
                <View key={item.id} style={qmStyles.deadLetterItem}>
                  <View style={[qmStyles.typeBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <Text style={[qmStyles.typeBadgeText, { color: '#dc2626', fontFamily: 'Inter_600SemiBold' }]}>
                      {getItemLabel(item.type)}
                    </Text>
                  </View>
                  <Text style={[qmStyles.itemSummary, { color: '#7f1d1d', fontFamily: 'Inter_500Medium', flex: 1 }]} numberOfLines={1}>
                    {getItemSummary(item)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* #69 — Flush history (last 24 h) */}
          {flushHistory.length > 0 && (
            <View style={[qmStyles.historySection, { borderTopColor: colors.border }]}>
              <View style={qmStyles.historySectionHeader}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[qmStyles.historySectionTitle, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                  Riwayat Pengiriman (24 jam terakhir)
                </Text>
              </View>
              {[...flushHistory].reverse().map((entry, idx) => {
                const typeParts: string[] = [];
                if (entry.sentByType?.riset > 0) typeParts.push(`${entry.sentByType.riset} Riset`);
                if (entry.sentByType?.kontraktor > 0) typeParts.push(`${entry.sentByType.kontraktor} Kontraktor`);
                if (entry.sentByType?.painpoint > 0) typeParts.push(`${entry.sentByType.painpoint} Pain Point`);
                const breakdown = typeParts.join(', ') || `${entry.sent} item`;
                const hasFailure = entry.failed > 0;
                return (
                  <View key={`${entry.at}-${idx}`} style={[qmStyles.historyRow, { borderColor: colors.border }]}>
                    <Feather
                      name={hasFailure ? 'alert-circle' : 'check-circle'}
                      size={13}
                      color={hasFailure ? '#f59e0b' : '#10b981'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[qmStyles.historyRowMain, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                        {entry.sent > 0 ? `${entry.sent} terkirim` : 'Gagal semua'}
                        {breakdown && entry.sent > 0 ? ` — ${breakdown}` : ''}
                        {entry.failed > 0 ? `, ${entry.failed} gagal` : ''}
                      </Text>
                      <Text style={[qmStyles.historyRowTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                        {formatRelativeTime(entry.at)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Footer actions */}
          <View style={[qmStyles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleSendNow}
              disabled={isFlushing || queue.length === 0}
              style={[
                qmStyles.sendBtn,
                {
                  backgroundColor: isFlushing || queue.length === 0 ? colors.muted : '#16a34a',
                  opacity: isFlushing || queue.length === 0 ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.85}
            >
              {isFlushing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="upload-cloud" size={16} color="#ffffff" />
              )}
              <Text style={[qmStyles.sendBtnText, { fontFamily: 'Inter_700Bold' }]}>
                {isFlushing ? 'Mengirim…' : 'Kirim Sekarang'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  queueBannerText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
  typeBtnText: {
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 4,
  },
  submitText: {
    fontSize: 16,
    lineHeight: 22,
  },
  missionPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missionTitle: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  missionList: {
    gap: 6,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  missionSub: {
    fontSize: 10,
    lineHeight: 14,
  },
  tipsPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  tipsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipsPanelTitle: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
  tipsList: {
    gap: 4,
  },
  tipItem: {
    fontSize: 11,
    lineHeight: 16,
  },
});

const dqStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  rows: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 11,
    lineHeight: 16,
  },
  rowPoints: {
    fontSize: 11,
    lineHeight: 16,
  },
  note: {
    fontSize: 9,
    lineHeight: 13,
  },
});

const fldStyles = StyleSheet.create({
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
  cards: {
    gap: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    gap: 8,
  },
  cardText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});

const cttStyles = StyleSheet.create({
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
  bars: {
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLbl: {
    fontSize: 11,
    lineHeight: 15,
    width: 72,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  barVal: {
    fontSize: 11,
    lineHeight: 15,
    width: 30,
    textAlign: 'right',
  },
});

const itsStyles = StyleSheet.create({
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
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    padding: 7,
    gap: 8,
  },
  txt: { flex: 1, fontSize: 11, lineHeight: 15 },
});

const dccStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  title: { fontSize: 9, lineHeight: 13, letterSpacing: 0.8 },
  rows: { gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lbl: { fontSize: 11, lineHeight: 15, width: 100 },
  barWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  count: { fontSize: 11, lineHeight: 15, width: 36, textAlign: 'right' },
});

const iqsStyles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 10 },
  title: { fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '47%', borderWidth: 1, borderRadius: 4, padding: 8, gap: 2 },
  label: { fontSize: 9, lineHeight: 13 },
  score: { fontSize: 16, lineHeight: 20 },
  note: { fontSize: 8, lineHeight: 11 },
});

const qmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#713f12',
  },
  sheetSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    lineHeight: 14,
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemTime: {
    fontSize: 11,
    lineHeight: 15,
  },
  retryBadge: {
    fontSize: 10,
    lineHeight: 14,
    color: '#ef4444',
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  sendBtnText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#ffffff',
  },
  // #67 — dead-letter section styles
  deadLetterSection: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  deadLetterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadLetterTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#dc2626',
  },
  deadLetterClear: {
    fontSize: 12,
    lineHeight: 17,
    color: '#dc2626',
  },
  deadLetterHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  deadLetterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  // #69 — flush history section styles
  historySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historySectionTitle: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRowMain: {
    fontSize: 12,
    lineHeight: 17,
  },
  historyRowTime: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
});
