import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { APP_TAB_ITEMS } from '@/constants/tab-navigation';
import { useThemeMode } from '@/contexts/theme-context';

export function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, colors: C } = useThemeMode();
  const paddingBottom = Math.max(insets.bottom, 8);

  const content = (
    <View style={[tabStyles.tabRow, { paddingBottom }]}>
      {APP_TAB_ITEMS.map((tab) => (
        <Pressable
          key={tab.path}
          onPress={() => router.replace(tab.path as any)}
          style={({ pressed }) => [tabStyles.tab, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol size={22} name={tab.icon} color={C.mutedLight} />
          <Text style={[tabStyles.tabLabel, { color: C.mutedLight }]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[tabStyles.wrapper, { position: 'fixed' as any }]}>
        <View style={[tabStyles.blurFallback, {
          backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(245, 246, 248, 0.85)',
        }]}>{content}</View>
      </View>
    );
  }

  return (
    <View style={tabStyles.wrapper}>
      <BlurView intensity={60} tint={mode === 'dark' ? 'dark' : 'light'} style={tabStyles.blur}>
        {content}
      </BlurView>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  blur: {
    overflow: 'hidden',
  },
  blurFallback: {
    backdropFilter: 'blur(20px)',
  } as any,
  tabRow: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200, 169, 110, 0.12)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
