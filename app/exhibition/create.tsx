import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, useWindowDimensions, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { spendPoints } from '@/lib/points';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';

import {
  type Wall, type RoomType, type PlacedArtwork,
  type WallImageInfo, type WallImageMode, type WallImages,
  ROOM_TEMPLATES, WALL_LABELS, MEDIUM_OPTIONS,
} from '@/components/exhibition/room-geometry';
import Room3DView from '@/components/exhibition/Room3DView';
import WallFaceEditor from '@/components/exhibition/WallFaceEditor';

const C = {
  bg: '#000000', fg: '#f5f5f5', gold: '#C8A96E', goldLight: '#E0C992',
  muted: '#a8a8a8', mutedLight: '#363636', border: '#262626', white: '#f5f5f5', inputBg: '#121212',
};

const WALL_COLORS = [
  '#F5F5F0', '#FFF8E7', '#E8E8E8', '#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A', '#D4C5A9',
];

export default function CreateExhibitionScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = !!editId;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [foreword, setForeword] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('medium');
  const [wallColors, setWallColors] = useState<Record<Wall, string>>({
    north: '#F5F5F0', south: '#F5F5F0', east: '#F5F5F0', west: '#F5F5F0',
  });
  const [floorColor, setFloorColor] = useState('#8B7355');
  const [ceilingColor, setCeilingColor] = useState('#F5F5F0');
  const [colorTarget, setColorTarget] = useState<'wall' | 'floor' | 'ceiling'>('wall');
  const [customHex, setCustomHex] = useState('');
  const [selectedWall, setSelectedWall] = useState<Wall | null>(null);
  const [artworks, setArtworks] = useState<PlacedArtwork[]>([]);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [wallEditorOpen, setWallEditorOpen] = useState<Wall | null>(null);
  const [wallImages, setWallImages] = useState<WallImages>({
    north: null, south: null, east: null, west: null,
  });
  const [wallImageLocalUris, setWallImageLocalUris] = useState<Record<Wall, string | null>>({
    north: null, south: null, east: null, west: null,
  });
  const [wallSurfaceMode, setWallSurfaceMode] = useState<'color' | 'image'>('color');
  const [bgmLocalUri, setBgmLocalUri] = useState<string | null>(null);
  const [bgmFileName, setBgmFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(!!editId);

  // 포트폴리오 작품 선택
  type PortfolioArtwork = { id: string; title: string; image_url: string; width_cm: number | null; height_cm: number | null; year: number | null; medium: string | null; edition: string | null; description: string | null };
  const [portfolioArtworks, setPortfolioArtworks] = useState<PortfolioArtwork[]>([]);
  const [portfolioPickerVisible, setPortfolioPickerVisible] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<{ wall: Wall; posXcm: number; posYcm: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('artworks')
      .select('id, title, image_url, width_cm, height_cm, year, medium, edition, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPortfolioArtworks(data); });
  }, [user]);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      try {
        // 전시관 데이터 로드
        const { data: ex, error: exErr } = await supabase
          .from('exhibitions')
          .select('*')
          .eq('id', editId)
          .single();
        if (exErr || !ex) { Alert.alert('오류', '전시관 데이터를 불러올 수 없습니다.'); router.back(); return; }

        setTitle(ex.title || '');
        setDescription(ex.description || '');
        setForeword(ex.foreword || '');
        setRoomType(ex.room_type as RoomType);
        setWallColors({
          north: ex.wall_color_north || '#F5F5F0',
          south: ex.wall_color_south || '#F5F5F0',
          east: ex.wall_color_east || '#F5F5F0',
          west: ex.wall_color_west || '#F5F5F0',
        });
        setFloorColor(ex.floor_color || '#8B7355');
        setCeilingColor(ex.ceiling_color || '#F5F5F0');

        if (ex.poster_image_url) setPosterUri(ex.poster_image_url);
        if (ex.bgm_url) {
          setBgmLocalUri(ex.bgm_url);
          setBgmFileName(ex.bgm_url.split('/').pop() || 'BGM');
        }

        // 벽면 이미지 로드
        if (ex.wall_images) {
          const wi = ex.wall_images as Record<string, { url: string; mode: WallImageMode } | null>;
          const newWallImages: WallImages = { north: null, south: null, east: null, west: null };
          const newWallImageLocalUris: Record<Wall, string | null> = { north: null, south: null, east: null, west: null };
          for (const w of ['north', 'south', 'east', 'west'] as Wall[]) {
            if (wi[w]) {
              newWallImages[w] = { url: wi[w]!.url, mode: wi[w]!.mode };
              newWallImageLocalUris[w] = wi[w]!.url; // 기존 URL을 그대로 사용
            }
          }
          setWallImages(newWallImages);
          setWallImageLocalUris(newWallImageLocalUris);
          // 벽면 이미지가 하나라도 있으면 이미지 모드로 설정
          if (Object.values(wi).some(v => v !== null)) {
            setWallSurfaceMode('image');
          }
        }

        // 배치된 작품 로드
        const { data: placements } = await supabase
          .from('exhibition_artworks')
          .select('*, artworks(*)')
          .eq('exhibition_id', editId);

        if (placements && placements.length > 0) {
          const loadedArtworks: PlacedArtwork[] = placements.map((p: any) => ({
            localId: p.artwork_id || Date.now().toString() + Math.random(),
            uri: p.artworks?.image_url || '',
            title: p.artworks?.title || '',
            year: p.artworks?.year || undefined,
            medium: p.artworks?.medium || undefined,
            edition: p.artworks?.edition || undefined,
            description: p.artworks?.description || undefined,
            wall: p.wall as Wall,
            positionX: p.position_x,
            positionY: p.position_y,
            widthCm: p.width_cm,
            heightCm: p.height_cm,
            topUri: p.artworks?.image_top_url || undefined,
            bottomUri: p.artworks?.image_bottom_url || undefined,
            leftUri: p.artworks?.image_left_url || undefined,
            rightUri: p.artworks?.image_right_url || undefined,
            existingArtworkId: p.artwork_id,
            existingImageUrl: p.artworks?.image_url || undefined,
          }));
          setArtworks(loadedArtworks);
        }
      } catch (e: any) {
        Alert.alert('오류', '데이터 로드 중 오류가 발생했습니다.');
      } finally {
        setEditLoading(false);
      }
    })();
  }, [editId, user]);

  const mapWidth = Math.min(screenWidth - 48, 360);
  const editorWidth = screenWidth - 48;
  const room = ROOM_TEMPLATES[roomType];

  // 벽면 에디터에서 터치 → 포트폴리오 피커 열기
  const handlePlaceArtwork = (wall: Wall, posXcm: number, posYcm: number) => {
    const safeX = isNaN(posXcm) ? 300 : posXcm;
    const safeY = isNaN(posYcm) ? 150 : posYcm;
    setPendingPlacement({ wall, posXcm: safeX, posYcm: safeY });
    setPortfolioPickerVisible(true);
  };

  // 포트폴리오 작품 선택 시 배치
  const handleSelectPortfolioArtwork = (pa: PortfolioArtwork) => {
    if (!pendingPlacement) return;
    const { wall, posXcm, posYcm } = pendingPlacement;

    const wallH = room.height;
    const baseHeight = Math.round(wallH * 0.4);
    let artW = pa.width_cm ?? baseHeight;
    let artH = pa.height_cm ?? baseHeight;

    // 벽에 맞게 스케일
    const scale = baseHeight / Math.max(artW, artH);
    if (scale < 1) {
      artW = Math.round(artW * scale);
      artH = Math.round(artH * scale);
    }
    artW = Math.max(20, Math.min(artW, 300));
    artH = Math.max(20, Math.min(artH, 300));

    const newArt: PlacedArtwork = {
      localId: Date.now().toString(),
      uri: pa.image_url,
      title: pa.title,
      year: pa.year ?? undefined,
      medium: pa.medium ?? undefined,
      edition: pa.edition ?? undefined,
      description: pa.description ?? undefined,
      wall,
      positionX: posXcm,
      positionY: posYcm,
      widthCm: artW,
      heightCm: artH,
      existingImageUrl: pa.image_url,
    };
    setArtworks(prev => [...prev, newArt]);
    setSelectedArtworkId(newArt.localId);
    setPortfolioPickerVisible(false);
    setPendingPlacement(null);
  };

  // 기기에서 직접 이미지 선택 (폴백)
  const handlePickFromDevice = async () => {
    if (!pendingPlacement) return;
    const { wall, posXcm, posYcm } = pendingPlacement;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const aspect = (asset.width || 1) / (asset.height || 1);
      const wallH = room.height;
      const baseHeight = Math.round(wallH * 0.4);
      let artW: number, artH: number;
      if (aspect >= 1) { artW = Math.round(baseHeight * aspect); artH = baseHeight; }
      else { artH = baseHeight; artW = Math.round(baseHeight * aspect); }
      artW = Math.max(20, Math.min(artW, 300));
      artH = Math.max(20, Math.min(artH, 300));

      const newArt: PlacedArtwork = {
        localId: Date.now().toString(),
        uri: asset.uri,
        title: `작품 ${artworks.length + 1}`,
        wall,
        positionX: posXcm,
        positionY: posYcm,
        widthCm: artW,
        heightCm: artH,
      };
      setArtworks(prev => [...prev, newArt]);
      setSelectedArtworkId(newArt.localId);
    }
    setPortfolioPickerVisible(false);
    setPendingPlacement(null);
  };

  const pickAngleImage = async (angle: 'top' | 'bottom' | 'left' | 'right') => {
    if (!selectedArtworkId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const key = `${angle}Uri` as keyof PlacedArtwork;
      setArtworks(prev => prev.map(a =>
        a.localId === selectedArtworkId ? { ...a, [key]: result.assets[0].uri } : a
      ));
    }
  };

  const resizeArtwork = (id: string, widthCm: number, heightCm: number) => {
    setArtworks(prev => prev.map(a =>
      a.localId === id ? { ...a, widthCm, heightCm } : a
    ));
  };

  const moveArtwork = (id: string, posXcm: number, posYcm: number) => {
    setArtworks(prev => prev.map(a =>
      a.localId === id ? { ...a, positionX: posXcm, positionY: posYcm } : a
    ));
  };

  const removeArtwork = (id: string) => {
    setArtworks(prev => prev.filter(a => a.localId !== id));
    if (selectedArtworkId === id) setSelectedArtworkId(null);
  };

  const isExistingUrl = (uri: string | null | undefined) => !!uri && uri.startsWith('http');

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('알림', '전시관 이름을 입력해주세요.'); return; }
    if (artworks.length === 0) { Alert.alert('알림', '작품을 배치해주세요.'); return; }
    if (!user) { Alert.alert('알림', '로그인이 필요합니다.'); return; }

    setLoading(true);
    try {
      // 새 전시관 생성 시 50모의 차감
      if (!isEditMode) {
        const { error: pointErr } = await spendPoints(user.id, 50, '전시관 만들기');
        if (pointErr) {
          Alert.alert('모의 부족', pointErr);
          setLoading(false);
          return;
        }
      }

      const uploadImage = async (uri: string): Promise<string | null> => {
        // 이미 업로드된 URL이면 그대로 반환
        if (isExistingUrl(uri)) return uri;
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('artworks').upload(fileName, blob, { contentType: 'image/jpeg' });
        if (error) return null;
        return supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;
      };

      // Upload poster if present
      let posterImageUrl: string | null = null;
      if (posterUri) {
        posterImageUrl = isExistingUrl(posterUri) ? posterUri : await uploadImage(posterUri);
      }

      // Upload BGM if present
      let bgmUrl: string | null = null;
      if (bgmLocalUri) {
        if (isExistingUrl(bgmLocalUri)) {
          bgmUrl = bgmLocalUri;
        } else {
          const bgmFn = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`;
          const bgmResponse = await fetch(bgmLocalUri);
          const bgmBlob = await bgmResponse.blob();
          const { error: bgmErr } = await supabase.storage.from('bgm').upload(bgmFn, bgmBlob, { contentType: 'audio/mpeg' });
          if (!bgmErr) {
            bgmUrl = supabase.storage.from('bgm').getPublicUrl(bgmFn).data.publicUrl;
          }
        }
      }

      // Upload wall images
      const wallImagesJson: Record<string, { url: string; mode: WallImageMode } | null> = {};
      for (const w of ['north', 'south', 'east', 'west'] as Wall[]) {
        const localUri = wallImageLocalUris[w];
        const info = wallImages[w];
        if (localUri && info) {
          if (isExistingUrl(localUri)) {
            wallImagesJson[w] = { url: localUri, mode: info.mode };
          } else {
            const uploadedUrl = await uploadImage(localUri);
            wallImagesJson[w] = uploadedUrl ? { url: uploadedUrl, mode: info.mode } : null;
          }
        } else {
          wallImagesJson[w] = null;
        }
      }

      const exhibitionData = {
        title: title.trim(),
        description: description.trim() || null,
        foreword: foreword.trim() || null,
        room_type: roomType,
        wall_color_north: wallColors.north, wall_color_south: wallColors.south,
        wall_color_east: wallColors.east, wall_color_west: wallColors.west,
        floor_color: floorColor, ceiling_color: ceilingColor,
        poster_image_url: posterImageUrl,
        wall_images: wallImagesJson,
        bgm_url: bgmUrl,
        is_published: true,
      };

      let exhibitionId: string;

      if (isEditMode && editId) {
        // 수정 모드: UPDATE
        const { error: updateErr } = await supabase.from('exhibitions')
          .update(exhibitionData)
          .eq('id', editId);
        if (updateErr) { Alert.alert('오류', `전시관 수정 실패: ${updateErr.message}`); setLoading(false); return; }
        exhibitionId = editId;

        // 기존 exhibition_artworks 삭제
        await supabase.from('exhibition_artworks').delete().eq('exhibition_id', editId);
      } else {
        // 생성 모드: INSERT
        const { data: exhibition, error: exErr } = await supabase.from('exhibitions')
          .insert({ user_id: user.id, ...exhibitionData })
          .select('id').single();
        if (exErr || !exhibition) { Alert.alert('오류', `전시관 생성 실패: ${exErr?.message || '알 수 없는 오류'}`); setLoading(false); return; }
        exhibitionId = exhibition.id;
      }

      for (const art of artworks) {
        const imageUrl = await uploadImage(art.uri);
        if (!imageUrl) continue;
        const topUrl = art.topUri ? await uploadImage(art.topUri) : null;
        const bottomUrl = art.bottomUri ? await uploadImage(art.bottomUri) : null;
        const leftUrl = art.leftUri ? await uploadImage(art.leftUri) : null;
        const rightUrl = art.rightUri ? await uploadImage(art.rightUri) : null;

        let artworkId: string | null = null;

        if (art.existingArtworkId) {
          // 기존 작품 업데이트
          const { error: artUpdateErr } = await supabase.from('artworks')
            .update({
              title: art.title, image_url: imageUrl,
              year: art.year || null,
              medium: art.medium || null,
              width_cm: art.widthCm,
              height_cm: art.heightCm,
              edition: art.edition || null,
              description: art.description || null,
              image_top_url: topUrl, image_bottom_url: bottomUrl,
              image_left_url: leftUrl, image_right_url: rightUrl,
            })
            .eq('id', art.existingArtworkId);
          if (!artUpdateErr) artworkId = art.existingArtworkId;
        }

        if (!artworkId) {
          // 새 작품 삽입
          const { data: artData } = await supabase.from('artworks')
            .insert({
              user_id: user.id, title: art.title, image_url: imageUrl,
              year: art.year || null,
              medium: art.medium || null,
              width_cm: art.widthCm,
              height_cm: art.heightCm,
              edition: art.edition || null,
              description: art.description || null,
              image_top_url: topUrl, image_bottom_url: bottomUrl,
              image_left_url: leftUrl, image_right_url: rightUrl,
            })
            .select('id').single();
          if (artData) artworkId = artData.id;
        }

        if (!artworkId) continue;

        await supabase.from('exhibition_artworks').insert({
          exhibition_id: exhibitionId, artwork_id: artworkId,
          wall: art.wall, position_x: art.positionX, position_y: art.positionY,
          width_cm: art.widthCm, height_cm: art.heightCm,
        });
      }

      if (!isEditMode) await refreshProfile();
      setLoading(false);
      router.replace(`/exhibition/${exhibitionId}`);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('오류', e?.message || `전시관 ${isEditMode ? '수정' : '생성'} 중 오류가 발생했습니다.`);
    }
  };

  const stepLabels = ['정보', '전시관', '벽면', '작품'];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {editLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ marginTop: 12, color: C.muted, fontSize: 13 }}>데이터 불러오는 중...</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 네비 */}
        <View style={styles.nav}>
          <Pressable style={styles.backBtn} onPress={() => {
            if (wallEditorOpen) { setWallEditorOpen(null); return; }
            if (step > 1) setStep((step - 1) as any);
            else router.back();
          }}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.enLogo}>MOUI<Text style={{ color: C.gold }}>-</Text>IST</Text>
          <Text style={styles.stepNum}>{step}/4</Text>
        </View>

        {/* 스텝 바 */}
        <View style={styles.stepBar}>
          {stepLabels.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i < step && styles.stepDotDone]} />
              <Text style={[styles.stepLabel, i < step && { color: C.gold }]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* ── STEP 1: 기본 정보 ── */}
        {step === 1 && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>{isEditMode ? '전시 수정' : '전시 정보'}</Text>

            <Text style={styles.label}>전시 이름 *</Text>
            <TextInput style={styles.input} placeholder="예: 봄의 기억" placeholderTextColor={C.mutedLight}
              value={title} onChangeText={setTitle} />

            <Text style={[styles.label, { marginTop: 20 }]}>전시 설명 (선택)</Text>
            <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="전시에 대한 짧은 설명" placeholderTextColor={C.mutedLight}
              value={description} onChangeText={setDescription} multiline />

            <Text style={[styles.label, { marginTop: 20 }]}>전시 서문 (선택)</Text>
            <Text style={styles.hint}>관람자가 전시관 입구에서 가장 먼저 읽게 됩니다</Text>
            <TextInput style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              placeholder="이번 전시는..." placeholderTextColor={C.mutedLight}
              value={foreword} onChangeText={setForeword} multiline />

            <Text style={[styles.label, { marginTop: 20 }]}>전시 포스터 (선택)</Text>
            <Text style={styles.hint}>전시관 입장 화면에 표시됩니다</Text>
            <Pressable
              style={styles.posterPicker}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'], quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setPosterUri(result.assets[0].uri);
                }
              }}
            >
              {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.posterPreview} contentFit="cover" />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Text style={{ fontSize: 28, color: C.mutedLight }}>+</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>포스터 이미지 선택</Text>
                </View>
              )}
            </Pressable>
            {posterUri && (
              <Pressable onPress={() => setPosterUri(null)} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: C.muted }}>삭제</Text>
              </Pressable>
            )}

            <Text style={[styles.label, { marginTop: 20 }]}>배경음악 (선택)</Text>
            <Text style={styles.hint}>전시관 3D 뷰어에서 재생됩니다 (MP3)</Text>
            {bgmLocalUri ? (
              <View style={styles.bgmRow}>
                <View style={styles.bgmInfo}>
                  <Text style={styles.bgmIcon}>♪</Text>
                  <Text style={styles.bgmFileName} numberOfLines={1}>{bgmFileName}</Text>
                </View>
                <Pressable onPress={() => { setBgmLocalUri(null); setBgmFileName(null); }}>
                  <Text style={{ fontSize: 11, color: C.muted }}>삭제</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.bgmPicker}
                onPress={async () => {
                  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/mpeg' });
                  if (!result.canceled && result.assets[0]) {
                    setBgmLocalUri(result.assets[0].uri);
                    setBgmFileName(result.assets[0].name);
                  }
                }}
              >
                <Text style={{ fontSize: 22, color: C.mutedLight }}>♪</Text>
                <Text style={{ fontSize: 11, color: C.muted }}>MP3 파일 선택</Text>
              </Pressable>
            )}

            <Pressable style={styles.nextBtn} onPress={() => {
              if (!title.trim()) { Alert.alert('알림', '전시 이름을 입력해주세요.'); return; }
              setStep(2);
            }}>
              <Text style={styles.nextBtnText}>다음</Text><Text style={styles.nextBtnArrow}>→</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── STEP 2: 전시관 선택 ── */}
        {step === 2 && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>전시관 선택</Text>
            <Text style={styles.sub}>전시 규모에 맞는 공간을 선택하세요</Text>

            {(Object.keys(ROOM_TEMPLATES) as RoomType[]).map(type => {
              const t = ROOM_TEMPLATES[type];
              const isSelected = roomType === type;
              return (
                <Pressable key={type} style={[styles.roomCard, isSelected && styles.roomCardSel]}
                  onPress={() => setRoomType(type)}>
                  <View style={styles.roomCardHeader}>
                    <Text style={[styles.roomCardTitle, isSelected && { color: C.gold }]}>{t.label}</Text>
                    <View style={[styles.radio, isSelected && styles.radioSel]} />
                  </View>
                  <Text style={styles.roomCardDesc}>{t.desc}</Text>
                  <View style={styles.roomCardDims}>
                    <Text style={styles.dimTag}>가로 {(t.northSouth / 100)}m</Text>
                    <Text style={styles.dimTag}>세로 {(t.eastWest / 100)}m</Text>
                    <Text style={styles.dimTag}>높이 {(t.height / 100).toFixed(1)}m</Text>
                  </View>
                </Pressable>
              );
            })}

            <Pressable style={styles.nextBtn} onPress={() => setStep(3)}>
              <Text style={styles.nextBtnText}>다음</Text><Text style={styles.nextBtnArrow}>→</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── STEP 3: 공간 색상 ── */}
        {step === 3 && (() => {
          const isHexValid = /^#[0-9A-Fa-f]{6}$/.test(customHex);

          const activeColor = colorTarget === 'wall'
            ? (selectedWall ? wallColors[selectedWall] : null)
            : colorTarget === 'floor' ? floorColor : ceilingColor;

          const applyColor = (color: string) => {
            if (colorTarget === 'wall' && selectedWall) {
              setWallColors(prev => ({ ...prev, [selectedWall]: color }));
            } else if (colorTarget === 'floor') {
              setFloorColor(color);
            } else if (colorTarget === 'ceiling') {
              setCeilingColor(color);
            }
          };

          const applyAllWalls = (color: string) => {
            setWallColors({ north: color, south: color, east: color, west: color });
          };

          const applyAllSurfaces = (color: string) => {
            applyAllWalls(color);
            setFloorColor(color);
            setCeilingColor(color);
          };

          return (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>공간 색상</Text>
            <Text style={styles.sub}>벽면, 바닥, 천장의 색상을 설정하세요</Text>

            <Room3DView
              roomType={roomType} wallColors={wallColors} wallImages={wallImages} floorColor={floorColor} artworks={[]}
              selectedWall={colorTarget === 'wall' ? selectedWall : null}
              onWallSelect={(w) => { setColorTarget('wall'); setSelectedWall(w); }}
            />

            {/* 세그먼트 탭 */}
            <View style={styles.segmentRow}>
              {([
                { key: 'wall' as const, label: '벽면' },
                { key: 'floor' as const, label: '바닥' },
                { key: 'ceiling' as const, label: '천장' },
              ]).map(({ key, label }) => (
                <Pressable key={key}
                  style={[styles.segmentBtn, colorTarget === key && styles.segmentBtnActive]}
                  onPress={() => setColorTarget(key)}>
                  <Text style={[styles.segmentText, colorTarget === key && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 타겟별 라벨 */}
            {colorTarget === 'wall' && !selectedWall && (
              <Text style={[styles.hint, { marginTop: 8 }]}>벽면을 터치해서 선택하세요</Text>
            )}
            {colorTarget === 'wall' && selectedWall && (
              <>
                <View style={styles.colorLabelRow}>
                  <Text style={styles.label}>{WALL_LABELS[selectedWall]}</Text>
                  <Pressable style={styles.applyAllBtn}
                    onPress={() => {
                      applyAllWalls(wallColors[selectedWall]);
                      if (wallSurfaceMode === 'image' && wallImages[selectedWall]) {
                        const img = wallImages[selectedWall];
                        const localUri = wallImageLocalUris[selectedWall];
                        setWallImages({ north: img, south: img, east: img, west: img });
                        setWallImageLocalUris({ north: localUri, south: localUri, east: localUri, west: localUri });
                      }
                    }}>
                    <Text style={styles.applyAllText}>전체 벽면 적용</Text>
                  </Pressable>
                </View>

                {/* 색상/이미지 토글 */}
                <View style={styles.surfaceToggleRow}>
                  <Pressable
                    style={[styles.surfaceToggleBtn, wallSurfaceMode === 'color' && styles.surfaceToggleBtnActive]}
                    onPress={() => setWallSurfaceMode('color')}>
                    <Text style={[styles.surfaceToggleText, wallSurfaceMode === 'color' && styles.surfaceToggleTextActive]}>색상</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.surfaceToggleBtn, wallSurfaceMode === 'image' && styles.surfaceToggleBtnActive]}
                    onPress={() => setWallSurfaceMode('image')}>
                    <Text style={[styles.surfaceToggleText, wallSurfaceMode === 'image' && styles.surfaceToggleTextActive]}>이미지</Text>
                  </Pressable>
                </View>
              </>
            )}
            {colorTarget === 'floor' && (
              <Text style={[styles.label, { marginTop: 12 }]}>바닥 색상</Text>
            )}
            {colorTarget === 'ceiling' && (
              <Text style={[styles.label, { marginTop: 12 }]}>천장 색상</Text>
            )}

            {/* 프리셋 컬러칩 (벽 미선택 시 wall 타겟이면 숨김) */}
            {(colorTarget !== 'wall' || selectedWall) && (
              <Animated.View entering={FadeIn.duration(200)}>
                {/* 이미지 모드 — 벽면 타겟에서만 */}
                {colorTarget === 'wall' && selectedWall && wallSurfaceMode === 'image' && (
                  <View style={{ gap: 10, marginBottom: 12 }}>
                    {wallImages[selectedWall]?.url ? (
                      <>
                        <Image source={{ uri: wallImages[selectedWall]!.url }} style={styles.wallImgPreview} contentFit="cover" />
                        {/* 채우기/반복 토글 */}
                        <View style={styles.surfaceToggleRow}>
                          <Pressable
                            style={[styles.surfaceToggleBtn, wallImages[selectedWall]!.mode === 'stretch' && styles.surfaceToggleBtnActive]}
                            onPress={() => setWallImages(prev => ({ ...prev, [selectedWall]: { ...prev[selectedWall]!, mode: 'stretch' as WallImageMode } }))}>
                            <Text style={[styles.surfaceToggleText, wallImages[selectedWall]!.mode === 'stretch' && styles.surfaceToggleTextActive]}>채우기</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.surfaceToggleBtn, wallImages[selectedWall]!.mode === 'tile' && styles.surfaceToggleBtnActive]}
                            onPress={() => setWallImages(prev => ({ ...prev, [selectedWall]: { ...prev[selectedWall]!, mode: 'tile' as WallImageMode } }))}>
                            <Text style={[styles.surfaceToggleText, wallImages[selectedWall]!.mode === 'tile' && styles.surfaceToggleTextActive]}>반복 패턴</Text>
                          </Pressable>
                        </View>
                        <Pressable style={styles.wallImgDeleteBtn}
                          onPress={() => {
                            setWallImages(prev => ({ ...prev, [selectedWall]: null }));
                            setWallImageLocalUris(prev => ({ ...prev, [selectedWall]: null }));
                          }}>
                          <Text style={styles.wallImgDeleteText}>이미지 삭제</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        style={styles.wallImgPicker}
                        onPress={async () => {
                          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                          if (!result.canceled && result.assets[0]) {
                            const uri = result.assets[0].uri;
                            setWallImages(prev => ({ ...prev, [selectedWall]: { url: uri, mode: 'stretch' as WallImageMode } }));
                            setWallImageLocalUris(prev => ({ ...prev, [selectedWall]: uri }));
                          }
                        }}>
                        <Text style={{ fontSize: 28, color: C.mutedLight }}>+</Text>
                        <Text style={{ fontSize: 11, color: C.muted }}>벽면 이미지 선택</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* 색상 모드 (바닥/천장은 항상 표시, 벽면은 색상 모드일 때만) */}
                {(colorTarget !== 'wall' || wallSurfaceMode === 'color') && (
                  <>
                    <View style={styles.colorRow}>
                      {WALL_COLORS.map(color => (
                        <Pressable key={color}
                          style={[styles.colorChip, { backgroundColor: color },
                            activeColor === color && styles.colorChipSel]}
                          onPress={() => applyColor(color)}>
                          {activeColor === color && (
                            <Text style={[styles.colorCheck,
                              ['#333333','#1B2A4A','#4A1B2A','#1B3A2A'].includes(color) && { color: '#fff' }]}>✓</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>

                    {/* 커스텀 hex 입력 */}
                    <View style={styles.hexRow}>
                      <Text style={styles.hexHash}>#</Text>
                      <TextInput
                        style={styles.hexInput}
                        placeholder="FF5500"
                        placeholderTextColor={C.mutedLight}
                        value={customHex.replace('#', '')}
                        onChangeText={(t) => {
                          const clean = t.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                          setCustomHex(`#${clean}`);
                        }}
                        maxLength={6}
                        autoCapitalize="characters"
                      />
                      <View style={[styles.hexPreview, {
                        backgroundColor: isHexValid ? customHex : '#DDD',
                      }]} />
                      <Pressable
                        style={[styles.hexApplyBtn, !isHexValid && { opacity: 0.3 }]}
                        disabled={!isHexValid}
                        onPress={() => { if (isHexValid) applyColor(customHex); }}>
                        <Text style={styles.hexApplyText}>적용</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* 전체 공간 통일 */}
                {activeColor && (colorTarget !== 'wall' || wallSurfaceMode === 'color') && (
                  <Pressable style={styles.unifyBtn}
                    onPress={() => applyAllSurfaces(activeColor)}>
                    <Text style={styles.unifyBtnText}>전체 공간 통일</Text>
                    <Text style={styles.unifyBtnSub}>벽 4면 + 바닥 + 천장</Text>
                  </Pressable>
                )}
              </Animated.View>
            )}

            <Pressable style={styles.nextBtn} onPress={() => setStep(4)}>
              <Text style={styles.nextBtnText}>다음: 작품 배치</Text><Text style={styles.nextBtnArrow}>→</Text>
            </Pressable>
          </Animated.View>
          );
        })()}

        {/* ── STEP 4: 작품 배치 ── */}
        {step === 4 && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>작품 배치</Text>
            <Text style={styles.sub}>
              {wallEditorOpen
                ? `${WALL_LABELS[wallEditorOpen]}에 작품을 배치하세요`
                : '벽면을 선택해서 작품을 배치하세요'}
            </Text>

            {wallEditorOpen === null ? (
              <>
                {/* 3D 룸 뷰 */}
                <Room3DView
                  roomType={roomType} wallColors={wallColors} wallImages={wallImages} floorColor={floorColor} artworks={artworks}
                  selectedWall={selectedWall}
                  onWallSelect={(w) => { setSelectedWall(w); setWallEditorOpen(w); }}
                />

                {/* 전체 작품 목록 (동서남북별) */}
                {artworks.length > 0 && (
                  <View style={{ marginTop: 24 }}>
                    <Text style={styles.label}>배치된 작품 ({artworks.length})</Text>
                    {(['north', 'south', 'east', 'west'] as Wall[]).map(w => {
                      const wallArts = artworks.filter(a => a.wall === w);
                      if (wallArts.length === 0) return null;
                      return (
                        <View key={w} style={{ marginBottom: 16 }}>
                          <Pressable style={styles.wallSectionHeader}
                            onPress={() => { setSelectedWall(w); setWallEditorOpen(w); }}>
                            <Text style={styles.wallSectionTitle}>{WALL_LABELS[w]}</Text>
                            <Text style={styles.wallSectionCount}>{wallArts.length}점</Text>
                            <Text style={styles.wallSectionArrow}>→</Text>
                          </Pressable>
                          {wallArts.map(art => (
                            <View key={art.localId} style={styles.artItemCompact}>
                              <Image source={{ uri: art.uri }} style={styles.artThumbSmall} contentFit="cover" />
                              <View style={{ flex: 1 }}>
                                <View style={styles.inlineEditRow}>
                                  <TextInput
                                    style={styles.inlineEditInput}
                                    value={art.title}
                                    onChangeText={(t) => setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, title: t } : a))}
                                    placeholder="작품 제목"
                                    placeholderTextColor={C.mutedLight}
                                  />
                                  <Text style={styles.inlineEditHint}>✎</Text>
                                </View>
                                <Text style={styles.artMeta}>{art.widthCm}×{art.heightCm}cm</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 공개 버튼 */}
                <Pressable onPress={handleSave} disabled={loading} style={{ marginTop: 28 }}>
                  <View style={[styles.createBtn, loading && { opacity: 0.5 }]}>
                    {loading && <ActivityIndicator color={C.white} size="small" />}
                    <Text style={styles.createBtnText}>
                      {loading
                        ? (isEditMode ? '수정 중...' : '생성 중...')
                        : (isEditMode ? '수정 완료' : '전시관 공개하기')}
                    </Text>
                    {!loading && <Text style={styles.createBtnArrow}>→</Text>}
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                {/* 벽면 정면 에디터 */}
                <WallFaceEditor
                  wall={wallEditorOpen}
                  roomType={roomType}
                  wallColor={wallColors[wallEditorOpen]}
                  wallImage={wallImages[wallEditorOpen]}
                  artworks={artworks.filter(a => a.wall === wallEditorOpen)}
                  selectedArtworkId={selectedArtworkId}
                  onPlaceArtwork={handlePlaceArtwork}
                  onSelectArtwork={setSelectedArtworkId}
                  onMoveArtwork={moveArtwork}
                  onResizeArtwork={resizeArtwork}
                  onClose={() => setWallEditorOpen(null)}
                  containerWidth={editorWidth}
                />

                {/* 이 벽에 걸린 작품만 표시 */}
                {(() => {
                  const wallArts = artworks.filter(a => a.wall === wallEditorOpen);
                  return wallArts.length > 0 && (
                    <Text style={[styles.label, { marginTop: 24 }]}>
                      {WALL_LABELS[wallEditorOpen]} 작품 ({wallArts.length})
                    </Text>
                  );
                })()}

                {artworks.filter(a => a.wall === wallEditorOpen).map(art => {
                  const isSelected = art.localId === selectedArtworkId;
                  return (
                    <Pressable key={art.localId}
                      style={[styles.artItem, isSelected && styles.artItemSel]}
                      onPress={() => setSelectedArtworkId(art.localId)}>
                      <Image source={{ uri: art.uri }} style={styles.artThumb} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <TextInput style={styles.artTitleInput} value={art.title}
                          onChangeText={(t) => setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, title: t } : a))}
                          placeholder="작품 제목" placeholderTextColor={C.mutedLight} />
                        <Text style={styles.artMeta}>
                          왼쪽 {(art.positionX / 100).toFixed(1)}m · 높이 {(art.positionY / 100).toFixed(1)}m · {art.widthCm}×{art.heightCm}cm
                        </Text>

                        {isSelected && (
                          <View style={styles.sizeSection}>
                            {/* ── 작품 정보 ── */}
                            <Text style={[styles.label, { marginTop: 4, marginBottom: 2 }]}>작품 정보</Text>

                            <View style={styles.fieldRow}>
                              <Text style={styles.fieldLabel}>제작 연도</Text>
                              <TextInput style={styles.fieldInput}
                                placeholder="예: 2024" placeholderTextColor={C.mutedLight}
                                keyboardType="number-pad" maxLength={4}
                                value={art.year ? String(art.year) : ''}
                                onChangeText={(t) => setArtworks(prev => prev.map(a =>
                                  a.localId === art.localId ? { ...a, year: t ? parseInt(t) || undefined : undefined } : a))}
                              />
                            </View>

                            <View style={styles.fieldRow}>
                              <Text style={styles.fieldLabel}>재료/기법</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  {MEDIUM_OPTIONS.map(m => (
                                    <Pressable key={m}
                                      style={[styles.mediumChip, art.medium === m && styles.mediumChipSel]}
                                      onPress={() => setArtworks(prev => prev.map(a =>
                                        a.localId === art.localId ? { ...a, medium: art.medium === m ? undefined : m } : a))}>
                                      <Text style={[styles.mediumChipText, art.medium === m && styles.mediumChipTextSel]}>{m}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              </ScrollView>
                            </View>

                            <View style={styles.fieldRow}>
                              <Text style={styles.fieldLabel}>에디션 (판화 등)</Text>
                              <TextInput style={styles.fieldInput}
                                placeholder="예: 1/10, AP" placeholderTextColor={C.mutedLight}
                                value={art.edition || ''}
                                onChangeText={(t) => setArtworks(prev => prev.map(a =>
                                  a.localId === art.localId ? { ...a, edition: t || undefined } : a))}
                              />
                            </View>

                            <View style={styles.fieldRow}>
                              <Text style={styles.fieldLabel}>작품 설명</Text>
                              <TextInput style={[styles.fieldInput, { minHeight: 50, textAlignVertical: 'top' }]}
                                placeholder="작품에 대한 설명" placeholderTextColor={C.mutedLight}
                                multiline value={art.description || ''}
                                onChangeText={(t) => setArtworks(prev => prev.map(a =>
                                  a.localId === art.localId ? { ...a, description: t || undefined } : a))}
                              />
                            </View>

                            {/* ── 전시 크기 (벽면 배치) ── */}
                            <Text style={[styles.label, { marginTop: 14, marginBottom: 2 }]}>전시 크기 · 위치</Text>

                            {[
                              { label: '가로', key: 'widthCm' as const, min: 10, max: 300 },
                              { label: '세로', key: 'heightCm' as const, min: 10, max: 300 },
                            ].map(({ label, key, min, max }) => (
                              <View key={key} style={styles.sizeRow}>
                                <Text style={styles.sizeLabel}>{label}</Text>
                                <Pressable style={styles.sizeBtn} onPress={() =>
                                  setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, [key]: Math.max(min, a[key] - 10) } : a))}>
                                  <Text style={styles.sizeBtnText}>−</Text>
                                </Pressable>
                                <Text style={styles.sizeValue}>{art[key]}cm</Text>
                                <Pressable style={styles.sizeBtn} onPress={() =>
                                  setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, [key]: Math.min(max, a[key] + 10) } : a))}>
                                  <Text style={styles.sizeBtnText}>+</Text>
                                </Pressable>
                              </View>
                            ))}
                            <View style={styles.sizeRow}>
                              <Text style={styles.sizeLabel}>높이</Text>
                              <Pressable style={styles.sizeBtn} onPress={() =>
                                setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, positionY: Math.max(30, a.positionY - 10) } : a))}>
                                <Text style={styles.sizeBtnText}>−</Text>
                              </Pressable>
                              <Text style={styles.sizeValue}>바닥 {art.positionY}cm</Text>
                              <Pressable style={styles.sizeBtn} onPress={() =>
                                setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, positionY: Math.min(280, a.positionY + 10) } : a))}>
                                <Text style={styles.sizeBtnText}>+</Text>
                              </Pressable>
                            </View>

                            {/* ── 다중 각도 ── */}
                            <Text style={[styles.label, { marginTop: 14, marginBottom: 6 }]}>다른 각도 사진 (선택)</Text>
                            <View style={styles.angleRow}>
                              {(['top', 'bottom', 'left', 'right'] as const).map(angle => {
                                const key = `${angle}Uri` as keyof PlacedArtwork;
                                const has = !!art[key];
                                const labels = { top: '위', bottom: '아래', left: '좌', right: '우' };
                                return (
                                  <Pressable key={angle} style={[styles.angleBox, has && styles.angleBoxFilled]}
                                    onPress={() => pickAngleImage(angle)}>
                                    {has ? <Image source={{ uri: art[key] as string }} style={styles.angleImg} contentFit="cover" />
                                      : <Text style={styles.anglePlus}>+</Text>}
                                    <Text style={styles.angleLabel}>{labels[angle]}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                      <Pressable onPress={() => removeArtwork(art.localId)} hitSlop={8}>
                        <Text style={styles.removeText}>✕</Text>
                      </Pressable>
                    </Pressable>
                  );
                })}

                {/* 다른 벽 꾸미기 버튼 */}
                <View style={styles.wallNavRow}>
                  {(['north', 'south', 'east', 'west'] as Wall[]).map(w => {
                    const count = artworks.filter(a => a.wall === w).length;
                    const isActive = w === wallEditorOpen;
                    return (
                      <Pressable key={w}
                        style={[styles.wallNavBtn, isActive && styles.wallNavBtnActive]}
                        onPress={() => { setWallEditorOpen(w); setSelectedArtworkId(null); }}>
                        <Text style={[styles.wallNavLabel, isActive && styles.wallNavLabelActive]}>
                          {WALL_LABELS[w]}
                        </Text>
                        {count > 0 && (
                          <Text style={[styles.wallNavCount, isActive && styles.wallNavCountActive]}>
                            {count}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={styles.overviewBtn}
                  onPress={() => { setWallEditorOpen(null); setSelectedArtworkId(null); }}>
                  <Text style={styles.overviewBtnText}>전체 보기</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      )}
      {/* 포트폴리오 피커 모달 */}
      <Modal
        visible={portfolioPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setPortfolioPickerVisible(false); setPendingPlacement(null); }}
      >
        <View style={pickerStyles.overlay}>
          <View style={[pickerStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.headerTitle}>작품 선택</Text>
              <Pressable onPress={() => { setPortfolioPickerVisible(false); setPendingPlacement(null); }}>
                <Text style={pickerStyles.headerClose}>✕</Text>
              </Pressable>
            </View>

            {portfolioArtworks.length > 0 ? (
              <FlatList
                data={portfolioArtworks}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={pickerStyles.grid}
                columnWrapperStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [pickerStyles.artItem, pressed && { opacity: 0.7 }]}
                    onPress={() => handleSelectPortfolioArtwork(item)}
                  >
                    <Image source={{ uri: item.image_url }} style={pickerStyles.artImage} contentFit="cover" />
                    <Text style={pickerStyles.artTitle} numberOfLines={1}>{item.title}</Text>
                  </Pressable>
                )}
              />
            ) : (
              <View style={pickerStyles.empty}>
                <Text style={pickerStyles.emptyText}>포트폴리오에 등록된 작품이 없습니다</Text>
                <Pressable
                  style={pickerStyles.emptyBtn}
                  onPress={() => { setPortfolioPickerVisible(false); setPendingPlacement(null); router.push('/artwork/create'); }}
                >
                  <Text style={pickerStyles.emptyBtnText}>작품 업로드하기</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [pickerStyles.deviceBtn, pressed && { opacity: 0.7 }]}
              onPress={handlePickFromDevice}
            >
              <Text style={pickerStyles.deviceBtnText}>기기에서 직접 선택</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f5f5f5',
  },
  headerClose: {
    fontSize: 18,
    color: '#a8a8a8',
    padding: 4,
  },
  grid: {
    paddingHorizontal: 16,
    gap: 8,
  },
  artItem: {
    flex: 1,
    maxWidth: '33%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  artImage: {
    width: '100%',
    aspectRatio: 1,
  },
  artTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f5f5f5',
    padding: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#a8a8a8',
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8A96E',
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C8A96E',
  },
  deviceBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  deviceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a8a8a8',
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 18, color: C.fg },
  enLogo: { fontSize: 11, fontWeight: '800', letterSpacing: 5, color: C.fg },
  stepNum: { fontSize: 12, color: C.muted, fontWeight: '600' },

  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.border },
  stepDotDone: { borderColor: C.gold, backgroundColor: C.gold },
  stepLabel: { fontSize: 10, color: C.mutedLight, fontWeight: '600', letterSpacing: 1 },

  title: { fontSize: 22, fontWeight: '900', color: C.fg, letterSpacing: 1, marginBottom: 4 },
  sub: { fontSize: 13, color: C.muted, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  hint: { fontSize: 11, color: C.mutedLight, marginBottom: 8, fontStyle: 'italic' },

  posterPicker: {
    width: '100%', aspectRatio: 0.7, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    overflow: 'hidden',
  },
  posterPreview: { width: '100%', height: '100%' },
  posterPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: C.inputBg,
  },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, backgroundColor: C.inputBg, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.fg },

  nextBtn: { backgroundColor: C.gold, paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  nextBtnText: { color: '#000000', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  nextBtnArrow: { color: '#000000', fontSize: 16 },

  roomCard: { borderWidth: 1.5, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 12 },
  roomCardSel: { borderColor: C.gold, backgroundColor: '#121212' },
  roomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomCardTitle: { fontSize: 16, fontWeight: '800', color: C.fg },
  roomCardDesc: { fontSize: 12, color: C.muted, marginTop: 4 },
  roomCardDims: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dimTag: { fontSize: 10, color: C.gold, fontWeight: '600', backgroundColor: 'rgba(200,169,110,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border },
  radioSel: { borderColor: C.gold, backgroundColor: C.gold },

  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  colorChipSel: { borderColor: C.gold, borderWidth: 3 },
  colorCheck: { fontSize: 14, fontWeight: '800', color: C.fg },

  segmentRow: { flexDirection: 'row', gap: 0, marginTop: 16, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: C.inputBg },
  segmentBtnActive: { backgroundColor: '#262626' },
  segmentText: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  segmentTextActive: { color: C.white },

  colorLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 0 },
  applyAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.08)' },
  applyAllText: { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1 },

  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  hexHash: { fontSize: 16, fontWeight: '700', color: C.muted },
  hexInput: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, backgroundColor: C.inputBg, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.fg, fontWeight: '600', letterSpacing: 2 },
  hexPreview: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.border },
  hexApplyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.gold },
  hexApplyText: { fontSize: 12, fontWeight: '700', color: '#000000' },

  unifyBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', backgroundColor: 'rgba(200,169,110,0.06)' },
  unifyBtnText: { fontSize: 13, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  unifyBtnSub: { fontSize: 9, color: C.muted, marginTop: 2 },

  artItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: C.inputBg },
  artItemSel: { borderColor: C.gold },
  artThumb: { width: 52, height: 52, borderRadius: 8 },
  artTitleInput: { fontSize: 14, color: C.fg, fontWeight: '600', paddingVertical: 0 },
  artMeta: { fontSize: 10, color: C.muted, marginTop: 3 },
  removeText: { fontSize: 16, color: C.muted, fontWeight: '600', paddingTop: 4 },

  fieldRow: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.inputBg, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.fg },
  mediumChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.inputBg },
  mediumChipSel: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.1)' },
  mediumChipText: { fontSize: 11, color: C.muted },
  mediumChipTextSel: { color: C.gold, fontWeight: '600' },

  sizeSection: { marginTop: 10, gap: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeLabel: { fontSize: 11, color: C.muted, width: 32, fontWeight: '600' },
  sizeBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  sizeBtnText: { fontSize: 16, color: C.fg, fontWeight: '600' },
  sizeValue: { fontSize: 12, color: C.fg, fontWeight: '600', minWidth: 80 },

  angleRow: { flexDirection: 'row', gap: 8 },
  angleBox: { width: 50, height: 50, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  angleBoxFilled: { borderStyle: 'solid', borderColor: C.gold, overflow: 'hidden' },
  angleImg: { width: '100%', height: '100%', borderRadius: 8 },
  anglePlus: { fontSize: 18, color: C.mutedLight },
  angleLabel: { position: 'absolute', bottom: -14, fontSize: 8, color: C.muted },

  createBtn: { backgroundColor: C.gold, paddingVertical: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  createBtnText: { color: '#000000', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  createBtnArrow: { color: '#000000', fontSize: 18 },

  wallSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  wallSectionTitle: { fontSize: 13, fontWeight: '700', color: C.fg, letterSpacing: 1 },
  wallSectionCount: { fontSize: 11, color: C.gold, fontWeight: '600' },
  wallSectionArrow: { fontSize: 12, color: C.mutedLight, marginLeft: 'auto' },

  artItemCompact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
  artThumbSmall: { width: 36, height: 36, borderRadius: 6 },
  artTitleCompact: { fontSize: 13, color: C.fg, fontWeight: '600' },

  wallNavRow: { flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap' },
  wallNavBtn: { flex: 1, minWidth: 70, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 2 },
  wallNavBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.08)' },
  wallNavLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  wallNavLabelActive: { color: C.gold },
  wallNavCount: { fontSize: 10, color: C.mutedLight, fontWeight: '600' },
  wallNavCountActive: { color: C.gold },

  overviewBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  overviewBtnText: { fontSize: 13, color: C.muted, fontWeight: '600', letterSpacing: 1 },

  // Wall surface mode toggle (color/image)
  surfaceToggleRow: { flexDirection: 'row', gap: 0, marginTop: 8, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  surfaceToggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: C.inputBg },
  surfaceToggleBtnActive: { backgroundColor: '#262626' },
  surfaceToggleText: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  surfaceToggleTextActive: { color: C.white },

  // Wall image picker/preview
  wallImgPicker: {
    width: '100%', height: 100, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: C.inputBg,
  },
  wallImgPreview: { width: '100%', height: 120, borderRadius: 10 },
  wallImgDeleteBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4 },
  wallImgDeleteText: { fontSize: 11, color: C.muted },

  // Inline edit in overview list
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineEditInput: { fontSize: 13, color: C.fg, fontWeight: '600', flex: 1, paddingVertical: 0 },
  inlineEditHint: { fontSize: 10, color: C.mutedLight },

  // BGM picker
  bgmPicker: {
    width: '100%', height: 70, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: C.inputBg,
  },
  bgmRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: C.gold, borderRadius: 10,
    backgroundColor: 'rgba(200,169,110,0.06)',
  },
  bgmInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bgmIcon: { fontSize: 18, color: C.gold },
  bgmFileName: { fontSize: 13, color: C.fg, fontWeight: '600', flex: 1 },
});
