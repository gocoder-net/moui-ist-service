import type { Wall, RoomType, WallImageMode, WallImageInfo, WallImages } from '../room-geometry';

export type { Wall, RoomType, WallImageMode, WallImageInfo, WallImages };

export type RoomDimensions = {
  widthM: number;   // meters (northSouth / 100) — X axis extent
  depthM: number;   // meters (eastWest / 100)  — Z axis extent
  heightM: number;  // meters (height / 100)    — Y axis extent
};

export type WallColors = Record<Wall, string>;

export type Placement3D = {
  id: string;
  wall: Wall;
  position_x: number;
  position_y: number;
  width_cm: number;
  height_cm: number;
  artwork: {
    id: string;
    title: string;
    description: string | null;
    image_url: string;
    year?: number | null;
    medium?: string | null;
    width_cm?: number | null;
    height_cm?: number | null;
    edition?: string | null;
    image_top_url?: string | null;
    image_bottom_url?: string | null;
    image_left_url?: string | null;
    image_right_url?: string | null;
  };
};

export type GallerySceneProps = {
  roomType: RoomType;
  wallColors: WallColors;
  wallImages?: WallImages;
  floorColor: string;
  ceilingColor: string;
  placements: Placement3D[];
  onClose: () => void;
  // Intro overlay
  title?: string;
  foreword?: string | null;
  posterUrl?: string | null;
  // BGM
  bgmUrl?: string | null;
};
