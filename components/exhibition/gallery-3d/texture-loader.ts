import * as THREE from 'three';
import { Platform } from 'react-native';

/** Web: straightforward TextureLoader */
export function loadTextureWeb(url: string): Promise<THREE.Texture> {
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
export async function loadTextureNative(url: string): Promise<THREE.Texture> {
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
export async function loadTexture(url: string): Promise<THREE.Texture> {
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
