import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';

const C = {
  bg: '#191f28', fg: '#f2f4f6', gold: '#C8A96E', goldLight: '#E0C992',
  muted: '#8b95a1', mutedLight: '#4e5968', border: '#333d4b', inputBg: '#212a35',
};

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
  const { user } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [medium, setMedium] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [edition, setEdition] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!title.trim()) { showAlert('알림', '제목을 입력해주세요.'); return; }

    setLoading(true);
    try {
      // 1. Upload image
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
      const publicUrl = supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;

      // 2. Insert DB
      const { error: insertError } = await supabase.from('artworks').insert({
        user_id: user.id,
        title: title.trim(),
        image_url: publicUrl,
        year: year ? parseInt(year, 10) : null,
        medium: medium.trim() || null,
        width_cm: widthCm ? parseFloat(widthCm) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        edition: edition.trim() || null,
        description: description.trim() || null,
      });
      if (insertError) {
        showAlert('오류', '저장에 실패했습니다: ' + insertError.message);
        setLoading(false);
        return;
      }

      // 3. Success
      router.back();
    } catch (err) {
      console.error('작품 저장 오류:', err);
      showAlert('오류', '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← 뒤로</Text>
        </Pressable>
        <Text style={styles.topTitle}>작품 업로드</Text>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.6 }, loading && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Text style={styles.saveBtnText}>저장</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 이미지 선택 */}
        <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Text style={styles.label}>작품 이미지 <Text style={styles.required}>*</Text></Text>
          <Pressable
            style={({ pressed }) => [styles.imagePicker, pressed && { opacity: 0.7 }]}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="contain" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>🖼️</Text>
                <Text style={styles.imagePlaceholderText}>탭하여 이미지 선택</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* 제목 */}
        <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
          <Text style={styles.label}>제목 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="작품 제목"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 연도 */}
        <Animated.View entering={FadeInDown.delay(250).duration(400).springify()}>
          <Text style={styles.label}>연도</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="예: 2024"
            placeholderTextColor={C.mutedLight}
            keyboardType="number-pad"
          />
        </Animated.View>

        {/* 재료/기법 */}
        <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
          <Text style={styles.label}>재료 / 기법</Text>
          <TextInput
            style={styles.input}
            value={medium}
            onChangeText={setMedium}
            placeholder="예: 캔버스에 유채"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 크기 (가로 x 세로) */}
        <Animated.View entering={FadeInDown.delay(350).duration(400).springify()}>
          <Text style={styles.label}>크기 (cm)</Text>
          <View style={styles.sizeRow}>
            <TextInput
              style={[styles.input, styles.sizeInput]}
              value={widthCm}
              onChangeText={setWidthCm}
              placeholder="가로"
              placeholderTextColor={C.mutedLight}
              keyboardType="decimal-pad"
            />
            <Text style={styles.sizeX}>×</Text>
            <TextInput
              style={[styles.input, styles.sizeInput]}
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="세로"
              placeholderTextColor={C.mutedLight}
              keyboardType="decimal-pad"
            />
          </View>
        </Animated.View>

        {/* 에디션 */}
        <Animated.View entering={FadeInDown.delay(400).duration(400).springify()}>
          <Text style={styles.label}>에디션</Text>
          <TextInput
            style={styles.input}
            value={edition}
            onChangeText={setEdition}
            placeholder="예: 1/10"
            placeholderTextColor={C.mutedLight}
          />
        </Animated.View>

        {/* 설명 */}
        <Animated.View entering={FadeInDown.delay(450).duration(400).springify()}>
          <Text style={styles.label}>설명</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="작품에 대한 설명을 입력하세요"
            placeholderTextColor={C.mutedLight}
            multiline
            textAlignVertical="top"
          />
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.fg,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
  },
  saveBtn: {
    backgroundColor: C.gold,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.bg,
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
    color: C.fg,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  required: {
    color: C.gold,
  },
  input: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: C.fg,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sizeInput: {
    flex: 1,
  },
  sizeX: {
    fontSize: 16,
    color: C.muted,
    fontWeight: '600',
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.inputBg,
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
    color: C.muted,
    letterSpacing: 0.5,
  },
});
