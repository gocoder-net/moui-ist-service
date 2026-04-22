import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
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
  bg: '#17171B',
  fg: '#EEEEF0',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#6B6B7B',
  mutedLight: '#4A4A58',
  border: '#1E1F2E',
  white: '#EEEEF0',
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
function ExhibitionCard({ item, onPress, onEdit }: { item: Exhibition; onPress: () => void; onEdit: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.exCard, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      {item.poster_image_url ? (
        <Image source={{ uri: item.poster_image_url }} style={styles.exPoster} contentFit="cover" />
      ) : (
        <View style={styles.exPosterPlaceholder}>
          <Text style={styles.exPosterEmoji}>{ROOM_EMOJI[item.room_type] ?? '🏛️'}</Text>
        </View>
      )}
      <View style={styles.exInfo}>
        <Text style={styles.exTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.exMeta}>
          <Text style={styles.exRoomType}>{ROOM_LABEL[item.room_type] ?? item.room_type}</Text>
          <Text style={styles.exMetaDot}>·</Text>
          <Text style={[styles.exPublish, item.is_published && { color: C.gold }]}>
            {item.is_published ? '공개' : '비공개'}
          </Text>
          <Pressable
            style={styles.exEditBtn}
            onPress={(e) => { e.stopPropagation(); onEdit(); }}
            hitSlop={6}
          >
            <Text style={styles.exEditText}>수정</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/* ── 메인 화면 ── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);

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

  const userTypeLabels = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
  const userTypeLabel = userTypeLabels[profile?.user_type ?? 'audience'];
  const userTypeEmoji = { creator: '🎨', aspiring: '✏️', audience: '👀' } as const;
  const emoji = userTypeEmoji[profile?.user_type ?? 'audience'];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 배경 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={100} color={C.gold} opacity={0.08} top="5%" left="2%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={140} color={C.goldLight} opacity={0.05} top="50%" left="60%" duration={7000} delay={800} />
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
              <Pressable
                style={({ pressed }) => [styles.exNewBtn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push('/exhibition/create')}
              >
                <Text style={styles.exNewBtnText}>+ 새 전시관</Text>
              </Pressable>
            </View>
            <FlatList
              data={exhibitions}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exList}
              renderItem={({ item }) => (
                <ExhibitionCard
                  item={item}
                  onPress={() => router.push(`/exhibition/${item.id}`)}
                  onEdit={() => router.push(`/exhibition/create?editId=${item.id}`)}
                />
              )}
            />
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
    paddingBottom: 40,
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
    backgroundColor: '#13141F',
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
    backgroundColor: '#13141F',
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
    backgroundColor: '#13141F',
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
    backgroundColor: '#13141F',
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
    backgroundColor: '#1E1F2E',
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
    backgroundColor: '#13141F',
    overflow: 'hidden',
  },
  exPoster: {
    width: '100%',
    height: 110,
  },
  exPosterPlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: '#13141F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exPosterEmoji: {
    fontSize: 40,
  },
  exInfo: {
    padding: 12,
    gap: 6,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 0.3,
  },
  exMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exRoomType: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  exMetaDot: {
    fontSize: 11,
    color: C.mutedLight,
  },
  exPublish: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  exEditBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
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
});
