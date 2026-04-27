import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { r2Upload } from '@/lib/r2';
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
import { PlayfulDiamond } from '@/components/ui/PlayfulDiamond';
import { FloatingShape } from '@/components/ui/FloatingShape';

const C = {
  bg: '#000000',
  fg: '#f5f5f5',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#a8a8a8',
  mutedLight: '#363636',
  border: '#262626',
  white: '#f5f5f5',
  inputBg: '#121212',
};

type UserType = 'creator' | 'aspiring' | 'audience';

const FIELD_CATEGORIES = [
  { key: '글', icon: '✍️', keywords: ['소설가', '시인', '에세이스트', '극작가', '평론가', '작가', '글작가', '문학', '수필가', '번역가', '칼럼니스트', '소설', '시', '에세이', '극본', '평론'] },
  { key: '그림', icon: '🎨', keywords: ['화가', '일러스트레이터', '만화가', '캘리그래퍼', '그래픽 디자이너', '회화', '수채화', '유화', '드로잉', '일러스트', '만화', '캘리그래피', '판화'] },
  { key: '영상', icon: '🎬', keywords: ['영화감독', '영상작가', '애니메이터', 'VJ', '영상감독', '시네마토그래퍼', 'PD', '영화', '애니메이션', '다큐멘터리', '뮤직비디오'] },
  { key: '소리', icon: '🎵', keywords: ['작곡가', '연주자', '사운드 아티스트', 'DJ', '뮤지션', '음악가', '성악가', '래퍼', '프로듀서', '작곡', '연주', '보컬', '싱어송라이터'] },
  { key: '사진', icon: '📷', keywords: ['사진작가', '포토그래퍼', '사진가', '사진'] },
  { key: '입체/공간', icon: '🗿', keywords: ['조각가', '도예가', '설치미술가', '건축가', '공예가', '금속공예', '목공예', '세라믹', '조각', '도자기', '설치미술', '건축', '도예', '텍스타일'] },
  { key: '디지털/인터랙티브', icon: '💻', keywords: ['미디어 아티스트', '게임 디자이너', 'AI 아티스트', 'NFT', '코딩 아티스트', '인터랙티브', '뉴미디어', '디지털 아트', '제너레이티브', '웹 아트'] },
  { key: '공연', icon: '🎭', keywords: ['무용가', '배우', '퍼포먼스 아티스트', '댄서', '안무가', '연극', '뮤지컬', '무용', '퍼포먼스', '행위예술'] },
] as const;

const SUB_FIELDS: Record<string, string[]> = {
  '글': ['소설', '시', '에세이', '웹소설', '극본', '평론', '번역', '칼럼'],
  '그림': ['회화', '일러스트', '웹툰/만화', '캘리그래피', '판화', '그래픽디자인'],
  '영상': ['영화', '애니메이션', '다큐멘터리', '뮤직비디오', '숏폼'],
  '소리': ['작곡', '연주', '보컬', '프로듀싱', '사운드아트', 'DJ'],
  '사진': ['순수사진', '상업사진', '다큐멘터리사진'],
  '입체/공간': ['조각', '도예/세라믹', '설치미술', '건축', '공예'],
  '디지털/인터랙티브': ['미디어아트', 'AI아트', '제너레이티브', '웹아트'],
  '공연': ['연극', '무용', '뮤지컬', '퍼포먼스'],
};

