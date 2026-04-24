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
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  interpolateColor,
} from 'react-native-reanimated';
import { useAuth } from '@/contexts/auth-context';

const C = {
  bg: '#000000',
  fg: '#f5f5f5',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#a8a8a8',
  mutedLight: '#363636',
  border: '#262626',
  error: '#D94040',
  white: '#f5f5f5',
  inputBg: '#121212',
};

/* ── 배경 떠다니는 도형 ── */
function FloatingShape({
  size,
  color,
  opacity,
  top,
  left,
  duration,
  delay,
  shape,
}: {
  size: number;
  color: string;
  opacity: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  shape: 'circle' | 'diamond' | 'ring' | 'line';
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-20, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(20, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    translateX.value = withDelay(
      delay + 500,
      withRepeat(
        withSequence(
          withTiming(12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
          withTiming(-12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: duration * 4, easing: Easing.linear }),
        -1,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.85, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  const shapeStyle = (() => {
    switch (shape) {
      case 'circle':
        return { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity };
      case 'diamond':
        return { width: size, height: size, borderWidth: 1, borderColor: color, opacity, transform: [{ rotate: '45deg' }] };
      case 'ring':
        return { width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color, opacity };
      case 'line':
        return { width: size, height: 1, backgroundColor: color, opacity };
    }
  })();

  return (
    <Animated.View style={[{ position: 'absolute', top: top as any, left: left as any }, animStyle]}>
      <View style={shapeStyle} />
    </Animated.View>
  );
}

/* ── 장난스러운 다이아몬드 ── */
function PlayfulDiamond() {
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const play = () => {
      rot.value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.in(Easing.cubic) }),
        withSpring(360, { damping: 6, stiffness: 200 }),
        withDelay(1500, withTiming(360, { duration: 0 })),
        withTiming(180, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        withSpring(180, { damping: 8, stiffness: 250 }),
        withDelay(2000, withTiming(180, { duration: 0 })),
        withTiming(720, { duration: 800, easing: Easing.in(Easing.quad) }),
        withSpring(720, { damping: 5, stiffness: 180 }),
        withDelay(1200, withTiming(720, { duration: 0 })),
        withTiming(740, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withSpring(720, { damping: 10, stiffness: 300 }),
        withDelay(1500, withTiming(0, { duration: 0 })),
      );
      scale.value = withSequence(
        withTiming(1.1, { duration: 300 }),
        withTiming(1, { duration: 300 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
        withTiming(0.9, { duration: 200 }),
        withSpring(1, { damping: 8 }),
        withDelay(2000, withTiming(1, { duration: 0 })),
        withTiming(1.15, { duration: 400 }),
        withTiming(1, { duration: 400 }),
        withDelay(1200, withTiming(1, { duration: 0 })),
        withTiming(1.05, { duration: 200 }),
        withSpring(1, { damping: 12 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
      );
    };
    play();
    const interval = setInterval(play, 9200);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  return <Animated.View style={[diamondStyles.box, animStyle]} />;
}

const diamondStyles = StyleSheet.create({
  box: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
});

/* ── 인풋 포커스 애니메이션 ── */
function AnimatedInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  autoComplete,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  inputRef,
  delay: enterDelay,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  autoComplete?: any;
  keyboardType?: any;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  delay: number;
}) {
  const focused = useSharedValue(0);
  const borderAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focused.value, [0, 1], [C.border, C.gold]),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400).springify()}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrap, borderAnim]}>
        <TextInput
          ref={inputRef as any}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.mutedLight}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => { focused.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { focused.value = withTiming(0, { duration: 200 }); }}
        />
      </Animated.View>
    </Animated.View>
  );
}

