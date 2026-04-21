import * as THREE from 'three';
import { Platform } from 'react-native';
import { placementToWorld, cmToM } from './gallery-math';
import type { Placement3D, RoomDimensions } from './types';

const DARK_WALLS = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'];

function isDarkWall(color: string): boolean {
  return DARK_WALLS.includes(color);
}

/* ── Texture loading ── */

/** Web: straightforward TextureLoader */
function loadTextureWeb(url: string): Promise<THREE.Texture> {
  return new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      reject,
    );
  });
}

/** Native: download to local file, then load as texture */
async function loadTextureNative(url: string): Promise<THREE.Texture> {
  const FileSystem = require('expo-file-system').default ?? require('expo-file-system');
  const ExpoTHREE = require('expo-three');

  // Unique local path per URL (hash via simple djb2)
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  const ext = url.match(/\.(jpe?g|png|webp|gif)/i)?.[0] || '.jpg';
  const localUri = `${FileSystem.cacheDirectory}artwork_${h}${ext}`;

  // Check if already cached
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.size === 0) {
    const result = await FileSystem.downloadAsync(url, localUri);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Download failed: ${result.status}`);
    }
  }

  // Load from local file via expo-asset → expo-three
  const { Asset } = require('expo-asset');
  const asset = Asset.fromURI(localUri);
  asset.localUri = localUri;  // skip downloadAsync — file is already local
  const tex: THREE.Texture = await ExpoTHREE.loadAsync(asset);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Load with one retry and timeout */
async function loadTexture(url: string): Promise<THREE.Texture> {
  if (Platform.OS === 'web') return loadTextureWeb(url);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 15s timeout per attempt
      const tex = await Promise.race([
        loadTextureNative(url),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      // Sanity check — texture should have image data
      if (tex.image) return tex;
      throw new Error('empty texture');
    } catch {
      if (attempt === 1) throw new Error('loadTexture failed after retry');
      // Clear cached file before retry
      try {
        const FileSystem = require('expo-file-system').default ?? require('expo-file-system');
        let h = 5381;
        for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
        const ext = url.match(/\.(jpe?g|png|webp|gif)/i)?.[0] || '.jpg';
        const localUri = `${FileSystem.cacheDirectory}artwork_${h}${ext}`;
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
  throw new Error('unreachable');
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
      } catch { /* keep white placeholder */ }
    }));
  } else {
    // Sequential: one at a time to avoid Android overload
    for (const { imgMesh, url } of entries) {
      try {
        const tex = await loadTexture(url);
        imgMesh.material = new THREE.MeshBasicMaterial({ map: tex });
      } catch { /* keep white placeholder */ }
    }
  }

  return artworkMeshes;
}
