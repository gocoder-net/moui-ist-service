import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { getCreatorVerificationStatusText } from '@/constants/creator-verification';
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
import { supabase } from '@/lib/supabase';

const USER_TYPE_LABELS: Record<string, string> = {
  creator: '작가',
  aspiring: '지망생',
  audience: '감상자',
};

type TabKey = 'creator' | 'aspiring' | 'audience';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'creator', label: '작가' },
  { key: 'aspiring', label: '지망생' },
  { key: 'audience', label: '감상자' },
];

type ArtistCard = {
  id: string;
  name: string | null;
  username: string;
  field: string | null;
  avatar_url: string | null;
  user_type: string;
  verified: boolean;
  artworkCount: number;
  coverImage: string | null;
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
function PlayfulDiamond({ color = '#C8A96E' }: { color?: string }) {
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
    <Animated.View style={[{ width: 16, height: 16, borderWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] }, animStyle]} />
  );
}

/* ── 메인 화면 ── */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();
  const { width: screenW } = useWindowDimensions();
  const MAX_CONTENT_W = 680;
  const numCols = 3;
  const [artists, setArtists] = useState<ArtistCard[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('creator');
  const [loading, setLoading] = useState(true);

  const loadArtists = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, field, avatar_url, user_type, verified')
      .in('user_type', ['creator', 'aspiring', 'audience']);

    if (!profiles || profiles.length === 0) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const { data: artworks } = await supabase
      .from('artworks')
      .select('user_id, image_url');

    const artworkMap = new Map<string, { count: number; cover: string | null }>();
    artworks?.forEach((aw) => {
      const existing = artworkMap.get(aw.user_id);
      if (existing) {
        existing.count++;
      } else {
        artworkMap.set(aw.user_id, { count: 1, cover: aw.image_url });
      }
    });

    const result: ArtistCard[] = profiles
      .map((p) => {
        const info = artworkMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          username: p.username,
          field: p.field,
          avatar_url: p.avatar_url,
          user_type: p.user_type,
          verified: !!(p as { verified?: boolean | null }).verified,
          artworkCount: info?.count ?? 0,
          coverImage: info?.cover ?? null,
        };
      });

    setArtists(result);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadArtists();
    }, [loadArtists]),
  );

  const tabCounts = (() => {
    const counts: Record<TabKey, number> = { creator: 0, aspiring: 0, audience: 0 };
    artists.forEach((a) => {
      if (a.artworkCount > 0 && a.user_type in counts) counts[a.user_type as TabKey]++;
    });
    return counts;
  })();

  const filtered = (() => {
    let list = artists.filter((a) => a.user_type === activeTab);

    if (search.trim()) {
      // 검색 시: 이름/아이디가 정확히 일치하면 작품 없어도 표시
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          a.field?.toLowerCase().includes(q),
      );
    } else {
      // 기본: 작품 올린 유저만 표시
      list = list.filter((a) => a.artworkCount > 0);
    }

    if (user?.id) {
      const meIdx = list.findIndex((a) => a.id === user.id);
      if (meIdx > 0) {
        const me = list[meIdx];
        list = [me, ...list.slice(0, meIdx), ...list.slice(meIdx + 1)];
      }
    }
    return list;
  })();

  const isMe = (item: ArtistCard) => user?.id === item.id;

  const renderArtistCard = ({ item, index }: { item: ArtistCard; index: number }) => {
    const me = isMe(item);
    return (
      <Animated.View entering={FadeInDown.delay(80 + index * 40).duration(400).springify()} style={styles.gridItem}>
        <Pressable
          style={({ pressed }) => [
            styles.artistCard,
            { borderColor: me ? C.gold : C.border, backgroundColor: C.card },
            me && { borderWidth: 1.5 },
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push(`/artist/${item.username}`)}
        >
          {/* Cover background */}
          {item.coverImage && (
            <Image
              source={{ uri: item.coverImage }}
              style={styles.artistCover}
              blurRadius={8}
              resizeMode="cover"
            />
          )}
          <View style={[styles.artistCoverOverlay, { backgroundColor: C.bg === '#000000' ? 'rgba(0,0,0,0.80)' : 'rgba(245,246,248,0.80)' }]} />

          {/* "나" badge */}
          {me && (
            <View style={[styles.meBadge, { backgroundColor: C.gold }]}>
              <Text style={styles.meBadgeText}>나</Text>
            </View>
          )}

          {/* Content */}
          <View style={styles.artistCardContent}>
            <View style={[styles.artistAvatar, { backgroundColor: C.bg, borderColor: me ? C.gold : C.border }]}>
              {item.avatar_url?.trim() ? (
                <Image
                  source={{ uri: item.avatar_url.trim() }}
                  style={styles.artistAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.artistAvatarText}>
                  {item.user_type === 'creator' ? '🎨' : '✏️'}
                </Text>
              )}
            </View>

            <Text style={[styles.artistName, { color: C.fg }]} numberOfLines={1}>
              {item.name ?? item.username}
            </Text>

            <View style={styles.badgeRow}>
              {item.user_type === 'creator' ? (
                <View
                  style={[
                    styles.verifyBadge,
                    {
                      borderColor: C.gold,
                      backgroundColor: C.goldDim,
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: C.gold }]}>
                    작가{' '}
                    <Text style={{ color: item.verified ? '#22c55e' : C.danger }}>
                      {getCreatorVerificationStatusText(item.verified)}
                    </Text>
                  </Text>
                </View>
              ) : (
                <View style={[styles.typeBadge, { borderColor: C.gold, backgroundColor: C.goldDim }]}>
                  <Text style={[styles.badgeText, { color: C.gold }]}>
                    {USER_TYPE_LABELS[item.user_type] ?? item.user_type}
                  </Text>
                </View>
              )}
            </View>

            {item.field && (
              <Text style={[styles.artistField, { color: C.muted }]} numberOfLines={1}>{item.field}</Text>
            )}

            {item.user_type !== 'audience' && (
              <Text style={[styles.countText, { color: C.gold }]}>{item.artworkCount} 작품</Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
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

      <View style={styles.innerContainer}>
      {/* 상단 타이틀 */}
      <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.topHeader}>
        <Text style={[styles.topTitle, { color: C.fg }]}>작품구경</Text>
      </Animated.View>

      {/* 유형 탭 (작가 / 지망생 / 감상자) */}
      <Animated.View entering={FadeInDown.delay(180).duration(400).springify()} style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Text style={[styles.tabLabel, { color: active ? C.fg : C.mutedLight }]} numberOfLines={1}>
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <Text style={[styles.tabCount, { color: active ? C.gold : C.mutedLight }]}> {tabCounts[t.key]}</Text>
                )}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: C.gold }]} />}
            </Pressable>
          );
        })}
      </Animated.View>

      {/* 검색 바 */}
      <Animated.View entering={FadeInDown.delay(260).duration(400).springify()} style={styles.searchWrap}>
        <View style={[styles.searchBar, { borderColor: C.border, backgroundColor: C.card }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: C.fg }]}
            placeholder="이름, 분야 검색..."
            placeholderTextColor={C.mutedLight}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* 작가 리스트 */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <View style={[styles.loadingDiamond, { borderColor: C.gold }]} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyDiamond, { borderColor: C.gold }]} />
          <Text style={[styles.emptyText, { color: C.muted }]}>
            {search.trim()
              ? '검색 결과가 없습니다'
              : `아직 등록된 ${USER_TYPE_LABELS[activeTab]}가 없습니다`}
          </Text>
        </View>
      ) : (
        <FlatList
          key={`${activeTab}-${numCols}`}
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderArtistCard}
          numColumns={numCols}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },

  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '800',
  },

  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 18,
  },
  tabItem: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },

  searchWrap: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  gridRow: {
    gap: 10,
  },
  gridItem: {
    flex: 1,
    marginBottom: 8,
  },

  /* Artist Card (grid square) */
  artistCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    aspectRatio: 0.78,
  },
  artistCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  artistCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  meBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 2,
  },
  meBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  artistCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  artistAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  artistAvatarImage: {
    width: '100%',
    height: '100%',
  },
  artistAvatarText: {
    fontSize: 15,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifyBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  artistName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  artistField: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  countText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* States */
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDiamond: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  emptyDiamond: {
    width: 12,
    height: 12,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  emptyText: {
    fontSize: 14,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
