import * as THREE from 'three';
import { Platform } from 'react-native';
import { placementToWorld, cmToM } from './gallery-math';
import type { Placement3D, RoomDimensions } from './types';

const DARK_WALLS = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'];

function isDarkWall(color: string): boolean {
  return DARK_WALLS.includes(color);
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  if (Platform.OS === 'web') {
    return new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        reject,
      );
    });
  }
  // Native: download image first, then load as texture
  // (expo-three loadAsync with raw URL fails on Android APK)
  const { Asset } = require('expo-asset');
  const asset = Asset.fromURI(url);
  await asset.downloadAsync();

  const ExpoTHREE = require('expo-three');
  const tex: THREE.Texture = await ExpoTHREE.loadAsync(asset);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build artwork meshes (image plane + frame) and add to scene.
 * Returns the image plane meshes (for raycasting).
 * Each mesh.userData stores { placementId }.
 */
export async function buildArtworks(
  scene: THREE.Scene,
  placements: Placement3D[],
  dims: RoomDimensions,
  wallColors: Record<string, string>,
): Promise<THREE.Mesh[]> {
  const artworkMeshes: THREE.Mesh[] = [];

  const tasks = placements.map(async (p) => {
    const wM = cmToM(p.width_cm);
    const hM = cmToM(p.height_cm);
    const { position, rotation } = placementToWorld(
      p.wall, p.position_x, p.position_y, dims,
    );
    const wallColor = wallColors[p.wall] || '#F5F5F0';
    const dark = isDarkWall(wallColor);
    const frameColor = dark ? '#D4C5A9' : '#5C4A32';
    const frameWidth = 0.025; // 2.5cm frame

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.copy(rotation);

    // Frame (slightly larger plane behind the canvas)
    const frameGeo = new THREE.BoxGeometry(
      wM + frameWidth * 2,
      hM + frameWidth * 2,
      0.03,
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.6,
      metalness: 0.1,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.01; // behind image
    group.add(frameMesh);

    // White mat/backing
    const matGeo = new THREE.PlaneGeometry(wM + 0.01, hM + 0.01);
    const matMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const matMesh = new THREE.Mesh(matGeo, matMat);
    matMesh.position.z = 0.005;
    group.add(matMesh);

    // Image plane
    const imgGeo = new THREE.PlaneGeometry(wM, hM);
    let imgMat: THREE.Material;
    try {
      const texture = await loadTexture(p.artwork.image_url);
      imgMat = new THREE.MeshBasicMaterial({ map: texture });
    } catch {
      // Fallback: gray placeholder
      imgMat = new THREE.MeshStandardMaterial({ color: '#cccccc' });
    }
    const imgMesh = new THREE.Mesh(imgGeo, imgMat);
    imgMesh.position.z = 0.01; // in front of mat
    imgMesh.userData = { placementId: p.id };
    imgMesh.name = `artwork_${p.id}`;
    group.add(imgMesh);

    scene.add(group);
    artworkMeshes.push(imgMesh);
  });

  await Promise.allSettled(tasks);
  return artworkMeshes;
}
