import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import * as THREE from 'three';
import { Image } from 'expo-image';
import GalleryCanvas, { type CanvasHandle } from './GalleryCanvas';
import { getRoomDimensions } from './gallery-math';
import { buildRoom } from './GalleryRoom';
import { buildArtworks } from './GalleryArtwork';
import { buildLighting } from './GalleryLighting';
import useGalleryControls from './use-gallery-controls';
import { WALL_LABELS } from '../room-geometry';
import type { GallerySceneProps, Placement3D, Wall, RoomDimensions } from './types';

const C = {
  bg: '#0A0A0A', fg: '#FFFFFF', gold: '#C8A96E',
  muted: '#888', mutedDark: '#444', border: '#222',
};

const DARK_WALLS = ['#333333', '#1B2A4A', '#4A1B2A', '#1B3A2A'];
const WALL_ORDER: Wall[] = ['north', 'east', 'south', 'west'];
const DIR_LABELS: Record<Wall, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };

type ViewAngle = 'front' | 'top' | 'bottom' | 'left' | 'right';

export default function GalleryScene({
  roomType, wallColors, floorColor, ceilingColor, placements, onClose,
  title, foreword, posterUrl,
}: GallerySceneProps) {
  const dims = useMemo(() => getRoomDimensions(roomType), [roomType]);
  const { width: sw } = useWindowDimensions();

  // Three.js refs
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(
    (() => {
      const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      cam.position.set(0, 1.6, 0);
      cam.rotation.set(0, 0, 0, 'YXZ');
      return cam;
    })(),
  );
  const handleRef = useRef<CanvasHandle | null>(null);
  const animRef = useRef(0);
  const artworkMeshesRef = useRef<THREE.Mesh[]>([]);
  const canvasSizeRef = useRef({ width: 1, height: 1 });

  // HUD state
  const [currentDir, setCurrentDir] = useState<Wall>('north');
  const lastDirRef = useRef<Wall>('north');

  // Intro: doors open → null
  const [introPhase, setIntroPhase] = useState<'doors' | null>('doors');
  const [sceneReady, setSceneReady] = useState(false);
  const doorStartRef = useRef(0);

  // Artwork detail overlay state
  const [selectedPlacement, setSelectedPlacement] = useState<Placement3D | null>(null);
  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');
  const pausedRef = useRef(false);

  const handleArtworkTap = useCallback((placementId: string) => {
    const found = placements.find((p) => p.id === placementId);
    if (found) {
      pausedRef.current = true;
      setSelectedPlacement(found);
      setViewAngle('front');
    }
  }, [placements]);

  const controls = useGalleryControls({
    cameraRef,
    dims,
    artworkMeshesRef,
    canvasSize: canvasSizeRef,
    onArtworkTap: handleArtworkTap,
  });

  // Pause camera & reset inputs when viewing artwork detail
  useEffect(() => {
    if (selectedPlacement) {
      controls.setJoystick(0, 0);
      controls.setLook(0, 0);
    } else {
      pausedRef.current = false;
    }
  }, [selectedPlacement]);

  const handleReady = useCallback((handle: CanvasHandle) => {
    handleRef.current = handle;
    canvasSizeRef.current = { width: handle.width, height: handle.height };

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    camera.aspect = handle.width / handle.height;
    camera.updateProjectionMatrix();

    // Start camera at entrance (outside south wall, looking north)
    const startZ = dims.depthM / 2 + 0.5;
    camera.position.set(0, 1.6, startZ);
    camera.rotation.set(0, 0, 0, 'YXZ');

    scene.background = new THREE.Color(C.bg);

    buildRoom(scene, dims, wallColors, floorColor, ceilingColor);
    buildLighting(scene, placements, dims);
    buildArtworks(scene, placements, dims, wallColors).then((meshes) => {
      artworkMeshesRef.current = meshes;
    });

    setSceneReady(true);

    const WALK_START = 800;
    const WALK_DUR = 2000;
    const INTRO_END = 3200;

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);

      // Door opening + camera walk-in
      if (doorStartRef.current > 0) {
        const elapsed = Date.now() - doorStartRef.current;
        if (elapsed < INTRO_END) {
          const t = Math.max(0, Math.min((elapsed - WALK_START) / WALK_DUR, 1));
          const ease = 1 - Math.pow(1 - t, 3);
          camera.position.set(0, 1.6, startZ * (1 - ease));
          camera.rotation.set(0, 0, 0, 'YXZ');
        } else {
          if (!pausedRef.current) controls.updateCamera();
        }
      }

      const dir = controls.getDirection();
      if (dir !== lastDirRef.current) {
        lastDirRef.current = dir;
        setCurrentDir(dir);
      }

      handle.renderer.render(scene, camera);
      handle.endFrame?.();
    };
    animate();
  }, [dims, wallColors, floorColor, ceilingColor, placements]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      const scene = sceneRef.current;
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      handleRef.current?.renderer.dispose();
    };
  }, []);

  // Start door animation when scene is ready
  useEffect(() => {
    if (sceneReady && introPhase === 'doors') {
      doorStartRef.current = Date.now();
      const timer = setTimeout(() => setIntroPhase(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [sceneReady]);

  const artCountOnWall = useMemo(
    () => placements.filter((p) => p.wall === currentDir).length,
    [placements, currentDir],
  );

  // Precompute detail info (avoids IIFE in JSX)
  const detailInfo = useMemo(() => {
    if (!selectedPlacement) return null;
    const art = selectedPlacement.artwork;
    const wc = wallColors[selectedPlacement.wall];
    const isDark = DARK_WALLS.includes(wc);
    const imgW = sw - 64;
    return {
      art, wc, isDark,
      frameColor: isDark ? '#D4C5A9' : '#5C4A32',
      imgW,
      imgH: imgW * (selectedPlacement.height_cm / selectedPlacement.width_cm),
      angles: {
        front: art.image_url, top: art.image_top_url,
        bottom: art.image_bottom_url, left: art.image_left_url, right: art.image_right_url,
      } as Record<ViewAngle, string | null | undefined>,
    };
  }, [selectedPlacement, wallColors, sw]);

  const currentDetailImg = detailInfo
    ? (detailInfo.angles[viewAngle] || detailInfo.art.image_url)
    : null;

  // ── Render (canvas always mounted) ──
  return (
    <View style={styles.root}>
      <View style={styles.canvasArea}>
        <GalleryCanvas onReady={handleReady} style={StyleSheet.absoluteFill} />
        {/* Touch overlay for drag-to-look — disabled during detail */}
        {!selectedPlacement && (
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={controls.onTouchStart}
            onResponderMove={controls.onTouchMove}
            onResponderRelease={controls.onTouchEnd}
          />
        )}
        {/* Minimap overlay */}
        {!introPhase && !selectedPlacement && (
          <View style={styles.minimapWrap} pointerEvents="none">
            <Minimap
              cameraRef={cameraRef}
              yawRef={controls.yawRef}
              dims={dims}
              wallColors={{ north: wallColors.north, south: wallColors.south,
                east: wallColors.east, west: wallColors.west }}
              placements={placements}
            />
          </View>
        )}
      </View>

      {/* HUD — hidden during intro & detail */}
      {!introPhase && !selectedPlacement && (
        <View style={styles.hud}>
          <View style={styles.hudTop}>
            <View style={styles.compass}>
              {WALL_ORDER.map((w) => (
                <Pressable
                  key={w}
                  style={[styles.compassItem, w === currentDir && styles.compassItemActive]}
                  onPress={() => controls.navigateToWall(w)}
                >
                  <Text style={[styles.compassText, w === currentDir && styles.compassTextActive]}>
                    {DIR_LABELS[w]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.dirLabel}>{WALL_LABELS[currentDir]}</Text>
          <Text style={styles.dirSub}>작품 {artCountOnWall}점</Text>

          <View style={styles.hudBottom}>
            <Joystick setJoystick={controls.setJoystick} label="이동" />
            <View style={styles.hudCenter}>
              <SpeedControl onChange={controls.setSpeedMult} label="이동속도" />
              <SpeedControl onChange={controls.setLookSpeed} label="시선속도" />
            </View>
            <Joystick setJoystick={controls.setLook} label="시선" />
          </View>

          <Pressable style={styles.exitBtn} onPress={onClose}>
            <Text style={styles.exitIcon}>🚪</Text>
            <Text style={styles.exitText}>나가기</Text>
          </Pressable>
        </View>
      )}

      {/* Artwork detail overlay */}
      {detailInfo && selectedPlacement && (
        <View style={styles.detailOverlay}>
          <ScrollView contentContainerStyle={[styles.detailWall, { backgroundColor: detailInfo.wc }]}>
            <View style={styles.detailSpotlight} />

            <View style={[styles.detailFrame, {
              borderColor: detailInfo.frameColor,
              width: detailInfo.imgW + 16, height: detailInfo.imgH + 16,
            }]}>
              <Image
                key={currentDetailImg}
                source={{ uri: currentDetailImg! }}
                style={{ width: detailInfo.imgW, height: detailInfo.imgH }}
                contentFit="cover"
                transition={250}
              />

              {viewAngle !== 'front' && (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setViewAngle('front')}
                />
              )}

              {viewAngle === 'front' && detailInfo.angles.top && (
                <Pressable style={[styles.edgeIcon, styles.edgeTop]} onPress={() => setViewAngle('top')}>
                  <Text style={styles.edgeIconText}>👁</Text>
                </Pressable>
              )}
              {viewAngle === 'front' && detailInfo.angles.bottom && (
                <Pressable style={[styles.edgeIcon, styles.edgeBottom]} onPress={() => setViewAngle('bottom')}>
                  <Text style={styles.edgeIconText}>👁</Text>
                </Pressable>
              )}
              {viewAngle === 'front' && detailInfo.angles.left && (
                <Pressable style={[styles.edgeIcon, styles.edgeLeft]} onPress={() => setViewAngle('left')}>
                  <Text style={styles.edgeIconText}>👁</Text>
                </Pressable>
              )}
              {viewAngle === 'front' && detailInfo.angles.right && (
                <Pressable style={[styles.edgeIcon, styles.edgeRight]} onPress={() => setViewAngle('right')}>
                  <Text style={styles.edgeIconText}>👁</Text>
                </Pressable>
              )}
            </View>

            {viewAngle !== 'front' && (
              <View style={styles.angleLabelBadge}>
                <Text style={styles.angleLabelText}>
                  {{ top: '위에서 본 모습', bottom: '아래에서 본 모습', left: '왼쪽에서 본 모습', right: '오른쪽에서 본 모습' }[viewAngle]}
                </Text>
                <Pressable onPress={() => setViewAngle('front')}>
                  <Text style={styles.angleLabelBack}>정면으로 ✕</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.detailPlate}>
              <Text style={[styles.plateTitle, { color: detailInfo.isDark ? '#eee' : '#333' }]}>
                {detailInfo.art.title}{detailInfo.art.year ? `, ${detailInfo.art.year}` : ''}
              </Text>
              <Text style={[styles.plateMeta, { color: detailInfo.isDark ? '#aaa' : '#777' }]}>
                {[
                  detailInfo.art.medium,
                  `${selectedPlacement.width_cm} × ${selectedPlacement.height_cm} cm`,
                  detailInfo.art.edition,
                ].filter(Boolean).join(' · ')}
              </Text>
              {detailInfo.art.description && (
                <Text style={[styles.plateDesc, { color: detailInfo.isDark ? '#888' : '#999' }]}>
                  {detailInfo.art.description}
                </Text>
              )}
            </View>
          </ScrollView>

          <Pressable
            style={styles.backBar}
            onPress={() => { setSelectedPlacement(null); setViewAngle('front'); }}
          >
            <Text style={styles.backBarText}>← 전시관으로 돌아가기</Text>
          </Pressable>
        </View>
      )}

      {/* Door opening overlay */}
      {introPhase === 'doors' && (
        <DoorOverlay sceneReady={sceneReady} screenWidth={sw} title={title} />
      )}
    </View>
  );
}


/* ── Minimap ── */
const MINIMAP_MAX = 100;
const WALL_T = 4;

function Minimap({ cameraRef, yawRef, dims, wallColors, placements }: {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera>;
  yawRef: React.MutableRefObject<number>;
  dims: RoomDimensions;
  wallColors: Record<Wall, string>;
  placements: Placement3D[];
}) {
  const [pos, setPos] = useState({ x: 0, z: 0, yaw: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      const cam = cameraRef.current;
      if (cam) setPos({ x: cam.position.x, z: cam.position.z, yaw: yawRef.current });
    }, 50);
    return () => clearInterval(id);
  }, []);

  const aspect = dims.widthM / dims.depthM;
  const mapW = aspect >= 1 ? MINIMAP_MAX : MINIMAP_MAX * aspect;
  const mapH = aspect >= 1 ? MINIMAP_MAX / aspect : MINIMAP_MAX;
  const innerW = mapW - WALL_T * 2;
  const innerH = mapH - WALL_T * 2;

  // Camera position on minimap
  const cx = (pos.x / dims.widthM + 0.5) * innerW + WALL_T;
  const cy = (pos.z / dims.depthM + 0.5) * innerH + WALL_T;

  // Artwork dots on walls
  const artDots = useMemo(() => {
    const nsLen = dims.widthM * 100;
    const ewLen = dims.depthM * 100;
    return placements.map((p) => {
      let dx = 0, dy = 0;
      const wallLen = (p.wall === 'north' || p.wall === 'south') ? nsLen : ewLen;
      const ratio = p.position_x / wallLen;
      switch (p.wall) {
        case 'north': dx = WALL_T + ratio * innerW; dy = WALL_T / 2; break;
        case 'south': dx = WALL_T + (1 - ratio) * innerW; dy = mapH - WALL_T / 2; break;
        case 'east':  dx = mapW - WALL_T / 2; dy = WALL_T + ratio * innerH; break;
        case 'west':  dx = WALL_T / 2; dy = WALL_T + (1 - ratio) * innerH; break;
      }
      return { id: p.id, x: dx, y: dy };
    });
  }, [placements, dims, innerW, innerH, mapW, mapH]);

  return (
    <View style={[styles.minimap, { width: mapW, height: mapH }]}>
      {/* Floor */}
      <View style={[styles.minimapFloor, {
        top: WALL_T, left: WALL_T, width: innerW, height: innerH,
      }]} />
      {/* Walls */}
      <View style={[styles.minimapEdge, { top: 0, left: 0, right: 0, height: WALL_T, backgroundColor: wallColors.north }]} />
      <View style={[styles.minimapEdge, { bottom: 0, left: 0, right: 0, height: WALL_T, backgroundColor: wallColors.south }]} />
      <View style={[styles.minimapEdge, { left: 0, top: 0, bottom: 0, width: WALL_T, backgroundColor: wallColors.west }]} />
      <View style={[styles.minimapEdge, { right: 0, top: 0, bottom: 0, width: WALL_T, backgroundColor: wallColors.east }]} />
      {/* Entrance gap on south wall */}
      <View style={[styles.minimapEntrance, { bottom: 0, left: mapW / 2 - 6 }]} />

      {/* Artwork dots */}
      {artDots.map((d) => (
        <View key={d.id} style={[styles.minimapArtDot, { left: d.x - 2, top: d.y - 2 }]} />
      ))}

      {/* Camera indicator */}
      <View style={{
        position: 'absolute', left: cx - 7, top: cy - 7,
        width: 14, height: 14,
        justifyContent: 'center', alignItems: 'center',
        transform: [{ rotate: `${-pos.yaw}rad` }],
      }}>
        {/* FOV cone */}
        <View style={styles.minimapFov} />
        {/* Dot */}
        <View style={styles.minimapCamDot} />
      </View>
    </View>
  );
}

/* ── Door Opening Overlay ── */
function DoorOverlay({ sceneReady, screenWidth, title }: {
  sceneReady: boolean; screenWidth: number; title?: string;
}) {
  const halfW = screenWidth / 2;

  const leftX = useSharedValue(0);
  const rightX = useSharedValue(0);
  const crackOp = useSharedValue(0);
  const titleOp = useSharedValue(1);
  const overlayOp = useSharedValue(1);

  useEffect(() => {
    if (!sceneReady) return;
    const doorEase = Easing.bezier(0.22, 1, 0.36, 1);
    crackOp.value = withDelay(200, withTiming(1, { duration: 500 }));
    leftX.value = withDelay(700, withTiming(-halfW - 20, { duration: 1400, easing: doorEase }));
    rightX.value = withDelay(700, withTiming(halfW + 20, { duration: 1400, easing: doorEase }));
    titleOp.value = withDelay(500, withTiming(0, { duration: 600 }));
    overlayOp.value = withDelay(2200, withTiming(0, { duration: 800 }));
  }, [sceneReady]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const crackStyle = useAnimatedStyle(() => ({ opacity: crackOp.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOp.value }));

  return (
    <Animated.View style={[styles.introOverlay, containerStyle]} pointerEvents="auto">
      <Animated.View style={[styles.introCrack, crackStyle]} />

      <Animated.View style={[styles.introDoor, styles.introDoorLeft, leftStyle]}>
        <View style={styles.introDoorPanel} />
        <View style={[styles.introDoorHandle, { right: 18 }]} />
      </Animated.View>

      <Animated.View style={[styles.introDoor, styles.introDoorRight, rightStyle]}>
        <View style={styles.introDoorPanel} />
        <View style={[styles.introDoorHandle, { left: 18 }]} />
      </Animated.View>

      <Animated.View style={[styles.introTitleWrap, titleStyle]}>
        <Text style={styles.introTitleSub}>MOUI-IST</Text>
        <View style={styles.introTitleLine} />
        <Text style={styles.introTitle}>{title || '전시관 입장'}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* ── Virtual Joystick ── */
const JOYSTICK_SIZE = 100;
const KNOB_SIZE = 38;
const MAX_R = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

function Joystick({ setJoystick, label }: { setJoystick: (x: number, y: number) => void; label?: string }) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const baseRef = useRef<View>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const webElRef = useRef<any>(null);

  const clampKnob = (dx: number, dy: number) => {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_R) {
      dx = (dx / dist) * MAX_R;
      dy = (dy / dist) * MAX_R;
    }
    return { dx, dy };
  };

  const emitJoystick = (dx: number, dy: number) => {
    const { dx: cx, dy: cy } = clampKnob(dx, dy);
    setKnobPos({ x: cx, y: cy });
    setJoystick(cx / MAX_R, cy / MAX_R);
  };

  const resetJoystick = () => {
    setKnobPos({ x: 0, y: 0 });
    setJoystick(0, 0);
    activeRef.current = false;
  };

  // Touch (mobile) handlers via responder
  const onStart = useCallback((e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    baseRef.current?.measure((_x, _y, _w, _h, px, py) => {
      originRef.current = { x: px + JOYSTICK_SIZE / 2, y: py + JOYSTICK_SIZE / 2 };
      activeRef.current = true;
      emitJoystick(pageX - originRef.current.x, pageY - originRef.current.y);
    });
  }, []);

  const onMove = useCallback((e: any) => {
    if (!activeRef.current) return;
    const { pageX, pageY } = e.nativeEvent;
    emitJoystick(pageX - originRef.current.x, pageY - originRef.current.y);
  }, []);

  const onEnd = useCallback(() => resetJoystick(), []);

  // Web mouse handlers
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = webElRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      originRef.current = { x: rect.left + JOYSTICK_SIZE / 2, y: rect.top + JOYSTICK_SIZE / 2 };
      activeRef.current = true;
      emitJoystick(e.clientX - originRef.current.x, e.clientY - originRef.current.y);

      const onMouseMove = (ev: MouseEvent) => {
        if (!activeRef.current) return;
        emitJoystick(ev.clientX - originRef.current.x, ev.clientY - originRef.current.y);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        resetJoystick();
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, []);

  const setRef = useCallback((node: any) => {
    baseRef.current = node;
    if (Platform.OS === 'web') webElRef.current = node;
  }, []);

  return (
    <View style={styles.joystickWrap}>
      <View
        ref={setRef}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onStart}
        onResponderMove={onMove}
        onResponderRelease={onEnd}
        onResponderTerminate={onEnd}
        style={styles.joystickBase}
      >
        <Text style={[styles.joystickHint, { top: 3 }]}>▲</Text>
        <Text style={[styles.joystickHint, { bottom: 3 }]}>▼</Text>
        <Text style={[styles.joystickHint, { left: 5 }]}>◀</Text>
        <Text style={[styles.joystickHint, { right: 5 }]}>▶</Text>
        <View style={[styles.joystickKnob, {
          transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }],
        }]} />
      </View>
      {label && <Text style={styles.joystickLabel}>{label}</Text>}
    </View>
  );
}

/* ── Speed Control ── */
const SPEED_MULTS = [0.2, 0.5, 1, 1.8, 3];

function SpeedControl({ onChange, label = '이동속도' }: { onChange: (m: number) => void; label?: string }) {
  const [level, setLevel] = useState(2); // 0-4, default 2 (= speed 3)
  const dec = () => { if (level > 0) { const n = level - 1; setLevel(n); onChange(SPEED_MULTS[n]); } };
  const inc = () => { if (level < 4) { const n = level + 1; setLevel(n); onChange(SPEED_MULTS[n]); } };
  return (
    <View style={styles.speedWrap}>
      <View style={styles.speedPanel}>
        <Pressable onPress={dec} style={[styles.speedPm, level === 0 && { opacity: 0.25 }]}>
          <Text style={styles.speedPmText}>−</Text>
        </Pressable>
        <Text style={styles.speedLevel}>{level + 1}</Text>
        <Pressable onPress={inc} style={[styles.speedPm, level === 4 && { opacity: 0.25 }]}>
          <Text style={styles.speedPmText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.speedLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  canvasArea: { flex: 1, position: 'relative' },

  // HUD
  hud: {
    backgroundColor: 'rgba(8,8,8,0.75)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: 'center',
    gap: 4,
  },
  hudTop: { flexDirection: 'row', justifyContent: 'center' },

  compass: { flexDirection: 'row', gap: 2 },
  compassItem: {
    width: 32, height: 28, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  compassItemActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.15)' },
  compassText: { fontSize: 11, fontWeight: '800', color: C.mutedDark },
  compassTextActive: { color: C.gold },

  dirLabel: { color: C.fg, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  dirSub: { color: C.muted, fontSize: 10 },

  hudBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 },
  hudCenter: { alignItems: 'center', gap: 6 },

  joystickWrap: { alignItems: 'center', gap: 2 },
  joystickBase: {
    width: JOYSTICK_SIZE, height: JOYSTICK_SIZE, borderRadius: JOYSTICK_SIZE / 2,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
  },
  joystickKnob: {
    width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2,
    backgroundColor: 'rgba(200,169,110,0.35)',
    borderWidth: 2, borderColor: C.gold,
  },
  joystickHint: {
    position: 'absolute', fontSize: 7, color: 'rgba(255,255,255,0.15)',
  },
  joystickLabel: { fontSize: 8, color: C.muted, letterSpacing: 1 },

  speedWrap: { alignItems: 'center', gap: 2 },
  speedPanel: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 2, paddingVertical: 1,
  },
  speedPm: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  speedPmText: { fontSize: 14, color: C.muted, fontWeight: '600' },
  speedLevel: { fontSize: 11, color: C.gold, fontWeight: '800', minWidth: 12, textAlign: 'center' },
  speedLabel: { fontSize: 8, color: C.muted, letterSpacing: 1 },

  exitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  exitIcon: { fontSize: 12 },
  exitText: { color: C.mutedDark, fontSize: 10 },

  // Minimap
  minimapWrap: {
    position: 'absolute', top: 12, right: 12,
  },
  minimap: {
    backgroundColor: 'rgba(10,10,10,0.75)',
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  minimapFloor: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.04)' },
  minimapEdge: { position: 'absolute', borderRadius: 1 },
  minimapEntrance: {
    position: 'absolute', width: 12, height: WALL_T,
    backgroundColor: 'rgba(10,10,10,0.75)',
  },
  minimapArtDot: {
    position: 'absolute', width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  minimapFov: {
    position: 'absolute', top: -6,
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(200,169,110,0.45)',
  },
  minimapCamDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },

  // Intro overlay
  introOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 100,
    justifyContent: 'center', alignItems: 'center',
  },
  introCrack: {
    position: 'absolute', width: 2, top: 0, bottom: 0, alignSelf: 'center',
    backgroundColor: 'rgba(255,248,220,0.5)',
    shadowColor: '#FFF8DC', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 30,
  },
  introDoor: {
    position: 'absolute', top: 0, bottom: 0, width: '52%',
    backgroundColor: '#1A1410', justifyContent: 'center',
  },
  introDoorLeft: {
    left: 0, borderRightWidth: 1, borderRightColor: 'rgba(200,169,110,0.25)',
  },
  introDoorRight: {
    right: 0, borderLeftWidth: 1, borderLeftColor: 'rgba(200,169,110,0.25)',
  },
  introDoorPanel: {
    position: 'absolute', top: '12%', bottom: '12%', left: 24, right: 24,
    borderWidth: 1, borderColor: 'rgba(200,169,110,0.12)', borderRadius: 3,
  },
  introDoorHandle: {
    position: 'absolute', width: 6, height: 44, borderRadius: 3,
    backgroundColor: C.gold, shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  introTitleWrap: { zIndex: 10, alignItems: 'center', gap: 8 },
  introTitleSub: {
    fontSize: 10, color: 'rgba(200,169,110,0.5)', letterSpacing: 6, fontWeight: '600',
  },
  introTitleLine: {
    width: 40, height: 1, backgroundColor: 'rgba(200,169,110,0.3)',
  },
  introTitle: {
    fontSize: 20, color: C.gold, fontWeight: '800', letterSpacing: 4,
  },

  // Artwork detail overlay
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: C.bg,
  },
  detailWall: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    gap: 16, paddingVertical: 24,
  },
  detailSpotlight: {
    position: 'absolute', top: 0, left: '15%', right: '15%', height: 100,
    backgroundColor: 'rgba(255,255,230,0.05)',
    borderBottomLeftRadius: 120, borderBottomRightRadius: 120,
  },
  detailFrame: {
    borderWidth: 5, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', padding: 4,
    shadowColor: '#000', shadowOffset: { width: 3, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  detailPlate: {
    alignItems: 'center', gap: 3,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4,
  },
  plateTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  plateMeta: { fontSize: 11 },
  plateDesc: { fontSize: 11, marginTop: 2, textAlign: 'center' },

  edgeIcon: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  edgeIconText: { fontSize: 14 },
  edgeTop: { top: 6, alignSelf: 'center', left: '50%', marginLeft: -16 },
  edgeBottom: { bottom: 6, alignSelf: 'center', left: '50%', marginLeft: -16 },
  edgeLeft: { left: 6, top: '50%', marginTop: -16 },
  edgeRight: { right: 6, top: '50%', marginTop: -16 },
  angleLabelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16,
  },
  angleLabelText: { color: '#ddd', fontSize: 12 },
  angleLabelBack: { color: C.gold, fontSize: 12, fontWeight: '600' },

  backBar: {
    backgroundColor: C.bg, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center',
  },
  backBarText: { color: C.gold, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
});
