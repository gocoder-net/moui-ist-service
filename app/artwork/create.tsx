import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { spendPoints } from '@/lib/points';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function CreateArtworkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { colors: C } = useThemeMode();
  const { artworkId } = useLocalSearchParams<{ artworkId?: string }>();

  const isEditing = !!artworkId;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [medium, setMedium] = useState('');
  const [technique, setTechnique] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [edition, setEdition] = useState('');
  const [description, setDescription] = useState('');
  const [tagChips, setTagChips] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  useEffect(() => {
    if (!artworkId) return;
    setInitialLoading(true);
    supabase.from('artworks').select('*').eq('id', artworkId).single().then(({ data }) => {
      if (data) {
        setTitle(data.title ?? '');
        setYear(data.year ? String(data.year) : '');
        setMedium(data.medium ?? '');
        setWidthCm(data.width_cm ? String(data.width_cm) : '');
        setHeightCm(data.height_cm ? String(data.height_cm) : '');
        setEdition(data.edition ?? '');
        setDescription(data.description ?? '');
        // 기존 태그 중 자동생성이 아닌 커스텀 태그만 로드
        if (data.tags && data.tags.length > 0) {
          const autoTags = new Set<string>();
          if (data.year) autoTags.add(String(data.year));
          if (data.medium) data.medium.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.add(t); });
          if (data.width_cm && data.height_cm) autoTags.add(`${data.width_cm}x${data.height_cm}cm`);
          const custom = data.tags.filter((t: string) => !autoTags.has(t));
          setTagChips(custom);
        }
        setImageUri(data.image_url);
        setOriginalImageUrl(data.image_url);
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

  const handleSave = async () => {
    if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
    if (!imageUri) { showAlert('알림', '이미지를 선택해주세요.'); return; }
    if (!title.trim()) { showAlert('알림', '작품명을 입력해주세요.'); return; }
    if (!year.trim()) { showAlert('알림', '제작연도를 입력해주세요.'); return; }
    if (!medium.trim()) { showAlert('알림', '재료를 입력해주세요.'); return; }
    if (!technique.trim()) { showAlert('알림', '기법을 입력해주세요.'); return; }
    if (!widthCm.trim() || !heightCm.trim()) { showAlert('알림', '크기(가로, 세로)를 입력해주세요.'); return; }
    if (!description.trim() || description.trim().length < 10) {
      showAlert('알림', `설명은 10글자 이상 입력해주세요. (현재 ${description.trim().length}자)`);
      return;
    }

    setLoading(true);
    try {
      // 새 작품 등록 시 10모의 차감
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
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('artworks')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (uploadError) {
          showAlert('오류', '이미지 업로드에 실패했습니다.');
          setLoading(false);
          return;
        }
        imageUrl = supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;

        if (isEditing && originalImageUrl) {
          const parts = originalImageUrl.split('/artworks/');
          if (parts[1]) {
            await supabase.storage.from('artworks').remove([decodeURIComponent(parts[1])]);
          }
        }
      }

      const combinedMedium = `${medium.trim()}, ${technique.trim()}`;

      // 자동 태그 생성: 제작연도 + 재료/기법 + 크기
      const autoTags: string[] = [];
      if (year.trim()) autoTags.push(year.trim());
      if (medium.trim()) medium.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
      if (technique.trim()) technique.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
      if (widthCm.trim() && heightCm.trim()) autoTags.push(`${widthCm.trim()}x${heightCm.trim()}cm`);
      // 커스텀 태그 추가 (칩 + 입력중인 텍스트)
      tagChips.forEach(t => { if (t) autoTags.push(t); });
      if (tagInput.trim()) {
        tagInput.split(/[,،]/).forEach(s => { const t = s.trim(); if (t) autoTags.push(t); });
      }
      // 중복 제거
      const tags = [...new Set(autoTags)];

      const artworkData = {
        title: title.trim(),
        image_url: imageUrl!,
        year: year ? parseInt(year, 10) : null,
        medium: combinedMedium || null,
        width_cm: widthCm ? parseFloat(widthCm) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        edition: edition.trim() || null,
        description: description.trim() || null,
        tags,
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
      router.back();
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
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.6 }, loading && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Text style={[styles.saveBtnText, { color: C.bg }]}>{isEditing ? '수정' : '저장'}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 이미지 선택 */}
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

        {/* 제목 */}
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

        {/* 제작연도 */}
        <Animated.View entering={FadeInDown.delay(250).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>제작연도 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={year}
            onChangeText={setYear}
            placeholder="예: 2024"
            placeholderTextColor={C.mutedLight}
            keyboardType="number-pad"
          />
        </Animated.View>

        {/* 재료 */}
        <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>재료 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={medium}
            onChangeText={setMedium}
            placeholder="예: 캔버스에 유채"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 기법 */}
        <Animated.View entering={FadeInDown.delay(350).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>기법 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={technique}
            onChangeText={setTechnique}
            placeholder="예: 임파스토, 글레이징"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 크기 (가로 / 세로 세로 배치) */}
        <Animated.View entering={FadeInDown.delay(400).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>크기 (cm) <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg, marginBottom: 8 }]}
            value={widthCm}
            onChangeText={setWidthCm}
            placeholder="가로 (cm)"
            placeholderTextColor={C.mutedLight}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="세로 (cm)"
            placeholderTextColor={C.mutedLight}
            keyboardType="decimal-pad"
          />
        </Animated.View>

        {/* 에디션 */}
        <Animated.View entering={FadeInDown.delay(450).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>에디션 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={edition}
            onChangeText={setEdition}
            placeholder="예: 1/10"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 설명 */}
        <Animated.View entering={FadeInDown.delay(500).duration(400).springify()}>
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

        {/* 태그 */}
        <Animated.View entering={FadeInDown.delay(550).duration(400).springify()}>
          <Text style={[styles.label, { color: C.fg }]}>추가 태그 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
            value={tagInput}
            onChangeText={(text) => {
              if (text.includes(',') || text.includes('،')) {
                const parts = text.split(/[,،]/);
                const newTags = parts.slice(0, -1).map(s => s.trim()).filter(Boolean);
                if (newTags.length > 0) {
                  setTagChips(prev => [...new Set([...prev, ...newTags])]);
                }
                setTagInput(parts[parts.length - 1]);
              } else {
                setTagInput(text);
              }
            }}
            placeholder={tagChips.length > 0 ? '태그 추가...' : '예: 네오팝, 스트릿아트 (쉼표로 구분)'}
            placeholderTextColor={C.mutedLight}
          />
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
            제작연도, 재료, 기법, 크기는 자동 태그 · 탭하면 삭제
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
