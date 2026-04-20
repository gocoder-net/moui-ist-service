import * as THREE from 'three';
import { placementToWorld } from './gallery-math';
import type { Placement3D, RoomDimensions } from './types';

/**
 * Build gallery lighting and add to scene.
 * - Soft ambient fill
 * - Directional light from ceiling
 * - Per-artwork spotlights for that gallery feel
 */
export function buildLighting(
  scene: THREE.Scene,
  placements: Placement3D[],
  dims: RoomDimensions,
): void {
  // Ambient fill
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // Main directional from ceiling-center
  const dir = new THREE.DirectionalLight(0xfff8e7, 0.4);
  dir.position.set(0, dims.heightM - 0.1, 0);
  scene.add(dir);

  // Hemisphere light for natural feel (sky=warm white, ground=warm brown)
  const hemi = new THREE.HemisphereLight(0xfff8e7, 0x8B7355, 0.25);
  scene.add(hemi);

  // Per-artwork spotlights (max 12 to limit GPU load)
  const maxSpots = 12;
  const step = Math.max(1, Math.ceil(placements.length / maxSpots));

  for (let i = 0; i < placements.length; i += step) {
    const p = placements[i];
    const { position } = placementToWorld(p.wall, p.position_x, p.position_y, dims);

    const spot = new THREE.SpotLight(0xfff8e7, 1.2, dims.heightM * 2, Math.PI / 6, 0.5, 1);
    // Position light above and slightly in front of the artwork (toward room center)
    const lightPos = position.clone();
    lightPos.y = dims.heightM - 0.15;
    // Pull toward room center
    lightPos.x *= 0.7;
    lightPos.z *= 0.7;
    spot.position.copy(lightPos);
    spot.target.position.copy(position);

    scene.add(spot);
    scene.add(spot.target);
  }
}
