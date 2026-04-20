import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import Room3DView from '@/components/exhibition/Room3DView';
import FirstPersonViewer from '@/components/exhibition/FirstPersonViewer';
import { ROOM_TEMPLATES, WALL_LABELS as WALL_LABELS_SHARED } from '@/components/exhibition/room-geometry';

const C = {
  bg: '#0A0A0A', fg: '#FFFFFF', gold: '#C8A96E', goldLight: '#E0C992',
  muted: '#888', mutedDark: '#555', border: '#333',
};

type Wall = 'north' | 'south' | 'east' | 'west';
type ViewAngle = 'front' | 'top' | 'bottom' | 'left' | 'right';
type RoomType = 'small' | 'medium' | 'large' | 'wide';

const WALL_LABELS: Record<Wall, string> = { north: '북쪽 벽', south: '남쪽 벽', east: '동쪽 벽', west: '서쪽 벽' };
const ROOM_SIZES = {
  small: { ns: 600, ew: 400, h: 300 }, medium: { ns: 1000, ew: 700, h: 350 },
  large: { ns: 1500, ew: 1000, h: 400 }, wide: { ns: 2000, ew: 800, h: 350 },
} as const;

type Placement = {
  id: string; wall: Wall; position_x: number; position_y: number;
  width_cm: number; height_cm: number;
  artwork: {
    id: string; title: string; description: string | null; image_url: string;
    image_top_url: string | null; image_bottom_url: string | null;
    image_left_url: string | null; image_right_url: string | null;
  };
};

type Exhibition = {
  id: string; title: string; description: string | null; foreword: string | null;
  room_type: RoomType;
  wall_color_north: string; wall_color_south: string;
  wall_color_east: string; wall_color_west: string;
  floor_color: string; user_id: string;
  profiles: { name: string | null; username: string } | null;
};

/* ── 1. 입구 화면 (서문) ── */
function EntranceView({ exhibition, onEnter }: { exhibition: Exhibition; onEnter: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.entranceScroll}>
      <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.entranceContent}>
        {/* 전시 제목 */}
        <View style={styles.entranceDiamond} />
        <Text style={styles.entranceTitle}>{exhibition.title}</Text>
        <View style={styles.entranceLine} />
        <Text style={styles.entranceAuthor}>
          {exhibition.profiles?.name || exhibition.profiles?.username || '작가'}
        </Text>

        {exhibition.description && (
          <Text style={styles.entranceDesc}>{exhibition.description}</Text>
        )}

        {/* 서문 */}
        {exhibition.foreword && (
          <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.forewordBox}>
            <Text style={styles.forewordLabel}>전시 서문</Text>
            <View style={styles.forewordDivider} />
            <Text style={styles.forewordText}>{exhibition.foreword}</Text>
          </Animated.View>
        )}

        {/* 전시 정보 */}
        <View style={styles.entranceInfo}>
          <Text style={styles.entranceInfoText}>
            {ROOM_SIZES[exhibition.room_type].ns / 100}m × {ROOM_SIZES[exhibition.room_type].ew / 100}m 전시 공간
          </Text>
        </View>

        {/* 입장 버튼 */}
        <Animated.View entering={FadeInUp.delay(800).duration(400)}>
          <Pressable style={styles.enterBtn} onPress={onEnter}>
            <Text style={styles.enterBtnText}>전시관 입장</Text>
            <Text style={styles.enterBtnArrow}>→</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </ScrollView>
  );
}

