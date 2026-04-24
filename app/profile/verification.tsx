import { useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

function showAlert(title: string, msg: string) {
  Platform.OS === 'web' ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!user || !imageUri) return;
    setSubmitting(true);
    try {
      const manipulated = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: SaveFormat.JPEG },
      );
      const uri = manipulated.uri;
      const fileName = `verification/${user.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        showAlert('오류', '이미지 업로드에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      const publicUrl = supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;

      const { error: insertError } = await (supabase as any)
        .from('verification_requests')
        .insert({ user_id: user.id, image_url: publicUrl });

      if (insertError) {
        showAlert('오류', '인증 요청 제출에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      showAlert('제출 완료', '관리자 확인 후 인증 처리됩니다.');
      router.back();
    } catch (err) {
      console.error('인증 요청 오류:', err);
      showAlert('오류', '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.duration(300)} style={s.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}>
          <Text style={[s.backText, { color: C.fg }]}>{'‹'}</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: C.fg }]}>작가 인증</Text>
        <View style={s.backBtn} />
      </Animated.View>

      <View style={s.content}>
        {/* 안내 텍스트 */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[s.infoCard, { backgroundColor: C.card }]}>
          <Text style={[s.infoText, { color: C.fg }]}>
            예술이 패스 카드 이미지를 첨부해주세요.{'\n'}
            관리자 확인 후 인증 처리됩니다.
          </Text>
          <Text style={[s.infoHighlight, { color: C.gold }]}>
            🔒 업로드한 이미지는 심사 후 서버에서 완전히 삭제됩니다.
          </Text>
        </Animated.View>

        {/* 이미지 선택 영역 */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Pressable
            style={({ pressed }) => [
              s.imageArea,
              { borderColor: C.border, backgroundColor: C.card },
              pressed && { opacity: 0.7 },
            ]}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={s.previewImage} contentFit="contain" />
            ) : (
              <View style={s.placeholder}>
                <Text style={[s.placeholderIcon]}>📷</Text>
                <Text style={[s.placeholderText, { color: C.muted }]}>탭하여 이미지 선택</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* 제출 버튼 */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Pressable
            style={({ pressed }) => [
              s.submitBtn,
              { backgroundColor: imageUri ? C.gold : C.border },
              pressed && imageUri && { opacity: 0.8 },
            ]}
            onPress={handleSubmit}
            disabled={!imageUri || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[s.submitText, { color: imageUri ? '#fff' : C.muted }]}>제출하기</Text>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, fontWeight: '300' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoHighlight: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  imageArea: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    gap: 8,
  },
  placeholderIcon: { fontSize: 36 },
  placeholderText: { fontSize: 14, fontWeight: '600' },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
