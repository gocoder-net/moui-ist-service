import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, PanResponder, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
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
  onMoveArtwork: (id: string, posXcm: number, posYcm: number) => void;
  onResizeArtwork: (id: string, widthCm: number, heightCm: number) => void;
  onClose: () => void;
  containerWidth: number;
};

export default function WallFaceEditor({
  wall, roomType, wallColor, artworks, selectedArtworkId,
  onPlaceArtwork, onSelectArtwork, onMoveArtwork, onResizeArtwork, onClose, containerWidth,
}: Props) {
  const wallLenCm = getWallLength(roomType, wall);
  const wallHCm = getWallHeight(roomType);

  const minPxPerCm = 0.3;
  const wallWidthPx = Math.max(containerWidth, wallLenCm * minPxPerCm);
  const wallHeightPx = Math.max((wallHCm / wallLenCm) * wallWidthPx, 180);

  const wallArtworks = useMemo(() =>
    artworks.filter(a => a.wall === wall).sort((a, b) => a.positionX - b.positionX),
    [artworks, wall]
  );

  // 거리 라벨
  const distanceLabels = useMemo(() => {
    if (wallArtworks.length === 0) return [];
    const labels: { fromPx: number; toPx: number; cm: number }[] = [];

    const first = wallArtworks[0];
    const firstLeftEdge = first.positionX - first.widthCm / 2;
    if (firstLeftEdge > 5) {
      labels.push({ fromPx: 0, toPx: cmToPx(firstLeftEdge, wallLenCm, wallWidthPx), cm: Math.round(firstLeftEdge) });
    }

    for (let i = 0; i < wallArtworks.length - 1; i++) {
      const rightEdge = wallArtworks[i].positionX + wallArtworks[i].widthCm / 2;
      const leftEdge = wallArtworks[i + 1].positionX - wallArtworks[i + 1].widthCm / 2;
      const gap = leftEdge - rightEdge;
      if (gap > 3) {
        labels.push({ fromPx: cmToPx(rightEdge, wallLenCm, wallWidthPx), toPx: cmToPx(leftEdge, wallLenCm, wallWidthPx), cm: Math.round(gap) });
      }
    }

    const last = wallArtworks[wallArtworks.length - 1];
    const lastRightEdge = last.positionX + last.widthCm / 2;
    const remaining = wallLenCm - lastRightEdge;
    if (remaining > 5) {
      labels.push({ fromPx: cmToPx(lastRightEdge, wallLenCm, wallWidthPx), toPx: wallWidthPx, cm: Math.round(remaining) });
    }

    return labels;
  }, [wallArtworks, wallLenCm, wallWidthPx]);

  // 벽면 빈곳 터치 → 배치
  const handleWallPress = (e: any) => {
    const nativeEvt = e.nativeEvent;
    let localX = nativeEvt.offsetX ?? nativeEvt.locationX;
    let localY = nativeEvt.offsetY ?? nativeEvt.locationY;
    if (localX == null || localY == null || isNaN(localX) || isNaN(localY)) {
      localX = wallWidthPx / 2;
      localY = wallHeightPx / 2;
    }
    const posXcm = Math.round(pxToCm(localX, wallWidthPx, wallLenCm));
    const posYcm = Math.round(wallHCm - pxToCm(localY, wallHeightPx, wallHCm));
    onPlaceArtwork(wall, Math.max(30, Math.min(wallLenCm - 30, posXcm)), Math.max(30, Math.min(wallHCm - 20, posYcm)));
  };

  const isDark = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'].includes(wallColor);
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
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

      <Text style={styles.hint}>터치: 작품 걸기 · 드래그: 작품 이동</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ borderRadius: 10, overflow: 'hidden' }}
        scrollEnabled={!selectedArtworkId}>
        <Pressable onPress={handleWallPress} style={{ position: 'relative' }}>
          <View style={[styles.wallSurface, { width: wallWidthPx, height: wallHeightPx, backgroundColor: wallColor }]}>
            {/* 세로 눈금 */}
            {Array.from({ length: Math.floor(wallLenCm / 100) }, (_, i) => {
              const x = cmToPx((i + 1) * 100, wallLenCm, wallWidthPx);
              return (
                <View key={`v${i}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, backgroundColor: gridColor }}>
                  <Text style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, color: textColor, fontWeight: '600' }}>{i + 1}m</Text>
                </View>
              );
            })}

            {/* 가로 눈금 */}
            {Array.from({ length: Math.floor(wallHCm / 100) }, (_, i) => {
              const y = wallHeightPx - cmToPx((i + 1) * 100, wallHCm, wallHeightPx);
              return (
                <View key={`h${i}`} style={{ position: 'absolute', top: y, left: 0, right: 0, height: 1, backgroundColor: gridColor }}>
                  <Text style={{ position: 'absolute', left: 4, top: -12, fontSize: 9, color: textColor, fontWeight: '600' }}>{i + 1}m</Text>
                </View>
              );
            })}

            {/* 눈높이 */}
            {wallHCm >= 150 && (
              <View style={{
                position: 'absolute', top: wallHeightPx - cmToPx(150, wallHCm, wallHeightPx),
                left: 0, right: 0, height: 1,
                borderTopWidth: 1, borderStyle: 'dashed',
                borderColor: isDark ? 'rgba(200,169,110,0.4)' : 'rgba(200,169,110,0.6)',
              }}>
                <Text style={{ position: 'absolute', right: 6, top: -14, fontSize: 9, color: C.gold, fontWeight: '600' }}>눈높이 150cm</Text>
              </View>
            )}

            {/* 바닥 */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: '#8B7355' }} />

            {/* 작품들 (드래그 가능) */}
            {wallArtworks.map(art => (
              <DraggableArtwork
                key={art.localId}
                art={art}
                wallLenCm={wallLenCm}
                wallHCm={wallHCm}
                wallWidthPx={wallWidthPx}
                wallHeightPx={wallHeightPx}
                isSelected={art.localId === selectedArtworkId}
                isDark={isDark}
                onSelect={() => onSelectArtwork(art.localId)}
                onMove={(x, y) => onMoveArtwork(art.localId, x, y)}
                onResize={(w, h) => onResizeArtwork(art.localId, w, h)}
              />
            ))}

            {/* 거리 라벨 */}
            {distanceLabels.map((d, i) => {
              const width = d.toPx - d.fromPx;
              if (width < 25) return null;
              return (
                <View key={`dist${i}`} style={{
                  position: 'absolute', left: d.fromPx, width,
                  top: wallHeightPx * 0.5 - 8, height: 16,
                  flexDirection: 'row', alignItems: 'center', zIndex: 0,
                }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(200,169,110,0.4)' }} />
                  <View style={{ backgroundColor: 'rgba(200,169,110,0.2)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginHorizontal: 2 }}>
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

/* ── 두 터치 사이 거리 ── */
function getTouchDistance(touches: any[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ── 드래그 + 핀치 가능한 작품 ── */
function DraggableArtwork({
  art, wallLenCm, wallHCm, wallWidthPx, wallHeightPx,
  isSelected, isDark, onSelect, onMove, onResize,
}: {
  art: PlacedArtwork;
  wallLenCm: number; wallHCm: number;
  wallWidthPx: number; wallHeightPx: number;
  isSelected: boolean; isDark: boolean;
  onSelect: () => void;
  onMove: (posXcm: number, posYcm: number) => void;
  onResize: (widthCm: number, heightCm: number) => void;
}) {
  const w = cmToPx(art.widthCm, wallLenCm, wallWidthPx);
  const h = cmToPx(art.heightCm, wallHCm, wallHeightPx);
  const baseLeft = cmToPx(art.positionX, wallLenCm, wallWidthPx) - w / 2;
  const baseTop = wallHeightPx - cmToPx(art.positionY, wallHCm, wallHeightPx) - h / 2;

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scaleOffset, setScaleOffset] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const draggingRef = useRef(false);
  const pinchingRef = useRef(false);
  const initialPinchDist = useRef(0);
  const webElRef = useRef<any>(null);

  // Stable refs for callbacks (avoid stale closures in useEffect)
  const cbRef = useRef({ onSelect, onMove });
  cbRef.current = { onSelect, onMove };
  const artStateRef = useRef({ positionX: art.positionX, positionY: art.positionY, widthCm: art.widthCm, heightCm: art.heightCm });
  artStateRef.current = { positionX: art.positionX, positionY: art.positionY, widthCm: art.widthCm, heightCm: art.heightCm };
  const dimsRef = useRef({ wallLenCm, wallHCm, wallWidthPx, wallHeightPx });
  dimsRef.current = { wallLenCm, wallHCm, wallWidthPx, wallHeightPx };

  // Web mouse drag support
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = webElRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cbRef.current.onSelect();

      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
        if (moved) {
          draggingRef.current = true;
          setIsDragging(true);
          setDragOffset({ x: dx, y: dy });
        }
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (moved) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          const d = dimsRef.current;
          const a = artStateRef.current;
          const cx = cmToPx(a.positionX, d.wallLenCm, d.wallWidthPx) + dx;
          const cy = (d.wallHeightPx - cmToPx(a.positionY, d.wallHCm, d.wallHeightPx)) + dy;
          const nx = Math.round(pxToCm(cx, d.wallWidthPx, d.wallLenCm));
          const ny = Math.round(d.wallHCm - pxToCm(cy, d.wallHeightPx, d.wallHCm));
          setDragOffset({ x: 0, y: 0 });
          setIsDragging(false);
          draggingRef.current = false;
          cbRef.current.onMove(
            Math.max(a.widthCm / 2, Math.min(d.wallLenCm - a.widthCm / 2, nx)),
            Math.max(a.heightCm / 2, Math.min(d.wallHCm - a.heightCm / 2, ny))
          );
        } else {
          setDragOffset({ x: 0, y: 0 });
          setIsDragging(false);
          draggingRef.current = false;
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, []);

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onSelect();
        draggingRef.current = false;
        pinchingRef.current = false;
        setIsDragging(false);
        setIsPinching(false);
        if (evt.nativeEvent.touches?.length >= 2) {
          initialPinchDist.current = getTouchDistance(evt.nativeEvent.touches);
          pinchingRef.current = true;
          setIsPinching(true);
        }
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;

        // 핀치 (두 손가락)
        if (touches && touches.length >= 2) {
          if (!pinchingRef.current) {
            initialPinchDist.current = getTouchDistance(touches);
            pinchingRef.current = true;
            setIsPinching(true);
          }
          const currentDist = getTouchDistance(touches);
          if (initialPinchDist.current > 0) {
            const scale = currentDist / initialPinchDist.current;
            setScaleOffset(Math.max(0.3, Math.min(3, scale)));
          }
          return;
        }

        // 드래그 (한 손가락)
        if (!pinchingRef.current && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3)) {
          draggingRef.current = true;
          setIsDragging(true);
          setDragOffset({ x: g.dx, y: g.dy });
        }
      },
      onPanResponderRelease: (_, g) => {
        // 핀치 끝
        if (pinchingRef.current) {
          const newWidth = Math.round(Math.max(10, Math.min(300, art.widthCm * scaleOffset)));
          const newHeight = Math.round(Math.max(10, Math.min(300, art.heightCm * scaleOffset)));
          setScaleOffset(1);
          setIsPinching(false);
          pinchingRef.current = false;
          setTimeout(() => onResize(newWidth, newHeight), 0);
          return;
        }

        // 드래그 끝
        if (draggingRef.current) {
          const newCenterPxX = cmToPx(art.positionX, wallLenCm, wallWidthPx) + g.dx;
          const newCenterPxY = (wallHeightPx - cmToPx(art.positionY, wallHCm, wallHeightPx)) + g.dy;
          const newXcm = Math.round(pxToCm(newCenterPxX, wallWidthPx, wallLenCm));
          const newYcm = Math.round(wallHCm - pxToCm(newCenterPxY, wallHeightPx, wallHCm));

          setDragOffset({ x: 0, y: 0 });
          setIsDragging(false);
          draggingRef.current = false;
          setTimeout(() => {
            onMove(
              Math.max(art.widthCm / 2, Math.min(wallLenCm - art.widthCm / 2, newXcm)),
              Math.max(art.heightCm / 2, Math.min(wallHCm - art.heightCm / 2, newYcm))
            );
          }, 0);
        } else {
          setDragOffset({ x: 0, y: 0 });
          setIsDragging(false);
          draggingRef.current = false;
        }
      },
    }),
    [art.positionX, art.positionY, art.widthCm, art.heightCm, wallLenCm, wallHCm, wallWidthPx, wallHeightPx]
  );

  const frameColor = isDark ? '#D4C5A9' : '#5C4A32';
  const displayW = w * (isPinching ? scaleOffset : 1);
  const displayH = h * (isPinching ? scaleOffset : 1);
  const displayLeft = isPinching ? (baseLeft + w / 2 - displayW / 2) : (baseLeft + dragOffset.x);
  const displayTop = isPinching ? (baseTop + h / 2 - displayH / 2) : (baseTop + dragOffset.y);

  const setWebRef = useCallback((node: any) => {
    webElRef.current = node;
  }, []);

  return (
    <View
      ref={Platform.OS === 'web' ? setWebRef : undefined}
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: displayLeft, top: displayTop,
        width: displayW, height: displayH,
        borderWidth: isSelected ? 3 : 2.5,
        borderColor: (isDragging || isPinching) ? C.gold : (isSelected ? C.gold : frameColor),
        backgroundColor: '#fff', padding: 2,
        shadowColor: '#000', shadowOffset: { width: 1, height: 3 },
        shadowOpacity: isDark ? 0.4 : 0.15, shadowRadius: (isDragging || isPinching) ? 8 : 4,
        zIndex: (isSelected || isDragging || isPinching) ? 10 : 1,
        opacity: isDragging ? 0.85 : 1,
        // @ts-ignore - web cursor
        ...(Platform.OS === 'web' ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}),
      }}
    >
      <Image source={{ uri: art.uri }}
        style={{ width: '100%', height: '100%' }} contentFit="cover" />
      {isDragging && (
        <View style={styles.dragLabel}>
          <Text style={styles.dragLabelText}>
            {Math.round(pxToCm(baseLeft + dragOffset.x + w / 2, wallWidthPx, wallLenCm))}cm
          </Text>
        </View>
      )}
      {isPinching && (
        <View style={styles.dragLabel}>
          <Text style={styles.dragLabelText}>
            {Math.round(art.widthCm * scaleOffset)}×{Math.round(art.heightCm * scaleOffset)}cm
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.fg, letterSpacing: 1 },
  headerDim: { fontSize: 11, color: C.muted, marginTop: 2 },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  closeBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  hint: { fontSize: 11, color: C.gold, letterSpacing: 0.5 },
  wallSurface: { position: 'relative', overflow: 'hidden' },
  dragLabel: {
    position: 'absolute', bottom: -18, left: 0, right: 0,
    alignItems: 'center',
  },
  dragLabelText: {
    fontSize: 9, color: C.gold, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
});
