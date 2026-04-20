import { useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  type Wall, type RoomType, type PlacedArtwork,
  getWallLength, getWallHeight, cmToPx, pxToCm, WALL_LABELS,
} from './room-geometry';

const C = {
  fg: '#0A0A0A', gold: '#C8A96E', muted: '#999', mutedLight: '#CCC',
  border: '#E8E5DF', white: '#FFF',
};

type Props = {
  wall: Wall;
  roomType: RoomType;
  wallColor: string;
  artworks: PlacedArtwork[];
  selectedArtworkId: string | null;
  onPlaceArtwork: (wall: Wall, posXcm: number, posYcm: number) => void;
  onSelectArtwork: (id: string) => void;
  onClose: () => void;
  containerWidth: number;
};

export default function WallFaceEditor({
  wall, roomType, wallColor, artworks, selectedArtworkId,
  onPlaceArtwork, onSelectArtwork, onClose, containerWidth,
}: Props) {
  const wallLenCm = getWallLength(roomType, wall);
  const wallHCm = getWallHeight(roomType);

  // 벽면 px - 가로를 꽉 채우되 너무 넓으면 스크롤
  const minPxPerCm = 0.3;
  const wallWidthPx = Math.max(containerWidth, wallLenCm * minPxPerCm);
  const wallHeightPx = (wallHCm / wallLenCm) * wallWidthPx;

  // 벽의 작품 (이 벽에 있는 것만)
  const wallArtworks = useMemo(() =>
    artworks.filter(a => a.wall === wall).sort((a, b) => a.positionX - b.positionX),
    [artworks, wall]
  );

  // 거리 라벨 계산
  const distanceLabels = useMemo(() => {
    if (wallArtworks.length === 0) return [];
    const labels: { fromPx: number; toPx: number; cm: number }[] = [];

    // 왼쪽 벽 → 첫 작품
    const first = wallArtworks[0];
    const firstLeftEdge = first.positionX - first.widthCm / 2;
    if (firstLeftEdge > 5) {
      labels.push({
        fromPx: 0,
        toPx: cmToPx(firstLeftEdge, wallLenCm, wallWidthPx),
        cm: Math.round(firstLeftEdge),
      });
    }

    // 작품 사이
    for (let i = 0; i < wallArtworks.length - 1; i++) {
      const rightEdge = wallArtworks[i].positionX + wallArtworks[i].widthCm / 2;
      const leftEdge = wallArtworks[i + 1].positionX - wallArtworks[i + 1].widthCm / 2;
      const gap = leftEdge - rightEdge;
      if (gap > 3) {
        labels.push({
          fromPx: cmToPx(rightEdge, wallLenCm, wallWidthPx),
          toPx: cmToPx(leftEdge, wallLenCm, wallWidthPx),
          cm: Math.round(gap),
        });
      }
    }

    // 마지막 작품 → 오른쪽 벽
    const last = wallArtworks[wallArtworks.length - 1];
    const lastRightEdge = last.positionX + last.widthCm / 2;
    const remaining = wallLenCm - lastRightEdge;
    if (remaining > 5) {
      labels.push({
        fromPx: cmToPx(lastRightEdge, wallLenCm, wallWidthPx),
        toPx: wallWidthPx,
        cm: Math.round(remaining),
      });
    }

    return labels;
  }, [wallArtworks, wallLenCm, wallWidthPx]);

  // 벽면 터치 → 클릭한 위치에 배치
  const wallRef = useRef<View>(null);

  const handleWallPress = (e: any) => {
    // web에서는 nativeEvent.offsetX/offsetY 사용, 없으면 pageX 기반 계산
    const nativeEvt = e.nativeEvent;
    let localX = nativeEvt.offsetX ?? nativeEvt.locationX;
    let localY = nativeEvt.offsetY ?? nativeEvt.locationY;

    // offsetX/locationX 둘 다 없으면 pageX로 계산
    if (localX == null || localY == null || isNaN(localX) || isNaN(localY)) {
      // fallback: 벽면 중앙
      localX = wallWidthPx / 2;
      localY = wallHeightPx / 2;
    }

    const posXcm = Math.round(pxToCm(localX, wallWidthPx, wallLenCm));
    const posYcm = Math.round(wallHCm - pxToCm(localY, wallHeightPx, wallHCm));
    const clampedX = Math.max(30, Math.min(wallLenCm - 30, posXcm));
    const clampedY = Math.max(30, Math.min(wallHCm - 20, posYcm));
    onPlaceArtwork(wall, clampedX, clampedY);
  };

  const isDark = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'].includes(wallColor);
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{WALL_LABELS[wall]}</Text>
          <Text style={styles.headerDim}>
            {(wallLenCm / 100).toFixed(0)}m × {(wallHCm / 100).toFixed(1)}m · 작품 {wallArtworks.length}점
          </Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕ 닫기</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>벽면을 터치하면 그 위치에 작품이 걸립니다</Text>

      {/* 벽면 에디터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ borderRadius: 10, overflow: 'hidden' }}>
        <Pressable onPress={handleWallPress} style={{ position: 'relative' }}>
          <View style={[styles.wallSurface, {
            width: wallWidthPx,
            height: Math.max(wallHeightPx, 180),
            backgroundColor: wallColor,
          }]}>
            {/* 세로 눈금 (1m마다) */}
            {Array.from({ length: Math.floor(wallLenCm / 100) }, (_, i) => {
              const x = cmToPx((i + 1) * 100, wallLenCm, wallWidthPx);
              return (
                <View key={`v${i}`} style={{
                  position: 'absolute', left: x, top: 0, bottom: 0,
                  width: 1, backgroundColor: gridColor,
                }}>
                  <Text style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, color: textColor, fontWeight: '600' }}>
                    {i + 1}m
                  </Text>
                </View>
              );
            })}

            {/* 가로 눈금 (1m마다, 바닥 기준) */}
            {Array.from({ length: Math.floor(wallHCm / 100) }, (_, i) => {
              const y = wallHeightPx - cmToPx((i + 1) * 100, wallHCm, wallHeightPx);
              return (
                <View key={`h${i}`} style={{
                  position: 'absolute', top: y, left: 0, right: 0,
                  height: 1, backgroundColor: gridColor,
                }}>
                  <Text style={{ position: 'absolute', left: 4, top: -12, fontSize: 9, color: textColor, fontWeight: '600' }}>
                    {i + 1}m
                  </Text>
                </View>
              );
            })}

            {/* 눈높이 (150cm) */}
            {wallHCm >= 150 && (
              <View style={{
                position: 'absolute',
                top: wallHeightPx - cmToPx(150, wallHCm, wallHeightPx),
                left: 0, right: 0, height: 1,
                borderTopWidth: 1, borderStyle: 'dashed',
                borderColor: isDark ? 'rgba(200,169,110,0.4)' : 'rgba(200,169,110,0.6)',
              }}>
                <Text style={{
                  position: 'absolute', right: 6, top: -14,
                  fontSize: 9, color: C.gold, fontWeight: '600',
                }}>
                  눈높이 150cm
                </Text>
              </View>
            )}

            {/* 바닥 */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 4, backgroundColor: '#8B7355',
            }} />

            {/* 작품들 */}
            {wallArtworks.map(art => {
              const w = cmToPx(art.widthCm, wallLenCm, wallWidthPx);
              const h = cmToPx(art.heightCm, wallHCm, wallHeightPx);
              const left = cmToPx(art.positionX, wallLenCm, wallWidthPx) - w / 2;
              const top = wallHeightPx - cmToPx(art.positionY, wallHCm, wallHeightPx) - h / 2;
              const isSelected = art.localId === selectedArtworkId;
              const frameColor = isDark ? '#D4C5A9' : '#5C4A32';

              return (
                <Pressable
                  key={art.localId}
                  onPress={() => onSelectArtwork(art.localId)}
                  style={{
                    position: 'absolute', left, top, width: w, height: h,
                    borderWidth: isSelected ? 3 : 2.5,
                    borderColor: isSelected ? C.gold : frameColor,
                    backgroundColor: '#fff', padding: 2,
                    shadowColor: '#000', shadowOffset: { width: 1, height: 3 },
                    shadowOpacity: isDark ? 0.4 : 0.15, shadowRadius: 4,
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <Animated.Image source={{ uri: art.uri }}
                    style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </Pressable>
              );
            })}

            {/* 거리 라벨 */}
            {distanceLabels.map((d, i) => {
              const width = d.toPx - d.fromPx;
              if (width < 25) return null;
              // 벽 중간 높이에 표시
              const labelY = wallHeightPx * 0.5;
              return (
                <View key={`dist${i}`} style={{
                  position: 'absolute', left: d.fromPx, width,
                  top: labelY - 8, height: 16,
                  flexDirection: 'row', alignItems: 'center',
                  zIndex: 0,
                }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(200,169,110,0.4)' }} />
                  <View style={{
                    backgroundColor: 'rgba(200,169,110,0.2)',
                    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginHorizontal: 2,
                  }}>
                    <Text style={{ fontSize: 8, color: C.gold, fontWeight: '700' }}>{d.cm}cm</Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(200,169,110,0.4)' }} />
                </View>
              );
            })}
          </View>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.fg, letterSpacing: 1 },
  headerDim: { fontSize: 11, color: C.muted, marginTop: 2 },
  closeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  closeBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  hint: { fontSize: 11, color: C.gold, letterSpacing: 0.5 },
  wallSurface: { position: 'relative', overflow: 'hidden' },
});
