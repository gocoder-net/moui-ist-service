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
  ceilingColor: string,
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
      color: ceilingColor,
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

  // Edge trim lines where walls meet (corners + floor/ceiling edges)
  buildEdgeTrims(scene, dims);
}

const TRIM_COLOR = '#1A1A1A';
const TRIM_RADIUS = 0.015; // 1.5cm radius

function buildEdgeTrims(scene: THREE.Scene, dims: RoomDimensions) {
  const hw = dims.widthM / 2;
  const hd = dims.depthM / 2;
  const h = dims.heightM;
  const trimMat = new THREE.MeshBasicMaterial({ color: TRIM_COLOR });

  // 4 vertical corner edges (floor to ceiling)
  const vGeo = new THREE.CylinderGeometry(TRIM_RADIUS, TRIM_RADIUS, h, 6);
  const corners = [
    [ hw,  hd],  // NE
    [-hw,  hd],  // NW (actually SE visually)
    [ hw, -hd],  // SW
    [-hw, -hd],  // NW
  ];
  for (const [x, z] of corners) {
    const m = new THREE.Mesh(vGeo, trimMat);
    m.position.set(x, h / 2, z);
    m.name = 'trim_v';
    scene.add(m);
  }

  // Horizontal edges along floor (y=0) and ceiling (y=h)
  // North & South edges (along X axis)
  const nsGeo = new THREE.CylinderGeometry(TRIM_RADIUS, TRIM_RADIUS, dims.widthM, 6);
  nsGeo.rotateZ(Math.PI / 2); // lay along X

  for (const y of [0, h]) {
    for (const z of [-hd, hd]) {
      const m = new THREE.Mesh(nsGeo, trimMat);
      m.position.set(0, y, z);
      m.name = 'trim_h';
      scene.add(m);
    }
  }

  // East & West edges (along Z axis)
  const ewGeo = new THREE.CylinderGeometry(TRIM_RADIUS, TRIM_RADIUS, dims.depthM, 6);
  ewGeo.rotateX(Math.PI / 2); // lay along Z

  for (const y of [0, h]) {
    for (const x of [-hw, hw]) {
      const m = new THREE.Mesh(ewGeo, trimMat);
      m.position.set(x, y, 0);
      m.name = 'trim_h';
      scene.add(m);
    }
  }
}