/* ── 2. 맵 뷰 ── */
function MapView({
  exhibition, placements, onSelect, mapWidth,
}: {
  exhibition: Exhibition; placements: Placement[];
  onSelect: (p: Placement) => void; mapWidth: number;
}) {
  const room = ROOM_SIZES[exhibition.room_type];
  const aspect = room.ew / room.ns;
  const mapHeight = mapWidth * aspect;
  const wallThick = 20;

  const cmToPxH = (cm: number) => (cm / room.ns) * (mapWidth - wallThick * 2);
  const cmToPxV = (cm: number) => (cm / room.ew) * (mapHeight - wallThick * 2);

  const wallColors: Record<Wall, string> = {
    north: exhibition.wall_color_north, south: exhibition.wall_color_south,
    east: exhibition.wall_color_east, west: exhibition.wall_color_west,
  };

  const renderH = (wall: Wall) => placements.filter(p => p.wall === wall).map(p => {
    const px = cmToPxH(p.position_x) + wallThick;
    const w = Math.max(cmToPxH(p.width_cm), 14);
    return (
      <Pressable key={p.id} onPress={() => onSelect(p)}
        style={[styles.mapThumb, {
          left: px - w / 2, width: w,
          top: wall === 'north' ? -10 : undefined,
          bottom: wall === 'south' ? -10 : undefined, height: 18,
        }]}>
        <Animated.Image source={{ uri: p.artwork.image_url }} style={styles.mapThumbImg} />
      </Pressable>
    );
  });

  const renderV = (wall: Wall) => placements.filter(p => p.wall === wall).map(p => {
    const px = cmToPxV(p.position_x) + wallThick;
    const w = Math.max(cmToPxV(p.width_cm), 14);
    return (
      <Pressable key={p.id} onPress={() => onSelect(p)}
        style={[styles.mapThumb, {
          top: px - w / 2, height: w,
          left: wall === 'west' ? -10 : undefined,
          right: wall === 'east' ? -10 : undefined, width: 18,
        }]}>
        <Animated.Image source={{ uri: p.artwork.image_url }} style={styles.mapThumbImg} />
      </Pressable>
    );
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.mapDim}>{room.ns / 100}m</Text>
      <View style={[styles.map, { width: mapWidth, height: mapHeight }]}>
        <View style={[styles.mapFloor, { top: wallThick, left: wallThick,
          width: mapWidth - wallThick * 2, height: mapHeight - wallThick * 2,
          backgroundColor: exhibition.floor_color, opacity: 0.3 }]} />

        <View style={[styles.mapWallH, { top: 0, width: mapWidth, height: wallThick, backgroundColor: wallColors.north }]}>{renderH('north')}</View>
        <View style={[styles.mapWallH, { bottom: 0, width: mapWidth, height: wallThick, backgroundColor: wallColors.south }]}>{renderH('south')}</View>
        <View style={[styles.mapWallV, { left: 0, height: mapHeight, width: wallThick, backgroundColor: wallColors.west }]}>{renderV('west')}</View>
        <View style={[styles.mapWallV, { right: 0, height: mapHeight, width: wallThick, backgroundColor: wallColors.east }]}>{renderV('east')}</View>

        <View style={[styles.mapEntrance, { bottom: -10, left: mapWidth / 2 - 14 }]}>
          <Text style={styles.mapEntranceText}>▽ 입구</Text>
        </View>
      </View>
      <Text style={[styles.mapDim, { alignSelf: 'flex-end' }]}>{room.ew / 100}m</Text>
    </View>
  );
}

