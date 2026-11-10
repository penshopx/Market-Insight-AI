import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useOfflineQueueContext } from '@/contexts/OfflineQueueContext';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Small red badge dot shown on the Input tab icon when offline items are pending */
function QueueBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Beranda</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="input">
        <Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />
        <Label>Input</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cari">
        <Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} />
        <Label>Cari</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <Label>Notifikasi</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const safeAreaInsets = useSafeAreaInsets();
  const { queueCount } = useOfflineQueueContext();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="input"
        options={{
          title: 'Input',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              {isIOS ? (
                <SymbolView name="plus.circle" tintColor={color} size={24} />
              ) : (
                <Feather name="plus-circle" size={22} color={color} />
              )}
              <QueueBadge count={queueCount} color={colors.destructive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cari"
        options={{
          title: 'Cari',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="magnifyingglass" tintColor={color} size={24} />
            ) : (
              <Feather name="search" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Notifikasi',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell" tintColor={color} size={24} />
            ) : (
              <Feather name="bell" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
