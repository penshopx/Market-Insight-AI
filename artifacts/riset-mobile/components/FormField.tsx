import React, { useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';

// ─── Text Input ────────────────────────────────────────────────────────────────
interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  error?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  required,
  error,
}: TextFieldProps) {
  const colors = useColors();

  return (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            color: colors.foreground,
            backgroundColor: colors.background,
            borderColor: error ? colors.destructive : colors.border,
            fontFamily: 'Inter_400Regular',
          },
        ]}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Select Chips ───────────────────────────────────────────────────────────────
interface ChipSelectProps {
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  required?: boolean;
  error?: string;
}

export function ChipSelect({
  label,
  options,
  value,
  onSelect,
  required,
  error,
}: ChipSelectProps) {
  const colors = useColors();

  return (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.muted,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: selected ? colors.primaryForeground : colors.mutedForeground,
                    fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {opt.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Image Field ────────────────────────────────────────────────────────────────

/**
 * Returned by `ImageFieldHandle.uploadPending()` when an image is present.
 * `servingUrl` is the URL to store in the DB record.
 *
 * Orphan cleanup (upload succeeded but DB create failed) is handled entirely
 * by the server-side cleanup job in `cleanupOrphanUploads.ts`, which runs on
 * startup and every hour. The client does not attempt cleanup to avoid the
 * race condition where the server committed the row but the response was lost
 * (which would cause client-side deletion of a valid, referenced object).
 */
export interface UploadResult {
  servingUrl: string;
}

/**
 * Handle exposed via React.forwardRef so the parent form can trigger the
 * actual storage upload at submit time rather than immediately on pick.
 * This prevents orphan objects when the user abandons the form after picking
 * a photo but before pressing "Simpan".
 */
export interface ImageFieldHandle {
  /**
   * Upload the locally-picked image to storage.
   *
   * Returns `undefined` when no image has been selected at all.
   * Returns `{ servingUrl }` when an image exists (either newly uploaded or
   * already committed).
   *
   * The caller is responsible for storing `servingUrl` in the DB record.
   * Orphan cleanup on DB create failure is handled by the server-side job.
   *
   * Throws on upload failure — callers should handle and abort the submit.
   */
  uploadPending: () => Promise<UploadResult | undefined>;
  /**
   * Returns the local file URI of a pending (not yet uploaded) image pick,
   * or `undefined` when no image is pending.
   *
   * Use this to capture the local URI before calling `uploadPending()` so
   * that, if the upload fails due to being offline, the URI can be stored in
   * the offline queue and the upload retried automatically on reconnect.
   */
  getPendingLocalUri: () => string | undefined;
}

interface ImageFieldProps {
  label: string;
  /** Already-committed serving URL (e.g. loaded from DB for edit flows). */
  imageUrl: string | undefined;
  onImageUrl: (url: string | undefined) => void;
}

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

export const ImageField = React.forwardRef<ImageFieldHandle, ImageFieldProps>(
  function ImageField({ label, imageUrl, onImageUrl }, ref) {
    const colors = useColors();
    /** Local file URI chosen by the user but NOT yet uploaded. */
    const [pendingLocalUri, setPendingLocalUri] = useState<string | undefined>();
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | undefined>();

    // ── Concurrent-call guard ─────────────────────────────────────────────────
    const uploadInProgressRef = useRef(false);

    // ── Imperative API ────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getPendingLocalUri: (): string | undefined => pendingLocalUri,
      uploadPending: async (): Promise<UploadResult | undefined> => {
        // Prevent concurrent invocations (e.g. rapid double-tap that bypasses
        // the form-level submission lock).
        if (uploadInProgressRef.current) {
          throw new Error('Upload already in progress — concurrent call rejected');
        }
        if (!pendingLocalUri) {
          // Nothing pending — return the committed URL if one exists, or undefined.
          return imageUrl ? { servingUrl: imageUrl } : undefined;
        }
        uploadInProgressRef.current = true;
        setUploading(true);
        setUploadError(undefined);
        try {
          const uri = pendingLocalUri;
          const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
          const contentType =
            ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

          const localBlob = await (await fetch(uri)).blob();

          const uploadRes = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': contentType },
            body: localBlob,
          });

          if (!uploadRes.ok) {
            const err = (await uploadRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Upload failed: ${uploadRes.status}`);
          }

          const { objectPath } = (await uploadRes.json()) as {
            objectPath: string;
          };
          const servingUrl = `${BASE_URL}/api/storage${objectPath}`;
          setPendingLocalUri(undefined);
          onImageUrl(servingUrl);
          return { servingUrl };
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Gagal mengupload foto.';
          setUploadError(`${message} Coba lagi.`);
          throw e; // re-throw so handleSubmit can abort
        } finally {
          uploadInProgressRef.current = false;
          setUploading(false);
        }
      },
    }));

    // ── Camera / gallery pickers ──────────────────────────────────────────────
    const pickFromCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Kamera Ditolak',
          'Izin akses kamera diperlukan untuk mengambil foto bukti. Aktifkan di pengaturan aplikasi.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]) {
        setPendingLocalUri(result.assets[0].uri);
        // Clear any previously committed URL so the UI shows the new pick.
        onImageUrl(undefined);
        setUploadError(undefined);
      }
    };

    const pickFromGallery = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Galeri Ditolak',
          'Izin akses galeri diperlukan untuk memilih foto bukti. Aktifkan di pengaturan aplikasi.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]) {
        setPendingLocalUri(result.assets[0].uri);
        onImageUrl(undefined);
        setUploadError(undefined);
      }
    };

    const removeImage = () => {
      setPendingLocalUri(undefined);
      setUploadError(undefined);
      onImageUrl(undefined);
    };

    // Show local pick preview first; fall back to committed URL.
    const previewUri = pendingLocalUri ?? imageUrl;

    return (
      <View style={styles.fieldWrapper}>
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
          {label}
        </Text>

        {/* "Pending upload" badge */}
        {!!pendingLocalUri && !uploading && (
          <View style={imgStyles.pendingBadge}>
            <Feather name="clock" size={11} color="#92400e" />
            <Text style={[imgStyles.pendingBadgeText, { fontFamily: 'Inter_500Medium' }]}>
              Foto akan diupload saat Simpan
            </Text>
          </View>
        )}

        {/* Picker buttons — shown when no image yet */}
        {!previewUri && !uploading && (
          <View style={imgStyles.btnRow}>
            <TouchableOpacity
              onPress={pickFromCamera}
              style={[imgStyles.pickBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name="camera" size={18} color={colors.mutedForeground} />
              <Text
                style={[imgStyles.pickBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
              >
                Kamera
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromGallery}
              style={[imgStyles.pickBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name="image" size={18} color={colors.mutedForeground} />
              <Text
                style={[imgStyles.pickBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
              >
                Galeri
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload spinner without local preview yet */}
        {uploading && !previewUri && (
          <View
            style={[
              imgStyles.loadingPlaceholder,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator color={colors.mutedForeground} />
            <Text
              style={[
                imgStyles.pickBtnText,
                { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
              ]}
            >
              Mengupload…
            </Text>
          </View>
        )}

        {/* Thumbnail preview */}
        {!!previewUri && (
          <View style={imgStyles.previewContainer}>
            <Image
              source={{ uri: previewUri }}
              style={imgStyles.thumbnail}
              contentFit="cover"
              transition={200}
            />

            {/* Uploading overlay on top of thumbnail */}
            {uploading && (
              <View style={imgStyles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
                <Text
                  style={[imgStyles.uploadingText, { fontFamily: 'Inter_500Medium' }]}
                >
                  Mengupload…
                </Text>
              </View>
            )}

            {/* Remove button */}
            {!uploading && (
              <TouchableOpacity
                onPress={removeImage}
                style={[imgStyles.removeBtn, { backgroundColor: colors.destructive }]}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                <Feather name="x" size={13} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Re-pick buttons below thumbnail once an image is picked */}
            {!uploading && (
              <View style={imgStyles.rePick}>
                <TouchableOpacity onPress={pickFromCamera} style={imgStyles.rePickBtn} activeOpacity={0.7}>
                  <Feather name="camera" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromGallery} style={imgStyles.rePickBtn} activeOpacity={0.7}>
                  <Feather name="image" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {uploadError ? (
          <Text
            style={[styles.error, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}
          >
            {uploadError}
          </Text>
        ) : null}
      </View>
    );
  }
);

// ─── Shared styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fieldWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    lineHeight: 20,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

const imgStyles = StyleSheet.create({
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pendingBadgeText: {
    fontSize: 11,
    color: '#92400e',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
  },
  pickBtnText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
  },
  previewContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 6,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 13,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rePick: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  rePickBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