/* ── 메인 화면 ── */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 버튼 펄스
  const btnGlow = useSharedValue(0);
  useEffect(() => {
    btnGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const btnGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.15 + btnGlow.value * 0.15,
    shadowRadius: 12 + btnGlow.value * 8,
  }));

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      setLoading(false);

      if (result.error) {
        const msg = result.error.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (msg.includes('email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.');
        } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
          setError('너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.');
        } else if (msg.includes('user not found')) {
          setError('등록되지 않은 이메일입니다.');
        } else if (msg.includes('network') || msg.includes('fetch')) {
          setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        } else {
          setError(`로그인에 실패했습니다: ${result.error}`);
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(`로그인 오류: ${err?.message ?? '알 수 없는 오류가 발생했습니다.'}`);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 배경 떠다니는 도형들 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={50} color={C.gold} opacity={0.10} top="3%" left="0%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={70} color={C.goldLight} opacity={0.06} top="45%" left="55%" duration={7000} delay={800} />
        <FloatingShape shape="ring" size={48} color={C.gold} opacity={0.08} top="75%" left="8%" duration={5000} delay={400} />

        <FloatingShape shape="diamond" size={22} color={C.gold} opacity={0.22} top="8%" left="80%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={16} color={C.gold} opacity={0.18} top="55%" left="90%" duration={4200} delay={200} />
        <FloatingShape shape="diamond" size={28} color={C.goldLight} opacity={0.12} top="82%" left="68%" duration={3800} delay={1000} />
        <FloatingShape shape="diamond" size={12} color={C.gold} opacity={0.25} top="28%" left="3%" duration={3000} delay={1400} />

        <FloatingShape shape="circle" size={8} color={C.gold} opacity={0.30} top="18%" left="22%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={6} color={C.goldLight} opacity={0.25} top="38%" left="72%" duration={2500} delay={900} />
        <FloatingShape shape="circle" size={10} color={C.gold} opacity={0.20} top="60%" left="32%" duration={3200} delay={500} />
        <FloatingShape shape="circle" size={5} color={C.gold} opacity={0.35} top="78%" left="82%" duration={2200} delay={1200} />
        <FloatingShape shape="circle" size={7} color={C.goldLight} opacity={0.25} top="90%" left="18%" duration={2600} delay={700} />

        <FloatingShape shape="line" size={70} color={C.gold} opacity={0.12} top="15%" left="58%" duration={5000} delay={1500} />
        <FloatingShape shape="line" size={90} color={C.goldLight} opacity={0.08} top="68%" left="42%" duration={4500} delay={300} />
      </View>

      <View style={styles.innerContainer}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 상단 네비게이션 */}
          <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.nav}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.enLogo}>
              MOUI<Text style={{ color: C.gold }}>-</Text>IST
            </Text>
            <View style={{ width: 40 }} />
          </Animated.View>

          {/* 헤더 */}
          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.header}>
            <PlayfulDiamond />
            <Text style={styles.title}>로그인</Text>
            <Text style={styles.subtitle}>다시 돌아오신 것을 환영합니다</Text>
            <View style={styles.headerLine} />
          </Animated.View>

          {/* 폼 */}
          <View style={styles.form}>
            <AnimatedInput
              label="이메일"
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              delay={350}
            />

            <AnimatedInput
              label="비밀번호"
              placeholder="비밀번호 입력"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              inputRef={passwordRef}
              delay={450}
            />

            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
                {error}
              </Animated.Text>
            ) : null}

            <Animated.View entering={FadeInDown.delay(550).duration(400).springify()}>
              <Pressable
                onPress={handleLogin}
                disabled={loading}
              >
                <Animated.View
                  style={[
                    styles.btnMain,
                    loading && styles.btnDisabled,
                    btnGlowStyle,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : null}
                  <Text style={styles.btnMainText}>
                    {loading ? '로그인 중...' : '로그인'}
                  </Text>
                  {!loading && <Text style={styles.btnArrow}>→</Text>}
                </Animated.View>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(650).duration(300)}>
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
          </View>

          {/* 하단 */}
          <Animated.View entering={FadeIn.delay(750).duration(400)} style={styles.footer}>
            <View style={styles.footerDivider}>
              <View style={styles.footerLine} />
              <View style={styles.footerDiamond} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 18,
    color: C.fg,
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },

  header: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 36,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 4,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: C.muted,
    letterSpacing: 1,
  },
  headerLine: {
    width: 28,
    height: 1,
    backgroundColor: C.gold,
    marginTop: 4,
  },

  form: {
    gap: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.inputBg,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: C.fg,
  },
  error: {
    fontSize: 13,
    color: C.error,
    textAlign: 'center',
    fontWeight: '600',
    paddingVertical: 4,
  },

  btnMain: {
    backgroundColor: C.gold,
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnMainText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  btnArrow: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '300',
  },

  forgotText: {
    fontSize: 13,
    color: C.gold,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    paddingBottom: 24,
    gap: 16,
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
  footerDiamond: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
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
