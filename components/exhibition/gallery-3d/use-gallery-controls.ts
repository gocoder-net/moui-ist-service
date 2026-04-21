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
  // Analog joystick input: x = left/right (-1..1), y = forward/backward (-1..1)
  const joystickRef = useRef({ x: 0, y: 0 });
  // Look joystick input: x = yaw, y = pitch (-1..1)
  const lookRef = useRef({ x: 0, y: 0 });
  const speedMultRef = useRef(1);
  const autoNavRef = useRef<{ targetYaw: number; targetX: number; targetZ: number } | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  /* ── Canvas tap for artwork selection ── */
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const dx = Math.abs(pageX - touchStartRef.current.x);
    const dy = Math.abs(pageY - touchStartRef.current.y);
    if (dx < 10 && dy < 10 && Date.now() - touchStartRef.current.time < 300) {
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

  /* ── Joystick input (movement) ── */
  const setJoystick = useCallback((x: number, y: number) => {
    joystickRef.current = { x, y };
  }, []);

  /* ── Look joystick input (camera rotation) ── */
  const setLook = useCallback((x: number, y: number) => {
    lookRef.current = { x, y };
  }, []);

  /* ── Speed control ── */
  const setSpeedMult = useCallback((m: number) => { speedMultRef.current = m; }, []);

  /* ── Auto-navigate to wall ── */
  const navigateToWall = useCallback((wall: Wall) => {
    const hw = dims.widthM / 2;
    const hd = dims.depthM / 2;
    const offset = 0.5; // distance from wall
    const targets: Record<Wall, { yaw: number; x: number; z: number }> = {
      north: { yaw: 0,            x: 0, z:  hd - offset },  // face -Z
      south: { yaw: Math.PI,      x: 0, z: -hd + offset },  // face +Z
      east:  { yaw: -Math.PI / 2, x: -hw + offset, z: 0 },  // face +X
      west:  { yaw: Math.PI / 2,  x:  hw - offset, z: 0 },  // face -X
    };
    autoNavRef.current = {
      targetYaw: targets[wall].yaw,
      targetX: targets[wall].x,
      targetZ: targets[wall].z,
    };
  }, [dims]);

  /* ── Per-frame camera update (called from animation loop) ── */
  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    // Auto-navigate animation
    const nav = autoNavRef.current;
    if (nav) {
      // Smooth yaw rotation
      let yawDiff = nav.targetYaw - yawRef.current;
      // Normalize to [-PI, PI]
      while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
      while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
      yawRef.current += yawDiff * 0.08;
      pitchRef.current *= 0.9; // level out pitch

      // Smooth position
      const dx = nav.targetX - camera.position.x;
      const dz = nav.targetZ - camera.position.z;
      camera.position.x += dx * 0.05;
      camera.position.z += dz * 0.05;

      // Done when close enough
      if (Math.abs(yawDiff) < 0.01 && Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
        yawRef.current = nav.targetYaw;
        camera.position.x = nav.targetX;
        camera.position.z = nav.targetZ;
        autoNavRef.current = null;
      }
    }

    // Look joystick → yaw/pitch
    const { x: lx, y: ly } = lookRef.current;
    const lookMag = Math.sqrt(lx * lx + ly * ly);
    if (lookMag > 0.05) {
      autoNavRef.current = null;
      yawRef.current -= lx * 0.04;
      pitchRef.current = clamp(pitchRef.current - ly * 0.03, -Math.PI / 3, Math.PI / 3);
    }

    // Movement joystick
    const maxSpeed = 0.06 * speedMultRef.current;
    const { x: jx, y: jy } = joystickRef.current;
    const mag = Math.min(Math.sqrt(jx * jx + jy * jy), 1);
    if (mag > 0.05) {
      autoNavRef.current = null;
      const speed = maxSpeed * mag;
      const sinY = Math.sin(yawRef.current);
      const cosY = Math.cos(yawRef.current);
      camera.position.x += (jy * sinY + jx * cosY) * speed;
      camera.position.z += (jy * cosY - jx * sinY) * speed;
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
    onTouchEnd,
    setJoystick,
    setLook,
    setSpeedMult,
    navigateToWall,
    updateCamera,
    getDirection,
    yawRef,
  };
}
