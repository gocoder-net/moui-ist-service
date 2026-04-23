import { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/** 크로스플랫폼 확인 다이얼로그 */
function confirmAlert(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

/** public URL에서 스토리지 파일 경로 추출 */
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
  white: '#f2f4f6',
};

/* ── 배경 떠다니는 도형 ── */
function FloatingShape({
  size, color, opacity, top, left, duration, delay, shape,
}: {
  size: number; color: string; opacity: number; top: string; left: string;
  duration: number; delay: number; shape: 'circle' | 'diamond' | 'ring' | 'line';
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-20, { duration, easing: Easing.inOut(Easing.sin) }),
      withTiming(20, { duration, easing: Easing.inOut(Easing.sin) }),
    ), -1, true));
    translateX.value = withDelay(delay + 500, withRepeat(withSequence(
      withTiming(12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
      withTiming(-12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
    ), -1, true));
    rotate.value = withDelay(delay, withRepeat(
      withTiming(360, { duration: duration * 4, easing: Easing.linear }), -1));
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1.15, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.85, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
    ), -1, true));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value }, { translateX: translateX.value },
      { rotate: `${rotate.value}deg` }, { scale: scale.value },
    ],
  }));

  const shapeStyle = (() => {
    switch (shape) {
      case 'circle': return { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity };
      case 'diamond': return { width: size, height: size, borderWidth: 1, borderColor: color, opacity, transform: [{ rotate: '45deg' }] };
      case 'ring': return { width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color, opacity };
      case 'line': return { width: size, height: 1, backgroundColor: color, opacity };
    }
  })();

  return (
    <Animated.View style={[{ position: 'absolute', top: top as any, left: left as any }, animStyle]}>
      <View style={shapeStyle} />
    </Animated.View>
  );
}

/* ── PlayfulDiamond ── */
function PlayfulDiamond({ size = 14 }: { size?: number }) {
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const play = () => {
      rot.value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.in(Easing.cubic) }),
        withSpring(360, { damping: 6, stiffness: 200 }),
        withDelay(1500, withTiming(360, { duration: 0 })),
        withTiming(180, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        withSpring(180, { damping: 8, stiffness: 250 }),
        withDelay(2000, withTiming(180, { duration: 0 })),
        withTiming(720, { duration: 800, easing: Easing.in(Easing.quad) }),
        withSpring(720, { damping: 5, stiffness: 180 }),
        withDelay(1200, withTiming(720, { duration: 0 })),
        withTiming(740, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withSpring(720, { damping: 10, stiffness: 300 }),
        withDelay(1500, withTiming(0, { duration: 0 })),
      );
      scale.value = withSequence(
        withTiming(1.1, { duration: 300 }), withTiming(1, { duration: 300 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
        withTiming(0.9, { duration: 200 }), withSpring(1, { damping: 8 }),
        withDelay(2000, withTiming(1, { duration: 0 })),
        withTiming(1.15, { duration: 400 }), withTiming(1, { duration: 400 }),
        withDelay(1200, withTiming(1, { duration: 0 })),
        withTiming(1.05, { duration: 200 }), withSpring(1, { damping: 12 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
      );
    };
    play();
    const interval = setInterval(play, 9200);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size, borderWidth: 1.5, borderColor: C.gold, transform: [{ rotate: '45deg' }] }, animStyle]} />
  );
}

