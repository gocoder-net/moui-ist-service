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

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session) {
      // 미인증 → auth 그룹으로
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    } else if (!profile?.user_type || profile.user_type === 'audience') {
      // 프로필이 아직 로드되지 않았을 수 있으므로 user_type 체크
      // handle_new_user 트리거가 기본값 'audience'를 설정하므로
      // 온보딩 완료 여부는 name 필드로 판단 (온보딩에서 설정)
      if (profile && !profile.name && !inOnboarding) {
        router.replace('/(onboarding)');
      } else if (profile && profile.name && (inAuthGroup || inOnboarding)) {
        router.replace('/(tabs)');
      }
    } else if (profile?.user_type === 'creator') {
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
    // 다이아몬드 등장
    diamondOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    diamondRotate.value = withDelay(200, withTiming(360, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // 로고 등장
    logoOpacity.value = withDelay(500, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withDelay(500, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) }));

    // 대시 등장
    dashOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));

    // 태그라인 등장
    taglineOpacity.value = withDelay(1200, withTiming(1, { duration: 500 }));

    // 페이드 아웃
    splashOpacity.value = withDelay(2200, withTiming(0, { duration: 500 }, () => {
      runOnJS(setSplashDone)(true);
    }));
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const dashAnimStyle = useAnimatedStyle(() => ({
    opacity: dashOpacity.value,
  }));

  const diamondAnimStyle = useAnimatedStyle(() => ({
    opacity: diamondOpacity.value,
    transform: [{ rotate: `${diamondRotate.value}deg` }],
  }));

  const taglineAnimStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const splashAnimStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  if (!splashDone || loading) {
    return (
      <Animated.View style={[splash.container, splashAnimStyle]}>
        <View style={splash.content}>
          <Animated.View style={[splash.diamond, diamondAnimStyle]} />

          <View style={splash.logoRow}>
            <Animated.Text style={[splash.logoText, logoAnimStyle]}>
              MOUI
            </Animated.Text>
            <Animated.Text style={[splash.logoDash, dashAnimStyle]}>
              -
            </Animated.Text>
            <Animated.Text style={[splash.logoText, logoAnimStyle]}>
              IST
            </Animated.Text>
          </View>

          <Animated.View style={[splash.divider, dashAnimStyle]} />
        </View>

        <Animated.Text style={[splash.bottomText, taglineAnimStyle]}>
          모의스트
        </Animated.Text>
      </Animated.View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
    </Stack>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
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
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
