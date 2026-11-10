import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
  onPress?: () => void;
}

export function StatCard({ label, value, icon, accent, warning, onPress }: StatCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={onPress ? handlePress : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: warning ? colors.destructive : colors.border,
          borderWidth: warning ? 1.5 : 1,
          opacity: pressed && onPress ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.iconRow}>{icon}</View>
      <Text
        style={[
          styles.value,
          {
            color: accent ? colors.primaryForeground : colors.foreground,
            fontFamily: 'Inter_700Bold',
          },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.label,
          {
            color: accent ? colors.primaryForeground : colors.mutedForeground,
            fontFamily: 'Inter_400Regular',
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 4,
    padding: 14,
    gap: 4,
  },
  iconRow: {
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
