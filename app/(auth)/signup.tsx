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
import { supabase } from '@/lib/supabase';

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
  error: '#D94040',
  white: '#f2f4f6',
  inputBg: '#212a35',
};

/* ── 배경 떠다니는 도형 (랜딩 화면과 동일) ── */
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

/* ── 장난스러운 다이아몬드 (랜딩 화면과 동일) ── */
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

  return (
    <Animated.View style={[diamondStyles.box, animStyle]} />
  );
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

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 11);

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
  helperText,
  autoCapitalize = 'none',
  required = false,
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
  helperText?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  required?: boolean;
  delay: number;
}) {
  const focused = useSharedValue(0);
  const borderAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focused.value, [0, 1], [C.border, C.gold]),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400).springify()}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.labelRequired}> *필수</Text> : null}
      </Text>
      <Animated.View style={[styles.inputWrap, borderAnim]}>
        <TextInput
          ref={inputRef as any}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.mutedLight}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => { focused.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { focused.value = withTiming(0, { duration: 200 }); }}
        />
      </Animated.View>
      {helperText ? <Text style={styles.inputHint}>{helperText}</Text> : null}
    </Animated.View>
  );
}

/* ── 메인 화면 ── */
export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const usernameRef = useRef<TextInput>(null);
  const realNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realName, setRealName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const USERNAME_REGEX = /^[a-z0-9_.]{2,20}$/;

  const handleUsernameChange = (text: string) => {
    const lower = text.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
    setUsername(lower);

    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    if (!lower || lower.length < 2) {
      setUsernameStatus(lower ? 'invalid' : 'idle');
      return;
    }
    if (!USERNAME_REGEX.test(lower)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', lower)
        .maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);
  };

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

  const handleSignUp = async () => {
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!displayName.trim() || !username.trim() || !realName.trim() || !normalizedPhoneNumber || !email.trim() || !password || !confirmPassword) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setError('아이디는 영문 소문자, 숫자, 밑줄, 점만 사용 가능합니다. (2~20자)');
      return;
    }
    if (usernameStatus !== 'available') {
      setError('아이디 중복 확인을 해주세요.');
      return;
    }
    if (normalizedPhoneNumber.length < 9) {
      setError('전화번호를 올바르게 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await signUp(
      email.trim(),
      password,
      realName.trim(),
      displayName.trim(),
      normalizedPhoneNumber,
      username.trim(),
    );
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 배경 떠다니는 도형들 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={120} color={C.gold} opacity={0.10} top="3%" left="0%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={160} color={C.goldLight} opacity={0.06} top="45%" left="55%" duration={7000} delay={800} />
        <FloatingShape shape="ring" size={80} color={C.gold} opacity={0.08} top="75%" left="8%" duration={5000} delay={400} />

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
            <Text style={styles.title}>회원가입</Text>
            <Text style={styles.subtitle}>창작의 여정을 함께 시작하세요</Text>
            <View style={styles.headerLine} />
          </Animated.View>

          {/* 폼 */}
          <View style={styles.form}>
            <AnimatedInput
              label="활동명"
              placeholder="모의스트에서 사용할 이름"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => usernameRef.current?.focus()}
              helperText="다른 사용자에게 보이는 이름이에요."
              required
              delay={350}
            />

            <Animated.View entering={FadeInDown.delay(390).duration(400).springify()}>
              <Text style={styles.label}>
                아이디<Text style={styles.labelRequired}> *필수</Text>
              </Text>
              <View style={[styles.inputWrap, { borderColor: usernameStatus === 'taken' ? C.error : usernameStatus === 'available' ? '#22c55e' : C.border }]}>
                <TextInput
                  ref={usernameRef}
                  style={styles.input}
                  placeholder="영문 소문자, 숫자, 밑줄, 점 (2~20자)"
                  placeholderTextColor={C.mutedLight}
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => realNameRef.current?.focus()}
                />
              </View>
              <Text style={[
                styles.inputHint,
                usernameStatus === 'taken' && { color: C.error },
                usernameStatus === 'available' && { color: '#22c55e' },
              ]}>
                {usernameStatus === 'idle' && '프로필 URL에 사용됩니다. (예: moui-ist.com/artist/myid)'}
                {usernameStatus === 'invalid' && '영문 소문자, 숫자, 밑줄(_), 점(.)만 가능 (2~20자)'}
                {usernameStatus === 'checking' && '확인 중...'}
                {usernameStatus === 'available' && '✓ 사용 가능한 아이디입니다.'}
                {usernameStatus === 'taken' && '✗ 이미 사용 중인 아이디입니다.'}
              </Text>
            </Animated.View>

            <AnimatedInput
              label="본명"
              placeholder="실명 입력"
              value={realName}
              onChangeText={setRealName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              inputRef={realNameRef}
              helperText="본인인증을 위해 꼭 필요하며 외부에는 공개되지 않아요."
              required
              delay={430}
            />

            <AnimatedInput
              label="전화번호"
              placeholder="01012345678"
              value={phoneNumber}
              onChangeText={(value) => setPhoneNumber(normalizePhoneNumber(value))}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              inputRef={phoneRef}
              helperText="하이픈 없이 입력해 주세요. 외부에는 공개되지 않아요."
              required
              delay={510}
            />

            <AnimatedInput
              label="이메일"
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              inputRef={emailRef}
              required
              delay={590}
            />

            <AnimatedInput
              label="비밀번호"
              placeholder="6자 이상"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              inputRef={passwordRef}
              required
              delay={670}
            />

            <AnimatedInput
              label="비밀번호 확인"
              placeholder="다시 입력"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              inputRef={confirmRef}
              required
              delay={750}
            />

            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
                {error}
              </Animated.Text>
            ) : null}

            <Animated.View entering={FadeInDown.delay(850).duration(400).springify()}>
              <Pressable
                onPress={handleSignUp}
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
                    <ActivityIndicator color="#191f28" size="small" />
                  ) : null}
                  <Text style={styles.btnMainText}>
                    {loading ? '가입 중...' : '가입하기'}
                  </Text>
                  {!loading && <Text style={styles.btnArrow}>→</Text>}
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>

          {/* 하단 */}
          <Animated.View entering={FadeIn.delay(950).duration(400)} style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>이미 계정이 있으신가요?</Text>
              <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
                <Text style={styles.footerLink}>로그인</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
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
    backgroundColor: '#212a35',
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
    marginTop: 16,
    marginBottom: 32,
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
  labelRequired: {
    color: C.gold,
    letterSpacing: 0.5,
    textTransform: 'none',
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
  inputHint: {
    fontSize: 11,
    color: C.muted,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 16,
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
    color: '#191f28',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  btnArrow: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '300',
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    paddingBottom: 24,
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
