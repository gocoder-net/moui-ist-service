import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, Easing, FadeIn, runOnJS,
} from 'react-native-reanimated';
import {
  type Wall, type RoomType,
  ROOM_TEMPLATES, WALL_LABELS, getWallLength, getWallHeight, cmToPx,
} from './room-geometry';

const C = {
  bg: '#0A0A0A', fg: '#FFFFFF', gold: '#C8A96E',
  muted: '#888', mutedDark: '#444', border: '#222',
};

type ViewAngle = 'front' | 'top' | 'bottom' | 'left' | 'right';

type Placement = {
  id: string; wall: Wall; position_x: number; position_y: number;
  width_cm: number; height_cm: number;
  artwork: {
    id: string; title: string; description: string | null; image_url: string;
    image_top_url: string | null; image_bottom_url: string | null;
    image_left_url: string | null; image_right_url: string | null;
  };
};

type Props = {
  roomType: RoomType;
  wallColors: Record<Wall, string>;
  placements: Placement[];
  onClose: () => void;
};

const WALL_ORDER: Wall[] = ['north', 'east', 'south', 'west'];

function getAdjacentWalls(current: Wall) {
  const idx = WALL_ORDER.indexOf(current);
  return {
    left: WALL_ORDER[(idx - 1 + 4) % 4],
    right: WALL_ORDER[(idx + 1) % 4],
  };
}

