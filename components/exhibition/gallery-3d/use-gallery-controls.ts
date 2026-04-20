import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { clamp, yawToDirection } from './gallery-math';
import type { RoomDimensions, Wall } from './types';
import type { GestureResponderEvent } from 'react-native';

type Params = {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera>;
  dims: RoomDimensions;
  artworkMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  canvasSize: React.MutableRefObject<{ width: number; height: number }>;
  onArtworkTap?: (placementId: string) => void;
};

export default function useGalleryControls({
  cameraRef, dims, artworkMeshesRef, canvasSize, onArtworkTap,
}: Params) {
  const yawRef = useRef(0);       // 0 = facing north (-Z)
  const pitchRef = useRef(0);
  const moveRef = useRef({ forward: false, backward: false, left: false, right: false });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef(false);

  /* ── Gesture overlay responder callbacks ── */
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, time: Date.now() };
    isDraggingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const dx = pageX - touchStartRef.current.x;
    const dy = pageY - touchStartRef.current.y;

    if (!isDraggingRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      yawRef.current -= dx * 0.004;
      pitchRef.current = clamp(pitchRef.current - dy * 0.004, -Math.PI / 3, Math.PI / 3);
      touchStartRef.current = { ...touchStartRef.current, x: pageX, y: pageY };
    }
  }, []);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (!isDraggingRef.current && Date.now() - touchStartRef.current.time < 300) {
      // Short tap → raycast for artwork selection
      const { locationX, locationY } = e.nativeEvent;
      const { width, height } = canvasSize.current;
      if (width > 0 && height > 0 && cameraRef.current) {
        const ndcX = (locationX / width) * 2 - 1;
        const ndcY = -(locationY / height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);
        const intersects = raycaster.intersectObjects(artworkMeshesRef.current);
        if (intersects.length > 0) {
          const id = intersects[0].object.userData?.placementId;
          if (id) onArtworkTap?.(id);
        }
      }
    }
  }, [onArtworkTap]);

  /* ── HUD button controls ── */
  const setMove = useCallback(
    (dir: 'forward' | 'backward' | 'left' | 'right', pressed: boolean) => {
      moveRef.current[dir] = pressed;
    },
    [],
  );

  /* ── Per-frame camera update (called from animation loop) ── */
  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const speed = 0.045;
    const ms = moveRef.current;
    const sinY = Math.sin(yawRef.current);
    const cosY = Math.cos(yawRef.current);

    if (ms.forward) {
      camera.position.x -= sinY * speed;
      camera.position.z -= cosY * speed;
    }
    if (ms.backward) {
      camera.position.x += sinY * speed;
      camera.position.z += cosY * speed;
    }
    if (ms.left) {
      camera.position.x -= cosY * speed;
      camera.position.z += sinY * speed;
    }
    if (ms.right) {
      camera.position.x += cosY * speed;
      camera.position.z -= sinY * speed;
    }

    // Collision — keep inside room with margin
    const margin = 0.3;
    const hw = dims.widthM / 2;
    const hd = dims.depthM / 2;
    camera.position.x = clamp(camera.position.x, -hw + margin, hw - margin);
    camera.position.z = clamp(camera.position.z, -hd + margin, hd - margin);
    camera.position.y = 1.6; // eye level

    // Apply rotation (YXZ = yaw first, then pitch)
    camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');
  }, [dims]);

  const getDirection = useCallback((): Wall => yawToDirection(yawRef.current), []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    setMove,
    updateCamera,
    getDirection,
    yawRef,
  };
}
