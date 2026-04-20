import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useAuth } from '@/contexts/auth-context';

const C = {
  bg: '#FAFAF7',
  fg: '#0A0A0A',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.08)',
  muted: '#999999',
  mutedLight: '#CCCCCC',
  border: '#E8E5DF',
  error: '#D94040',
  white: '#FFFFFF',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 입장 애니메이션
  const headerY = useSharedValue(30);
  const headerOpacity = useSharedValue(0);
  const formY = useSharedValue(40);
  const formOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);
  const decorLine = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    headerY.value = withDelay(100, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));

    decorLine.value = withDelay(300, withTiming(1, { duration: 600 }));

    formOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    formY.value = withDelay(350, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));

    footerOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
  }, []);

  const headerAnim = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const formAnim = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formY.value }],
  }));
  const footerAnim = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));
  const lineAnim = useAnimatedStyle(() => ({
    transform: [{ scaleX: decorLine.value }],
    opacity: decorLine.value,
  }));

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 뒤로가기 */}
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>←</Text>
        </Pressable>

        {/* 헤더 */}
        <Animated.View style={[styles.header, headerAnim]}>
          <View style={styles.logoMark}>
            <View style={styles.diamond} />
          </View>
          <Text style={styles.title}>로그인</Text>
          <Text style={styles.subtitle}>
            다시 돌아오신 것을 환영합니다
          </Text>
          <Animated.View style={[styles.headerLine, lineAnim]} />
        </Animated.View>

        {/* 폼 */}
        <Animated.View style={[styles.formCard, formAnim]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>이메일</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={C.mutedLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.inputWrap}>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="비밀번호 입력"
                placeholderTextColor={C.mutedLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>
          </View>

          {error ? (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.error}
            >
              {error}
            </Animated.Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.btnMain,
              pressed && styles.btnPressed,
              loading && styles.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnMainText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
            {!loading && <Text style={styles.btnArrow}>→</Text>}
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert(
                '비밀번호 찾기',
                '비밀번호 재설정 기능은 곧 추가될 예정입니다.',
              )
            }
            hitSlop={8}
          >
            <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
        </Animated.View>

        {/* 하단 */}
        <Animated.View style={[styles.footer, footerAnim]}>
          <View style={styles.footerDivider}>
            <View style={styles.footerLine} />
            <Text style={styles.footerOr}>또는</Text>
            <View style={styles.footerLine} />
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>계정이 없으신가요?</Text>
            <Pressable onPress={() => router.replace('/(auth)/signup')} hitSlop={8}>
              <Text style={styles.footerLink}>회원가입</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 18,
    color: C.fg,
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  diamond: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: C.muted,
    marginBottom: 20,
  },
  headerLine: {
    width: 32,
    height: 1,
    backgroundColor: C.gold,
  },

  formCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.bg,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: C.fg,
  },
  error: {
    fontSize: 13,
    color: C.error,
    textAlign: 'center',
    fontWeight: '500',
  },

  btnMain: {
    backgroundColor: C.fg,
    paddingVertical: 17,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnMainText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  btnArrow: {
    color: C.gold,
    fontSize: 16,
    fontWeight: '300',
  },

  forgotText: {
    fontSize: 13,
    color: C.gold,
    textAlign: 'center',
    fontWeight: '600',
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    gap: 20,
  },
  footerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  footerOr: {
    fontSize: 12,
    color: C.mutedLight,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: C.muted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: C.gold,
  },
});
