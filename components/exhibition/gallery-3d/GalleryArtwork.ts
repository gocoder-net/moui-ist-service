import * as THREE from 'three';
import { Platform } from 'react-native';
import { placementToWorld, cmToM } from './gallery-math';
import { loadTexture } from './texture-loader';
import type { Placement3D, RoomDimensions } from './types';

const DARK_WALLS = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'];

function isDarkWall(color: string): boolean {
  return DARK_WALLS.includes(color);
}

/**
 * Build artwork meshes (image plane + frame) and add to scene.
 * Returns the image plane meshes (for raycasting).
 * Each mesh.userData stores { placementId }.
 *
 * Textures load sequentially on native to avoid overloading
 * the network/GL context on Android APK.
 */
export async function buildArtworks(
  scene: THREE.Scene,
  placements: Placement3D[],
  dims: RoomDimensions,
  wallColors: Record<string, string>,
): Promise<THREE.Mesh[]> {
  const artworkMeshes: THREE.Mesh[] = [];

  // Build all meshes first (with placeholder material), add to scene
  const entries = placements.map((p) => {
    const wM = cmToM(p.width_cm);
    const hM = cmToM(p.height_cm);
    const { position, rotation } = placementToWorld(
      p.wall, p.position_x, p.position_y, dims,
    );
    const wallColor = wallColors[p.wall] || '#F5F5F0';
    const dark = isDarkWall(wallColor);
    const frameColor = dark ? '#D4C5A9' : '#5C4A32';
    const frameWidth = 0.025;

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.copy(rotation);

    // Frame
    const frameGeo = new THREE.BoxGeometry(wM + frameWidth * 2, hM + frameWidth * 2, 0.03);
    const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.1 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.01;
    group.add(frameMesh);

    // White mat
    const matGeo = new THREE.PlaneGeometry(wM + 0.01, hM + 0.01);
    const matMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const matMesh = new THREE.Mesh(matGeo, matMat);
    matMesh.position.z = 0.005;
    group.add(matMesh);

    // Image plane — start with white placeholder
    const imgGeo = new THREE.PlaneGeometry(wM, hM);
    const imgMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const imgMesh = new THREE.Mesh(imgGeo, imgMat);
    imgMesh.position.z = 0.01;
    imgMesh.userData = { placementId: p.id };
    imgMesh.name = `artwork_${p.id}`;
    group.add(imgMesh);

    scene.add(group);
    artworkMeshes.push(imgMesh);

    return { imgMesh, url: p.artwork.image_url };
  });

  // Load textures — sequential on native, parallel on web
  if (Platform.OS === 'web') {
    await Promise.allSettled(entries.map(async ({ imgMesh, url }) => {
      try {
        const tex = await loadTexture(url);
        imgMesh.material = new THREE.MeshBasicMaterial({ map: tex });
      } catch (e: any) {
        console.warn('[GalleryArtwork] texture load failed:', url, e?.message);
      }
    }));
  } else {
    // Sequential: one at a time to avoid Android overload
    for (const { imgMesh, url } of entries) {
      try {
        const tex = await loadTexture(url);
        imgMesh.material = new THREE.MeshBasicMaterial({ map: tex });
      } catch (e: any) {
        console.warn('[GalleryArtwork] texture load failed:', url, e?.message);
      }
    }
  }

  return artworkMeshes;
}
