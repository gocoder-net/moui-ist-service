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

/** djb2 hash for cache key */
function hashUrl(url: string): number {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return h;
}

function getExt(url: string): string {
  return url.match(/\.(jpe?g|png|webp|gif)/i)?.[0] || '.jpg';
}

/** Native: download → cache → load via expo-three */
export async function loadTextureNative(url: string): Promise<THREE.Texture> {
  const FileSystem = require('expo-file-system').default ?? require('expo-file-system');
  const ExpoTHREE = require('expo-three');
  const { Asset } = require('expo-asset');

  const h = hashUrl(url);
  const ext = getExt(url);
  const type = ext.replace('.', ''); // 'jpg', 'png', etc.
  const localUri = `${FileSystem.cacheDirectory}artwork_${h}${ext}`;

  // Download if not cached
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.size === 0) {
    const result = await FileSystem.downloadAsync(url, localUri);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Download failed: ${result.status}`);
    }
  }

  // Method 1: local file via Asset.fromURI
  try {
    const asset = Asset.fromURI(localUri);
    asset.localUri = localUri;
    asset.type = type;
    asset.downloaded = true;
    asset.name = `artwork_${h}`;
    const tex: THREE.Texture = await ExpoTHREE.loadAsync(asset);
    if (tex?.image) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
  } catch (e: any) {
    console.warn('[texture-loader] local asset failed, trying remote:', e?.message);
  }

  // Method 2: let expo-asset download from remote URL
  try {
    const asset = Asset.fromURI(url);
    asset.type = type;
    await asset.downloadAsync();
    const tex: THREE.Texture = await ExpoTHREE.loadAsync(asset);
    if (tex?.image) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
  } catch (e: any) {
    console.warn('[texture-loader] remote asset failed, trying base64:', e?.message);
  }

  // Method 3: base64 data URI fallback
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = type === 'png' ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64}`;
    const asset = Asset.fromURI(dataUri);
    asset.localUri = dataUri;
    asset.type = type;
    asset.downloaded = true;
    const tex: THREE.Texture = await ExpoTHREE.loadAsync(asset);
    if (tex?.image) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
  } catch (e: any) {
    console.warn('[texture-loader] base64 fallback failed:', e?.message);
  }

  throw new Error('All texture loading methods failed for: ' + url);
}

/** Load with one retry and timeout */
export async function loadTexture(url: string): Promise<THREE.Texture> {
  if (Platform.OS === 'web') return loadTextureWeb(url);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 20s timeout per attempt
      const tex = await Promise.race([
        loadTextureNative(url),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
      ]);
      if (tex.image) return tex;
      throw new Error('empty texture');
    } catch (e: any) {
      console.warn(`[texture-loader] attempt ${attempt + 1} failed:`, e?.message);
      if (attempt === 1) throw new Error('loadTexture failed after retry');
      // Clear cached file before retry
      try {
        const FileSystem = require('expo-file-system').default ?? require('expo-file-system');
        const h = hashUrl(url);
        const ext = getExt(url);
        const localUri = `${FileSystem.cacheDirectory}artwork_${h}${ext}`;
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
  throw new Error('unreachable');
}
