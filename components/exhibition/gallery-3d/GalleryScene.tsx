import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
  FadeInDown,
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
import type { GallerySceneProps, Placement3D, Wall } from './types';

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

  // Intro animation state: 'foreword' → 'doors' → null
  const [introPhase, setIntroPhase] = useState<'foreword' | 'doors' | null>(
    (foreword || posterUrl) ? 'foreword' : 'doors'
  );
  const [sceneReady, setSceneReady] = useState(false);
  const doorStartRef = useRef(0);

  // Artwork detail overlay state
  const [selectedPlacement, setSelectedPlacement] = useState<Placement3D | null>(null);
  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');

  const handleArtworkTap = useCallback((placementId: string) => {
    const found = placements.find((p) => p.id === placementId);
    if (found) {
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
          controls.updateCamera();
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

  // When transitioning to 'doors' phase, start the door animation timer
  useEffect(() => {
    if (introPhase === 'doors' && sceneReady) {
      doorStartRef.current = Date.now();
      const timer = setTimeout(() => setIntroPhase(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [introPhase, sceneReady]);

  // If no foreword/poster, start doors immediately when scene ready
  useEffect(() => {
    if (introPhase === 'doors' && sceneReady && doorStartRef.current === 0) {
      doorStartRef.current = Date.now();
    }
  }, [sceneReady, introPhase]);

  const handleEnterGallery = useCallback(() => {
    setIntroPhase('doors');
  }, []);

  const artCountOnWall = useMemo(
    () => placements.filter((p) => p.wall === currentDir).length,
    [placements, currentDir],
  );

  // ── Artwork detail overlay ──
  if (selectedPlacement) {
    const art = selectedPlacement.artwork;
    const wc = wallColors[selectedPlacement.wall];
    const isDark = DARK_WALLS.includes(wc);
    const frameColor = isDark ? '#D4C5A9' : '#5C4A32';
    const imgW = sw - 64;
    const imgH = imgW * (selectedPlacement.height_cm / selectedPlacement.width_cm);

    const angles: Record<ViewAngle, string | null | undefined> = {
      front: art.image_url,
      top: art.image_top_url,
      bottom: art.image_bottom_url,
      left: art.image_left_url,
      right: art.image_right_url,
    };
    const currentImg = angles[viewAngle] || art.image_url;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.detailWall, { backgroundColor: wc }]}>
          <View style={styles.detailSpotlight} />

          {/* Frame + Image */}
          <View style={[styles.detailFrame, {
            borderColor: frameColor, width: imgW + 16, height: imgH + 16,
          }]}>
            <Image
              key={currentImg}
              source={{ uri: currentImg! }}
              style={{ width: imgW, height: imgH }}
              contentFit="cover"
              transition={250}
            />
          </View>

          {/* Info plate */}
          <View style={styles.detailPlate}>
            <Text style={[styles.plateTitle, { color: isDark ? '#eee' : '#333' }]}>
              {art.title}{art.year ? `, ${art.year}` : ''}
            </Text>
            <Text style={[styles.plateMeta, { color: isDark ? '#aaa' : '#777' }]}>
              {[
                art.medium,
                `${selectedPlacement.width_cm} × ${selectedPlacement.height_cm} cm`,
                art.edition,
              ].filter(Boolean).join(' · ')}
            </Text>
            {art.description && (
              <Text style={[styles.plateDesc, { color: isDark ? '#888' : '#999' }]}>
                {art.description}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Angle controls */}
        <View style={styles.anglePanel}>
          <View style={styles.angleCross}>
            <View style={styles.angleRow}>
              <View style={{ width: 50 }} />
              <AngleBtn k="top" icon="↑" label="위" cur={viewAngle} has={!!angles.top} set={setViewAngle} />
              <View style={{ width: 50 }} />
            </View>
            <View style={styles.angleRow}>
              <AngleBtn k="left" icon="←" label="좌" cur={viewAngle} has={!!angles.left} set={setViewAngle} />
              <AngleBtn k="front" icon="◉" label="정면" cur={viewAngle} has set={setViewAngle} />
              <AngleBtn k="right" icon="→" label="우" cur={viewAngle} has={!!angles.right} set={setViewAngle} />
            </View>
            <View style={styles.angleRow}>
              <View style={{ width: 50 }} />
              <AngleBtn k="bottom" icon="↓" label="아래" cur={viewAngle} has={!!angles.bottom} set={setViewAngle} />
              <View style={{ width: 50 }} />
            </View>
          </View>
        </View>

        <Pressable
          style={styles.backBar}
          onPress={() => { setSelectedPlacement(null); setViewAngle('front'); }}
        >
          <Text style={styles.backBarText}>← 전시관으로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main 3D view ──
  return (
    <View style={styles.root}>
      <View style={styles.canvasArea}>
        <GalleryCanvas onReady={handleReady} style={StyleSheet.absoluteFill} />
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={controls.onTouchStart}
          onResponderMove={controls.onTouchMove}
          onResponderRelease={controls.onTouchEnd}
        />
      </View>

      {/* HUD — hidden during intro */}
      {!introPhase && (
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
            <Joystick setJoystick={controls.setJoystick} />
            <SpeedControl onChange={controls.setSpeedMult} />
          </View>

          <Pressable style={styles.exitBtn} onPress={onClose}>
            <Text style={styles.exitText}>전시관 나가기</Text>
          </Pressable>
        </View>
      )}

      {/* Foreword overlay */}
      {introPhase === 'foreword' && (
        <ForewordOverlay
          title={title}
          foreword={foreword}
          posterUrl={posterUrl}
          onEnter={handleEnterGallery}
        />
      )}

      {/* Door opening overlay */}
      {introPhase === 'doors' && (
        <DoorOverlay sceneReady={sceneReady} screenWidth={sw} title={title} />
      )}
    </View>
  );
}

/* ── Angle button ── */
function AngleBtn({ k, icon, label, cur, has, set }: {
  k: ViewAngle; icon: string; label: string;
  cur: ViewAngle; has: boolean; set: (v: ViewAngle) => void;
}) {
  const active = cur === k;
  return (
    <Pressable
      style={[styles.angleBtn, active && styles.angleBtnActive, !has && { opacity: 0.2 }]}
      onPress={() => has && set(k)} disabled={!has}
    >
      <Text style={[styles.angleBtnIcon, active && { color: C.gold }]}>{icon}</Text>
      <Text style={[styles.angleBtnLabel, active && { color: C.gold }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Foreword Overlay (poster + foreword scroll) ── */
function ForewordOverlay({ title, foreword, posterUrl, onEnter }: {
  title?: string; foreword?: string | null; posterUrl?: string | null;
  onEnter: () => void;
}) {
  const { width: sw } = useWindowDimensions();
  const posterW = sw - 80;

  return (
    <View style={styles.forewordRoot}>
      <ScrollView
        contentContainerStyle={styles.forewordScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Poster image */}
        {posterUrl && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Image
              source={{ uri: posterUrl }}
              style={{ width: posterW, height: posterW * 1.4, borderRadius: 4 }}
              contentFit="cover"
              transition={300}
            />
          </Animated.View>
        )}

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.forewordTitleWrap}>
          <View style={styles.forewordDiamond} />
          <Text style={styles.forewordTitleText}>{title || '전시'}</Text>
          <View style={styles.forewordTitleDivider} />
        </Animated.View>

        {/* Foreword text */}
        {foreword && (
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.forewordTextBox}>
            <Text style={styles.forewordLabel}>전시 서문</Text>
            <View style={styles.forewordTextDivider} />
            <Text style={styles.forewordBody}>{foreword}</Text>
          </Animated.View>
        )}

        {/* Enter button */}
        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
          <Pressable style={styles.forewordEnterBtn} onPress={onEnter}>
            <Text style={styles.forewordEnterText}>전시관 입장</Text>
            <Text style={styles.forewordEnterArrow}>→</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
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
const JOYSTICK_SIZE = 120;
const KNOB_SIZE = 44;
const MAX_R = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

function Joystick({ setJoystick }: { setJoystick: (x: number, y: number) => void }) {
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
      {/* Direction hints */}
      <Text style={[styles.joystickHint, { top: 4 }]}>▲</Text>
      <Text style={[styles.joystickHint, { bottom: 4 }]}>▼</Text>
      <Text style={[styles.joystickHint, { left: 6 }]}>◀</Text>
      <Text style={[styles.joystickHint, { right: 6 }]}>▶</Text>
      {/* Knob */}
      <View style={[styles.joystickKnob, {
        transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }],
      }]} />
    </View>
  );
}

/* ── Speed Control ── */
const SPEED_OPTS: { label: string; icon: string; mult: number }[] = [
  { label: '느리게', icon: '🐢', mult: 0.4 },
  { label: '보통',   icon: '🚶', mult: 1 },
  { label: '빠르게', icon: '🏃', mult: 2.2 },
];

function SpeedControl({ onChange }: { onChange: (m: number) => void }) {
  const [idx, setIdx] = useState(1);
  return (
    <View style={styles.speedPanel}>
      <Text style={styles.speedTitle}>이동속도</Text>
      {SPEED_OPTS.map((opt, i) => (
        <Pressable
          key={i}
          style={[styles.speedBtn, i === idx && styles.speedBtnActive]}
          onPress={() => { setIdx(i); onChange(opt.mult); }}
        >
          <Text style={styles.speedIcon}>{opt.icon}</Text>
          <Text style={[styles.speedLabel, i === idx && { color: C.gold }]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  canvasArea: { flex: 1, position: 'relative' },

  // HUD
  hud: {
    backgroundColor: 'rgba(8,8,8,0.97)',
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

  hudBottom: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },

  joystickBase: {
    width: JOYSTICK_SIZE, height: JOYSTICK_SIZE, borderRadius: JOYSTICK_SIZE / 2,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },
  joystickKnob: {
    width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2,
    backgroundColor: 'rgba(200,169,110,0.35)',
    borderWidth: 2, borderColor: C.gold,
  },
  joystickHint: {
    position: 'absolute', fontSize: 8, color: 'rgba(255,255,255,0.15)',
  },

  speedPanel: { alignItems: 'center', gap: 6 },
  speedTitle: { fontSize: 9, color: C.muted, letterSpacing: 1 },
  speedBtn: {
    width: 52, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  speedBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.12)' },
  speedIcon: { fontSize: 14, lineHeight: 18 },
  speedLabel: { fontSize: 7, color: C.muted },

  exitBtn: { marginTop: 4 },
  exitText: { color: C.mutedDark, fontSize: 11 },

  // Foreword overlay
  forewordRoot: {
    ...StyleSheet.absoluteFillObject, zIndex: 110,
    backgroundColor: C.bg,
  },
  forewordScroll: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 28,
  },
  forewordTitleWrap: { alignItems: 'center', gap: 10 },
  forewordDiamond: {
    width: 10, height: 10, borderRadius: 2, backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  forewordTitleText: {
    fontSize: 24, fontWeight: '800', color: C.fg, letterSpacing: 2, textAlign: 'center',
  },
  forewordTitleDivider: { width: 50, height: 1, backgroundColor: 'rgba(200,169,110,0.4)' },
  forewordTextBox: {
    width: '100%', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 6, padding: 20,
  },
  forewordLabel: { fontSize: 10, color: C.gold, fontWeight: '700', letterSpacing: 3 },
  forewordTextDivider: { width: 30, height: 1, backgroundColor: 'rgba(200,169,110,0.3)' },
  forewordBody: { fontSize: 15, color: '#CCC', lineHeight: 26, letterSpacing: 0.5 },
  forewordEnterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 40,
    borderWidth: 1.5, borderColor: C.gold, borderRadius: 30,
    marginTop: 12,
  },
  forewordEnterText: { fontSize: 15, fontWeight: '700', color: C.gold, letterSpacing: 2 },
  forewordEnterArrow: { fontSize: 16, color: C.gold },

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

  anglePanel: {
    backgroundColor: 'rgba(8,8,8,0.97)', padding: 12,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center',
  },
  angleCross: { gap: 3 },
  angleRow: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  angleBtn: {
    width: 50, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  angleBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.12)' },
  angleBtnIcon: { fontSize: 14, color: C.muted },
  angleBtnLabel: { fontSize: 7, color: C.muted },

  backBar: {
    backgroundColor: C.bg, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center',
  },
  backBarText: { color: C.gold, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
});