/* ── 3. 작품 감상 뷰 ── */
function ArtworkView({ placement, wallColor, onClose }: {
  placement: Placement; wallColor: string; onClose: () => void;
}) {
  const [angle, setAngle] = useState<ViewAngle>('front');
  const { width: sw } = useWindowDimensions();
  const art = placement.artwork;

  const angles: Record<ViewAngle, string | null> = {
    front: art.image_url, top: art.image_top_url, bottom: art.image_bottom_url,
    left: art.image_left_url, right: art.image_right_url,
  };
  const currentImg = angles[angle] || art.image_url;
  const isDark = ['#333333','#1B2A4A','#4A1B2A','#1B3A2A'].includes(wallColor);
  const frameColor = isDark ? '#D4C5A9' : '#5C4A32';
  const imgW = sw - 72;
  const imgH = imgW * (placement.height_cm / placement.width_cm);

  const btns: { key: ViewAngle; label: string; icon: string }[] = [
    { key: 'top', label: '위', icon: '↑' },
    { key: 'left', label: '좌', icon: '←' },
    { key: 'front', label: '정면', icon: '◉' },
    { key: 'right', label: '우', icon: '→' },
    { key: 'bottom', label: '아래', icon: '↓' },
  ];

  return (
    <View style={styles.artView}>
      {/* 벽면 */}
      <ScrollView contentContainerStyle={[styles.artWall, { backgroundColor: wallColor }]}>
        <View style={styles.spotlight} />

        {/* 프레임 */}
        <View style={[styles.artFrame, { borderColor: frameColor, width: imgW + 20, height: imgH + 20 }]}>
          <Animated.Image key={currentImg} entering={FadeIn.duration(250)}
            source={{ uri: currentImg }} style={{ width: imgW, height: imgH }} resizeMode="cover" />
        </View>

        {/* 플레이트 */}
        <View style={styles.artPlate}>
          <Text style={[styles.artPlateTitle, { color: isDark ? '#eee' : '#333' }]}>{art.title}</Text>
          <Text style={[styles.artPlateMeta, { color: isDark ? '#aaa' : '#777' }]}>
            {placement.width_cm} × {placement.height_cm} cm
          </Text>
          {art.description && <Text style={[styles.artPlateDesc, { color: isDark ? '#999' : '#888' }]}>{art.description}</Text>}
        </View>
      </ScrollView>

      {/* 시점 컨트롤 */}
      <View style={styles.ctrl}>
        <View style={styles.ctrlCross}>
          <View style={styles.ctrlRow}>
            <View style={{ width: 50 }} />
            <CtrlBtn b={btns[0]} cur={angle} has={!!angles.top} onPress={setAngle} />
            <View style={{ width: 50 }} />
          </View>
          <View style={styles.ctrlRow}>
            <CtrlBtn b={btns[1]} cur={angle} has={!!angles.left} onPress={setAngle} />
            <CtrlBtn b={btns[2]} cur={angle} has={true} onPress={setAngle} />
            <CtrlBtn b={btns[3]} cur={angle} has={!!angles.right} onPress={setAngle} />
          </View>
          <View style={styles.ctrlRow}>
            <View style={{ width: 50 }} />
            <CtrlBtn b={btns[4]} cur={angle} has={!!angles.bottom} onPress={setAngle} />
            <View style={{ width: 50 }} />
          </View>
        </View>
      </View>

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>← 전시관으로 돌아가기</Text>
      </Pressable>
    </View>
  );
}

function CtrlBtn({ b, cur, has, onPress }: {
  b: { key: ViewAngle; label: string; icon: string };
  cur: ViewAngle; has: boolean; onPress: (v: ViewAngle) => void;
}) {
  const active = cur === b.key;
  return (
    <Pressable
      style={[styles.ctrlBtn, active && styles.ctrlBtnActive, !has && styles.ctrlBtnOff]}
      onPress={() => has && onPress(b.key)} disabled={!has}>
      <Text style={[styles.ctrlIcon, active && { color: C.gold }, !has && { color: C.mutedDark }]}>{b.icon}</Text>
      <Text style={[styles.ctrlLabel, active && { color: C.gold }, !has && { color: C.mutedDark }]}>{b.label}</Text>
    </Pressable>
  );
}

