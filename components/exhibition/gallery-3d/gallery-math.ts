import * as THREE from 'three';
import { ROOM_TEMPLATES } from '../room-geometry';
import type { Wall, RoomType, RoomDimensions } from './types';

export function getRoomDimensions(roomType: RoomType): RoomDimensions {
  const t = ROOM_TEMPLATES[roomType];
  return {
    widthM: t.northSouth / 100,
    depthM: t.eastWest / 100,
    heightM: t.height / 100,
  };
}

export function cmToM(cm: number): number {
  return cm / 100;
}

/**
 * Convert wall-relative placement to world position + rotation.
 *
 * positionX is "distance from the left edge when facing the wall from inside."
 * This means:
 *   north: left=west(-X)   → right=east(+X)
 *   south: left=east(+X)   → right=west(-X)   (mirrored on X)
 *   east:  left=north(-Z)  → right=south(+Z)
 *   west:  left=south(+Z)  → right=north(-Z)   (mirrored on Z)
 */
export function placementToWorld(
  wall: Wall,
  posX: number,
  posY: number,
  dims: RoomDimensions,
): { position: THREE.Vector3; rotation: THREE.Euler } {
  const OFFSET = 0.005;
  const y = posY / 100;
  const hw = dims.widthM / 2;
  const hd = dims.depthM / 2;

  switch (wall) {
    case 'north':
      return {
        position: new THREE.Vector3(-hw + posX / 100, y, -hd + OFFSET),
        rotation: new THREE.Euler(0, 0, 0),
      };
    case 'south':
      return {
        position: new THREE.Vector3(hw - posX / 100, y, hd - OFFSET),
        rotation: new THREE.Euler(0, Math.PI, 0),
      };
    case 'east':
      return {
        position: new THREE.Vector3(hw - OFFSET, y, -hd + posX / 100),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      };
    case 'west':
      return {
        position: new THREE.Vector3(-hw + OFFSET, y, hd - posX / 100),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
      };
  }
}

/** Wall/floor/ceiling transforms for room construction. */
export function getWallTransforms(dims: RoomDimensions) {
  const { widthM: w, depthM: d, heightM: h } = dims;
  return {
    north: {
      position: new THREE.Vector3(0, h / 2, -d / 2),
      rotation: new THREE.Euler(0, 0, 0),
      size: [w, h] as [number, number],
    },
    south: {
      position: new THREE.Vector3(0, h / 2, d / 2),
      rotation: new THREE.Euler(0, Math.PI, 0),
      size: [w, h] as [number, number],
    },
    east: {
      position: new THREE.Vector3(w / 2, h / 2, 0),
      rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      size: [d, h] as [number, number],
    },
    west: {
      position: new THREE.Vector3(-w / 2, h / 2, 0),
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      size: [d, h] as [number, number],
    },
    floor: {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      size: [w, d] as [number, number],
    },
    ceiling: {
      position: new THREE.Vector3(0, h, 0),
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      size: [w, d] as [number, number],
    },
  };
}

/** Yaw angle → cardinal direction. yaw=0 faces north (-Z). */
export function yawToDirection(yaw: number): Wall {
  let a = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (a > 7 * Math.PI / 4 || a <= Math.PI / 4) return 'north';
  if (a > Math.PI / 4 && a <= 3 * Math.PI / 4) return 'west';
  if (a > 3 * Math.PI / 4 && a <= 5 * Math.PI / 4) return 'south';
  return 'east';
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