/* ── 퀵 액션 카드 ── */
function QuickCard({
  icon, title, desc, delay: d, onPress,
}: {
  icon: string; title: string; desc: string; delay: number; onPress?: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(d).duration(400).springify()}>
      <Pressable
        style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
        onPress={onPress}
      >
        <Text style={styles.quickIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.quickTitle}>{title}</Text>
          <Text style={styles.quickDesc}>{desc}</Text>
        </View>
        <Text style={{ color: C.mutedLight, fontSize: 14 }}>→</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ── 전시관 타입 ── */
type Exhibition = {
  id: string;
  title: string;
  room_type: string;
  poster_image_url: string | null;
  is_published: boolean;
  created_at: string;
};

const ROOM_EMOJI: Record<string, string> = {
  small: '🏠',
  medium: '🏛️',
  large: '🏰',
};

const ROOM_LABEL: Record<string, string> = {
  small: '소형',
  medium: '중형',
  large: '대형',
};

/* ── 전시관 카드 ── */
function ExhibitionCard({ item, onPress, onEdit, onDelete }: { item: Exhibition; onPress: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.exCard}>
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        onPress={onPress}
      >
        <View style={styles.exPosterWrap}>
          {item.poster_image_url ? (
            <Image source={{ uri: item.poster_image_url }} style={styles.exPoster} contentFit="cover" />
          ) : (
            <View style={styles.exPosterPlaceholder}>
              <Text style={styles.exPosterEmoji}>{ROOM_EMOJI[item.room_type] ?? '🏛️'}</Text>
            </View>
          )}
          <View style={styles.exBadgeRow}>
            <View style={styles.exBadge}>
              <Text style={styles.exBadgeText}>{ROOM_LABEL[item.room_type] ?? item.room_type}</Text>
            </View>
            <View style={[styles.exBadge, item.is_published && styles.exBadgePublished]}>
              <Text style={[styles.exBadgeText, item.is_published && { color: C.gold }]}>
                {item.is_published ? '공개' : '비공개'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.exTitleWrap}>
          <Text style={styles.exTitle} numberOfLines={1}>{item.title}</Text>
        </View>
      </Pressable>
      <View style={styles.exBtnRow}>
        <TouchableOpacity
          style={styles.exEditBtn}
          activeOpacity={0.5}
          onPress={onEdit}
        >
          <Text style={styles.exEditText}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exDeleteBtn}
          activeOpacity={0.5}
          onPress={onDelete}
        >
          <Text style={styles.exDeleteText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── 메인 화면 ── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const exScrollRef = useRef<ScrollView>(null);
  const exScrollX = useRef(0);

  const fetchExhibitions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('exhibitions')
      .select('id, title, room_type, poster_image_url, is_published, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setExhibitions(data);
  }, [user]);

  useEffect(() => { fetchExhibitions(); }, [fetchExhibitions]);
  useFocusEffect(useCallback(() => { fetchExhibitions(); }, [fetchExhibitions]));

  const handleDelete = useCallback((id: string) => {
    confirmAlert('전시관 삭제', '정말 삭제하시겠습니까?\n전시관과 관련 파일이 모두 삭제됩니다.', async () => {
      try {
        // 1) 전시관 상세 정보 조회 (스토리지 파일 경로 확보)
        const { data: ex } = await supabase
          .from('exhibitions')
          .select('poster_image_url, wall_images, bgm_url')
          .eq('id', id)
          .single();

        // 2) 스토리지 파일 삭제
        if (ex) {
          const artworkPaths: string[] = [];
          const bgmPaths: string[] = [];

          if (ex.poster_image_url) {
            const p = extractStoragePath(ex.poster_image_url, 'artworks');
            if (p) artworkPaths.push(p);
          }
          if (ex.wall_images && typeof ex.wall_images === 'object') {
            const wi = ex.wall_images as Record<string, { url: string; mode: string } | null>;
            for (const wall of ['north', 'south', 'east', 'west']) {
              if (wi[wall]?.url) {
                const p = extractStoragePath(wi[wall]!.url, 'artworks');
                if (p) artworkPaths.push(p);
              }
            }
          }
          if (ex.bgm_url) {
            const p = extractStoragePath(ex.bgm_url, 'bgm');
            if (p) bgmPaths.push(p);
          }

          if (artworkPaths.length > 0) {
            await supabase.storage.from('artworks').remove(artworkPaths);
          }
          if (bgmPaths.length > 0) {
            await supabase.storage.from('bgm').remove(bgmPaths);
          }
        }

        // 3) DB 삭제
        const { error: eaErr } = await supabase
          .from('exhibition_artworks').delete().eq('exhibition_id', id);
        if (eaErr) console.warn('exhibition_artworks 삭제 실패:', eaErr.message);

        const { error: exErr } = await supabase
          .from('exhibitions').delete().eq('id', id);
        if (exErr) {
          if (Platform.OS === 'web') window.alert('삭제 실패: ' + exErr.message);
          return;
        }

        fetchExhibitions();
      } catch (err) {
        console.error('삭제 중 오류:', err);
        if (Platform.OS === 'web') window.alert('삭제 실패: 알 수 없는 오류가 발생했습니다.');
      }
    });
  }, [fetchExhibitions]);

  const userTypeLabels = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
  const userTypeLabel = userTypeLabels[profile?.user_type ?? 'audience'];
  const userTypeEmoji = { creator: '🎨', aspiring: '✏️', audience: '👀' } as const;
  const emoji = userTypeEmoji[profile?.user_type ?? 'audience'];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 배경 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={50} color={C.gold} opacity={0.08} top="5%" left="2%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={70} color={C.goldLight} opacity={0.05} top="50%" left="60%" duration={7000} delay={800} />
        <FloatingShape shape="diamond" size={20} color={C.gold} opacity={0.20} top="10%" left="82%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={14} color={C.gold} opacity={0.15} top="60%" left="5%" duration={4200} delay={200} />
        <FloatingShape shape="diamond" size={24} color={C.goldLight} opacity={0.10} top="80%" left="70%" duration={3800} delay={1000} />
        <FloatingShape shape="circle" size={7} color={C.gold} opacity={0.28} top="20%" left="25%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={5} color={C.goldLight} opacity={0.22} top="40%" left="75%" duration={2500} delay={900} />
        <FloatingShape shape="circle" size={8} color={C.gold} opacity={0.18} top="70%" left="35%" duration={3200} delay={500} />
        <FloatingShape shape="line" size={60} color={C.gold} opacity={0.10} top="15%" left="55%" duration={5000} delay={1500} />
        <FloatingShape shape="line" size={80} color={C.goldLight} opacity={0.07} top="65%" left="40%" duration={4500} delay={300} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 상단 바 */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.topBar}>
          <Text style={styles.enLogo}>
            MOUI<Text style={{ color: C.gold }}>-</Text>IST
          </Text>
          <Pressable onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </Animated.View>

        {/* 프로필 영역 */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarEmoji}>{emoji}</Text>
            <View style={styles.avatarDiamond}>
              <PlayfulDiamond size={10} />
            </View>
          </View>

          <Text style={styles.greeting}>
            안녕하세요, <Text style={{ color: C.gold }}>{profile?.name ?? '회원'}</Text>님
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{userTypeLabel}</Text>
            </View>
          </View>

          <Text style={styles.email}>{user?.email}</Text>
        </Animated.View>

        {/* 구분선 */}
        <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* 내 전시관 */}
        {exhibitions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(420).duration(400).springify()}>
            <View style={styles.exSectionHeader}>
              <Text style={styles.sectionTitle}>🏛️ 내 전시관</Text>
              <View style={styles.exHeaderRight}>
                {Platform.OS === 'web' && exhibitions.length > 1 && (
                  <View style={styles.exScrollBtns}>
                    <TouchableOpacity
                      style={styles.exScrollBtn}
                      activeOpacity={0.5}
                      onPress={() => exScrollRef.current?.scrollTo({ x: Math.max(0, exScrollX.current - 172), animated: true })}
                    >
                      <Text style={styles.exScrollBtnText}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.exScrollBtn}
                      activeOpacity={0.5}
                      onPress={() => exScrollRef.current?.scrollTo({ x: exScrollX.current + 172, animated: true })}
                    >
                      <Text style={styles.exScrollBtnText}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [styles.exNewBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/exhibition/create')}
                >
                  <Text style={styles.exNewBtnText}>+ 새 전시관</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              ref={exScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exList}
              onScroll={(e) => { exScrollX.current = e.nativeEvent.contentOffset.x; }}
              scrollEventThrottle={16}
            >
              {exhibitions.map((item) => (
                <ExhibitionCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/exhibition/${item.id}`)}
                  onEdit={() => router.push(`/exhibition/create?editId=${item.id}`)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* 구분선2 */}
        <Animated.View entering={FadeIn.delay(440).duration(300)} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* 퀵 액션 */}
        <View style={styles.sectionHeader}>
          <Animated.Text entering={FadeIn.delay(450).duration(300)} style={styles.sectionTitle}>
            시작하기
          </Animated.Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard icon="🏛️" title="전시관 만들기" desc="나만의 가상 전시 공간을 만드세요" delay={500} onPress={() => router.push('/exhibition/create')} />
          {/* <QuickCard icon="🖼️" title="전시관 둘러보기" desc="다양한 온라인 전시를 감상하세요" delay={580} />
          <QuickCard icon="👥" title="작가 팔로우" desc="좋아하는 작가를 팔로우하세요" delay={660} />
          <QuickCard icon="💬" title="커뮤니티" desc="창작자들과 소통하세요" delay={740} /> */}
        </View>

        {/* 안내 카드 */}
        <Animated.View entering={FadeInDown.delay(800).duration(400).springify()} style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <PlayfulDiamond size={12} />
          </View>
          <Text style={styles.infoTitle}>곧 더 많은 기능이 찾아옵니다</Text>
          <Text style={styles.infoDesc}>
            작품 업로드, 피드, 팔로우, 알림 등{'\n'}다양한 기능이 준비 중입니다
          </Text>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>Coming Soon</Text>
          </View>
        </Animated.View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 90,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  logoutText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
    letterSpacing: 1,
  },

  profileSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#212a35',
    borderWidth: 1.5,
    borderColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  avatarDiamond: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#212a35',
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 1,
  },
  email: {
    fontSize: 12,
    color: C.mutedLight,
    letterSpacing: 0.5,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  sectionHeader: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 2,
  },

  quickGrid: {
    gap: 12,
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    backgroundColor: '#212a35',
  },
  quickIcon: {
    fontSize: 28,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 0.5,
  },
  quickDesc: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 16,
  },

  infoCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#212a35',
  },
  infoIconWrap: {
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
  },
  infoDesc: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  infoBadge: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#333d4b',
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 2,
  },

  /* 내 전시관 */
  exSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 14,
  },
  exHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exScrollBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  exScrollBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exScrollBtnText: {
    fontSize: 14,
    color: C.muted,
  },
  exNewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.gold,
  },
  exNewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 0.5,
  },
  exList: {
    gap: 12,
    paddingBottom: 4,
  },
  exCard: {
    width: 160,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: '#212a35',
    overflow: 'hidden',
  },
  exPosterWrap: {
    position: 'relative',
  },
  exPoster: {
    width: '100%',
    height: 110,
  },
  exPosterPlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: '#212a35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exPosterEmoji: {
    fontSize: 40,
  },
  exBadgeRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    gap: 4,
  },
  exBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(25,31,40,0.75)',
  },
  exBadgePublished: {
    backgroundColor: 'rgba(200,169,110,0.18)',
  },
  exBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.3,
  },
  exTitleWrap: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 0.3,
  },
  exBtnRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  exEditBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: 'rgba(200,169,110,0.08)',
  },
  exEditText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 0.5,
  },
  exDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D94040',
    backgroundColor: 'rgba(217,64,64,0.08)',
  },
  exDeleteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D94040',
    letterSpacing: 0.5,
  },
});
