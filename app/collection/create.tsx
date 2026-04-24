import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Database } from '@/types/database';

type Artwork = Database['public']['Tables']['artworks']['Row'];

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function CreateCollectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();
  const { collectionId } = useLocalSearchParams<{ collectionId?: string }>();

  const isEditing = !!collectionId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [originalCoverUrl, setOriginalCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // All user artworks + selected ones
  const [allArtworks, setAllArtworks] = useState<Artwork[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load existing collection if editing
  useEffect(() => {
    if (!user) return;
    // Load all user artworks
    supabase
      .from('artworks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAllArtworks(data);
      });

    if (!collectionId) return;
    setInitialLoading(true);
    Promise.all([
      supabase.from('artwork_collections').select('*').eq('id', collectionId).single(),
      supabase.from('collection_artworks').select('artwork_id').eq('collection_id', collectionId),
    ]).then(([colRes, artRes]) => {
      if (colRes.data) {
        setTitle(colRes.data.title ?? '');
        setDescription(colRes.data.description ?? '');
        setCoverUri(colRes.data.cover_image_url);
        setOriginalCoverUrl(colRes.data.cover_image_url);
      }
      if (artRes.data) {
        setSelectedIds(new Set(artRes.data.map((r: any) => r.artwork_id)));
      }
      setInitialLoading(false);
    });
  }, [user, collectionId]);

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const toggleArtwork = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
    if (!title.trim()) { showAlert('알림', '컬렉션 이름을 입력해주세요.'); return; }
    if (selectedIds.size === 0) { showAlert('알림', '작품을 1개 이상 선택해주세요.'); return; }

    setLoading(true);
    try {
      let coverUrl = originalCoverUrl;
      const coverChanged = coverUri !== originalCoverUrl;

      if (coverChanged && coverUri) {
        const fileName = `${user.id}/col_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const response = await fetch(coverUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('artworks')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (uploadError) {
          showAlert('오류', '이미지 업로드에 실패했습니다.');
          setLoading(false);
          return;
        }
        coverUrl = supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;

        if (isEditing && originalCoverUrl) {
          const parts = originalCoverUrl.split('/artworks/');
          if (parts[1]) {
            await supabase.storage.from('artworks').remove([decodeURIComponent(parts[1])]);
          }
        }
      }

      const colData = {
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: coverUrl,
      };

      let colId = collectionId;

      if (isEditing) {
        const { error } = await supabase.from('artwork_collections')
          .update(colData)
          .eq('id', collectionId);
        if (error) {
          showAlert('오류', '수정에 실패했습니다: ' + error.message);
          setLoading(false);
          return;
        }
      } else {
        const { data, error } = await supabase.from('artwork_collections').insert({
          user_id: user.id,
          ...colData,
        }).select('id').single();
        if (error || !data) {
          showAlert('오류', '저장에 실패했습니다: ' + (error?.message ?? ''));
          setLoading(false);
          return;
        }
        colId = data.id;
      }

      // Sync collection_artworks: delete all then re-insert
      await supabase.from('collection_artworks').delete().eq('collection_id', colId!);
      const artworkRows = Array.from(selectedIds).map((artwork_id, idx) => ({
        collection_id: colId!,
        artwork_id,
        sort_order: idx,
      }));
      if (artworkRows.length > 0) {
        const { error: linkErr } = await supabase.from('collection_artworks').insert(artworkRows);
        if (linkErr) {
          showAlert('오류', '작품 연결에 실패했습니다: ' + linkErr.message);
          setLoading(false);
          return;
        }
      }

      router.back();
    } catch (err) {
      console.error('컬렉션 저장 오류:', err);
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
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: C.border }]}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backText, { color: C.fg }]}>← 뒤로</Text>
          </Pressable>
          <Text style={[styles.topTitle, { color: C.fg }]}>{isEditing ? '컬렉션 수정' : '컬렉션 만들기'}</Text>
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
          {/* Cover image */}
          <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>커버 이미지 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <Pressable
              style={({ pressed }) => [styles.coverPicker, { borderColor: C.border, backgroundColor: C.card }, pressed && { opacity: 0.7 }]}
              onPress={pickCover}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverPreview} contentFit="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverPlaceholderIcon}>🎨</Text>
                  <Text style={[styles.coverPlaceholderText, { color: C.muted }]}>탭하여 커버 이미지 선택</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>컬렉션 이름 <Text style={[styles.required, { color: C.gold }]}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 바스키야 시리즈"
              placeholderTextColor={C.mutedLight}
            />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>설명 <Text style={[styles.optional, { color: C.mutedLight }]}>(선택)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              value={description}
              onChangeText={setDescription}
              placeholder="컬렉션에 대한 설명"
              placeholderTextColor={C.mutedLight}
              multiline
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Select artworks */}
          <Animated.View entering={FadeInDown.delay(400).duration(400).springify()}>
            <Text style={[styles.label, { color: C.fg }]}>
              작품 선택 <Text style={[styles.required, { color: C.gold }]}>*</Text>
              <Text style={[styles.optional, { color: C.mutedLight }]}> ({selectedIds.size}개 선택)</Text>
            </Text>
            <View style={styles.artworkGrid}>
              {allArtworks.map((aw) => {
                const selected = selectedIds.has(aw.id);
                return (
                  <Pressable
                    key={aw.id}
                    style={({ pressed }) => [
                      styles.artworkItem,
                      { borderColor: selected ? C.gold : C.border, backgroundColor: C.card },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => toggleArtwork(aw.id)}
                  >
                    <Image source={{ uri: aw.image_url }} style={styles.artworkThumb} contentFit="cover" />
                    {selected && (
                      <View style={[styles.checkBadge, { backgroundColor: C.gold }]}>
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    )}
                    <Text style={[styles.artworkItemTitle, { color: C.fg }]} numberOfLines={1}>{aw.title}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  required: {
    fontWeight: '700',
  },
  optional: {
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  coverPicker: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPlaceholderIcon: {
    fontSize: 36,
  },
  coverPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  artworkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  artworkItem: {
    width: '30%',
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  artworkThumb: {
    width: '100%',
    aspectRatio: 1,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  artworkItemTitle: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
});
