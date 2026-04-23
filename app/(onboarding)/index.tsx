import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
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

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
  white: '#f2f4f6',
  inputBg: '#212a35',
};

type UserType = 'creator' | 'aspiring' | 'audience';

const FIELD_CATEGORIES = [
  { key: '글', icon: '✍️' },
  { key: '그림', icon: '🎨' },
  { key: '영상', icon: '🎬' },
  { key: '소리', icon: '🎵' },
  { key: '사진', icon: '📷' },
  { key: '입체/공간', icon: '🗿' },
  { key: '디지털/인터랙티브', icon: '💻' },
  { key: '공연', icon: '🎭' },
] as const;

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 11);

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

/* ── 선택 카드 ── */
function SelectionCard({
  emoji,
  title,
  desc,
  selected,
  onPress,
  delay: enterDelay,
}: {
  emoji: string;
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  delay: number;
}) {
  const borderProgress = useSharedValue(0);
  const cardScale = useSharedValue(1);

  useEffect(() => {
    borderProgress.value = withTiming(selected ? 1 : 0, { duration: 250 });
    if (selected) {
      cardScale.value = withSequence(
        withTiming(0.96, { duration: 100 }),
        withSpring(1, { damping: 10, stiffness: 200 }),
      );
    }
  }, [selected]);

  const cardAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(borderProgress.value, [0, 1], [C.border, C.gold]),
    backgroundColor: interpolateColor(borderProgress.value, [0, 1], [C.bg, '#212a35']),
    transform: [{ scale: cardScale.value }],
  }));

  const titleAnim = useAnimatedStyle(() => ({
    color: interpolateColor(borderProgress.value, [0, 1], [C.fg, C.gold]),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400).springify()}>
      <Pressable onPress={onPress}>
        <Animated.View style={[styles.card, cardAnim]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <View style={styles.cardContent}>
            <Animated.Text style={[styles.cardTitle, titleAnim]}>{title}</Animated.Text>
            <Text style={styles.cardDesc}>{desc}</Text>
          </View>
          <View style={[styles.cardRadio, selected && styles.cardRadioSelected]}>
            {selected && <View style={styles.cardRadioDot} />}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/* ── 메인 화면 ── */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<UserType | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const realNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

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

  useEffect(() => {
    const presetRealName = typeof user?.user_metadata?.real_name === 'string' ? user.user_metadata.real_name : '';
    if (presetRealName && !realName.trim()) {
      setRealName(presetRealName);
    }
  }, [user]);

  useEffect(() => {
    const presetDisplayName = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : '';
    if (presetDisplayName && !displayName.trim()) {
      setDisplayName(presetDisplayName);
    }
  }, [user]);

  useEffect(() => {
    const presetPhoneNumber = typeof user?.user_metadata?.phone_number === 'string' ? user.user_metadata.phone_number : '';
    if (presetPhoneNumber && !phoneNumber.trim()) {
      setPhoneNumber(normalizePhoneNumber(presetPhoneNumber));
    }
  }, [user]);

  const needsFieldSelection = selected === 'creator' || selected === 'aspiring';
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const canProceed = step === 1
    ? !!selected
    : !!displayName.trim()
      && !!realName.trim()
      && normalizedPhoneNumber.length >= 9
      && (!needsFieldSelection || selectedFields.length > 0);

  const btnGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.15 + btnGlow.value * 0.15,
    shadowRadius: 12 + btnGlow.value * 8,
  }));

  const handleNext = () => {
    if (step === 1 && selected) setStep(2);
  };

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleComplete = async () => {
    if (!displayName.trim() || !realName.trim() || normalizedPhoneNumber.length < 9 || !selected || !user) return;
    if (needsFieldSelection && selectedFields.length === 0) return;
    setLoading(true);
    await supabase
      .from('profiles')
      .update({
        user_type: selected,
        name: displayName.trim(),
        real_name: realName.trim(),
        phone_number: normalizedPhoneNumber,
        field: needsFieldSelection ? selectedFields.join(', ') : null,
      })
      .eq('id', user.id);

    await refreshProfile();
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 배경 떠다니는 도형들 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={50} color={C.gold} opacity={0.10} top="3%" left="0%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={70} color={C.goldLight} opacity={0.06} top="50%" left="55%" duration={7000} delay={800} />
        <FloatingShape shape="ring" size={48} color={C.gold} opacity={0.08} top="80%" left="8%" duration={5000} delay={400} />

        <FloatingShape shape="diamond" size={22} color={C.gold} opacity={0.22} top="8%" left="80%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={16} color={C.gold} opacity={0.18} top="60%" left="90%" duration={4200} delay={200} />
        <FloatingShape shape="diamond" size={28} color={C.goldLight} opacity={0.12} top="85%" left="68%" duration={3800} delay={1000} />
        <FloatingShape shape="diamond" size={12} color={C.gold} opacity={0.25} top="32%" left="3%" duration={3000} delay={1400} />

        <FloatingShape shape="circle" size={8} color={C.gold} opacity={0.30} top="15%" left="22%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={6} color={C.goldLight} opacity={0.25} top="42%" left="72%" duration={2500} delay={900} />
        <FloatingShape shape="circle" size={10} color={C.gold} opacity={0.20} top="65%" left="32%" duration={3200} delay={500} />
        <FloatingShape shape="circle" size={5} color={C.gold} opacity={0.35} top="78%" left="85%" duration={2200} delay={1200} />

        <FloatingShape shape="line" size={70} color={C.gold} opacity={0.12} top="12%" left="58%" duration={5000} delay={1500} />
        <FloatingShape shape="line" size={90} color={C.goldLight} opacity={0.08} top="72%" left="42%" duration={4500} delay={300} />
      </View>

      {/* 상단 로고 */}
      <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.top}>
        <Text style={styles.enLogo}>
          MOUI<Text style={{ color: C.gold }}>-</Text>IST
        </Text>
      </Animated.View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
      </View>

      {step === 1 ? (
        <>
          {/* 헤더 */}
          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.header}>
            <PlayfulDiamond />
            <Text style={styles.title}>어떤 활동을 하고 싶으세요?</Text>
            <Text style={styles.subtitle}>나중에 언제든 변경할 수 있어요</Text>
            <View style={styles.headerLine} />
          </Animated.View>

          {/* 선택 카드 */}
          <View style={styles.cards}>
            <SelectionCard
              emoji="🎨"
              title="작가"
              desc="작품을 올리고 감상자와 소통해요"
              selected={selected === 'creator'}
              onPress={() => setSelected('creator')}
              delay={400}
            />
            <SelectionCard
              emoji="✏️"
              title="지망생"
              desc="창작을 배우고 성장해 나가요"
              selected={selected === 'aspiring'}
              onPress={() => setSelected('aspiring')}
              delay={500}
            />
            <SelectionCard
              emoji="👀"
              title="감상자"
              desc="작품을 감상하고 작가를 응원해요"
              selected={selected === 'audience'}
              onPress={() => setSelected('audience')}
              delay={600}
            />
          </View>
        </>
      ) : (
        <>
          {/* Step 2: 이름 입력 */}
          <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
            <PlayfulDiamond />
            <Text style={styles.title}>기본 정보를 알려주세요</Text>
            <Text style={styles.subtitle}>활동명은 프로필에 표시되고, 연락처는 공개되지 않아요</Text>
            <View style={styles.headerLine} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={styles.nameForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>활동명 <Text style={{ color: C.gold }}>*</Text></Text>
              <TextInput
                style={styles.textInput}
                placeholder="모의스트에서 사용할 이름"
                placeholderTextColor={C.mutedLight}
                value={displayName}
                onChangeText={setDisplayName}
                returnKeyType="next"
                onSubmitEditing={() => realNameRef.current?.focus()}
                autoFocus
                maxLength={30}
              />
              <Text style={styles.inputHint}>다른 사용자에게 보이는 이름이에요</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>본명 <Text style={styles.inputRequired}>(필수)</Text></Text>
              <TextInput
                ref={realNameRef}
                style={styles.textInput}
                placeholder="실명 입력"
                placeholderTextColor={C.mutedLight}
                value={realName}
                onChangeText={setRealName}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                maxLength={30}
              />
              <Text style={styles.inputHint}>본인인증을 위해 꼭 필요하며 외부에는 공개되지 않아요</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>전화번호 <Text style={styles.inputRequired}>(필수)</Text></Text>
              <TextInput
                ref={phoneRef}
                style={styles.textInput}
                placeholder="01012345678"
                placeholderTextColor={C.mutedLight}
                value={phoneNumber}
                onChangeText={(value) => setPhoneNumber(normalizePhoneNumber(value))}
                keyboardType="phone-pad"
                autoComplete="tel"
                returnKeyType="done"
                onSubmitEditing={handleComplete}
                maxLength={11}
              />
              <Text style={styles.inputHint}>하이픈 없이 입력해 주세요. 외부에는 공개되지 않아요</Text>
            </View>

            {needsFieldSelection && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>분야 <Text style={styles.inputRequired}>(필수)</Text></Text>
                <View style={styles.chipGrid}>
                  {FIELD_CATEGORIES.map((cat) => {
                    const selectedField = selectedFields.includes(cat.key);
                    return (
                      <Pressable
                        key={cat.key}
                        onPress={() => toggleField(cat.key)}
                        style={[
                          styles.chip,
                          selectedField && styles.chipSelected,
                        ]}
                      >
                        <Text style={styles.chipIcon}>{cat.icon}</Text>
                        <Text style={[styles.chipText, selectedField && styles.chipTextSelected]}>{cat.key}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.inputHint}>작가와 지망생은 최소 1개의 분야 선택이 꼭 필요해요</Text>
              </View>
            )}
          </Animated.View>

          <View style={{ flex: 1 }} />
        </>
      )}

      {/* 하단 버튼 */}
      <View style={styles.bottom}>
        {step === 2 && (
          <Pressable onPress={() => setStep(1)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 이전</Text>
          </Pressable>
        )}

        <Pressable
          onPress={step === 1 ? handleNext : handleComplete}
          disabled={!canProceed || loading}
        >
          <Animated.View
            style={[
              styles.btnMain,
              !canProceed && styles.btnDisabled,
              btnGlowStyle,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#191f28" size="small" />
            ) : null}
            <Text style={styles.btnMainText}>
              {loading ? '설정 중...' : step === 1 ? '다음' : '시작하기'}
            </Text>
            {!loading && canProceed && <Text style={styles.btnArrow}>→</Text>}
          </Animated.View>
        </Pressable>

        <View style={styles.footerDivider}>
          <View style={styles.footerLine} />
          <View style={styles.footerDiamond} />
          <View style={styles.footerLine} />
        </View>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 28,
  },

  top: {
    alignItems: 'center',
    paddingTop: 20,
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
    marginBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 1,
    marginTop: 16,
    textAlign: 'center',
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

  cards: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  cardEmoji: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
  },
  cardDesc: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },
  cardRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRadioSelected: {
    borderColor: C.gold,
  },
  cardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
  },

  bottom: {
    paddingBottom: 24,
    paddingTop: 20,
    gap: 16,
  },
  btnMain: {
    backgroundColor: C.gold,
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.35,
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

  footerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
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

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginTop: 16,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  stepDotActive: {
    backgroundColor: C.gold,
  },
  stepLine: {
    width: 32,
    height: 1.5,
    backgroundColor: C.border,
  },
  stepLineActive: {
    backgroundColor: C.gold,
  },

  // Name form (Step 2)
  nameForm: {
    gap: 24,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.fg,
    letterSpacing: 0.5,
  },
  inputOptional: {
    fontSize: 12,
    fontWeight: '400',
    color: C.muted,
  },
  inputRequired: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
  },
  textInput: {
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.fg,
  },
  inputHint: {
    fontSize: 11,
    color: C.muted,
    marginLeft: 4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipSelected: {
    borderColor: C.gold,
    backgroundColor: 'rgba(200,169,110,0.12)',
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.muted,
  },
  chipTextSelected: {
    color: C.gold,
  },

  backBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 13,
    color: C.muted,
    letterSpacing: 1,
  },
});
