import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, TextInput,
  Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { getCreatorVerificationStatusText, getCreatorVerificationResetLabel } from '@/constants/creator-verification';
import { REGIONS, PROVINCE_LIST, parseRegion } from '@/constants/regions';
import { spendPoints } from '@/lib/points';

const USER_TYPE_LABELS = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
const USER_TYPE_EMOJI = { creator: '🎨', aspiring: '✏️', audience: '👀' } as const;

/* 분야 카테고리 */
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

/* URL → SNS 플랫폼 자동 감지 */
function detectSnsType(url: string): { key: string; icon: string; label: string } {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am'))
    return { key: 'instagram', icon: '📸', label: 'Instagram' };
  if (lower.includes('twitter.com') || lower.includes('x.com'))
    return { key: 'twitter', icon: '🐦', label: 'X (Twitter)' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be'))
    return { key: 'youtube', icon: '🎬', label: 'YouTube' };
  if (lower.includes('behance.net'))
    return { key: 'behance', icon: '🎨', label: 'Behance' };
  if (lower.includes('dribbble.com'))
    return { key: 'dribbble', icon: '🏀', label: 'Dribbble' };
  if (lower.includes('github.com'))
    return { key: 'github', icon: '💻', label: 'GitHub' };
  return { key: 'website', icon: '🌐', label: '웹사이트' };
}

function snsIconForKey(key: string): string {
  const map: Record<string, string> = {
    instagram: '📸', twitter: '🐦', youtube: '🎬', behance: '🎨',
    dribbble: '🏀', github: '💻', website: '🌐',
  };
  return map[key] ?? '🔗';
}

export default function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const { colors: C } = useThemeMode();
  const scrollRef = useRef<ScrollView>(null);
  const regionYRef = useRef(0);
  const [regionHighlight, setRegionHighlight] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingType, setChangingType] = useState(false);

  // 편집 폼 상태
  const [name, setName] = useState(profile?.name ?? '');
  const [realName, setRealName] = useState(profile?.real_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  // 분야: 8개 카테고리 멀티 선택
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldInput, setFieldInput] = useState('');
  const [fieldMessage, setFieldMessage] = useState('');
  // 지역
  const [regionProvince, setRegionProvince] = useState('');
  const [regionDistrict, setRegionDistrict] = useState('');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  // 링크: 동적 배열
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');

  // focus=region이면 자동 편집 모드 진입 + 지역 강조
  useEffect(() => {
    if (params.focus === 'region' && !editing) {
      handleStartEdit();
      setRegionHighlight(true);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: regionYRef.current, animated: true });
      }, 500);
      setTimeout(() => setRegionHighlight(false), 3000);
    }
  }, [params.focus]);

  const userType = profile?.user_type ?? 'audience';
  const emoji = USER_TYPE_EMOJI[userType];
  const label = USER_TYPE_LABELS[userType];
  const avatarUrl = profile?.avatar_url;
  const realNameLocked = !!profile?.real_name?.trim();

  /* 분야 카테고리 토글 */
  const toggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  /* 세부 분야 입력 → 자동 감지 */
  const handleFieldInput = (text: string) => {
    setFieldInput(text);
    const match = detectFieldFromInput(text);
    if (match) {
      setFieldMessage(`작가님은 ${match.icon} ${match.category} 작가님이네요!`);
      if (!selectedFields.includes(match.category)) {
        setSelectedFields(prev => [...prev, match.category]);
      }
    } else {
      setFieldMessage('');
    }
  };

  /* 링크 배열 → Record 변환 (자동 감지) */
  function buildSnsLinks(): Record<string, string> {
    const result: Record<string, string> = {};
    let counter: Record<string, number> = {};
    for (const url of links) {
      const trimmed = url.trim();
      if (!trimmed) continue;
      const { key } = detectSnsType(trimmed);
      // 같은 플랫폼이 여러개면 key에 번호 추가
      const count = counter[key] ?? 0;
      const finalKey = count === 0 ? key : `${key}_${count}`;
      result[finalKey] = trimmed;
      counter[key] = count + 1;
    }
    return result;
  }

  /* 기존 SNS links → 배열로 변환 */
  function parseLinksFromProfile(): string[] {
    const parsed: Record<string, string> = (() => {
      if (!profile?.sns_links) return {};
      if (typeof profile.sns_links === 'string') {
        try { return JSON.parse(profile.sns_links); } catch { return {}; }
      }
      if (typeof profile.sns_links === 'object' && !Array.isArray(profile.sns_links)) {
        return profile.sns_links as Record<string, string>;
      }
      return {};
    })();
    return Object.values(parsed).filter(Boolean);
  }

  /* 링크 추가 (3번째부터 300 MOUI 차감) */
  const addLink = async () => {
    const url = linkInput.trim();
    if (!url) return;
    if (links.includes(url)) {
      const msg = '이미 추가된 링크입니다.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('안내', msg);
      return;
    }

    const newCount = links.length + 1;
    if (newCount > 2) {
      const points = profile?.points ?? 0;
      const COST = 300;
      if (points < COST) {
        const msg = `3번째 링크부터는 ${COST} MOUI가 필요합니다.\n현재 보유: ${points} MOUI`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('포인트 부족', msg);
        return;
      }
      const confirmed = Platform.OS === 'web'
        ? window.confirm(`링크 추가에 ${COST} MOUI가 차감됩니다.\n계속하시겠습니까?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              '링크 추가',
              `3번째 링크부터는 ${COST} MOUI가 차감됩니다.`,
              [{ text: '취소', style: 'cancel', onPress: () => resolve(false) }, { text: '추가', onPress: () => resolve(true) }],
            );
          });
      if (!confirmed) return;

      // 포인트 차감 + 내역 기록
      if (user) {
        const { error } = await spendPoints(user.id, COST, '링크 추가');
        if (error) {
          Platform.OS === 'web' ? window.alert(error) : Alert.alert('오류', error);
          return;
        }
        await refreshProfile();
      }
    }

    setLinks(prev => [...prev, url]);
    setLinkInput('');
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeUserType = async (newType: 'creator' | 'aspiring' | 'audience') => {
    if (!user || !profile || newType === userType) return;
    const points = profile.points ?? 0;
    const COST = 100;

    if (points < COST) {
      const msg = `유형 변경에는 ${COST} MOUI가 필요합니다.\n현재 보유: ${points} MOUI`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('포인트 부족', msg);
      return;
    }

    // 인증 작가가 다른 유형으로 바꿀 경우 경고
    const isVerified = !!(profile as any)?.verified;
    if (userType === 'creator' && isVerified && newType !== 'creator') {
      const confirmed = Platform.OS === 'web'
        ? window.confirm(`유형을 변경하면 인증 작가 상태가 ${getCreatorVerificationResetLabel()} 상태로 초기화됩니다.\n${COST} MOUI가 차감됩니다.\n계속하시겠습니까?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              '인증 초기화 경고',
              `유형을 변경하면 인증 작가 상태가 ${getCreatorVerificationResetLabel()} 상태로 초기화됩니다.\n${COST} MOUI가 차감됩니다.`,
              [{ text: '취소', style: 'cancel', onPress: () => resolve(false) }, { text: '변경', style: 'destructive', onPress: () => resolve(true) }],
            );
          });
      if (!confirmed) return;
    } else {
      const confirmed = Platform.OS === 'web'
        ? window.confirm(`유형을 "${USER_TYPE_LABELS[newType]}"(으)로 변경합니다.\n${COST} MOUI가 차감됩니다.\n계속하시겠습니까?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              '유형 변경',
              `유형을 "${USER_TYPE_LABELS[newType]}"(으)로 변경합니다.\n${COST} MOUI가 차감됩니다.`,
              [{ text: '취소', style: 'cancel', onPress: () => resolve(false) }, { text: '변경', onPress: () => resolve(true) }],
            );
          });
      if (!confirmed) return;
    }

    setChangingType(true);
    try {
      const updatePayload: Record<string, any> = {
        user_type: newType,
        points: points - COST,
      };
      // 작가→다른 유형: 인증 초기화
      if (userType === 'creator' && isVerified && newType !== 'creator') {
        updatePayload.verified = false;
      }

      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
      if (error) {
        const msg = '유형 변경에 실패했습니다: ' + error.message;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
        setChangingType(false);
        return;
      }

      await refreshProfile();
      setChangingType(false);

      // 관람자→작가/지망생: 분야 선택 필요
      if (userType === 'audience' && (newType === 'creator' || newType === 'aspiring')) {
        const msg = '분야를 선택해주세요. 작가정보 수정 페이지로 이동합니다.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('분야 선택 필요', msg);
        }
        handleStartEdit();
      }
    } catch (err) {
      console.error('유형 변경 오류:', err);
      setChangingType(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!realNameLocked && !realName.trim()) {
      const msg = '본명은 본인인증을 위해 꼭 필요합니다.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('안내', msg);
      return;
    }
    setSaving(true);
    const snsLinks = buildSnsLinks();
    const fieldValue = selectedFields.length > 0 ? selectedFields.join(', ') : null;
    const regionValue = regionProvince && regionDistrict ? `${regionProvince} ${regionDistrict}` : null;
    const updatePayload: Record<string, any> = {
      name: name || null,
      bio: bio || null,
      field: fieldValue,
      region: regionValue,
      sns_links: snsLinks,
    };
    if (!realNameLocked) {
      updatePayload.real_name = realName.trim();
    }
    await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  const handleStartEdit = () => {
    setName(profile?.name ?? '');
    setRealName(profile?.real_name ?? '');
    setBio(profile?.bio ?? '');
    // 기존 field를 카테고리 배열로 파싱
    const existingField = profile?.field ?? '';
    const parsed = existingField.split(',').map((s: string) => s.trim()).filter(Boolean);
    setSelectedFields(parsed);
    setFieldInput('');
    setFieldMessage('');
    // 지역 파싱
    const regionParsed = parseRegion((profile as any)?.region);
    setRegionProvince(regionParsed?.province ?? '');
    setRegionDistrict(regionParsed?.district ?? '');
    setShowProvincePicker(false);
    setShowDistrictPicker(false);
    setLinks(parseLinksFromProfile());
    setLinkInput('');
    setEditing(true);
  };

  const pickAvatar = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const rawUri = result.assets[0].uri;
      // 최소 용량으로 리사이즈 + 압축
      const manipulated = await manipulateAsync(
        rawUri,
        [{ resize: { width: 200 } }],
        { compress: 0.3, format: SaveFormat.JPEG }
      );
      const uri = manipulated.uri;
      const fileName = `avatars/${user.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const marker = '/storage/v1/object/public/artworks/';
        const idx = profile.avatar_url.indexOf(marker);
        if (idx !== -1) {
          const oldPath = decodeURIComponent(profile.avatar_url.slice(idx + marker.length));
          await supabase.storage.from('artworks').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        const msg = '이미지 업로드에 실패했습니다.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
        setUploadingAvatar(false);
        return;
      }

      const publicUrl = supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      await refreshProfile();
    } catch (err) {
      console.error('아바타 업로드 오류:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const createdDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const snsEntries = Object.entries(
    typeof profile?.sns_links === 'object' && profile?.sns_links && !Array.isArray(profile.sns_links)
      ? (profile.sns_links as Record<string, string>)
      : {}
  ).filter(([, v]) => v);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.fg }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.fg }]}>프로필</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        {!editing ? (
          <>
            {/* 프로필 정보 카드 */}
            <Animated.View entering={FadeInDown.delay(100).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
              <View style={styles.profileRow}>
                <Pressable onPress={pickAvatar} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <View style={[styles.avatarWrap, { backgroundColor: C.bg, borderColor: C.gold }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                    ) : (
                      <Text style={styles.avatarEmoji}>{emoji}</Text>
                    )}
                    {uploadingAvatar && (
                      <View style={styles.avatarOverlay}>
                        <Text style={styles.avatarOverlayText}>...</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.cameraIcon, { backgroundColor: C.gold }]}>
                    <Text style={{ fontSize: 10 }}>📷</Text>
                  </View>
                </Pressable>
                <View style={styles.profileInfo}>
                  <Text style={[styles.name, { color: C.fg }]}>{profile?.name ?? '회원'}</Text>
                  <Text style={[styles.username, { color: C.mutedLight }]}>@{profile?.username}</Text>
                </View>
                <View style={styles.badgeGroup}>
                  {userType === 'creator' ? (
                    <View style={[styles.badge, { backgroundColor: C.bg, borderColor: C.gold }]}>
                      <Text style={[styles.badgeText, { color: C.gold }]}>
                        작가{' '}
                        <Text style={{ color: (profile as any)?.verified ? '#22c55e' : C.danger }}>
                          {getCreatorVerificationStatusText((profile as any)?.verified)}
                        </Text>
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: C.bg, borderColor: C.gold }]}>
                      <Text style={[styles.badgeText, { color: C.gold }]}>{label}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* 정보 행들 */}
              <View style={styles.infoList}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📧</Text>
                  <Text style={[styles.infoText, { color: C.fg }]}>{user?.email}</Text>
                </View>
                {createdDate && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>📅</Text>
                    <Text style={[styles.infoText, { color: C.fg }]}>{createdDate} 가입</Text>
                  </View>
                )}
                {profile?.field && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>🎯</Text>
                    <View style={styles.fieldTagRow}>
                      {profile.field.split(',').map((f: string) => {
                        const trimmed = f.trim();
                        const cat = FIELD_CATEGORIES.find(c => c.key === trimmed);
                        return (
                          <View key={trimmed} style={[styles.fieldTag, { backgroundColor: C.gold + '22', borderColor: C.gold }]}>
                            <Text style={{ fontSize: 11 }}>{cat?.icon ?? '🎯'}</Text>
                            <Text style={[styles.fieldTagText, { color: C.gold }]}>{trimmed}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {(profile as any)?.region && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>📍</Text>
                    <Text style={[styles.infoText, { color: C.fg }]}>{(profile as any).region}</Text>
                  </View>
                )}
                {profile?.real_name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>👤</Text>
                    <Text style={[styles.infoText, { color: C.fg }]}>{profile.real_name}</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [styles.editBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
                onPress={handleStartEdit}
              >
                <Text style={[styles.editBtnText, { color: C.fg }]}>작가정보 수정</Text>
              </Pressable>
            </Animated.View>

            {/* 유형 변경 */}
            <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
              <Text style={[styles.sectionTitle, { color: C.muted }]}>유형 변경</Text>
              <Text style={[styles.typeChangeHint, { color: C.mutedLight }]}>
                변경 시 100 MOUI가 차감됩니다
              </Text>
              <View style={styles.typeChangeRow}>
                {(['creator', 'aspiring', 'audience'] as const).map((t) => {
                  const selected = userType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => !selected && !changingType && handleChangeUserType(t)}
                      style={({ pressed }) => [
                        styles.typeChangeBtn,
                        {
                          borderColor: selected ? C.gold : C.border,
                          backgroundColor: selected ? C.gold + '22' : C.bg,
                        },
                        pressed && !selected && { opacity: 0.7 },
                        changingType && !selected && { opacity: 0.4 },
                      ]}
                    >
                      <Text style={styles.typeChangeEmoji}>{USER_TYPE_EMOJI[t]}</Text>
                      <Text style={[styles.typeChangeLabel, { color: selected ? C.gold : C.fg }]}>
                        {USER_TYPE_LABELS[t]}
                      </Text>
                      {selected && (
                        <Text style={[styles.typeChangeCurrent, { color: C.gold }]}>현재</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* 소개 */}
            {profile?.bio && (
              <Animated.View entering={FadeInDown.delay(200).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
                <Text style={[styles.sectionTitle, { color: C.muted }]}>소개</Text>
                <Text style={[styles.bioText, { color: C.fg }]}>{profile.bio}</Text>
              </Animated.View>
            )}

            {/* 링크 */}
            {snsEntries.length > 0 && (
              <Animated.View entering={FadeInDown.delay(300).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
                <Text style={[styles.sectionTitle, { color: C.muted }]}>링크</Text>
                {snsEntries.map(([key, url]) => {
                  const detected = detectSnsType(url);
                  return (
                    <View key={key} style={styles.snsRow}>
                      <Text style={styles.snsIcon}>{detected.icon}</Text>
                      <Text style={[styles.snsLabel, { color: C.muted }]}>{detected.label}</Text>
                      <Text style={[styles.snsUrl, { color: C.fg }]} numberOfLines={1}>{url}</Text>
                    </View>
                  );
                })}
              </Animated.View>
            )}

          </>
        ) : (
          <>
            {/* 편집 모드 */}
            <Animated.View entering={FadeInDown.delay(100).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
              <Text style={[styles.sectionTitle, { color: C.muted }]}>프로필 이미지</Text>
              <View style={styles.editAvatarRow}>
                <Pressable onPress={pickAvatar} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <View style={[styles.editAvatarWrap, { backgroundColor: C.bg, borderColor: C.gold }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.editAvatarImage} contentFit="cover" />
                    ) : (
                      <Text style={styles.editAvatarEmoji}>{emoji}</Text>
                    )}
                    {uploadingAvatar && (
                      <View style={styles.avatarOverlay}>
                        <Text style={styles.avatarOverlayText}>...</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
                <Pressable
                  onPress={pickAvatar}
                  style={({ pressed }) => [styles.changeAvatarBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.changeAvatarText, { color: C.fg }]}>📷 사진 변경</Text>
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
              <Text style={[styles.sectionTitle, { color: C.muted }]}>기본 정보</Text>

              <Text style={[styles.fieldLabel, { color: C.muted }]}>활동명</Text>
              <TextInput style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]} value={name} onChangeText={setName} placeholder="활동명" placeholderTextColor={C.mutedLight} />

              <Text style={[styles.fieldLabel, { color: C.muted }]}>본명 (필수)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: C.bg, borderColor: C.border, color: C.fg },
                  realNameLocked && styles.inputReadonly,
                ]}
                value={realName}
                onChangeText={setRealName}
                placeholder="실명 입력"
                placeholderTextColor={C.mutedLight}
                editable={!realNameLocked}
                selectTextOnFocus={!realNameLocked}
              />
              <Text style={[styles.fieldHelp, { color: C.mutedLight }]}>
                {realNameLocked
                  ? '가입 시 등록한 본명이며, 본인인증을 위해 꼭 필요해요. 등록 후에는 변경할 수 없어요.'
                  : '본인인증을 위해 꼭 필요하며, 등록 후에는 변경할 수 없어요.'}
              </Text>

              <Text style={[styles.fieldLabel, { color: C.muted }]}>분야</Text>
              <View style={styles.chipGrid}>
                {FIELD_CATEGORIES.map(cat => {
                  const selected = selectedFields.includes(cat.key);
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => toggleField(cat.key)}
                      style={[
                        styles.chip,
                        { borderColor: selected ? C.gold : C.border, backgroundColor: selected ? C.gold + '22' : C.bg },
                      ]}
                    >
                      <Text style={styles.chipIcon}>{cat.icon}</Text>
                      <Text style={[styles.chipText, { color: selected ? C.gold : C.muted }]}>{cat.key}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.fieldLabel, { color: C.muted, marginTop: 16 }]}>세부 분야 입력 (자동 분류)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
                value={fieldInput}
                onChangeText={handleFieldInput}
                placeholder="예: 소설가, 일러스트레이터, 작곡가"
                placeholderTextColor={C.mutedLight}
              />
              {fieldMessage !== '' && (
                <Text style={[styles.fieldDetectMsg, { color: C.gold }]}>{fieldMessage}</Text>
              )}

              <View
                onLayout={(e) => { regionYRef.current = e.nativeEvent.layout.y + 200; }}
                style={regionHighlight ? [styles.regionHighlight, { borderColor: C.gold }] : undefined}
              >
              <Text style={[styles.fieldLabel, { color: regionHighlight ? C.gold : C.muted, fontWeight: regionHighlight ? '900' : '700' }]}>📍 활동 지역</Text>
              {/* 시/도 선택 */}
              <Pressable
                onPress={() => { setShowProvincePicker(!showProvincePicker); setShowDistrictPicker(false); }}
                style={[styles.input, styles.pickerBtn, { backgroundColor: C.bg, borderColor: showProvincePicker ? C.gold : C.border }]}
              >
                <Text style={{ color: regionProvince ? C.fg : C.mutedLight, fontSize: 15 }}>
                  {regionProvince || '시/도 선택'}
                </Text>
                <Text style={{ color: C.mutedLight, fontSize: 12 }}>{showProvincePicker ? '▲' : '▼'}</Text>
              </Pressable>
              {showProvincePicker && (
                <ScrollView style={[styles.pickerList, { backgroundColor: C.bg, borderColor: C.border }]} nestedScrollEnabled>
                  {PROVINCE_LIST.map(p => (
                    <Pressable
                      key={p}
                      onPress={() => {
                        setRegionProvince(p);
                        setRegionDistrict('');
                        setShowProvincePicker(false);
                        setShowDistrictPicker(true);
                      }}
                      style={({ pressed }) => [styles.pickerItem, regionProvince === p && { backgroundColor: C.gold + '22' }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={[styles.pickerItemText, { color: regionProvince === p ? C.gold : C.fg }]}>{p}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* 구/군/시 선택 */}
              {regionProvince !== '' && (
                <>
                  <Pressable
                    onPress={() => { setShowDistrictPicker(!showDistrictPicker); setShowProvincePicker(false); }}
                    style={[styles.input, styles.pickerBtn, { backgroundColor: C.bg, borderColor: showDistrictPicker ? C.gold : C.border, marginTop: 8 }]}
                  >
                    <Text style={{ color: regionDistrict ? C.fg : C.mutedLight, fontSize: 15 }}>
                      {regionDistrict || '구/군/시 선택'}
                    </Text>
                    <Text style={{ color: C.mutedLight, fontSize: 12 }}>{showDistrictPicker ? '▲' : '▼'}</Text>
                  </Pressable>
                  {showDistrictPicker && (
                    <ScrollView style={[styles.pickerList, { backgroundColor: C.bg, borderColor: C.border }]} nestedScrollEnabled>
                      {(REGIONS[regionProvince] ?? []).map(d => (
                        <Pressable
                          key={d}
                          onPress={() => { setRegionDistrict(d); setShowDistrictPicker(false); }}
                          style={({ pressed }) => [styles.pickerItem, regionDistrict === d && { backgroundColor: C.gold + '22' }, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={[styles.pickerItemText, { color: regionDistrict === d ? C.gold : C.fg }]}>{d}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              {regionProvince && regionDistrict ? (
                <View style={styles.regionPreview}>
                  <Text style={[styles.regionPreviewText, { color: C.gold }]}>📍 {regionProvince} {regionDistrict}</Text>
                  <Pressable onPress={() => { setRegionProvince(''); setRegionDistrict(''); }}>
                    <Text style={{ color: C.mutedLight, fontSize: 12 }}>초기화</Text>
                  </Pressable>
                </View>
              ) : null}
              </View>

              <Text style={[styles.fieldLabel, { color: C.muted }]}>소개</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
                value={bio}
                onChangeText={setBio}
                placeholder="자기소개를 작성하세요"
                placeholderTextColor={C.mutedLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
              <Text style={[styles.sectionTitle, { color: C.muted }]}>링크</Text>
              <Text style={[styles.snsHint, { color: C.mutedLight }]}>
                URL을 입력하고 추가 버튼을 눌러주세요 (2개 무료, 3개부터 300 MOUI)
              </Text>

              <View style={styles.linkInputRow}>
                <TextInput
                  style={[styles.input, styles.linkInputField, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
                  value={linkInput}
                  onChangeText={setLinkInput}
                  placeholder="https://..."
                  placeholderTextColor={C.mutedLight}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Pressable
                  onPress={addLink}
                  style={({ pressed }) => [
                    styles.linkAddBtn,
                    { backgroundColor: C.gold, opacity: !linkInput.trim() ? 0.4 : pressed ? 0.8 : 1 },
                  ]}
                  disabled={!linkInput.trim()}
                >
                  <Text style={[styles.linkAddBtnText, { color: C.bg }]}>추가</Text>
                </Pressable>
              </View>

              {links.length > 0 && (
                <View style={styles.linkList}>
                  {links.map((url, index) => {
                    const detected = detectSnsType(url);
                    return (
                      <View key={`${url}-${index}`} style={[styles.linkItem, { backgroundColor: C.bg, borderColor: C.border }]}>
                        <Text style={styles.linkItemIcon}>{detected.icon}</Text>
                        <View style={styles.linkItemInfo}>
                          <Text style={[styles.linkItemLabel, { color: C.muted }]}>{detected.label}</Text>
                          <Text style={[styles.linkItemUrl, { color: C.fg }]} numberOfLines={1}>{url}</Text>
                        </View>
                        {index >= 2 && (
                          <Text style={[styles.linkItemCost, { color: C.gold }]}>300M</Text>
                        )}
                        <Pressable onPress={() => removeLink(index)} hitSlop={8}>
                          <Text style={[styles.linkItemDelete, { color: C.danger }]}>삭제</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>

            {/* 저장/취소 버튼 */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
                onPress={() => setEditing(false)}
              >
                <Text style={[styles.cancelBtnText, { color: C.muted }]}>취소</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={[styles.saveBtnText, { color: C.bg }]}>{saving ? '저장 중...' : '저장'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 16,
  },

  /* 카드 */
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },

  /* 프로필 행 */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarEmoji: { fontSize: 28 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
  avatarOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    gap: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
  },
  username: {
    fontSize: 13,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* 편집 아바타 */
  editAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  editAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  editAvatarEmoji: { fontSize: 36 },
  changeAvatarBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  changeAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* 정보 행 */
  infoList: {
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },

  /* 수정 버튼 */
  editBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* 소개 */
  bioText: {
    fontSize: 15,
    lineHeight: 24,
  },

  /* SNS */
  snsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  snsIcon: { fontSize: 16 },
  snsLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 80,
    textTransform: 'capitalize',
  },
  snsUrl: {
    flex: 1,
    fontSize: 13,
  },
  snsHint: {
    fontSize: 11,
    marginBottom: 12,
  },
  linkInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  linkInputField: {
    flex: 1,
  },
  linkAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  linkAddBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  linkList: {
    marginTop: 12,
    gap: 8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkItemIcon: {
    fontSize: 16,
  },
  linkItemInfo: {
    flex: 1,
    gap: 1,
  },
  linkItemLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  linkItemUrl: {
    fontSize: 13,
  },
  linkItemCost: {
    fontSize: 10,
    fontWeight: '700',
  },
  linkItemDelete: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* 편집 폼 */
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputReadonly: {
    opacity: 0.72,
  },
  fieldHelp: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    marginLeft: 2,
  },
  inputMulti: {
    minHeight: 100,
    paddingTop: 12,
  },

  /* 액션 버튼 */
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },

  /* 분야 칩 */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldDetectMsg: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  typeChangeHint: {
    fontSize: 11,
    marginBottom: 12,
  },
  typeChangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChangeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  typeChangeEmoji: {
    fontSize: 20,
  },
  typeChangeLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  typeChangeCurrent: {
    fontSize: 10,
    fontWeight: '700',
  },
  fieldTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  fieldTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  fieldTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* 지역 선택 */
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerList: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerItemText: {
    fontSize: 14,
  },
  regionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  regionPreviewText: {
    fontSize: 13,
    fontWeight: '700',
  },
  regionHighlight: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },
});