/* ── 메인 뷰어 ── */
export default function ExhibitionViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: sw } = useWindowDimensions();

  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'entrance' | 'map' | 'artwork'>('entrance');
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);

  const mapWidth = Math.min(sw - 48, 360);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const { data: ex } = await supabase.from('exhibitions')
      .select('*, profiles(name, username)').eq('id', id).single();
    if (ex) setExhibition(ex as any);

    const { data: arts } = await supabase.from('exhibition_artworks')
      .select('*, artwork:artworks(id, title, description, image_url, image_top_url, image_bottom_url, image_left_url, image_right_url)')
      .eq('exhibition_id', id).order('created_at');
    if (arts) setPlacements(arts as any);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <View style={styles.loadingDiamond} />
        <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>전시관 입장 중...</Text>
      </View>
    );
  }

  if (!exhibition) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>전시관을 찾을 수 없습니다</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.gold }}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const wallColorOf = (w: Wall) => ({
    north: exhibition.wall_color_north, south: exhibition.wall_color_south,
    east: exhibition.wall_color_east, west: exhibition.wall_color_west,
  }[w]);

  // 1인칭 관람 모드
  if (mode === 'map') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <FirstPersonViewer
          roomType={exhibition.room_type as RoomType}
          wallColors={{
            north: exhibition.wall_color_north, south: exhibition.wall_color_south,
            east: exhibition.wall_color_east, west: exhibition.wall_color_west,
          }}
          placements={placements}
          onClose={() => setMode('entrance')}
        />
      </View>
    );
  }

  // 입구
  if (mode === 'entrance') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable style={styles.topBack} onPress={() => router.back()}>
          <Text style={styles.topBackText}>← 나가기</Text>
        </Pressable>
        <EntranceView exhibition={exhibition} onEnter={() => setMode('map')} />
      </View>
    );
  }

  // 맵
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 상단 */}
        <View style={styles.topBar}>
          <Pressable style={styles.topBarBtn} onPress={() => setMode('entrance')}>
            <Text style={{ color: C.fg, fontSize: 14 }}>←</Text>
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{exhibition.title}</Text>
          <Pressable style={styles.topBarBtn} onPress={() => router.back()}>
            <Text style={{ color: C.muted, fontSize: 10 }}>나가기</Text>
          </Pressable>
        </View>

        <View style={styles.guideRow}>
          <View style={styles.guideDiamond} />
          <Text style={styles.guideText}>작품을 터치해서 감상하세요</Text>
        </View>

        <Room3DView
          roomType={exhibition.room_type as RoomType}
          wallColors={{
            north: exhibition.wall_color_north, south: exhibition.wall_color_south,
            east: exhibition.wall_color_east, west: exhibition.wall_color_west,
          }}
          artworks={placements.map(p => ({
            localId: p.id, uri: p.artwork.image_url, title: p.artwork.title,
            wall: p.wall, positionX: p.position_x, positionY: p.position_y,
            widthCm: p.width_cm, heightCm: p.height_cm,
          }))}
          selectedWall={null}
          onWallSelect={() => {}}
          viewerMode
          onArtworkSelect={(art) => {
            const found = placements.find(p => p.id === art.localId);
            if (found) { setSelectedPlacement(found); setMode('artwork'); }
          }}
        />

        {/* 작품 목록 */}
        <Text style={[styles.listTitle, { marginTop: 28 }]}>전시 작품 ({placements.length})</Text>
        {placements.map((p, i) => (
          <Animated.View key={p.id} entering={FadeIn.delay(200 + i * 60).duration(300)}>
            <Pressable style={styles.listItem}
              onPress={() => { setSelectedPlacement(p); setMode('artwork'); }}>
              <Animated.Image source={{ uri: p.artwork.image_url }} style={styles.listThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listItemTitle}>{p.artwork.title}</Text>
                <Text style={styles.listItemMeta}>
                  {WALL_LABELS[p.wall]} · {p.width_cm}×{p.height_cm}cm · 바닥에서 {p.position_y}cm
                </Text>
                <View style={styles.angleBadges}>
                  <View style={styles.badge}><Text style={styles.badgeText}>정면</Text></View>
                  {p.artwork.image_top_url && <View style={styles.badge}><Text style={styles.badgeText}>위</Text></View>}
                  {p.artwork.image_bottom_url && <View style={styles.badge}><Text style={styles.badgeText}>아래</Text></View>}
                  {p.artwork.image_left_url && <View style={styles.badge}><Text style={styles.badgeText}>좌</Text></View>}
                  {p.artwork.image_right_url && <View style={styles.badge}><Text style={styles.badgeText}>우</Text></View>}
                </View>
              </View>
              <Text style={{ color: C.gold }}>→</Text>
            </Pressable>
          </Animated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  loadingScreen: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  loadingDiamond: { width: 16, height: 16, borderWidth: 1.5, borderColor: C.gold, transform: [{ rotate: '45deg' }] },
  loadingText: { color: C.muted, fontSize: 14, letterSpacing: 1, marginTop: 12 },

  // Entrance
  entranceScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  entranceContent: { alignItems: 'center', gap: 12 },
  entranceDiamond: { width: 14, height: 14, borderWidth: 1.5, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 8 },
  entranceTitle: { fontSize: 28, fontWeight: '900', color: C.fg, letterSpacing: 3, textAlign: 'center' },
  entranceLine: { width: 32, height: 1, backgroundColor: C.gold, marginVertical: 8 },
  entranceAuthor: { fontSize: 14, color: C.gold, fontWeight: '600', letterSpacing: 1 },
  entranceDesc: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  forewordBox: { width: '100%', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 24, marginTop: 20, gap: 10 },
  forewordLabel: { fontSize: 11, color: C.gold, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  forewordDivider: { height: 1, backgroundColor: C.border },
  forewordText: { fontSize: 14, color: '#ccc', lineHeight: 24 },
  entranceInfo: { marginTop: 12 },
  entranceInfoText: { fontSize: 11, color: C.muted, letterSpacing: 1 },
  enterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.fg, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: C.gold, marginTop: 16 },
  enterBtnText: { color: C.gold, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  enterBtnArrow: { color: C.gold, fontSize: 18 },

  topBack: { paddingHorizontal: 24, paddingVertical: 8 },
  topBackText: { color: C.muted, fontSize: 13 },

  // Map view
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  topBarBtn: { width: 40, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { color: C.fg, fontSize: 15, fontWeight: '800', letterSpacing: 1, flex: 1, textAlign: 'center' },

  guideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  guideDiamond: { width: 7, height: 7, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }] },
  guideText: { color: C.gold, fontSize: 12, letterSpacing: 1 },

  map: { position: 'relative' },
  mapFloor: { position: 'absolute', borderRadius: 2 },
  mapWallH: { position: 'absolute', left: 0, borderRadius: 2, overflow: 'visible' },
  mapWallV: { position: 'absolute', top: 0, borderRadius: 2, overflow: 'visible' },
  mapDim: { fontSize: 10, color: C.muted },
  mapEntrance: { position: 'absolute' },
  mapEntranceText: { fontSize: 8, color: C.gold, fontWeight: '700' },
  mapThumb: { position: 'absolute', borderRadius: 3, overflow: 'hidden', borderWidth: 2, borderColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },
  mapThumbImg: { width: '100%', height: '100%' },

  // List
  listTitle: { color: C.fg, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  listThumb: { width: 50, height: 50, borderRadius: 8 },
  listItemTitle: { color: C.fg, fontSize: 14, fontWeight: '700' },
  listItemMeta: { color: C.muted, fontSize: 10, marginTop: 2 },
  angleBadges: { flexDirection: 'row', gap: 4, marginTop: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(200,169,110,0.15)' },
  badgeText: { fontSize: 9, color: C.gold, fontWeight: '600' },

  // Artwork view
  artView: { flex: 1 },
  artWall: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 20 },
  spotlight: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 80,
    backgroundColor: 'rgba(255,255,200,0.06)', borderBottomLeftRadius: 100, borderBottomRightRadius: 100 },
  artFrame: { borderWidth: 5, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 5,
    shadowColor: '#000', shadowOffset: { width: 4, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  artPlate: { alignItems: 'center', gap: 3, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6 },
  artPlateTitle: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  artPlateMeta: { fontSize: 11 },
  artPlateDesc: { fontSize: 11, marginTop: 2 },

  // Controls
  ctrl: { backgroundColor: 'rgba(10,10,10,0.95)', padding: 14, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' },
  ctrlCross: { gap: 3 },
  ctrlRow: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  ctrlBtn: { width: 50, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  ctrlBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.15)' },
  ctrlBtnOff: { opacity: 0.2 },
  ctrlIcon: { fontSize: 14, color: C.muted },
  ctrlLabel: { fontSize: 7, color: C.muted, marginTop: 1 },

  closeBtn: { backgroundColor: C.bg, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' },
  closeBtnText: { color: C.gold, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
});