function detectFieldFromInput(input: string): { category: string; icon: string } | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return null;
  for (const cat of FIELD_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (kw.toLowerCase().includes(trimmed) || trimmed.includes(kw.toLowerCase())) {
        return { category: cat.key, icon: cat.icon };
      }
    }
  }
  return null;
}

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 11);

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
    backgroundColor: interpolateColor(borderProgress.value, [0, 1], [C.bg, '#1a1a1a']),
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
  const [selectedSubFields, setSelectedSubFields] = useState<string[]>([]);
  const [fieldInput, setFieldInput] = useState('');
  const [fieldMessage, setFieldMessage] = useState('');
  const [fieldLimitMsg, setFieldLimitMsg] = useState('');
  const [subFieldLimitMsg, setSubFieldLimitMsg] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
      && (!needsFieldSelection || (selectedFields.length > 0 && selectedSubFields.length > 0));

  const btnGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.15 + btnGlow.value * 0.15,
    shadowRadius: 12 + btnGlow.value * 8,
  }));

  const handleNext = () => {
    if (step === 1 && selected) setStep(2);
  };

  /* 분야 카테고리 토글 (최대 2개) — 해제해도 세부분야 유지 */
  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      if (prev.includes(key)) {
        setFieldLimitMsg('');
        setSubFieldLimitMsg('');
        return prev.filter(k => k !== key);
      }
      if (prev.length >= 2) {
        setFieldLimitMsg('상위 분야는 최대 2개까지 선택할 수 있습니다. 기존 분야를 해제해주세요.');
        return prev;
      }
      setFieldLimitMsg('');
      return [...prev, key];
    });
  };

  /* 세부 분야 입력 → 자동 감지 (대분야 + 세부분야) */
  const handleFieldInput = (text: string) => {
    setFieldInput(text);
    const trimmed = text.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) { setFieldMessage(''); return; }

    // 1. 대분야 매칭
    const match = detectFieldFromInput(text);
    if (match) {
      if (!selectedFields.includes(match.category) && selectedFields.length < 2) {
        setSelectedFields(prev => prev.length < 2 ? [...prev, match.category] : prev);
      }
    }

    // 2. 세부분야 매칭
    let subMatch: { field: string; sub: string; icon: string } | null = null;
    for (const [field, subs] of Object.entries(SUB_FIELDS)) {
      for (const sub of subs) {
        if (sub.toLowerCase().includes(trimmed) || trimmed.includes(sub.toLowerCase())) {
          const cat = FIELD_CATEGORIES.find(c => c.key === field);
          subMatch = { field, sub, icon: cat?.icon ?? '🎯' };
          break;
        }
      }
      if (subMatch) break;
    }

    if (subMatch) {
      if (!selectedFields.includes(subMatch.field) && selectedFields.length < 2) {
        setSelectedFields(prev => prev.length < 2 ? [...prev, subMatch!.field] : prev);
      }
      if (!selectedSubFields.includes(subMatch.sub)) {
        const fieldSubs = SUB_FIELDS[subMatch.field] ?? [];
        setSelectedSubFields(prev => {
          const countForField = prev.filter(s => fieldSubs.includes(s)).length;
          return countForField < 2 && prev.length < 4 ? [...prev, subMatch!.sub] : prev;
        });
      }
      setFieldMessage(`${subMatch.icon} ${subMatch.field} → ${subMatch.sub}`);
    } else if (match) {
      setFieldMessage(
        selected === 'aspiring'
          ? `${match.icon} ${match.category} 분야에 관심이 있으시군요!`
          : `작가님은 ${match.icon} ${match.category} 작가님이네요!`
      );
    } else {
      setFieldMessage('');
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUri(result.assets[0].uri);
  };

  const handleComplete = async () => {
    if (!displayName.trim() || !realName.trim() || normalizedPhoneNumber.length < 9 || !selected || !user) return;
    if (needsFieldSelection && selectedFields.length === 0) return;
    setLoading(true);

    let avatarUrl: string | null = null;

    // Upload avatar if selected
    if (avatarUri) {
      try {
        const manipulated = await manipulateAsync(
          avatarUri,
          [{ resize: { width: 200 } }],
          { compress: 0.3, format: SaveFormat.JPEG },
        );
        const fileName = `avatars/${user.id}/${Date.now()}.jpg`;
        const response = await fetch(manipulated.uri);
        const blob = await response.blob();
        const { url: uploadedUrl, error: uploadErr } = await r2Upload('artworks', fileName, blob, 'image/jpeg');
        if (!uploadErr && uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      } catch {}
    }

    // Give 1000 MOUI for setting profile picture
    let bonusPoints: number | undefined;
    if (avatarUrl) {
      const { data: curProfile } = await supabase.from('profiles').select('points').eq('id', user.id).single();
      bonusPoints = (curProfile?.points ?? 50) + 1000;
      await (supabase as any).from('point_history').insert({
        user_id: user.id,
        amount: 1000,
        balance: bonusPoints,
        type: 'avatar_bonus',
        description: '프로필 사진 등록 보상',
      });
    }

    await supabase.from('profiles').update({
      user_type: selected,
      name: displayName.trim(),
      real_name: realName.trim(),
      phone_number: normalizedPhoneNumber,
      field: needsFieldSelection ? selectedFields.join(', ') : null,
      sub_field: selectedSubFields.length > 0 ? selectedSubFields.join(', ') : null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      ...(bonusPoints !== undefined ? { points: bonusPoints } : {}),
    } as any).eq('id', user.id);
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
    <View style={styles.innerContainer}>
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
              desc="작품을 올리고 소통해요"
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
              title="일반"
              desc="작품을 감상하고 작가를 응원해요"
              selected={selected === 'audience'}
              onPress={() => setSelected('audience')}
              delay={600}
            />
          </View>
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 2: 이름 입력 */}
          <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
            <PlayfulDiamond />
            <Text style={styles.title}>기본 정보를 알려주세요</Text>
            <Text style={styles.subtitle}>활동명은 프로필에 표시되고, 연락처는 공개되지 않아요</Text>
            <View style={styles.headerLine} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={styles.nameForm}>
            {/* 프로필 사진 */}
            <View style={styles.avatarSection}>
              <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Text style={{ fontSize: 10, color: '#000000' }}>+</Text>
                </View>
              </Pressable>
              <Text style={styles.avatarLabel}>프로필 사진</Text>
              <Text style={[styles.inputHint, { color: C.gold, fontWeight: '700' }]}>
                등록하면 1,000 MOUI 지급!
              </Text>
            </View>

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
                onChangeText={(t) => setRealName(t.replace(/[0-9]/g, ''))}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                maxLength={30}
              />
              <Text style={[styles.inputHint, { color: C.gold, fontWeight: '700' }]}>꼭 실명을 넣어주세요. 작가인증 시 필요합니다.</Text>
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
                maxLength={11}
              />
              <Text style={styles.inputHint}>하이픈 없이 입력해 주세요. 외부에는 공개되지 않아요</Text>
            </View>

            {needsFieldSelection && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{selected === 'aspiring' ? '희망 분야' : '분야'} <Text style={styles.inputRequired}>(필수)</Text></Text>
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
                {fieldLimitMsg !== '' && (
                  <Text style={{ color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{fieldLimitMsg}</Text>
                )}
                {!fieldLimitMsg && (
                  <Text style={styles.inputHint}>
                    {selected === 'aspiring' ? '관심 있는 희망 분야를 최소 1개 선택해주세요' : '최소 1개의 분야를 선택해주세요'}
                  </Text>
                )}

                {/* 세부 분야 선택 (분야별 그룹, 각 분야당 최대 2개) */}
                {selectedFields.length > 0 && (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 16 }]}>세부 분야 <Text style={styles.inputRequired}>(필수)</Text></Text>
                    {selectedFields.map(field => {
                      const cat = FIELD_CATEGORIES.find(c => c.key === field);
                      const subs = SUB_FIELDS[field] ?? [];
                      const countForField = selectedSubFields.filter(s => subs.includes(s)).length;
                      return (
                        <View key={field} style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, color: C.mutedLight, marginBottom: 6 }}>{cat?.icon} {field} (최대 2개)</Text>
                          <View style={styles.chipGrid}>
                            {subs.map(sub => {
                              const active = selectedSubFields.includes(sub);
                              return (
                                <Pressable
                                  key={`${field}_${sub}`}
                                  onPress={() => {
                                    if (active) {
                                      setSelectedSubFields(prev => prev.filter(s => s !== sub));
                                      setSubFieldLimitMsg('');
                                    } else if (countForField >= 2) {
                                      setSubFieldLimitMsg(`${field} 분야는 세부분야를 최대 2개까지 선택할 수 있습니다.`);
                                    } else if (selectedSubFields.length >= 4) {
                                      setSubFieldLimitMsg('세부 분야는 총 최대 4개까지 선택할 수 있습니다. 기존 세부 분야를 해제해주세요.');
                                    } else {
                                      setSelectedSubFields(prev => [...prev, sub]);
                                      setSubFieldLimitMsg('');
                                    }
                                  }}
                                  style={[
                                    styles.chip,
                                    { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold + '22' : 'transparent' },
                                  ]}
                                >
                                  <Text style={[styles.chipText, { color: active ? C.gold : C.muted }]}>{sub}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                    {subFieldLimitMsg !== '' && (
                      <Text style={{ color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{subFieldLimitMsg}</Text>
                    )}
                  </>
                )}

                <Text style={[styles.inputLabel, { marginTop: 16 }]}>세부 분야 입력 (자동 분류)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="예: 소설가, 일러스트레이터, 작곡가"
                  placeholderTextColor={C.mutedLight}
                  value={fieldInput}
                  onChangeText={handleFieldInput}
                />
                {fieldMessage !== '' && (
                  <Text style={[styles.inputHint, { color: C.gold, fontWeight: '700' }]}>{fieldMessage}</Text>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>
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
              <ActivityIndicator color="#000000" size="small" />
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
    </View>
    </KeyboardAvoidingView>
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

  // Avatar
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarPicker: {
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.fg,
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
