import { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import {
  type Wall, type RoomType, type PlacedArtwork, type WallImages,
  ROOM_TEMPLATES, WALL_LABELS, cmToPx,
} from './room-geometry';

const C = {
  gold: '#C8A96E', muted: '#6B6B7B', mutedLight: '#4A4A58', border: '#1E1F2E',
  fg: '#EEEEF0', white: '#EEEEF0',
};

type Props = {
  roomType: RoomType;
  wallColors: Record<Wall, string>;
  wallImages?: WallImages;
  floorColor?: string;
  artworks: PlacedArtwork[];
  selectedWall: Wall | null;
  onWallSelect: (wall: Wall) => void;
  viewerMode?: boolean;
  onArtworkSelect?: (art: PlacedArtwork) => void;
};

/**
 * 전시관을 "펼친 도면"으로 보여주는 뷰.
 * 가운데 바닥(평면도) + 4면 벽이 접혀 펼쳐진 형태.
 * 각 벽면에 작품 썸네일이 보이고, 벽을 터치하면 선택됨.
 */
export default function Room3DView({
  roomType, wallColors, wallImages, floorColor, artworks, selectedWall, onWallSelect,
  viewerMode, onArtworkSelect,
}: Props) {
  const room = ROOM_TEMPLATES[roomType];

  // 비율 기반 크기 (최대 280px)
  const maxDim = Math.max(room.northSouth, room.eastWest);
  const scale = 220 / maxDim;
  const floorW = room.northSouth * scale;
  const floorH = room.eastWest * scale;
  const wallH = 50; // 벽 높이 (접힌 형태에서)

  const getWallArtworks = (wall: Wall) => artworks.filter(a => a.wall === wall);

  const renderThumbs = (wall: Wall, faceW: number) => {
    const isVertical = wall === 'east' || wall === 'west';
    const wallLen = isVertical ? room.eastWest : room.northSouth;
    return getWallArtworks(wall).map(art => {
      const artSize = Math.max(cmToPx(art.widthCm, wallLen, faceW), 8);
      const artPos = cmToPx(art.positionX, wallLen, faceW) - artSize / 2;
      return (
        <Pressable
          key={art.localId}
          onPress={() => viewerMode && onArtworkSelect?.(art)}
          style={isVertical ? {
            position: 'absolute',
            top: artPos, left: (wallH - 16) / 2,
            height: artSize, width: 16,
            backgroundColor: '#fff',
            borderWidth: 1, borderColor: '#8B7355',
            borderRadius: 1, overflow: 'hidden',
          } : {
            position: 'absolute',
            left: artPos, top: (wallH - 16) / 2,
            width: artSize, height: 16,
            backgroundColor: '#fff',
            borderWidth: 1, borderColor: '#8B7355',
            borderRadius: 1, overflow: 'hidden',
          }}
        >
          <Image source={{ uri: art.uri }}
            style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </Pressable>
      );
    });
  };

  const wallPress = (wall: Wall) => () => onWallSelect(wall);
  const isDark = (c: string) => ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'].includes(c);
  const labelColor = (c: string) => isDark(c) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.25)';

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>벽면을 터치해서 선택하세요</Text>

      <View style={styles.unfolded}>
        {/* 북쪽 벽 (위에 접힌) */}
        <Pressable onPress={wallPress('north')} style={[styles.wallH, {
          width: floorW, height: wallH,
          backgroundColor: wallColors.north,
          borderWidth: selectedWall === 'north' ? 2 : 1,
          borderColor: selectedWall === 'north' ? C.gold : C.border,
          borderBottomWidth: 0,
        }]}>
          {wallImages?.north?.url && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: wallImages.north.url }} style={{ width: '100%', height: '100%' }}
                contentFit="cover" />
            </View>
          )}
          {renderThumbs('north', floorW)}
          <Text style={[styles.wallText, { color: labelColor(wallColors.north) }]}>
            북 ({getWallArtworks('north').length})
          </Text>
        </Pressable>

        {/* 중간 행: 서 + 바닥 + 동 */}
        <View style={styles.middleRow}>
          {/* 서쪽 벽 */}
          <Pressable onPress={wallPress('west')} style={[styles.wallV, {
            width: wallH, height: floorH,
            backgroundColor: wallColors.west,
            borderWidth: selectedWall === 'west' ? 2 : 1,
            borderColor: selectedWall === 'west' ? C.gold : C.border,
            borderRightWidth: 0,
          }]}>
            {wallImages?.west?.url && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image source={{ uri: wallImages.west.url }} style={{ width: '100%', height: '100%' }}
                  contentFit="cover" />
              </View>
            )}
            {renderThumbs('west', floorH)}
            <Text style={[styles.wallText, { color: labelColor(wallColors.west), transform: [{ rotate: '-90deg' }] }]}>
              서 ({getWallArtworks('west').length})
            </Text>
          </Pressable>

          {/* 바닥 (평면도) */}
          <View style={[styles.floor, { width: floorW, height: floorH, backgroundColor: floorColor || '#F5F0E6' }]}>
            <Text style={styles.floorLabel}>{room.label}</Text>
            <Text style={styles.floorDim}>
              {(room.northSouth / 100)}m × {(room.eastWest / 100)}m
            </Text>
            {/* 입구 표시 */}
            <View style={styles.entranceMark}>
              <Text style={styles.entranceText}>▽ 입구</Text>
            </View>
          </View>

          {/* 동쪽 벽 */}
          <Pressable onPress={wallPress('east')} style={[styles.wallV, {
            width: wallH, height: floorH,
            backgroundColor: wallColors.east,
            borderWidth: selectedWall === 'east' ? 2 : 1,
            borderColor: selectedWall === 'east' ? C.gold : C.border,
            borderLeftWidth: 0,
          }]}>
            {wallImages?.east?.url && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image source={{ uri: wallImages.east.url }} style={{ width: '100%', height: '100%' }}
                  contentFit="cover" />
              </View>
            )}
            {renderThumbs('east', floorH)}
            <Text style={[styles.wallText, { color: labelColor(wallColors.east), transform: [{ rotate: '90deg' }] }]}>
              동 ({getWallArtworks('east').length})
            </Text>
          </Pressable>
        </View>

        {/* 남쪽 벽 (아래에 접힌) */}
        <Pressable onPress={wallPress('south')} style={[styles.wallH, {
          width: floorW, height: wallH,
          backgroundColor: wallColors.south,
          borderWidth: selectedWall === 'south' ? 2 : 1,
          borderColor: selectedWall === 'south' ? C.gold : C.border,
          borderTopWidth: 0,
        }]}>
          {wallImages?.south?.url && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: wallImages.south.url }} style={{ width: '100%', height: '100%' }}
                contentFit="cover" />
            </View>
          )}
          {renderThumbs('south', floorW)}
          <Text style={[styles.wallText, { color: labelColor(wallColors.south) }]}>
            남 · 입구 ({getWallArtworks('south').length})
          </Text>
        </Pressable>
      </View>

      {/* 총 작품 수 */}
      <Text style={styles.totalCount}>총 {artworks.length}점 배치됨</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  hint: { fontSize: 11, color: C.muted, letterSpacing: 1 },

  unfolded: { alignItems: 'center' },
  middleRow: { flexDirection: 'row' },

  floor: {
    backgroundColor: '#F5F0E6', borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  floorLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  floorDim: { fontSize: 9, color: C.mutedLight, marginTop: 2 },
  entranceMark: { position: 'absolute', bottom: 4 },
  entranceText: { fontSize: 8, color: C.gold, fontWeight: '700' },

  wallH: {
    position: 'relative', overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 2,
  },
  wallV: {
    position: 'relative', overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 2,
  },
  wallText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  totalCount: { fontSize: 11, color: C.muted },
});
