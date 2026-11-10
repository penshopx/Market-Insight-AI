import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { ExpiringCertification } from '@workspace/api-client-react';

interface CertAlertProps {
  cert: ExpiringCertification;
  compact?: boolean;
}

export function CertAlert({ cert, compact }: CertAlertProps) {
  const colors = useColors();

  const urgencyColor =
    cert.daysLeft <= 7
      ? colors.destructive
      : cert.daysLeft <= 14
        ? '#f97316'
        : '#eab308';

  const handleWAShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = encodeURIComponent(
      `⚠️ *Sertifikasi Hampir Expire*\n\n` +
      `*${cert.holderName}*\n` +
      `Tipe: ${cert.type}${cert.level ? ` · Jenjang ${cert.level}` : ''}\n` +
      (cert.certNumber ? `No: ${cert.certNumber}\n` : '') +
      `⏰ Expire dalam: *${cert.daysLeft} hari* (${cert.expiryDate})\n\n` +
      (cert.contactPhone ? `📱 ${cert.contactPhone}\n\n` : '') +
      `Segera perpanjang sebelum habis masa berlakunya.\n\nPlatform Riset Marketing Konstruksi — PT Maheswara Jaya Persada`
    );
    Linking.openURL(`https://wa.me/?text=${text}`);
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: urgencyColor,
          borderLeftColor: urgencyColor,
          borderRadius: 4,
        },
      ]}
    >
      <View style={[styles.urgencyBar, { backgroundColor: urgencyColor }]} />
      <View style={styles.body}>
        <Text
          style={[styles.name, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
          numberOfLines={1}
        >
          {cert.holderName}
        </Text>
        <Text
          style={[styles.meta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={1}
        >
          {cert.type}
          {cert.level ? ` · Jenjang ${cert.level}` : ''}
          {cert.certNumber ? ` · ${cert.certNumber}` : ''}
        </Text>
        {!compact && (
          <View style={styles.actions}>
            <Pressable onPress={handleWAShare} style={styles.waBtn}>
              <Feather name="share-2" size={11} color="#16a34a" />
              <Text style={[styles.waBtnText, { fontFamily: 'Inter_500Medium' }]}>Bagikan</Text>
            </Pressable>
            {cert.contactPhone ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const phone = cert.contactPhone!.replace(/\D/g, '');
                  const wa = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
                  const text = encodeURIComponent(
                    `Halo ${cert.holderName}, kami ingin mengingatkan bahwa sertifikasi ${cert.type} Anda akan expire dalam ${cert.daysLeft} hari (${cert.expiryDate}). Kami siap membantu perpanjangan. Bisa kami jadwalkan konsultasi?\n\n— Tim PT Maheswara Jaya Persada`
                  );
                  Linking.openURL(`https://wa.me/${wa}?text=${text}`);
                }}
                style={styles.callBtn}
              >
                <Feather name="phone-call" size={11} color="#2563eb" />
                <Text style={[styles.callBtnText, { fontFamily: 'Inter_500Medium' }]}>Hubungi</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
      <View style={styles.badge}>
        <Feather name="clock" size={12} color={urgencyColor} />
        <Text style={[styles.days, { color: urgencyColor, fontFamily: 'Inter_700Bold' }]}>
          {cert.daysLeft}h
        </Text>
        <Text style={[styles.daysLabel, { color: urgencyColor, fontFamily: 'Inter_400Regular' }]}>
          hari
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  urgencyBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  name: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  contact: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    alignItems: 'center',
    paddingRight: 14,
    gap: 0,
  },
  days: {
    fontSize: 18,
    lineHeight: 22,
  },
  daysLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  waBtnText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#16a34a',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  callBtnText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#2563eb',
  },
});