/* ── 벽면 렌더 (정면/사이드 공용) ── */
function WallSurface({
  wall, roomType, wallColor, placements, screenWidth,
  isSide, onArtworkPress,
}: {
  wall: Wall; roomType: RoomType; wallColor: string;
  placements: Placement[]; screenWidth: number;
  isSide?: boolean; onArtworkPress?: (p: Placement) => void;
}) {
  const wallLenCm = getWallLength(roomType, wall);
  const wallHCm = getWallHeight(roomType);
  const wallWidthPx = isSide ? 80 : Math.max(screenWidth - 16, wallLenCm * 0.25);
  const wallHeightPx = isSide ? 200 : Math.max((wallHCm / wallLenCm) * wallWidthPx, 220);

  const isDark = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'].includes(wallColor);
  const frameColor = isDark ? '#D4C5A9' : '#5C4A32';
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const wallPlacements = placements.filter(p => p.wall === wall);

  return (
    <View style={{
      width: wallWidthPx, height: wallHeightPx,
      backgroundColor: wallColor, overflow: 'hidden',
      position: 'relative',
    }}>
      {/* 눈금선 (사이드에선 안 보임) */}
      {!isSide && Array.from({ length: Math.floor(wallLenCm / 100) }, (_, i) => (
        <View key={i} style={{
          position: 'absolute', left: cmToPx((i + 1) * 100, wallLenCm, wallWidthPx),
          top: 0, bottom: 0, width: 1, backgroundColor: gridColor,
        }} />
      ))}

      {/* 작품들 */}
      {wallPlacements.map(p => {
        const w = cmToPx(p.width_cm, wallLenCm, wallWidthPx);
        const h = cmToPx(p.height_cm, wallHCm, wallHeightPx);
        const left = cmToPx(p.position_x, wallLenCm, wallWidthPx) - w / 2;
        const top = wallHeightPx - cmToPx(p.position_y, wallHCm, wallHeightPx) - h / 2;

        if (isSide) {
          // 사이드에서는 작은 힌트만
          return (
            <View key={p.id} style={{
              position: 'absolute',
              left: Math.max(4, left), top: Math.max(4, top),
              width: Math.min(w, wallWidthPx - 8),
              height: Math.min(h, 40),
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
            }} />
          );
        }

        return (
          <Pressable key={p.id}
            onPress={() => onArtworkPress?.(p)}
            style={{
              position: 'absolute', left, top, width: w, height: h,
              borderWidth: 3, borderColor: frameColor, backgroundColor: '#fff', padding: 2,
              shadowColor: '#000', shadowOffset: { width: 2, height: 4 },
              shadowOpacity: isDark ? 0.5 : 0.2, shadowRadius: 6,
            }}>
            <Animated.Image source={{ uri: p.artwork.image_url }}
              style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </Pressable>
        );
      })}

      {/* 사이드 라벨 */}
      {isSide && (
        <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>
            {WALL_LABELS[wall]}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── 메인 ── */
export default function FirstPersonViewer({ roomType, wallColors, placements, onClose }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const [facingWall, setFacingWall] = useState<Wall>('north');
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);
  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 전환 애니메이션
  const slideX = useSharedValue(0);
  const fadeOpacity = useSharedValue(1);
  const stepBob = useSharedValue(0); // 걷는 느낌 상하 흔들림

  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slideX.value },
      { translateY: stepBob.value },
    ],
    opacity: fadeOpacity.value,
  }));

  const { left: leftWall, right: rightWall } = getAdjacentWalls(facingWall);

  const turnTo = (direction: 'left' | 'right') => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const nextWall = direction === 'left' ? leftWall : rightWall;
    const slideDir = direction === 'left' ? sw : -sw;

    // 걷는 흔들림
    stepBob.value = withSequence(
      withTiming(-4, { duration: 100 }),
      withTiming(3, { duration: 100 }),
      withTiming(-2, { duration: 80 }),
      withTiming(0, { duration: 80 }),
    );

    // 슬라이드 아웃
    slideX.value = withTiming(slideDir * 0.3, { duration: 250, easing: Easing.in(Easing.cubic) }, () => {
      // 벽 전환
      runOnJS(setFacingWall)(nextWall);
      runOnJS(setSelectedPlacement)(null);
      // 반대편에서 슬라이드 인
      slideX.value = -slideDir * 0.3;
      slideX.value = withSpring(0, { damping: 20, stiffness: 150 }, () => {
        runOnJS(setIsTransitioning)(false);
      });
    });
  };

  const isDark = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'].includes(wallColors[facingWall]);

  // ── 작품 클로즈업 ──
  if (selectedPlacement) {
    const art = selectedPlacement.artwork;
    const angles: Record<ViewAngle, string | null> = {
      front: art.image_url, top: art.image_top_url, bottom: art.image_bottom_url,
      left: art.image_left_url, right: art.image_right_url,
    };
    const currentImg = angles[viewAngle] || art.image_url;
    const imgW = sw - 64;
    const imgH = imgW * (selectedPlacement.height_cm / selectedPlacement.width_cm);
    const frameColor = isDark ? '#D4C5A9' : '#5C4A32';

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.closeupWall, { backgroundColor: wallColors[facingWall] }]}>
          {/* 스포트라이트 */}
          <View style={styles.spotlight} />

          {/* 프레임 */}
          <View style={[styles.closeupFrame, {
            borderColor: frameColor, width: imgW + 16, height: imgH + 16,
          }]}>
            <Animated.Image key={currentImg} entering={FadeIn.duration(250)}
              source={{ uri: currentImg }}
              style={{ width: imgW, height: imgH }} resizeMode="cover" />
          </View>

          {/* 플레이트 */}
          <View style={styles.closeupPlate}>
            <Text style={[styles.plateTitle, { color: isDark ? '#eee' : '#333' }]}>
              {art.title}
            </Text>
            <Text style={[styles.plateMeta, { color: isDark ? '#aaa' : '#777' }]}>
              {selectedPlacement.width_cm} × {selectedPlacement.height_cm} cm
            </Text>
            {art.description && (
              <Text style={[styles.plateDesc, { color: isDark ? '#888' : '#999' }]}>
                {art.description}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* 시점 컨트롤 */}
        <View style={styles.anglePanel}>
          <View style={styles.angleCross}>
            <View style={styles.angleRow}>
              <View style={{ width: 50 }} />
              <ABtn k="top" icon="↑" label="위" cur={viewAngle} has={!!angles.top} set={setViewAngle} />
              <View style={{ width: 50 }} />
            </View>
            <View style={styles.angleRow}>
              <ABtn k="left" icon="←" label="좌" cur={viewAngle} has={!!angles.left} set={setViewAngle} />
              <ABtn k="front" icon="◉" label="정면" cur={viewAngle} has={true} set={setViewAngle} />
              <ABtn k="right" icon="→" label="우" cur={viewAngle} has={!!angles.right} set={setViewAngle} />
            </View>
            <View style={styles.angleRow}>
              <View style={{ width: 50 }} />
              <ABtn k="bottom" icon="↓" label="아래" cur={viewAngle} has={!!angles.bottom} set={setViewAngle} />
              <View style={{ width: 50 }} />
            </View>
          </View>
        </View>

        <Pressable style={styles.backBar}
          onPress={() => { setSelectedPlacement(null); setViewAngle('front'); }}>
          <Text style={styles.backBarText}>← 벽면으로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  // ── 1인칭 뷰 ──
  return (
    <View style={styles.root}>
      {/* 천장 (원근감) */}
      <View style={styles.ceiling}>
        <View style={styles.ceilingGrad} />
        <View style={styles.ceilingLight} />
      </View>

      {/* 벽면 영역 (좌 사이드 + 정면 + 우 사이드) */}
      <Animated.View style={[styles.wallArea, slideStyle]}>
        <View style={styles.wallRow}>
          {/* 왼쪽 벽 (사선) */}
          <Pressable
            onPress={() => turnTo('left')}
            style={[styles.sideWall, styles.sideWallLeft]}
          >
            <WallSurface
              wall={leftWall} roomType={roomType}
              wallColor={wallColors[leftWall]}
              placements={placements} screenWidth={sw} isSide
            />
            <View style={styles.sideOverlay}>
              <Text style={styles.sideArrow}>‹</Text>
            </View>
          </Pressable>

          {/* 정면 벽 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.frontWallScroll}>
            <WallSurface
              wall={facingWall} roomType={roomType}
              wallColor={wallColors[facingWall]}
              placements={placements} screenWidth={sw}
              onArtworkPress={setSelectedPlacement}
            />
          </ScrollView>

          {/* 오른쪽 벽 (사선) */}
          <Pressable
            onPress={() => turnTo('right')}
            style={[styles.sideWall, styles.sideWallRight]}
          >
            <WallSurface
              wall={rightWall} roomType={roomType}
              wallColor={wallColors[rightWall]}
              placements={placements} screenWidth={sw} isSide
            />
            <View style={styles.sideOverlay}>
              <Text style={styles.sideArrow}>›</Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* 바닥 (원근감) */}
      <View style={styles.floor}>
        <View style={styles.floorShine} />
        <View style={styles.floorTiles}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={[styles.floorTile, i % 2 === 0 && styles.floorTileAlt]} />
          ))}
        </View>
      </View>

      {/* 하단 네비게이션 */}
      <View style={styles.navPanel}>
        <View style={styles.navTop}>
          {/* 나침반 */}
          <View style={styles.compass}>
            {WALL_ORDER.map(w => {
              const isActive = w === facingWall;
              const labels: Record<Wall, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };
              return (
                <Pressable key={w}
                  style={[styles.compassItem, isActive && styles.compassItemActive]}
                  onPress={() => {
                    if (!isTransitioning && w !== facingWall) {
                      setFacingWall(w);
                      setSelectedPlacement(null);
                    }
                  }}>
                  <Text style={[styles.compassText, isActive && styles.compassTextActive]}>
                    {labels[w]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.navLabel}>{WALL_LABELS[facingWall]}</Text>
        <Text style={styles.navSub}>
          작품 {placements.filter(p => p.wall === facingWall).length}점 ·
          {' '}{(getWallLength(roomType, facingWall) / 100)}m 벽
        </Text>

        {/* 좌우 이동 */}
        <View style={styles.moveRow}>
          <Pressable style={styles.moveBtn} onPress={() => turnTo('left')} disabled={isTransitioning}>
            <Text style={styles.moveBtnIcon}>‹</Text>
            <Text style={styles.moveBtnLabel}>왼쪽으로</Text>
          </Pressable>

          <View style={styles.positionDot} />

          <Pressable style={styles.moveBtn} onPress={() => turnTo('right')} disabled={isTransitioning}>
            <Text style={styles.moveBtnIcon}>›</Text>
            <Text style={styles.moveBtnLabel}>오른쪽으로</Text>
          </Pressable>
        </View>

        <Pressable style={styles.exitBtn} onPress={onClose}>
          <Text style={styles.exitText}>전시관 나가기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ABtn({ k, icon, label, cur, has, set }: {
  k: ViewAngle; icon: string; label: string;
  cur: ViewAngle; has: boolean; set: (v: ViewAngle) => void;
}) {
  return (
    <Pressable
      style={[styles.aBtn, cur === k && styles.aBtnActive, !has && { opacity: 0.2 }]}
      onPress={() => has && set(k)} disabled={!has}>
      <Text style={[styles.aBtnIcon, cur === k && { color: C.gold }]}>{icon}</Text>
      <Text style={[styles.aBtnLabel, cur === k && { color: C.gold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // 천장
  ceiling: {
    height: 24, backgroundColor: '#0e0e0e',
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 4,
  },
  ceilingGrad: {
    position: 'absolute', bottom: 0, left: '10%', right: '10%',
    height: 12, backgroundColor: 'rgba(200,169,110,0.04)',
    borderTopLeftRadius: 100, borderTopRightRadius: 100,
  },
  ceilingLight: {
    width: 100, height: 3, backgroundColor: 'rgba(255,255,230,0.25)', borderRadius: 2,
  },

  // 벽면 영역
  wallArea: { flex: 1 },
  wallRow: { flex: 1, flexDirection: 'row' },

  sideWall: {
    width: 50, overflow: 'hidden', justifyContent: 'center',
  },
  sideWallLeft: {
    transform: [{ perspective: 400 }, { rotateY: '35deg' }],
    marginRight: -8,
  },
  sideWallRight: {
    transform: [{ perspective: 400 }, { rotateY: '-35deg' }],
    marginLeft: -8,
  },
  sideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  sideArrow: { fontSize: 28, color: 'rgba(255,255,255,0.5)', fontWeight: '200' },

  frontWallScroll: { flex: 1 },

  // 바닥
  floor: {
    height: 44, backgroundColor: '#6B5B3E', overflow: 'hidden',
    transform: [{ perspective: 300 }, { rotateX: '10deg' }],
    marginTop: -4,
  },
  floorShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  floorTiles: { flexDirection: 'row', flex: 1, opacity: 0.15 },
  floorTile: { flex: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  floorTileAlt: { backgroundColor: 'rgba(0,0,0,0.15)' },

  // 하단 네비게이션
  navPanel: {
    backgroundColor: 'rgba(8,8,8,0.97)', paddingVertical: 12, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center', gap: 6,
  },
  navTop: { flexDirection: 'row', justifyContent: 'center' },
  compass: { flexDirection: 'row', gap: 2 },
  compassItem: {
    width: 32, height: 28, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  compassItemActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.15)' },
  compassText: { fontSize: 11, fontWeight: '800', color: C.mutedDark },
  compassTextActive: { color: C.gold },

  navLabel: { color: C.fg, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  navSub: { color: C.muted, fontSize: 10 },

  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 2 },
  moveBtn: { alignItems: 'center', gap: 2 },
  moveBtnIcon: { fontSize: 28, color: C.gold, fontWeight: '200', lineHeight: 30 },
  moveBtnLabel: { fontSize: 9, color: C.muted },
  positionDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, opacity: 0.5,
  },

  exitBtn: { marginTop: 4 },
  exitText: { color: C.mutedDark, fontSize: 11 },

  // 클로즈업
  closeupWall: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    gap: 16, paddingVertical: 24,
  },
  spotlight: {
    position: 'absolute', top: 0, left: '15%', right: '15%', height: 100,
    backgroundColor: 'rgba(255,255,230,0.05)',
    borderBottomLeftRadius: 120, borderBottomRightRadius: 120,
  },
  closeupFrame: {
    borderWidth: 5, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', padding: 4,
    shadowColor: '#000', shadowOffset: { width: 3, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  closeupPlate: {
    alignItems: 'center', gap: 3,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4,
  },
  plateTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  plateMeta: { fontSize: 11 },
  plateDesc: { fontSize: 11, marginTop: 2, textAlign: 'center' },

  // 시점
  anglePanel: {
    backgroundColor: 'rgba(8,8,8,0.97)', padding: 12,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center',
  },
  angleCross: { gap: 3 },
  angleRow: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  aBtn: {
    width: 50, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  aBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.12)' },
  aBtnIcon: { fontSize: 14, color: C.muted },
  aBtnLabel: { fontSize: 7, color: C.muted },

  backBar: {
    backgroundColor: C.bg, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center',
  },
  backBarText: { color: C.gold, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
});
