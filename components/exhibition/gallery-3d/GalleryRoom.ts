import * as THREE from 'three';
import { getWallTransforms } from './gallery-math';
import type { RoomDimensions, WallColors } from './types';

/**
 * Build room walls, floor, and ceiling and add them to the scene.
 * Walls use MeshStandardMaterial with the exhibition's wall colors.
 */
export function buildRoom(
  scene: THREE.Scene,
  dims: RoomDimensions,
  wallColors: WallColors,
  floorColor: string,
): void {
  const transforms = getWallTransforms(dims);
  const walls: Array<{ key: keyof typeof transforms; color: string }> = [
    { key: 'north', color: wallColors.north },
    { key: 'south', color: wallColors.south },
    { key: 'east', color: wallColors.east },
    { key: 'west', color: wallColors.west },
  ];

  for (const { key, color } of walls) {
    const t = transforms[key];
    const geo = new THREE.PlaneGeometry(t.size[0], t.size[1]);
    const mat = new THREE.MeshStandardMaterial({
      color,
      side: THREE.FrontSide,
      roughness: 0.9,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(t.position);
    mesh.rotation.copy(t.rotation);
    mesh.name = `wall_${key}`;
    scene.add(mesh);
  }

  // Floor
  {
    const t = transforms.floor;
    const geo = new THREE.PlaneGeometry(t.size[0], t.size[1]);
    const mat = new THREE.MeshStandardMaterial({
      color: floorColor,
      side: THREE.FrontSide,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(t.position);
    mesh.rotation.copy(t.rotation);
    mesh.name = 'floor';
    scene.add(mesh);
  }

  // Ceiling
  {
    const t = transforms.ceiling;
    const geo = new THREE.PlaneGeometry(t.size[0], t.size[1]);
    const mat = new THREE.MeshStandardMaterial({
      color: '#f5f5f0',
      side: THREE.FrontSide,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(t.position);
    mesh.rotation.copy(t.rotation);
    mesh.name = 'ceiling';
    scene.add(mesh);
  }
}
