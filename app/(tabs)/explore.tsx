import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
  white: '#f2f4f6',
};

type ArtistCard = {
  id: string;
  name: string | null;
  username: string;
  field: string | null;
  avatar_url: string | null;
  user_type: string;
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

/* ── 메인 화면 ── */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [artists, setArtists] = useState<ArtistCard[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadArtists = useCallback(async () => {
    setLoading(true);

    // Fetch all creators/aspirings with at least 1 artwork
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, field, avatar_url, user_type')
      .in('user_type', ['creator', 'aspiring']);

    if (!profiles || profiles.length === 0) {
      setArtists([]);
      setLoading(false);
      return;
    }

    // Fetch artwork counts per user
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
      .filter((p) => {
        const info = artworkMap.get(p.id);
        return info && info.count > 0;
      })
      .map((p) => {
        const info = artworkMap.get(p.id)!;
        return {
          id: p.id,
          name: p.name,
          username: p.username,
          field: p.field,
          avatar_url: p.avatar_url,
          user_type: p.user_type,
          artworkCount: info.count,
          coverImage: info.cover,
        };
      });

    setArtists(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadArtists();
  }, []);

  const filtered = search.trim()
    ? artists.filter((a) => {
        const q = search.toLowerCase();
        return (
          (a.name?.toLowerCase().includes(q)) ||
          a.username.toLowerCase().includes(q) ||
          (a.field?.toLowerCase().includes(q))
        );
      })
    : artists;

  const renderArtistCard = ({ item, index }: { item: ArtistCard; index: number }) => (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(400).springify()}>
      <Pressable
        style={({ pressed }) => [styles.artistCard, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
        onPress={() => router.push(`/artist/${item.id}`)}
      >
        {/* cover background */}
        {item.coverImage && (
          <Image
            source={{ uri: item.coverImage }}
            style={styles.artistCover}
            blurRadius={8}
            resizeMode="cover"
          />
        )}
        <View style={styles.artistCoverOverlay} />

        <View style={styles.artistCardContent}>
          {/* avatar */}
          <View style={styles.artistAvatar}>
            <Text style={styles.artistAvatarText}>
              {item.user_type === 'creator' ? '🎨' : '✏️'}
            </Text>
          </View>

          <View style={styles.artistInfo}>
            <Text style={styles.artistName} numberOfLines={1}>
              {item.name ?? item.username}
            </Text>
            {item.field && (
              <Text style={styles.artistField} numberOfLines={1}>{item.field}</Text>
            )}
          </View>

          {/* artwork count badge */}
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{item.artworkCount}</Text>
            <Text style={styles.countBadgeLabel}>작품</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

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
        <Text style={styles.subtitle}>다양한 작가들을 만나보세요</Text>
        <View style={styles.headerLine} />
      </Animated.View>

      {/* 검색 바 */}
      <Animated.View entering={FadeInDown.delay(350).duration(400).springify()} style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="작가, 분야 검색..."
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
          <View style={styles.loadingDiamond} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyDiamond} />
          <Text style={styles.emptyText}>
            {search.trim() ? '검색 결과가 없습니다' : '아직 등록된 작가가 없습니다'}
          </Text>
          {!search.trim() && (
            <Text style={styles.emptySubtext}>첫 번째 작품을 업로드해보세요!</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderArtistCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
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
    marginBottom: 20,
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

  searchWrap: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#212a35',
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.fg,
    padding: 0,
  },

  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 90,
  },

  /* Artist Card */
  artistCard: {
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#212a35',
  },
  artistCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  artistCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25,31,40,0.75)',
  },
  artistCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 14,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistAvatarText: {
    fontSize: 22,
  },
  artistInfo: {
    flex: 1,
    gap: 3,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 0.5,
  },
  artistField: {
    fontSize: 12,
    color: C.gold,
    fontWeight: '600',
    letterSpacing: 1,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(200,169,110,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 1,
  },
  countBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: C.gold,
  },
  countBadgeLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '600',
    letterSpacing: 1,
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
    borderColor: C.gold,
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
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 12,
    color: C.mutedLight,
    letterSpacing: 0.5,
  },
});
