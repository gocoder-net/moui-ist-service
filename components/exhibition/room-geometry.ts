export type Wall = 'north' | 'south' | 'east' | 'west';
export type RoomType = 'small' | 'medium' | 'large' | 'wide';

export const WALL_LABELS: Record<Wall, string> = {
  north: '북쪽 벽',
  south: '남쪽 벽',
  east: '동쪽 벽',
  west: '서쪽 벽',
};

// 전시관 타입별 실제 크기 (cm)
// northSouth = 북남 벽 길이 (가로), eastWest = 동서 벽 길이 (세로), height = 천장 높이
export const ROOM_TEMPLATES: Record<RoomType, {
  label: string;
  desc: string;
  northSouth: number;
  eastWest: number;
  height: number;
}> = {
  small:  { label: '소형 전시관', desc: '아늑한 개인전', northSouth: 600, eastWest: 400, height: 300 },
  medium: { label: '중형 전시관', desc: '일반적인 기획전', northSouth: 1000, eastWest: 700, height: 350 },
  large:  { label: '대형 전시관', desc: '대규모 그룹전', northSouth: 1500, eastWest: 1000, height: 400 },
  wide:   { label: '와이드 전시관', desc: '파노라마형 전시', northSouth: 2000, eastWest: 800, height: 350 },
};

/** 벽의 길이 (cm) */
export function getWallLength(roomType: RoomType, wall: Wall): number {
  const room = ROOM_TEMPLATES[roomType];
  return (wall === 'north' || wall === 'south') ? room.northSouth : room.eastWest;
}

/** 벽(천장) 높이 (cm) */
export function getWallHeight(roomType: RoomType): number {
  return ROOM_TEMPLATES[roomType].height;
}

/** cm → px 변환 */
export function cmToPx(cm: number, totalCm: number, totalPx: number): number {
  return (cm / totalCm) * totalPx;
}

/** px → cm 변환 */
export function pxToCm(px: number, totalPx: number, totalCm: number): number {
  return (px / totalPx) * totalCm;
}

export type PlacedArtwork = {
  localId: string;
  uri: string;
  title: string;
  wall: Wall;
  positionX: number;   // cm from left edge of wall (center of artwork)
  positionY: number;   // cm from floor (center of artwork)
  widthCm: number;
  heightCm: number;
  topUri?: string;
  bottomUri?: string;
  leftUri?: string;
  rightUri?: string;
};
