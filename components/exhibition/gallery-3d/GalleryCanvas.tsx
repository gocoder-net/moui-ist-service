import { useRef, useEffect, useCallback } from 'react';
import { View, Platform, StyleSheet, type LayoutChangeEvent } from 'react-native';
import * as THREE from 'three';

export type CanvasHandle = {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  /** Call after renderer.render() on native to flush frame */
  endFrame?: () => void;
};

type Props = {
  onReady: (handle: CanvasHandle) => void;
  style?: any;
};

export default function GalleryCanvas(props: Props) {
  if (Platform.OS === 'web') return <WebCanvas {...props} />;
  return <NativeCanvas {...props} />;
}

/* ── Web: append <canvas> to View DOM node ── */
function WebCanvas({ onReady, style }: Props) {
  const viewRef = useRef<View>(null);
  const readyCalledRef = useRef(false);

  useEffect(() => {
    const node = viewRef.current as unknown as HTMLDivElement;
    if (!node || readyCalledRef.current) return;

    // Wait a tick for layout
    const timer = setTimeout(() => {
      const rect = node.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      if (w === 0 || h === 0) return;

      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      node.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      readyCalledRef.current = true;
      onReady({ renderer, width: w, height: h });

      const handleResize = () => {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          renderer.setSize(r.width, r.height);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  return <View ref={viewRef} style={[styles.canvas, style]} />;
}

/* ── Native: expo-gl GLView ── */
function NativeCanvas({ onReady, style }: Props) {
  const readyCalledRef = useRef(false);

  const handleContextCreate = useCallback(async (gl: any) => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;

    const { Renderer } = require('expo-three');
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    onReady({
      renderer,
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      endFrame: () => gl.endFrameEXP(),
    });
  }, []);

  const { GLView } = require('expo-gl');
  return <GLView style={[styles.canvas, style]} onContextCreate={handleContextCreate} />;
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
