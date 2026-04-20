import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  type Wall, type RoomType, type PlacedArtwork,
  ROOM_TEMPLATES, WALL_LABELS, MEDIUM_OPTIONS,
} from '@/components/exhibition/room-geometry';
import Room3DView from '@/components/exhibition/Room3DView';
import WallFaceEditor from '@/components/exhibition/WallFaceEditor';

const C = {
  bg: '#FFFFFF', fg: '#0A0A0A', gold: '#C8A96E', goldLight: '#E0C992',
  muted: '#999', mutedLight: '#CCC', border: '#E8E5DF', white: '#FFF', inputBg: '#F8F7F4',
};

const WALL_COLORS = [
  '#F5F5F0', '#FFF8E7', '#E8E8E8', '#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A', '#D4C5A9',
];

export default function CreateExhibitionScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [foreword, setForeword] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('medium');
  const [wallColors, setWallColors] = useState<Record<Wall, string>>({
    north: '#F5F5F0', south: '#F5F5F0', east: '#F5F5F0', west: '#F5F5F0',
  });
  const [selectedWall, setSelectedWall] = useState<Wall | null>(null);
  const [artworks, setArtworks] = useState<PlacedArtwork[]>([]);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [wallEditorOpen, setWallEditorOpen] = useState<Wall | null>(null);
  const [loading, setLoading] = useState(false);

  const mapWidth = Math.min(screenWidth - 48, 360);
  const room = ROOM_TEMPLATES[roomType];

  // 벽면 에디터에서 터치 → 이미지 피커 → 배치
  const handlePlaceArtwork = async (wall: Wall, posXcm: number, posYcm: number) => {
    // NaN 방어
    const safeX = isNaN(posXcm) ? 300 : posXcm;
    const safeY = isNaN(posYcm) ? 150 : posYcm;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const newArt: PlacedArtwork = {
        localId: Date.now().toString(),
        uri: result.assets[0].uri,
        title: `작품 ${artworks.length + 1}`,
        wall,
        positionX: safeX,
        positionY: safeY,
        widthCm: 60,
        heightCm: 40,
      };
      setArtworks(prev => [...prev, newArt]);
      setSelectedArtworkId(newArt.localId);
    }
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

  const removeArtwork = (id: string) => {
    setArtworks(prev => prev.filter(a => a.localId !== id));
    if (selectedArtworkId === id) setSelectedArtworkId(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('알림', '전시관 이름을 입력해주세요.'); return; }
    if (artworks.length === 0) { Alert.alert('알림', '작품을 배치해주세요.'); return; }
    if (!user) return;

    setLoading(true);

    const uploadImage = async (uri: string): Promise<string | null> => {
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('artworks').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (error) return null;
      return supabase.storage.from('artworks').getPublicUrl(fileName).data.publicUrl;
    };

    const { data: exhibition, error: exErr } = await supabase.from('exhibitions')
      .insert({
        user_id: user.id, title: title.trim(),
        description: description.trim() || null,
        foreword: foreword.trim() || null,
        room_type: roomType,
        wall_color_north: wallColors.north, wall_color_south: wallColors.south,
        wall_color_east: wallColors.east, wall_color_west: wallColors.west,
        is_published: true,
      })
      .select('id').single();

    if (exErr || !exhibition) { Alert.alert('오류', '전시관 생성 실패'); setLoading(false); return; }

    for (const art of artworks) {
      const imageUrl = await uploadImage(art.uri);
      if (!imageUrl) continue;
      const topUrl = art.topUri ? await uploadImage(art.topUri) : null;
      const bottomUrl = art.bottomUri ? await uploadImage(art.bottomUri) : null;
      const leftUrl = art.leftUri ? await uploadImage(art.leftUri) : null;
      const rightUrl = art.rightUri ? await uploadImage(art.rightUri) : null;

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
      if (!artData) continue;

      await supabase.from('exhibition_artworks').insert({
        exhibition_id: exhibition.id, artwork_id: artData.id,
        wall: art.wall, position_x: art.positionX, position_y: art.positionY,
        width_cm: art.widthCm, height_cm: art.heightCm,
      });
    }

    setLoading(false);
    router.replace(`/exhibition/${exhibition.id}`);
  };

  const stepLabels = ['정보', '전시관', '벽면', '작품'];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
            <Text style={styles.title}>전시 정보</Text>

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

        {/* ── STEP 3: 벽면 색상 ── */}
        {step === 3 && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>벽면 설정</Text>
            <Text style={styles.sub}>3D 전시관을 돌려보고 벽을 선택해 색상을 변경하세요</Text>

            <Room3DView
              roomType={roomType} wallColors={wallColors} artworks={[]}
              selectedWall={selectedWall}
              onWallSelect={(w) => setSelectedWall(w)}
            />

            {selectedWall && (
              <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
                <Text style={styles.label}>{WALL_LABELS[selectedWall]} 색상</Text>
                <View style={styles.colorRow}>
                  {WALL_COLORS.map(color => (
                    <Pressable key={color}
                      style={[styles.colorChip, { backgroundColor: color },
                        wallColors[selectedWall] === color && styles.colorChipSel]}
                      onPress={() => setWallColors(prev => ({ ...prev, [selectedWall]: color }))}>
                      {wallColors[selectedWall] === color && (
                        <Text style={[styles.colorCheck,
                          ['#333333','#1B2A4A','#4A1B2A','#1B3A2A'].includes(color) && { color: '#fff' }]}>✓</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            <Pressable style={styles.nextBtn} onPress={() => setStep(4)}>
              <Text style={styles.nextBtnText}>다음: 작품 배치</Text><Text style={styles.nextBtnArrow}>→</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── STEP 4: 작품 배치 ── */}
        {step === 4 && (
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>작품 배치</Text>
            <Text style={styles.sub}>
              {wallEditorOpen
                ? `${WALL_LABELS[wallEditorOpen]}에 작품을 배치하세요`
                : '3D 전시관을 돌려보고 벽면을 선택하세요'}
            </Text>

            {wallEditorOpen === null ? (
              <>
                {/* 3D 룸 뷰 */}
                <Room3DView
                  roomType={roomType} wallColors={wallColors} artworks={artworks}
                  selectedWall={selectedWall}
                  onWallSelect={(w) => { setSelectedWall(w); setWallEditorOpen(w); }}
                />
              </>
            ) : (
              <>
                {/* 벽면 정면 에디터 */}
                <WallFaceEditor
                  wall={wallEditorOpen}
                  roomType={roomType}
                  wallColor={wallColors[wallEditorOpen]}
                  artworks={artworks.filter(a => a.wall === wallEditorOpen)}
                  selectedArtworkId={selectedArtworkId}
                  onPlaceArtwork={handlePlaceArtwork}
                  onSelectArtwork={setSelectedArtworkId}
                  onClose={() => setWallEditorOpen(null)}
                  containerWidth={mapWidth}
                />
              </>
            )}

            {/* 배치된 작품 목록 */}
            {artworks.length > 0 && (
              <Text style={[styles.label, { marginTop: 24 }]}>배치된 작품 ({artworks.length})</Text>
            )}

            {artworks.map(art => {
              const isSelected = art.localId === selectedArtworkId;
              return (
                <Pressable key={art.localId}
                  style={[styles.artItem, isSelected && styles.artItemSel]}
                  onPress={() => setSelectedArtworkId(art.localId)}>
                  <Animated.Image source={{ uri: art.uri }} style={styles.artThumb} />
                  <View style={{ flex: 1 }}>
                    <TextInput style={styles.artTitleInput} value={art.title}
                      onChangeText={(t) => setArtworks(prev => prev.map(a => a.localId === art.localId ? { ...a, title: t } : a))}
                      placeholder="작품 제목" placeholderTextColor={C.mutedLight} />
                    <Text style={styles.artMeta}>
                      {WALL_LABELS[art.wall]} · 왼쪽 {(art.positionX / 100).toFixed(1)}m · 높이 {(art.positionY / 100).toFixed(1)}m · {art.widthCm}×{art.heightCm}cm
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
                                {has ? <Animated.Image source={{ uri: art[key] as string }} style={styles.angleImg} />
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

            {/* 공개 버튼 */}
            <Pressable onPress={handleCreate} disabled={loading} style={{ marginTop: 28 }}>
              <View style={[styles.createBtn, loading && { opacity: 0.5 }]}>
                {loading && <ActivityIndicator color={C.white} size="small" />}
                <Text style={styles.createBtnText}>{loading ? '생성 중...' : '전시관 공개하기'}</Text>
                {!loading && <Text style={styles.createBtnArrow}>→</Text>}
              </View>
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

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
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, backgroundColor: C.inputBg, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.fg },

  nextBtn: { backgroundColor: C.fg, paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  nextBtnText: { color: C.white, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  nextBtnArrow: { color: C.gold, fontSize: 16 },

  roomCard: { borderWidth: 1.5, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 12 },
  roomCardSel: { borderColor: C.gold, backgroundColor: '#FDFBF7' },
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

  artItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: C.inputBg },
  artItemSel: { borderColor: C.gold },
  artThumb: { width: 52, height: 52, borderRadius: 8 },
  artTitleInput: { fontSize: 14, color: C.fg, fontWeight: '600', paddingVertical: 0 },
  artMeta: { fontSize: 10, color: C.muted, marginTop: 3 },
  removeText: { fontSize: 16, color: C.muted, fontWeight: '600', paddingTop: 4 },

  fieldRow: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.fg },
  mediumChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
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

  createBtn: { backgroundColor: C.fg, paddingVertical: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  createBtnText: { color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  createBtnArrow: { color: C.gold, fontSize: 18 },
});
