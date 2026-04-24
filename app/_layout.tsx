import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const { mode, colors } = useThemeMode();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inPublic = segments[0] === 'exhibition' || segments[0] === 'artist' || segments[0] === '3dexhibition';

    if (!session) {
      if (!inAuthGroup && !inPublic) {
        router.replace('/(auth)');
      }
    } else if (profile) {
      if (!profile.name && !inOnboarding) {
        router.replace('/(onboarding)');
      } else if (profile.name && (inAuthGroup || inOnboarding)) {
        router.replace('/(tabs)');
      }
    }
  }, [session, profile, loading, segments]);

  const [splashDone, setSplashDone] = useState(false);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const dashOpacity = useSharedValue(0);
  const diamondRotate = useSharedValue(0);
  const diamondOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const splashOpacity = useSharedValue(1);

  useEffect(() => {
    diamondOpacity.value = withDelay(50, withTiming(1, { duration: 100 }));
    diamondRotate.value = withDelay(50, withTiming(360, { duration: 200, easing: Easing.out(Easing.cubic) }));
    logoOpacity.value = withDelay(125, withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withDelay(125, withTiming(1, { duration: 150, easing: Easing.out(Easing.back(1.5)) }));
    dashOpacity.value = withDelay(225, withTiming(1, { duration: 100 }));
    taglineOpacity.value = withDelay(300, withTiming(1, { duration: 125 }));
    splashOpacity.value = withDelay(550, withTiming(0, { duration: 125 }, () => {
      runOnJS(setSplashDone)(true);
    }));
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const dashAnimStyle = useAnimatedStyle(() => ({ opacity: dashOpacity.value }));
  const diamondAnimStyle = useAnimatedStyle(() => ({
    opacity: diamondOpacity.value,
    transform: [{ rotate: `${diamondRotate.value}deg` }],
  }));
  const taglineAnimStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const splashAnimStyle = useAnimatedStyle(() => ({ opacity: splashOpacity.value }));

  const navTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="exhibition/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="artist/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="3dexhibition/[username]/[num]" options={{ headerShown: false }} />
          <Stack.Screen name="artwork/create" options={{ headerShown: false }} />
          <Stack.Screen name="profile/detail" options={{ headerShown: false }} />
          <Stack.Screen name="profile/points" options={{ headerShown: false }} />
          <Stack.Screen name="profile/settings" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
        </Stack>

        {(!splashDone || loading) && (
          <Animated.View style={[splash.container, splashAnimStyle, StyleSheet.absoluteFill]}>
            <View style={splash.content}>
              <Animated.View style={[splash.diamond, diamondAnimStyle]} />
              <View style={splash.logoRow}>
                <Animated.Text style={[splash.logoText, logoAnimStyle]}>MOUI</Animated.Text>
                <Animated.Text style={[splash.logoDash, dashAnimStyle]}>-</Animated.Text>
                <Animated.Text style={[splash.logoText, logoAnimStyle]}>IST</Animated.Text>
              </View>
              <Animated.View style={[splash.divider, dashAnimStyle]} />
            </View>
            <Animated.Text style={[splash.bottomText, taglineAnimStyle]}>모의스트</Animated.Text>
          </Animated.View>
        )}
      </View>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  diamond: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#C8A96E',
    transform: [{ rotate: '45deg' }],
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  logoDash: {
    fontSize: 42,
    fontWeight: '200',
    color: '#C8A96E',
    marginHorizontal: 2,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#C8A96E',
  },
  bottomText: {
    position: 'absolute',
    bottom: 60,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 6,
    color: '#555555',
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <RootNavigator />
      </ThemeModeProvider>
    </AuthProvider>
  );
}
