import { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { r2Upload, r2Delete, r2ExtractPath } from '@/lib/r2';
import { spendPoints } from '@/lib/points';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import {
  type FormType,
  getFormType,
  getParentField,
  FORM_TYPE_LABEL,
  FORM_META_FIELDS,
  YEAR_FIELD_LABEL,
  FIELD_CATEGORIES,
  SUB_FIELDS,
} from '@/constants/artwork-form';
import { showAlert } from '@/lib/utils';

export default function CreateArtworkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { colors: C } = useThemeMode();
  const { artworkId } = useLocalSearchParams<{ artworkId?: string }>();

  const isEditing = !!artworkId;

  // ── 카테고리 선택 ──
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [originalCategory, setOriginalCategory] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [pickerField, setPickerField] = useState<string | null>(null);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  // 진입 시 분야가 이미 설정되어 있었는지 추적
  const hadSubFieldOnEntry = useRef(!!profile?.sub_field);

  // 유저의 세부 분야 파싱
  const userSubFields = useMemo(() => {
    if (!profile?.sub_field) return [];
    return profile.sub_field.split(',').map(s => s.trim()).filter(Boolean);
  }, [profile?.sub_field]);

  // 상위분야별 세부분야 개수 계산
  const parentFieldCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sf of userSubFields) {
      const p = getParentField(sf);
      if (p) counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [userSubFields]);

  const userParentFields = useMemo(() => Object.keys(parentFieldCounts), [parentFieldCounts]);

  // 제한: 상위분야 최대 2개, 분야별 세부분야 최대 2개, 총 최대 4개
  const canAddMore = userSubFields.length < 4;
  const canAddNewParent = userParentFields.length < 2;

  // 세부 분야 1개면 자동 선택
  useEffect(() => {
    if (!isEditing && userSubFields.length === 1 && !selectedCategory) {
      setSelectedCategory(userSubFields[0]);
    }
  }, [userSubFields, isEditing, selectedCategory]);

  // 편집 시: 원래 분야가 현재 유저 분야에 포함되는지
  const canEditCategory = !isEditing || !originalCategory || userSubFields.includes(originalCategory);

  // 분야 변경 핸들러 (변경 시 경고)
  const handleCategoryChange = (newCategory: string) => {
    if (isEditing && selectedCategory && newCategory !== selectedCategory) {
      const doChange = () => {
        setMetadata({});
        setSelectedCategory(newCategory);
      };
      if (Platform.OS === 'web') {
        if (window.confirm('분야를 변경하면 입력한 세부 정보가 초기화됩니다.\n변경하시겠습니까?')) {
          doChange();
        }
      } else {
        Alert.alert(
          '분야 변경',
          '분야를 변경하면 입력한 세부 정보가 초기화됩니다.\n변경하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '변경', style: 'destructive', onPress: doChange },
          ],
        );
      }
    } else {
      setSelectedCategory(newCategory);
    }
  };

  const formType: FormType = getFormType(selectedCategory);
  // onlyFor 필터: 선택된 세부분야에 해당하는 필드만 표시
  const metaFields = useMemo(() => {
    return FORM_META_FIELDS[formType].filter(f => {
      if (!f.onlyFor) return true;
      return selectedCategory ? f.onlyFor.includes(selectedCategory) : false;
    });
  }, [formType, selectedCategory]);

  // ── 공통 필드 ──
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [tagChips, setTagChips] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // ── 메타데이터 (폼 타입별 추가 필드) ──
  const [metadata, setMetadata] = useState<Record<string, string>>({});

  const setMeta = (key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // ── 편집 모드: 기존 데이터 로드 ──
  useEffect(() => {
    if (!artworkId) return;
    setInitialLoading(true);
    supabase.from('artworks').select('*').eq('id', artworkId).single().then(({ data }) => {
      if (data) {
        setTitle(data.title ?? '');
        setYear(data.year ? String(data.year) : '');
        setDescription(data.description ?? '');
        setImageUri(data.image_url);
        setOriginalImageUrl(data.image_url);

        // category 로드
        const cat = (data as any).category as string | null;
        setOriginalCategory(cat);
        if (cat) {
          setSelectedCategory(cat);
        }

        // metadata 로드
        const meta = ((data as any).metadata ?? {}) as Record<string, string>;
        const loaded: Record<string, string> = { ...meta };

        // 기존 작품 (category 없음): visual 컬럼에서 역파싱
        if (!cat) {
          if (data.medium) {
            const parts = data.medium.split(',').map((s: string) => s.trim());
            if (parts.length >= 2) {
              loaded.medium = parts.slice(0, -1).join(', ');
              loaded.technique = parts[parts.length - 1];
            } else {
              loaded.medium = data.medium;
            }
          }
          if (data.width_cm) loaded.width_cm = String(data.width_cm);
          if (data.height_cm) loaded.height_cm = String(data.height_cm);
          if (data.edition) loaded.edition = data.edition;
        }

        setMetadata(loaded);

        // 태그 로드 (커스텀만)
        if (data.tags && data.tags.length > 0) {
          const autoTags = new Set<string>();
          if (data.year) autoTags.add(String(data.year));
          if (data.medium) data.medium.split(/[,،]/).forEach((s: string) => { const t = s.trim(); if (t) autoTags.add(t); });
          if (data.width_cm && data.height_cm) autoTags.add(`${data.width_cm}x${data.height_cm}cm`);
          const custom = data.tags.filter((t: string) => !autoTags.has(t));
          setTagChips(custom);
        }
      }
      setInitialLoading(false);
    });
  }, [artworkId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── 분야 선택 시 프로필에도 저장 (미설정 유저) ──
  const selectCategoryAndSaveProfile = async (subField: string, parentField: string) => {
    setSelectedCategory(subField);
    setShowFieldPicker(false);
    setPickerField(null);

    // 진입 시 분야가 없었던 유저만 프로필에 저장
    if (!hadSubFieldOnEntry.current && user) {
      const currentSubs = profile?.sub_field
        ? profile.sub_field.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      // 이미 포함된 분야면 스킵
      if (currentSubs.includes(subField)) return;

      // 제한 체크: 총 4개, 분야별 2개
      if (currentSubs.length >= 4) return;
      const siblingCount = currentSubs.filter(s => getParentField(s) === parentField).length;
      if (siblingCount >= 2) return;

      const newSubs = [...currentSubs, subField].join(', ');
      const currentParents = profile?.field
        ? profile.field.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const newField = currentParents.includes(parentField)
        ? currentParents.join(', ')
        : [...currentParents, parentField].join(', ');

      await supabase.from('profiles').update({
        field: newField,
        sub_field: newSubs,
      }).eq('id', user.id);
      await refreshProfile();
      setProfileSavedMsg(true);
    }
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
    if (!selectedCategory) { showAlert('알림', '분야를 선택해주세요.'); return; }
    if (!imageUri) { showAlert('알림', '이미지를 선택해주세요.'); return; }
    if (!title.trim()) { showAlert('알림', '작품명을 입력해주세요.'); return; }
    if (!year.trim()) { showAlert('알림', `${YEAR_FIELD_LABEL[formType].label}를 입력해주세요.`); return; }
    if (!description.trim() || description.trim().length < 10) {
      showAlert('알림', `설명은 10글자 이상 입력해주세요. (현재 ${description.trim().length}자)`);
      return;
    }
    // 필수 메타 필드 검증
    for (const field of metaFields) {
      if (field.required && !metadata[field.key]?.trim()) {
        showAlert('알림', `${field.label}을(를) 입력해주세요.`);
        return;
      }
    }

    setLoading(true);
    try {
      if (!isEditing) {
        const { error: pointErr } = await spendPoints(user.id, 10, '작품 업로드');
        if (pointErr) {
          showAlert('모의 부족', pointErr);
          setLoading(false);
          return;
        }
      }

      let imageUrl = originalImageUrl;
      const imageChanged = imageUri !== originalImageUrl;

      if (imageChanged) {
        const baseName = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const fileName = `${user.id}/${baseName}.jpg`;
        const thumbName = `${user.id}/thumb_${baseName}.jpg`;

        // 원본 업로드
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const { url: uploadedUrl, error: uploadError } = await r2Upload('artworks', fileName, blob, 'image/jpeg');
        if (uploadError || !uploadedUrl) {
          showAlert('오류', '이미지 업로드에 실패했습니다.');
          setLoading(false);
          return;
        }
        imageUrl = uploadedUrl;

        // 썸네일 생성 + 업로드
        try {
          const thumb = await manipulateAsync(imageUri, [{ resize: { width: 400 } }], { compress: 0.6, format: SaveFormat.JPEG });
          const thumbRes = await fetch(thumb.uri);
          const thumbBlob = await thumbRes.blob();
          await r2Upload('artworks', thumbName, thumbBlob, 'image/jpeg');
        } catch {}

        if (isEditing && originalImageUrl) {
          const oldPath = r2ExtractPath(originalImageUrl, 'artworks');
          if (oldPath) {
            await r2Delete('artworks', [oldPath, `thumb_${oldPath.split('/').pop()}`].filter(Boolean));
          }
        }
      }

      // 자동 태그
      const autoTags: string[] = [];
      if (year.trim()) autoTags.push(year.trim());
      if (selectedCategory) autoTags.push(selectedCategory);
      // visual 타입 전용 자동태그
      if (formType === 'visual') {
        if (metadata.medium) metadata.medium.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
        if (metadata.technique) metadata.technique.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
        if (metadata.width_cm && metadata.height_cm) autoTags.push(`${metadata.width_cm}x${metadata.height_cm}cm`);
      }
      // 장르 자동태그
      if (metadata.genre) metadata.genre.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
      tagChips.forEach(t => { if (t) autoTags.push(t); });
      if (tagInput.trim()) {
        tagInput.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
      }
      const tags = [...new Set(autoTags)];

      // 저장할 메타데이터 (빈 값 제외)
      const cleanMeta: Record<string, string> = {};
      for (const [k, v] of Object.entries(metadata)) {
        if (v && v.trim()) cleanMeta[k] = v.trim();
      }

      // visual 타입: 기존 컬럼 활용
      const isVisual = formType === 'visual';
      const combinedMedium = isVisual
        ? [metadata.medium?.trim(), metadata.technique?.trim()].filter(Boolean).join(', ')
        : null;

      const artworkData: any = {
        title: title.trim(),
        image_url: imageUrl!,
        year: year ? parseInt(year, 10) : null,
        medium: combinedMedium || null,
        width_cm: isVisual && metadata.width_cm ? parseFloat(metadata.width_cm) : null,
        height_cm: isVisual && metadata.height_cm ? parseFloat(metadata.height_cm) : null,
        edition: (isVisual || formType === 'writing') && metadata.edition ? metadata.edition.trim() : null,
        description: description.trim() || null,
        tags,
        category: selectedCategory || null,
        metadata: cleanMeta,
      };

      if (isEditing) {
        const { error: updateError } = await supabase.from('artworks')
          .update(artworkData)
          .eq('id', artworkId);
        if (updateError) {
          showAlert('오류', '수정에 실패했습니다: ' + updateError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from('artworks').insert({
          user_id: user.id,
          ...artworkData,
        });
        if (insertError) {
          showAlert('오류', '저장에 실패했습니다: ' + insertError.message);
          setLoading(false);
          return;
        }
      }

      if (!isEditing) await refreshProfile();
      if (!isEditing && profile?.username) {
        router.replace(`/artist/${profile.username}`);
      } else {
        router.back();
      }
    } catch (err) {
      console.error('작품 저장 오류:', err);
      showAlert('오류', '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
      {/* 상단 바 */}
      <View style={[styles.topBar, { borderBottomColor: C.border }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backText, { color: C.fg }]}>← 뒤로</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: C.fg }]}>{isEditing ? '작품 수정' : '작품 업로드'}</Text>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: (!selectedCategory || loading) ? C.border : C.gold }, pressed && selectedCategory && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading || !selectedCategory}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Text style={[styles.saveBtnText, { color: C.bg }]}>{isEditing ? '수정' : '저장 (-10)'}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 카테고리(세부 분야) 선택 ── */}
        <Animated.View entering={FadeInDown.delay(50).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>분야 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>

          {/* 유저의 세부 분야가 있으면 칩으로 표시 */}
          {userSubFields.length > 0 || (isEditing && !canEditCategory) ? (
            <View style={styles.categoryChipsWrap}>
              {/* 편집 시: 원래 분야가 유저 분야에 없으면 잠금 상태로 표시 */}
              {isEditing && !canEditCategory && originalCategory && !userSubFields.includes(originalCategory) && (
                <View
                  style={[
                    styles.categoryChip,
                    { borderColor: C.gold, backgroundColor: C.goldDim, opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.categoryChipText, { color: C.gold }]}>{originalCategory}</Text>
                </View>
              )}
              {userSubFields.map((sf) => {
                const active = selectedCategory === sf;
                const disabled = !canEditCategory;
                return (
                  <Pressable
                    key={sf}
                    style={[
                      styles.categoryChip,
                      { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.goldDim : C.card },
                      disabled && { opacity: 0.4 },
                    ]}
                    onPress={() => !disabled && handleCategoryChange(sf)}
                    disabled={disabled}
                  >
                    <Text style={[styles.categoryChipText, { color: active ? C.gold : C.muted }]}>{sf}</Text>
                  </Pressable>
                );
              })}
              {/* 미설정 유저 + 세부분야 4개 미만일 때만 "다른 분야" */}
              {!hadSubFieldOnEntry.current && canAddMore && canEditCategory && (
                <Pressable
                  style={[styles.categoryChip, { borderColor: C.border, backgroundColor: C.card, borderStyle: 'dashed' }]}
                  onPress={() => setShowFieldPicker(true)}
                >
                  <Text style={[styles.categoryChipText, { color: C.mutedLight }]}>+ 다른 분야</Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* 세부 분야 미설정: 전체 선택 UI */
            <>
              <Pressable
                style={[styles.fieldPickerBtn, { borderColor: C.border, backgroundColor: C.card }]}
                onPress={() => setShowFieldPicker(true)}
              >
                <Text style={[styles.fieldPickerBtnText, { color: C.mutedLight }]}>
                  세부 분야를 선택해주세요
                </Text>
              </Pressable>
              <Text style={[styles.fieldPickerHint, { color: C.mutedLight }]}>
                여기서 분야를 선택하면 작가 분야가 프로필에 설정됩니다.
              </Text>
            </>
          )}

          {/* 분야 미선택 시 빨간 안내 */}
          {!selectedCategory && canEditCategory && (
            <Text style={styles.fieldWarning}>
              분야를 선택해야 작품을 등록할 수 있습니다.
            </Text>
          )}

          {/* 분야 변경 불가 안내 */}
          {isEditing && !canEditCategory && (
            <Text style={styles.fieldWarning}>
              현재 작가 분야에 포함되지 않은 작품은 분야를 변경할 수 없습니다.
            </Text>
          )}

          {/* 프로필 저장 완료 메시지 */}
          {profileSavedMsg && (
            <Text style={styles.fieldSavedMsg}>
              작가 분야가 프로필에 저장되었습니다.
            </Text>
          )}

          {/* 선택된 폼 타입 표시 */}
          {selectedCategory && (
            <Text style={[styles.formTypeHint, { color: C.mutedLight }]}>
              {FORM_TYPE_LABEL[formType]} 폼이 적용됩니다
            </Text>
          )}
        </Animated.View>

        {/* ── 분야 선택 팝업 ── */}
        {showFieldPicker && (
          <Animated.View entering={FadeInDown.duration(300).springify()} style={[styles.fieldPickerPanel, { backgroundColor: C.card, borderColor: C.border }]}>
            {!pickerField ? (
              <>
                <Text style={[styles.fieldPickerTitle, { color: C.fg }]}>분야를 선택하세요</Text>
                <View style={styles.categoryChipsWrap}>
                  {/* 상위분야 2개 꽉 찼으면 기존만, + 분야별 2개 꽉 찬 분야 제외 */}
                  {(canAddNewParent
                    ? FIELD_CATEGORIES
                    : FIELD_CATEGORIES.filter(fc => userParentFields.includes(fc.key))
                  ).filter(fc => (parentFieldCounts[fc.key] ?? 0) < 2).map((fc) => (
                    <Pressable
                      key={fc.key}
                      style={[styles.fieldCategoryChip, { borderColor: C.border, backgroundColor: C.bg }]}
                      onPress={() => setPickerField(fc.key)}
                    >
                      <Text style={styles.fieldCategoryIcon}>{fc.icon}</Text>
                      <Text style={[styles.fieldCategoryText, { color: C.fg }]}>{fc.key}</Text>
                    </Pressable>
                  ))}
                </View>
                {!canAddNewParent && (
                  <Text style={[styles.fieldPickerLimitHint, { color: C.mutedLight }]}>
                    상위 분야는 최대 2개, 분야별 세부분야는 최대 2개까지 선택할 수 있습니다.
                  </Text>
                )}
                <Pressable onPress={() => { setShowFieldPicker(false); setPickerField(null); }} style={styles.fieldPickerClose}>
                  <Text style={[styles.fieldPickerCloseText, { color: C.muted }]}>닫기</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => setPickerField(null)} style={{ marginBottom: 8 }}>
                  <Text style={[styles.fieldPickerBack, { color: C.gold }]}>← {pickerField}</Text>
                </Pressable>
                <View style={styles.categoryChipsWrap}>
                  {(SUB_FIELDS[pickerField] ?? []).filter(sf => !userSubFields.includes(sf)).map((sf) => (
                    <Pressable
                      key={sf}
                      style={[styles.categoryChip, { borderColor: C.border, backgroundColor: C.bg }]}
                      onPress={() => selectCategoryAndSaveProfile(sf, pickerField)}
                    >
                      <Text style={[styles.categoryChipText, { color: C.fg }]}>{sf}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        )}

        {/* ── 이미지 선택 ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>작품 이미지 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <Pressable
            style={({ pressed }) => [styles.imagePicker, { borderColor: C.border, backgroundColor: C.card }, pressed && { opacity: 0.7 }]}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="contain" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>🖼️</Text>
                <Text style={[styles.imagePlaceholderText, { color: C.muted }]}>탭하여 이미지 선택</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* ── 제목 ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>제목 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={title}
            onChangeText={setTitle}
            placeholder="작품 제목"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* ── 제작연도/공연연도/발표연도 ── */}
        <Animated.View entering={FadeInDown.delay(250).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>{YEAR_FIELD_LABEL[formType].label} <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={year}
            onChangeText={setYear}
            placeholder={YEAR_FIELD_LABEL[formType].placeholder}
            placeholderTextColor={C.mutedLight}
            keyboardType="number-pad"
          />
        </Animated.View>

        {/* ── 폼 타입별 추가 필드 ── */}
        {metaFields.map((field, idx) => (
          <Animated.View key={`${field.key}-${field.label}`} entering={FadeInDown.delay(300 + idx * 50).duration(400).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>
              {field.label} {field.required
                ? <Text style={[styles.required, { color: C.gold }]}>*</Text>
                : <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text>
              }
            </Text>
            {/* 크기 필드: width_cm과 height_cm을 함께 렌더링 */}
            {field.key === 'width_cm' ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg, marginBottom: 8 }]}
                  value={metadata.width_cm ?? ''}
                  onChangeText={(v) => setMeta('width_cm', v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={C.mutedLight}
                  keyboardType={field.keyboard ?? 'default'}
                />
              </>
            ) : field.key === 'height_cm' ? (
              <TextInput
                style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
                value={metadata.height_cm ?? ''}
                onChangeText={(v) => setMeta('height_cm', v)}
                placeholder={field.placeholder}
                placeholderTextColor={C.mutedLight}
                keyboardType={field.keyboard ?? 'default'}
              />
            ) : (
              <TextInput
                style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
                value={metadata[field.key] ?? ''}
                onChangeText={(v) => setMeta(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={C.mutedLight}
                keyboardType={field.keyboard ?? 'default'}
                autoCapitalize={field.keyboard === 'url' ? 'none' : 'sentences'}
              />
            )}
          </Animated.View>
        ))}

        {/* ── 설명 ── */}
        <Animated.View entering={FadeInDown.delay(300 + metaFields.length * 50).duration(400).springify()}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: C.fg, marginTop: 0 }]}>설명 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <Text style={[styles.charCount, { color: description.trim().length >= 10 ? C.gold : C.danger }]}>
              {description.trim().length}/10
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={description}
            onChangeText={setDescription}
            placeholder="작품에 대한 설명을 입력하세요 (10자 이상)"
            placeholderTextColor={C.mutedLight}
            multiline
            textAlignVertical="top"
          />
        </Animated.View>

        {/* ── 태그 ── */}
        <Animated.View entering={FadeInDown.delay(350 + metaFields.length * 50).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>태그 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, styles.tagInputField, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="예: 네오팝, 스트릿아트"
              placeholderTextColor={C.mutedLight}
            />
            <Pressable
              style={({ pressed }) => [
                styles.tagAddBtn,
                { backgroundColor: tagInput.trim() ? C.gold : C.border },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                const newTags = tagInput.split(/[,،]/).map(s => s.trim()).filter(Boolean);
                if (newTags.length > 0) {
                  setTagChips(prev => [...new Set([...prev, ...newTags])]);
                  setTagInput('');
                }
              }}
              disabled={!tagInput.trim()}
            >
              <Text style={[styles.tagAddBtnText, { color: tagInput.trim() ? C.bg : C.mutedLight }]}>등록</Text>
            </Pressable>
          </View>
          {tagChips.length > 0 && (
            <View style={styles.tagChipsWrap}>
              {tagChips.map((tag, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.tagChip, { backgroundColor: C.goldDim, borderColor: C.gold }, pressed && { opacity: 0.6 }]}
                  onPress={() => setTagChips(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Text style={[styles.tagChipText, { color: C.gold }]}>#{tag}</Text>
                  <Text style={[styles.tagChipX, { color: C.gold }]}>×</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={[styles.tagHint, { color: C.mutedLight }]}>
            연도, 분야, 재료 등은 자동 태그 · 탭하면 삭제
          </Text>
        </Animated.View>

        <View style={{ height: 40 }} />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 90,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  required: {
    fontWeight: '700',
  },
  optional: {
    fontSize: 11,
    fontWeight: '500',
  },
  charCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
  },
  textArea: {
    minHeight: 140,
    paddingTop: 14,
  },
  // ── 카테고리 칩 ──
  categoryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  formTypeHint: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  fieldWarning: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e74c3c',
    marginTop: 8,
  },
  fieldSavedMsg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498db',
    marginTop: 8,
  },
  fieldPickerLimitHint: {
    fontSize: 11,
    marginTop: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // ── 분야 선택 패널 ──
  fieldPickerBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldPickerBtnText: {
    fontSize: 14,
  },
  fieldPickerHint: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  fieldPickerPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  fieldPickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  fieldPickerClose: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  fieldPickerCloseText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldPickerBack: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  fieldCategoryIcon: {
    fontSize: 16,
  },
  fieldCategoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // ── 태그 ──
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tagInputField: {
    flex: 1,
  },
  tagAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagChipX: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  tagHint: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  imagePicker: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 260,
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  imagePlaceholderIcon: {
    fontSize: 40,
  },
  imagePlaceholderText: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
