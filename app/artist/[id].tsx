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
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeMode } from '@/contexts/theme-context';
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
  const { mode, colors: C } = useThemeMode();
  const paddingBottom = Math.max(insets.bottom, 8);

  const content = (
    <View style={[tabStyles.tabRow, { paddingBottom }]}>
      {TAB_ITEMS.map((tab) => (
        <Pressable
          key={tab.name}
          onPress={() => router.replace(tab.name as any)}
          style={({ pressed }) => [tabStyles.tab, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol size={22} name={tab.icon} color={C.mutedLight} />
          <Text style={[tabStyles.tabLabel, { color: C.mutedLight }]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={tabStyles.wrapper}>
        <View style={[tabStyles.blurFallback, {
          backgroundColor: mode === 'dark' ? 'rgba(25, 31, 40, 0.85)' : 'rgba(245, 246, 248, 0.85)',
        }]}>{content}</View>
      </View>
    );
  }

  return (
    <View style={tabStyles.wrapper}>
      <BlurView intensity={60} tint={mode === 'dark' ? 'dark' : 'light'} style={tabStyles.blur}>
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

    let frame: any;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
  C,
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
  C: any;
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
          <View style={[styles.artCard, { height: cardH, backgroundColor: C.card }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, parallaxStyle]}>
              <Image
                source={{ uri: artwork.image_url }}
                style={{ width: '100%', height: cardH + 60, top: -30 }}
                resizeMode="cover"
              />
            </Animated.View>
            <LinearGradient
              colors={['transparent', 'rgba(25,31,40,0.0)', 'rgba(25,31,40,0.7)', 'rgba(25,31,40,0.92)']}
              locations={[0, 0.35, 0.7, 1]}
              style={styles.artGradient}
            />
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
  isOwner,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  artworks: Artwork[];
  initialIndex: number;
  onClose: () => void;
  isOwner?: boolean;
  onEdit?: (artwork: Artwork) => void;
  onDelete?: (artwork: Artwork) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [viewerHovered, setViewerHovered] = useState(false);
  const flatListRef = useRef<FlatList<Artwork>>(null);
  const isWebViewer = Platform.OS === 'web';
  const viewerFrameWidth = isWebViewer ? Math.min(screenW * 0.88, 1280) : screenW;
  const viewerImageHeight = isWebViewer ? screenH * 0.72 : screenH * 0.6;
  const viewerNavOffset = isWebViewer ? Math.max((screenW - viewerFrameWidth) / 2 + 18, 18) : 18;

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible) return null;

  const artwork = artworks[currentIndex];

  const handleDelete = () => {
    if (!artwork) return;
    if (Platform.OS === 'web') {
      if (window.confirm('이 작품을 삭제하시겠습니까?\n삭제된 작품은 복구할 수 없습니다.')) {
        onDelete?.(artwork);
      }
    } else {
      Alert.alert('작품 삭제', '이 작품을 삭제하시겠습니까?\n삭제된 작품은 복구할 수 없습니다.', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => onDelete?.(artwork) },
      ]);
    }
  };

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
    if (idx !== currentIndex && idx >= 0 && idx < artworks.length) {
      setCurrentIndex(idx);
    }
  };

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= artworks.length) return;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < artworks.length - 1;

  const viewerList = (
    <FlatList
      ref={flatListRef}
      data={artworks}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, i) => ({ length: screenW, offset: screenW * i, index: i })}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ width: screenW, height: screenH, justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={{ uri: item.image_url }}
            style={{ width: viewerFrameWidth, height: viewerImageHeight }}
            resizeMode="contain"
          />
        </View>
      )}
    />
  );

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
        {isWebViewer ? (
          <View
            style={styles.viewerStage}
            {...({
              onMouseEnter: () => setViewerHovered(true),
              onMouseLeave: () => setViewerHovered(false),
            } as any)}
          >
            {viewerList}
            {artworks.length > 1 && viewerHovered && (
              <>
                {canGoPrev && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.viewerNavButton,
                      styles.viewerNavButtonLeft,
                      { left: viewerNavOffset },
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => scrollToIndex(currentIndex - 1)}
                  >
                    <Text style={styles.viewerNavText}>‹</Text>
                  </Pressable>
                )}
                {canGoNext && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.viewerNavButton,
                      styles.viewerNavButtonRight,
                      { right: viewerNavOffset },
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => scrollToIndex(currentIndex + 1)}
                  >
                    <Text style={styles.viewerNavText}>›</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.viewerStage}>
            {viewerList}
          </View>
        )}

        {/* Bottom info */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.viewerBottom, { paddingBottom: insets.bottom + 24 }]}
          pointerEvents="box-none"
        >
          <View style={styles.viewerInfoRow}>
            <View style={styles.viewerInfoLeft}>
              <Text style={styles.viewerTitle}>{artwork?.title}</Text>
              {(artwork?.year || artwork?.medium) && (
                <Text style={styles.viewerMeta}>
                  {[artwork?.year, artwork?.medium].filter(Boolean).join(' · ')}
                </Text>
              )}
              {artwork?.width_cm && artwork?.height_cm && (
                <Text style={styles.viewerSize}>{artwork.width_cm} × {artwork.height_cm} cm</Text>
              )}
            </View>

            {/* Owner action buttons - small, bottom-right */}
            {isOwner && artwork && (
              <View style={styles.viewerActions}>
                <Pressable
                  style={({ pressed }) => [styles.viewerEditBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => onEdit?.(artwork)}
                >
                  <Text style={styles.viewerEditText}>수정</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.viewerDeleteBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleDelete}
                >
                  <Text style={styles.viewerDeleteText}>삭제</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* pagination */}
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
  const { colors: C } = useThemeMode();
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
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }]}>
        <Animated.View style={diamondSpinStyle}>
          <View style={[styles.loadingDiamond, { borderColor: C.gold }]} />
        </Animated.View>
        <Text style={{ color: C.muted, marginTop: 16, letterSpacing: 2, fontSize: 12 }}>LOADING</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }]}>
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
  let cumulativeY = galleryStartY;
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

  const isOwner = user?.id === id;
  const artistName = profile.name ?? profile.username;
  const avatarInitial = artistName.trim().charAt(0).toUpperCase() || 'A';

  const openViewer = (artworkIndex: number) => {
    setViewerIndex(artworkIndex);
    setViewerVisible(true);
  };

  const handleEditArtwork = (artwork: Artwork) => {
    setViewerVisible(false);
    router.push(`/artwork/create?artworkId=${artwork.id}`);
  };

  const handleDeleteArtwork = async (artwork: Artwork) => {
    if (artwork.image_url) {
      const parts = artwork.image_url.split('/artworks/');
      if (parts[1]) {
        await supabase.storage.from('artworks').remove([decodeURIComponent(parts[1])]);
      }
    }
    await supabase.from('artworks').delete().eq('id', artwork.id);
    setArtworks(prev => prev.filter(a => a.id !== artwork.id));
    setViewerVisible(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { top: insets.top + 8, borderColor: C.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backText, { color: C.fg }]}>←</Text>
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
          <LinearGradient
            colors={['rgba(25,31,40,0.3)', 'rgba(25,31,40,0.65)', 'rgba(25,31,40,0.95)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View style={[styles.heroContent, heroContentStyle]}>
            <LinearGradient
              colors={['rgba(16,22,30,0.84)', 'rgba(28,39,52,0.72)', 'rgba(16,22,30,0.58)']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroPanel, { borderColor: 'rgba(200,169,110,0.22)' }]}
            >
              <View style={styles.heroPanelShine} />
              <Animated.View style={[styles.heroDiamond, { borderColor: C.gold }, diamondSpinStyle]} />
              <View style={[styles.heroAvatarWrap, { borderColor: 'rgba(200,169,110,0.45)', backgroundColor: 'rgba(12,18,26,0.75)' }]}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.heroAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.heroAvatarFallback, { backgroundColor: 'rgba(200,169,110,0.16)' }]}>
                    <Text style={[styles.heroAvatarInitial, { color: C.gold }]}>{avatarInitial}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.heroName, { color: C.fg }]}>{artistName}</Text>

              {profile.field && (
                <Text style={[styles.heroField, { color: C.gold }]}>{profile.field}</Text>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <AnimatedCounter to={artworks.length} style={[styles.statNumber, { color: C.fg }]} />
                  <Text style={[styles.statLabel, { color: C.muted }]}>작품</Text>
                </View>
                <View style={[styles.statDot, { backgroundColor: C.mutedLight }]} />
                <View style={styles.statItem}>
                  <AnimatedCounter to={followerCount} style={[styles.statNumber, { color: C.fg }]} />
                  <Text style={[styles.statLabel, { color: C.muted }]}>팔로워</Text>
                </View>
              </View>

              {user?.id && user.id !== id && (
                <Pressable
                  style={({ pressed }) => [
                    styles.followBtn,
                    { borderColor: C.gold },
                    isFollowing && { backgroundColor: C.gold },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={toggleFollow}
                >
                  <Text style={[styles.followBtnText, { color: C.gold }, isFollowing && { color: C.bg }]}>
                    {isFollowing ? '팔로잉' : '팔로우'}
                  </Text>
                </Pressable>
              )}
            </LinearGradient>
          </Animated.View>
        </View>

        {/* ═══ BIO SECTION ═══ */}
        {profile.bio && (
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={[styles.bioSection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={[styles.bioQuote, { color: C.gold }]}>"</Text>
            <Text style={[styles.bioText, { color: C.fg }]}>{profile.bio}</Text>
            <Text style={[styles.bioQuote, { color: C.gold, alignSelf: 'flex-end' }]}>"</Text>
            <View style={[styles.bioDivider, { backgroundColor: C.gold }]} />
          </Animated.View>
        )}

        {/* ═══ GALLERY SECTION ═══ */}
        {artworks.length > 0 ? (
          <View style={[styles.gallerySection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={[styles.sectionLabel, { color: C.muted }]}>WORKS</Text>
            <View style={[styles.sectionLabelLine, { backgroundColor: C.gold }]} />

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
                    C={C}
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
                      C={C}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <View style={[styles.emptyDiamond, { borderColor: C.gold }]} />
            <Text style={[styles.emptyText, { color: C.muted }]}>아직 등록된 작품이 없습니다</Text>
          </View>
        )}

        {/* ═══ SNS / CONTACT SECTION ═══ */}
        {snsEntries.length > 0 && (
          <View style={[styles.snsSection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={[styles.sectionLabel, { color: C.muted }]}>CONTACT</Text>
            <View style={[styles.sectionLabelLine, { backgroundColor: C.gold }]} />
            {snsEntries.map(([key, url]) => (
              <Pressable
                key={key}
                style={[styles.snsRow, { borderBottomColor: C.border }]}
                onPress={() => Linking.openURL(url)}
              >
                <Text style={styles.snsIcon}>{snsIcon(key)}</Text>
                <Text style={[styles.snsKey, { color: C.fg }]}>{key}</Text>
                <Text style={[styles.snsArrow, { color: C.gold }]}>→</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* footer */}
        <View style={styles.footer}>
          <View style={[styles.footerDiamond, { borderColor: C.gold }]} />
          <Text style={[styles.footerText, { color: C.mutedLight }]}>MOUI-IST</Text>
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
        isOwner={isOwner}
        onEdit={handleEditArtwork}
        onDelete={handleDeleteArtwork}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  },
  backText: {
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
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroPanel: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroPanelShine: {
    position: 'absolute',
    top: 0,
    left: '22%',
    right: '22%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroDiamond: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  heroAvatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  heroField: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
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
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 1,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  /* Follow */
  followBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 4,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Bio */
  bioSection: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  bioQuote: {
    fontSize: 48,
    fontFamily: Fonts.serif,
    lineHeight: 48,
    opacity: 0.5,
  },
  bioText: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    lineHeight: 32,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  bioDivider: {
    width: 40,
    height: 1,
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
    letterSpacing: 4,
    marginBottom: 8,
  },
  sectionLabelLine: {
    width: 24,
    height: 1,
    marginBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  artCard: {
    borderRadius: 12,
    overflow: 'hidden',
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
    color: '#f2f4f6',
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
    transform: [{ rotate: '45deg' }],
  },
  emptyText: {
    fontSize: 14,
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
    gap: 12,
  },
  snsIcon: { fontSize: 18 },
  snsKey: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'capitalize',
  },
  snsArrow: {
    fontSize: 16,
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
    transform: [{ rotate: '45deg' }],
  },
  footerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
  },

  /* Loading */
  loadingDiamond: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },

  /* Fullscreen Viewer */
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  viewerStage: {
    flex: 1,
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
  viewerNavButton: {
    position: 'absolute',
    top: '50%',
    zIndex: 6,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(13,16,22,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: -28 }],
    cursor: 'pointer',
  },
  viewerNavButtonLeft: {
    left: 18,
  },
  viewerNavButtonRight: {
    right: 18,
  },
  viewerNavText: {
    fontSize: 34,
    lineHeight: 36,
    color: '#f2f4f6',
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
  viewerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  viewerInfoLeft: {
    flex: 1,
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
  viewerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  viewerEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C8A96E',
    alignItems: 'center',
  },
  viewerEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C8A96E',
  },
  viewerDeleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D94040',
    alignItems: 'center',
  },
  viewerDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D94040',
  },
  viewerDots: {
    marginTop: 12,
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
  },
});
