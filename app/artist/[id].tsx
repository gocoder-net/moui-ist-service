import { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Linking,
  Platform,
  useWindowDimensions,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Artwork = Database['public']['Tables']['artworks']['Row'];

const MAX_CONTENT_W = 680;
const MAX_HERO_H = 320;

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
};

const Fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};

const TAB_ITEMS = [
  { name: '/(tabs)', icon: 'house.fill' as const, label: '홈' },
  { name: '/(tabs)/explore', icon: 'paperplane.fill' as const, label: '탐색' },
  { name: '/(tabs)/profile', icon: 'person.fill' as const, label: '내 정보' },
];

/* ── Bottom Tab Bar ── */
function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const paddingBottom = Math.max(insets.bottom, 8);

  const content = (
    <View style={[tabStyles.tabRow, { paddingBottom }]}>
      {TAB_ITEMS.map((tab) => (
        <Pressable
          key={tab.name}
          onPress={() => router.replace(tab.name as any)}
          style={({ pressed }) => [tabStyles.tab, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol size={22} name={tab.icon} color="#6b7280" />
          <Text style={tabStyles.tabLabel}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={tabStyles.wrapper}>
        <View style={tabStyles.blurFallback}>{content}</View>
      </View>
    );
  }

  return (
    <View style={tabStyles.wrapper}>
      <BlurView intensity={60} tint="dark" style={tabStyles.blur}>
        {content}
      </BlurView>
    </View>
  );
}

/* ── SNS icon helper ── */
function snsIcon(key: string): string {
  const map: Record<string, string> = {
    instagram: '📸', twitter: '🐦', youtube: '🎬', behance: '🎨',
    dribbble: '🏀', github: '💻', website: '🌐', blog: '📝',
  };
  return map[key.toLowerCase()] || '🔗';
}

/* ── Animated Counter ── */
function AnimatedCounter({ to, duration = 1200, style }: { to: number; duration?: number; style?: any }) {
  const [display, setDisplay] = useState(0);
  const val = useSharedValue(0);

  useEffect(() => {
    val.value = 0;
    val.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) });

    // Poll the shared value to update display
    let frame: any;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease out
      setDisplay(Math.round(eased * to));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);

  return <Text style={style}>{display}</Text>;
}

/* ── Artwork Card with parallax + gradient + press effect ── */
function ArtworkCard({
  artwork,
  index,
  isHero,
  scrollY,
  layoutY,
  cardW,
  cardH,
  viewH,
  onPress,
}: {
  artwork: Artwork;
  index: number;
  isHero: boolean;
  scrollY: SharedValue<number>;
  layoutY: number;
  cardW: number;
  cardH: number;
  viewH: number;
  onPress: () => void;
}) {
  const scaleVal = useSharedValue(1);

  const fadeStyle = useAnimatedStyle(() => {
    const distFromView = layoutY - scrollY.value - viewH;
    return {
      opacity: interpolate(distFromView, [viewH * 0.3, 0], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(distFromView, [viewH * 0.3, 0], [40, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const parallaxStyle = useAnimatedStyle(() => {
    const offset = layoutY - scrollY.value;
    return {
      transform: [
        { translateY: interpolate(offset, [-viewH, viewH], [30, -30], Extrapolation.CLAMP) },
      ],
    };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
  }));

  const handlePressIn = () => {
    scaleVal.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scaleVal.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  return (
    <Animated.View style={[fadeStyle, { width: isHero ? '100%' : cardW, marginBottom: 12 }]}>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={[styles.artCard, { height: cardH }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, parallaxStyle]}>
              <Image
                source={{ uri: artwork.image_url }}
                style={{ width: '100%', height: cardH + 60, top: -30 }}
                resizeMode="cover"
              />
            </Animated.View>
            {/* gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(25,31,40,0.0)', 'rgba(25,31,40,0.7)', 'rgba(25,31,40,0.92)']}
              locations={[0, 0.35, 0.7, 1]}
              style={styles.artGradient}
            />
            {/* metadata */}
            <View style={styles.artOverlay}>
              <Text style={styles.artTitle} numberOfLines={1}>{artwork.title}</Text>
              {(artwork.year || artwork.medium) && (
                <Text style={styles.artMeta} numberOfLines={1}>
                  {[artwork.year, artwork.medium].filter(Boolean).join(' · ')}
                </Text>
              )}
              {artwork.width_cm && artwork.height_cm && (
                <Text style={styles.artSize}>{artwork.width_cm} × {artwork.height_cm} cm</Text>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* ── Fullscreen Artwork Viewer ── */
function ArtworkViewer({
  visible,
  artworks,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  artworks: Artwork[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible) return null;

  const artwork = artworks[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.viewerRoot}>
        {/* Close button */}
        <Pressable
          style={[styles.viewerCloseBtn, { top: insets.top + 12 }]}
          onPress={onClose}
        >
          <Text style={styles.viewerCloseText}>✕</Text>
        </Pressable>

        {/* Image swiper */}
        <FlatList
          ref={flatListRef}
          data={artworks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: screenW, offset: screenW * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
            setCurrentIndex(idx);
          }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: screenW, height: screenH, justifyContent: 'center', alignItems: 'center' }}>
              <Image
                source={{ uri: item.image_url }}
                style={{ width: screenW, height: screenH * 0.6 }}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Bottom info */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.viewerBottom, { paddingBottom: insets.bottom + 24 }]}
          pointerEvents="none"
        >
          <Text style={styles.viewerTitle}>{artwork?.title}</Text>
          {(artwork?.year || artwork?.medium) && (
            <Text style={styles.viewerMeta}>
              {[artwork?.year, artwork?.medium].filter(Boolean).join(' · ')}
            </Text>
          )}
          {artwork?.width_cm && artwork?.height_cm && (
            <Text style={styles.viewerSize}>{artwork.width_cm} × {artwork.height_cm} cm</Text>
          )}
          {/* pagination dots */}
          {artworks.length > 1 && (
            <View style={styles.viewerDots}>
              <Text style={styles.viewerCounter}>
                {currentIndex + 1} / {artworks.length}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

/* ── Main Page ── */
export default function ArtistPortfolioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const heroH = Math.min(screenH * 0.4, MAX_HERO_H);
  const contentW = Math.min(screenW, MAX_CONTENT_W);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const diamondRotation = useSharedValue(0);
  useEffect(() => {
    diamondRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false,
    );
  }, []);
  const diamondSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${diamondRotation.value}deg` }],
  }));

  useEffect(() => { if (id) loadData(); }, [id]);
  useFocusEffect(useCallback(() => { if (id) loadData(); }, [id]));

  const loadData = async () => {
    setLoading(true);
    const [profileRes, artworksRes, followCountRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('artworks').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (artworksRes.data) setArtworks(artworksRes.data);
    setFollowerCount(followCountRes.count ?? 0);

    if (user?.id && user.id !== id) {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id)
        .eq('following_id', id);
      setIsFollowing((count ?? 0) > 0);
    }
    setLoading(false);
  };

  const toggleFollow = async () => {
    if (!user?.id || user.id === id) return;
    if (isFollowing) {
      await supabase.from('follows').delete().match({ follower_id: user.id, following_id: id });
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      setFollowerCount((c) => c + 1);
    }
    setIsFollowing(!isFollowing);
  };

  /* ── Parallax styles ── */
  const heroBgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, heroH], [0, heroH * 0.3], Extrapolation.CLAMP) },
    ],
  }));

  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, heroH * 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, heroH * 0.5], [0, -40], Extrapolation.CLAMP) },
    ],
  }));

  /* ── SNS links ── */
  const snsLinks: Record<string, string> = (() => {
    if (!profile?.sns_links) return {};
    if (typeof profile.sns_links === 'string') {
      try { return JSON.parse(profile.sns_links); } catch { return {}; }
    }
    if (typeof profile.sns_links === 'object' && !Array.isArray(profile.sns_links)) {
      return profile.sns_links as Record<string, string>;
    }
    return {};
  })();
  const snsEntries = Object.entries(snsLinks).filter(([, v]) => v);

  const heroImage = artworks[0]?.image_url;

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={diamondSpinStyle}>
          <View style={styles.loadingDiamond} />
        </Animated.View>
        <Text style={{ color: C.muted, marginTop: 16, letterSpacing: 2, fontSize: 12 }}>LOADING</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.muted, fontSize: 16 }}>작가를 찾을 수 없습니다</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.gold }}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  /* ── Gallery layout: 3-cycle (1 hero + 2 grid) ── */
  const galleryPad = 24;
  const heroCardW = contentW - galleryPad * 2;
  const heroCardH = heroCardW * 0.65;
  const gridCardW = (contentW - galleryPad * 2 - 12) / 2;
  const gridCardH = gridCardW * 1.2;
  const galleryStartY = heroH + (profile?.bio ? 200 : 0) + 50;

  const rows: any[] = [];
  let artworkIndexMap: number[] = []; // maps row artwork to global index
  let cumulativeY = galleryStartY;
  let globalIdx = 0;
  for (let i = 0; i < artworks.length; ) {
    const cyclePos = i % 3;
    if (cyclePos === 0) {
      rows.push({ type: 'hero', artwork: artworks[i], layoutY: cumulativeY, globalIdx: i });
      cumulativeY += heroCardH + 12;
      i++;
    } else {
      rows.push({
        type: 'grid',
        artworks: artworks.slice(i, i + 2),
        layoutY: cumulativeY,
        globalIdx: i,
      });
      cumulativeY += gridCardH + 12;
      i += 2;
    }
  }

  const openViewer = (artworkIndex: number) => {
    setViewerIndex(artworkIndex);
    setViewerVisible(true);
  };

  return (
    <View style={styles.root}>
      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ HERO SECTION ═══ */}
        <View style={[styles.heroWrap, { height: heroH }]}>
          {heroImage && (
            <Animated.View style={[StyleSheet.absoluteFill, heroBgStyle]}>
              <Image
                source={{ uri: heroImage }}
                style={[StyleSheet.absoluteFill, { width: screenW, height: heroH + heroH * 0.3 }]}
                blurRadius={50}
                resizeMode="cover"
              />
            </Animated.View>
          )}
          {/* gradient overlay */}
          <LinearGradient
            colors={['rgba(25,31,40,0.3)', 'rgba(25,31,40,0.65)', 'rgba(25,31,40,0.95)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View style={[styles.heroContent, heroContentStyle]}>
            {/* diamond */}
            <Animated.View style={[styles.heroDiamond, diamondSpinStyle]} />

            <Text style={styles.heroName}>{profile.name ?? profile.username}</Text>

            {profile.field && (
              <Text style={styles.heroField}>{profile.field}</Text>
            )}

            {/* diamond divider */}
            <View style={styles.heroDividerRow}>
              <View style={styles.heroDividerLine} />
              <View style={styles.heroDividerDiamond} />
              <View style={styles.heroDividerLine} />
            </View>

            {/* stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <AnimatedCounter to={artworks.length} style={styles.statNumber} />
                <Text style={styles.statLabel}>작품</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <AnimatedCounter to={followerCount} style={styles.statNumber} />
                <Text style={styles.statLabel}>팔로워</Text>
              </View>
            </View>

            {/* follow button */}
            {user?.id && user.id !== id && (
              <Pressable
                style={({ pressed }) => [
                  styles.followBtn,
                  isFollowing && styles.followBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={toggleFollow}
              >
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? '팔로잉' : '팔로우'}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>

        {/* ═══ BIO SECTION ═══ */}
        {profile.bio && (
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={[styles.bioSection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={styles.bioQuote}>"</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
            <Text style={[styles.bioQuote, { alignSelf: 'flex-end' }]}>"</Text>
            <View style={styles.bioDivider} />
          </Animated.View>
        )}

        {/* ═══ GALLERY SECTION ═══ */}
        {artworks.length > 0 ? (
          <View style={[styles.gallerySection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={styles.sectionLabel}>WORKS</Text>
            <View style={styles.sectionLabelLine} />

            {rows.map((row: any, idx: number) => {
              if (row.type === 'hero') {
                return (
                  <ArtworkCard
                    key={row.artwork.id}
                    artwork={row.artwork}
                    index={row.globalIdx}
                    isHero
                    scrollY={scrollY}
                    layoutY={row.layoutY}
                    cardW={heroCardW}
                    cardH={heroCardH}
                    viewH={screenH}
                    onPress={() => openViewer(row.globalIdx)}
                  />
                );
              }
              return (
                <View key={`grid-${idx}`} style={styles.gridRow}>
                  {row.artworks.map((aw: Artwork, gi: number) => (
                    <ArtworkCard
                      key={aw.id}
                      artwork={aw}
                      index={row.globalIdx + gi}
                      isHero={false}
                      scrollY={scrollY}
                      layoutY={row.layoutY}
                      cardW={gridCardW}
                      cardH={gridCardH}
                      viewH={screenH}
                      onPress={() => openViewer(row.globalIdx + gi)}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <View style={styles.emptyDiamond} />
            <Text style={styles.emptyText}>아직 등록된 작품이 없습니다</Text>
          </View>
        )}

        {/* ═══ SNS / CONTACT SECTION ═══ */}
        {snsEntries.length > 0 && (
          <View style={[styles.snsSection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={styles.sectionLabelLine} />
            {snsEntries.map(([key, url]) => (
              <Pressable
                key={key}
                style={styles.snsRow}
                onPress={() => Linking.openURL(url)}
              >
                <Text style={styles.snsIcon}>{snsIcon(key)}</Text>
                <Text style={styles.snsKey}>{key}</Text>
                <Text style={styles.snsArrow}>→</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* footer */}
        <View style={styles.footer}>
          <View style={styles.footerDiamond} />
          <Text style={styles.footerText}>MOUI-IST</Text>
        </View>
      </Animated.ScrollView>

      {/* Bottom tab bar */}
      <BottomTabBar />

      {/* Fullscreen viewer */}
      <ArtworkViewer
        visible={viewerVisible}
        artworks={artworks}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  /* Back button */
  backBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(25,31,40,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  backText: {
    color: C.fg,
    fontSize: 20,
    fontWeight: '300',
  },

  /* Hero */
  heroWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  heroDiamond: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: C.gold,
    marginBottom: 8,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 6,
    textAlign: 'center',
  },
  heroField: {
    fontSize: 14,
    fontWeight: '600',
    color: C.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  heroDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  heroDividerLine: {
    width: 40,
    height: 1,
    backgroundColor: C.gold,
  },
  heroDividerDiamond: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.mutedLight,
  },

  /* Follow */
  followBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.gold,
    marginTop: 4,
  },
  followBtnActive: {
    backgroundColor: C.gold,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 1,
  },
  followBtnTextActive: {
    color: C.bg,
  },

  /* Bio */
  bioSection: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  bioQuote: {
    fontSize: 48,
    color: C.gold,
    fontFamily: Fonts.serif,
    lineHeight: 48,
    opacity: 0.5,
  },
  bioText: {
    fontSize: 18,
    color: C.fg,
    fontFamily: Fonts.serif,
    lineHeight: 32,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  bioDivider: {
    width: 40,
    height: 1,
    backgroundColor: C.gold,
    alignSelf: 'center',
    marginTop: 32,
  },

  /* Gallery */
  gallerySection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 8,
  },
  sectionLabelLine: {
    width: 24,
    height: 1,
    backgroundColor: C.gold,
    marginBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  artCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#212a35',
  },
  artGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  artOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  artTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artMeta: {
    fontSize: 11,
    color: 'rgba(242,244,246,0.7)',
    marginTop: 2,
  },
  artSize: {
    fontSize: 10,
    color: 'rgba(242,244,246,0.5)',
    marginTop: 1,
  },

  /* Empty */
  emptySection: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
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

  /* SNS */
  snsSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  snsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  snsIcon: { fontSize: 18 },
  snsKey: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.fg,
    letterSpacing: 1,
    textTransform: 'capitalize',
  },
  snsArrow: {
    fontSize: 16,
    color: C.gold,
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  footerDiamond: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  footerText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.mutedLight,
    letterSpacing: 4,
  },

  /* Loading */
  loadingDiamond: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  /* Fullscreen Viewer */
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  viewerCloseBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
  },
  viewerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  viewerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  viewerMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  viewerSize: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  viewerDots: {
    marginTop: 16,
    alignItems: 'center',
  },
  viewerCounter: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },
});

const tabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blur: {
    overflow: 'hidden',
  },
  blurFallback: {
    backgroundColor: 'rgba(25, 31, 40, 0.85)',
    backdropFilter: 'blur(20px)',
  } as any,
  tabRow: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200, 169, 110, 0.12)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#6b7280',
  },
});
