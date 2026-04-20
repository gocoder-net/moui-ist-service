import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  bg: '#FFFFFF',
  fg: '#0A0A0A',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#999999',
  mutedLight: '#CCCCCC',
  border: '#E8E5DF',
  white: '#FFFFFF',
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
function PlayfulDiamond() {
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
    <Animated.View style={[{ width: 16, height: 16, borderWidth: 1.5, borderColor: C.gold, transform: [{ rotate: '45deg' }] }, animStyle]} />
  );
}

/* ── 카테고리 카드 ── */
const categories = [
  { emoji: '🎨', title: '회화', count: 'Coming Soon' },
  { emoji: '📷', title: '사진', count: 'Coming Soon' },
  { emoji: '✍️', title: '글', count: 'Coming Soon' },
  { emoji: '🎵', title: '음악', count: 'Coming Soon' },
  { emoji: '🎬', title: '영상', count: 'Coming Soon' },
  { emoji: '🏗️', title: '디자인', count: 'Coming Soon' },
];

/* ── 메인 화면 ── */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 배경 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={100} color={C.gold} opacity={0.08} top="8%" left="5%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={130} color={C.goldLight} opacity={0.05} top="55%" left="60%" duration={7000} delay={800} />
        <FloatingShape shape="diamond" size={18} color={C.gold} opacity={0.20} top="12%" left="85%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={22} color={C.goldLight} opacity={0.12} top="75%" left="8%" duration={3800} delay={1000} />
        <FloatingShape shape="circle" size={6} color={C.gold} opacity={0.28} top="25%" left="20%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={8} color={C.goldLight} opacity={0.20} top="45%" left="78%" duration={2500} delay={900} />
        <FloatingShape shape="line" size={60} color={C.gold} opacity={0.10} top="18%" left="50%" duration={5000} delay={1500} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 상단 바 */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.topBar}>
          <Text style={styles.enLogo}>
            MOUI<Text style={{ color: C.gold }}>-</Text>IST
          </Text>
        </Animated.View>

        {/* 헤더 */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.header}>
          <PlayfulDiamond />
          <Text style={styles.title}>탐색</Text>
          <Text style={styles.subtitle}>다양한 창작 분야를 둘러보세요</Text>
          <View style={styles.headerLine} />
        </Animated.View>

        {/* 검색 바 (플레이스홀더) */}
        <Animated.View entering={FadeInDown.delay(350).duration(400).springify()}>
          <Pressable style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>작가, 작품 검색...</Text>
          </Pressable>
        </Animated.View>

        {/* 카테고리 */}
        <Animated.Text entering={FadeIn.delay(450).duration(300)} style={styles.sectionTitle}>
          카테고리
        </Animated.Text>

        <View style={styles.categoryGrid}>
          {categories.map((cat, i) => (
            <Animated.View
              key={cat.title}
              entering={FadeInDown.delay(500 + i * 80).duration(400).springify()}
            >
              <Pressable style={({ pressed }) => [styles.categoryCard, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <Text style={styles.categoryCount}>{cat.count}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* 트렌딩 */}
        <Animated.View entering={FadeInDown.delay(900).duration(400).springify()} style={styles.trendingCard}>
          <View style={styles.trendingHeader}>
            <Text style={styles.trendingTitle}>트렌딩</Text>
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.trendingDesc}>
            아직 트렌딩 데이터가 없습니다.{'\n'}첫 번째 작품을 업로드해보세요!
          </Text>
          <View style={styles.trendingDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDiamond} />
            <View style={styles.dividerLine} />
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
    paddingVertical: 16,
    alignItems: 'center',
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },

  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 3,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: C.muted,
    letterSpacing: 1,
  },
  headerLine: {
    width: 28,
    height: 1,
    backgroundColor: C.gold,
    marginTop: 4,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 28,
    backgroundColor: '#F8F7F4',
  },
  searchIcon: {
    fontSize: 16,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: C.mutedLight,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 2,
    marginBottom: 16,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  categoryCard: {
    width: 100,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
  },
  categoryCount: {
    fontSize: 9,
    color: C.mutedLight,
    fontWeight: '600',
    letterSpacing: 1,
  },

  trendingCard: {
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDFBF7',
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
  },
  trendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.fg,
  },
  trendingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: 2,
  },
  trendingDesc: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  trendingDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 4,
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
});
