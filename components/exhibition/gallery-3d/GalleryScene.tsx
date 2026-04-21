import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
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
  roomType, wallColors, floorColor, ceilingColor, placements, onClose
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

    scene.background = new THREE.Color(C.bg);

    buildRoom(scene, dims, wallColors, floorColor, ceilingColor);
    buildLighting(scene, placements, dims);
    buildArtworks(scene, placements, dims, wallColors).then((meshes) => {
      artworkMeshesRef.current = meshes;
    });

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      controls.updateCamera();

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

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudTop}>
          <View style={styles.compass}>
            {WALL_ORDER.map((w) => (
              <View key={w} style={[styles.compassItem, w === currentDir && styles.compassItemActive]}>
                <Text style={[styles.compassText, w === currentDir && styles.compassTextActive]}>
                  {DIR_LABELS[w]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.dirLabel}>{WALL_LABELS[currentDir]}</Text>
        <Text style={styles.dirSub}>작품 {artCountOnWall}점</Text>

        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <View style={{ width: 52 }} />
            <MoveBtn icon="↑" label="전진" dir="forward" setMove={controls.setMove} />
            <View style={{ width: 52 }} />
          </View>
          <View style={styles.dpadRow}>
            <MoveBtn icon="←" label="좌" dir="left" setMove={controls.setMove} />
            <View style={styles.dpadCenter} />
            <MoveBtn icon="→" label="우" dir="right" setMove={controls.setMove} />
          </View>
          <View style={styles.dpadRow}>
            <View style={{ width: 52 }} />
            <MoveBtn icon="↓" label="후진" dir="backward" setMove={controls.setMove} />
            <View style={{ width: 52 }} />
          </View>
        </View>

        <Pressable style={styles.exitBtn} onPress={onClose}>
          <Text style={styles.exitText}>전시관 나가기</Text>
        </Pressable>
      </View>
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

/* ── Move button (hold to move) ── */
function MoveBtn({ icon, label, dir, setMove }: {
  icon: string; label: string;
  dir: 'forward' | 'backward' | 'left' | 'right';
  setMove: (d: typeof dir, pressed: boolean) => void;
}) {
  return (
    <Pressable
      style={styles.moveBtn}
      onPressIn={() => setMove(dir, true)}
      onPressOut={() => setMove(dir, false)}
    >
      <Text style={styles.moveBtnIcon}>{icon}</Text>
      <Text style={styles.moveBtnLabel}>{label}</Text>
    </Pressable>
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

  dpad: { gap: 2, marginTop: 2 },
  dpadRow: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  dpadCenter: { width: 52, height: 42, borderRadius: 10 },
  moveBtn: {
    width: 52, height: 42, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moveBtnIcon: { fontSize: 16, color: C.gold, lineHeight: 18 },
  moveBtnLabel: { fontSize: 7, color: C.muted },

  exitBtn: { marginTop: 4 },
  exitText: { color: C.mutedDark, fontSize: 11 },

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
