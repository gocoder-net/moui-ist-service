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
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCreatorVerificationStatusText } from '@/constants/creator-verification';
import { APP_TAB_ITEMS } from '@/constants/tab-navigation';
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
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { spendPoints } from '@/lib/points';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Artwork = Database['public']['Tables']['artworks']['Row'];
type Exhibition = Database['public']['Tables']['exhibitions']['Row'];

const MAX_CONTENT_W = 680;
const MAX_HERO_H = 220;
const ARTWORK_PAGE_SIZE = 3;

const Fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}달 전`;
}

/* ── Like Diamond Button (with animation) ── */
function LikeDiamondButton({ liked, count, onPress, size = 18 }: { liked: boolean; count: number; onPress: () => void; size?: number }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const handlePress = () => {
    if (!liked) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 150 }),
        withTiming(1, { duration: 200 }),
      );
      rotation.value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(360, { duration: 0 }),
      );
      setTimeout(() => { rotation.value = 0; }, 700);
    }
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable onPress={handlePress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Animated.View style={[{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: '#C8A96E',
        transform: [{ rotate: '45deg' }],
      }, liked && { backgroundColor: '#C8A96E', borderRadius: size * 0.16 }, animStyle]} />
      {count > 0 && <Text style={{ color: '#C8A96E', fontSize: size * 0.7, fontWeight: '700' }}>{count}</Text>}
    </Pressable>
  );
}

/* ── Spinning Diamond ── */
function SpinningDiamond({ size = 14, color = '#C8A96E', active = true }: { size?: number; color?: string; active?: boolean }) {
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) { rot.value = 0; scale.value = 1; return; }
    rot.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false);
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    );
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size, borderWidth: 2, borderColor: color }, animStyle]} />
  );
}

/* ── Bottom Tab Bar ── */
function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, colors: C } = useThemeMode();
  const paddingBottom = Math.max(insets.bottom, 8);

  const content = (
    <View style={[tabStyles.tabRow, { paddingBottom }]}>
      {APP_TAB_ITEMS.map((tab) => (
        <Pressable
          key={tab.path}
          onPress={() => router.replace(tab.path as any)}
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
          backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(245, 246, 248, 0.85)',
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

/* ── SNS meta helper ── */
function detectSnsType(url: string): { key: string; icon: string; label: string } {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am'))
    return { key: 'instagram', icon: '📸', label: 'Instagram' };
  if (lower.includes('threads.net'))
    return { key: 'threads', icon: '🧵', label: 'Threads' };
  if (lower.includes('twitter.com') || lower.includes('x.com'))
    return { key: 'twitter', icon: '🐦', label: 'X (Twitter)' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be'))
    return { key: 'youtube', icon: '🎬', label: 'YouTube' };
  if (lower.includes('tiktok.com'))
    return { key: 'tiktok', icon: '🎵', label: 'TikTok' };
  if (lower.includes('facebook.com') || lower.includes('fb.com'))
    return { key: 'facebook', icon: '👥', label: 'Facebook' };
  if (lower.includes('linkedin.com'))
    return { key: 'linkedin', icon: '💼', label: 'LinkedIn' };
  if (lower.includes('behance.net'))
    return { key: 'behance', icon: '🎨', label: 'Behance' };
  if (lower.includes('dribbble.com'))
    return { key: 'dribbble', icon: '🏀', label: 'Dribbble' };
  if (lower.includes('artstation.com'))
    return { key: 'artstation', icon: '🖼️', label: 'ArtStation' };
  if (lower.includes('pixiv.net'))
    return { key: 'pixiv', icon: '🖌️', label: 'Pixiv' };
  if (lower.includes('github.com'))
    return { key: 'github', icon: '💻', label: 'GitHub' };
  if (lower.includes('notion.so') || lower.includes('notion.site'))
    return { key: 'notion', icon: '🗂️', label: 'Notion' };
  if (lower.includes('blog.naver.com'))
    return { key: 'blog', icon: '📝', label: '네이버 블로그' };
  if (lower.includes('brunch.co.kr'))
    return { key: 'blog', icon: '🍞', label: '브런치' };
  if (lower.includes('tistory.com'))
    return { key: 'blog', icon: '📔', label: '티스토리' };
  if (lower.includes('medium.com'))
    return { key: 'blog', icon: '✒️', label: 'Medium' };
  if (lower.includes('soundcloud.com'))
    return { key: 'soundcloud', icon: '🔊', label: 'SoundCloud' };
  if (lower.includes('spotify.com'))
    return { key: 'spotify', icon: '🎧', label: 'Spotify' };
  if (lower.includes('bandcamp.com'))
    return { key: 'bandcamp', icon: '💿', label: 'Bandcamp' };
  if (lower.includes('vimeo.com'))
    return { key: 'vimeo', icon: '🎞️', label: 'Vimeo' };
  return { key: 'website', icon: '🌐', label: '웹사이트' };
}

const USER_TYPE_LABELS: Record<string, string> = { creator: '작가', aspiring: '지망생', audience: '일반' };
const USER_TYPE_EMOJI: Record<string, string> = { creator: '🎨', aspiring: '✏️', audience: '👀' };

const FIELD_ICON_MAP: Record<string, string> = {
  글: '✍️',
  그림: '🎨',
  영상: '🎬',
  소리: '🎵',
  사진: '📷',
  '입체/공간': '🗿',
  '디지털/인터랙티브': '💻',
  공연: '🎭',
};

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

/* ── Artwork Card (clean feed style) ── */
function ArtworkCard({
  artwork,
  cardW,
  onPress,
  C,
}: {
  artwork: Artwork;
  cardW: number;
  onPress: () => void;
  C: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imgRatio, setImgRatio] = useState<number | null>(null);

  useEffect(() => {
    if (artwork.image_url) {
      Image.getSize(artwork.image_url, (w, h) => {
        if (w && h) setImgRatio(w / h);
      });
    }
  }, [artwork.image_url]);

  const ratio = imgRatio
    ?? (artwork.width_cm && artwork.height_cm ? artwork.width_cm / artwork.height_cm : 1);
  const imgH = Math.max(cardW * 0.4, Math.min(cardW / ratio, cardW * 1.6));

  return (
    <View style={{ width: '100%', marginBottom: 20 }}>
      <Pressable onPress={onPress}>
        <View style={[styles.artCard, { backgroundColor: C.card }]}>
          <Image
            source={{ uri: artwork.image_url }}
            style={{ width: '100%', height: imgH }}
            resizeMode="contain"
          />
        </View>
      </Pressable>
      <View style={styles.artInfoRow}>
        <Text style={[styles.artInfoTitle, { color: C.fg }]} numberOfLines={expanded ? undefined : 1}>
          {artwork.title}
        </Text>
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <Text style={[styles.artInfoMore, { color: C.gold }]}>
            {expanded ? '접기' : '더보기'}
          </Text>
        </Pressable>
      </View>
      {expanded && (
        <View style={[styles.artExpandedInfo, { borderTopColor: C.border }]}>
          {(artwork.year || artwork.medium) && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              {[artwork.year, artwork.medium].filter(Boolean).join(' · ')}
            </Text>
          )}
          {artwork.width_cm && artwork.height_cm && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              {artwork.width_cm} × {artwork.height_cm} cm
            </Text>
          )}
          {(artwork as any).edition && (
            <Text style={[styles.artExpandedMeta, { color: C.muted }]}>
              에디션: {(artwork as any).edition}
            </Text>
          )}
          {(artwork as any).description && (
            <Text style={[styles.artExpandedDesc, { color: C.fg }]}>
              {(artwork as any).description}
            </Text>
          )}
        </View>
      )}
    </View>
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
  onIndexChange,
  artistProfile,
}: {
  visible: boolean;
  artworks: Artwork[];
  initialIndex: number;
  onClose: () => void;
  isOwner?: boolean;
  onEdit?: (artwork: Artwork) => void;
  onDelete?: (artwork: Artwork) => void;
  onIndexChange?: (index: number) => void;
  artistProfile?: Profile | null;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [viewerHovered, setViewerHovered] = useState(false);
  const flatListRef = useRef<FlatList<Artwork>>(null);
  const isWebViewer = Platform.OS === 'web';
  const viewerFrameWidth = isWebViewer ? Math.min(screenW * 0.88, 1280) : screenW;
  const viewerImageHeight = isWebViewer ? screenH * 0.72 : screenH * 0.6;
  const viewerNavOffset = isWebViewer ? Math.max((screenW - viewerFrameWidth) / 2 + 18, 18) : 18;

  // Likes & Comments
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<{ id: string; content: string; user_id: string; username: string; name: string; avatar_url: string | null; created_at: string; user_type: string; verified: boolean }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const loadLikesComments = useCallback(async (artworkId: string) => {
    const [{ count: lc }, { count: cc }] = await Promise.all([
      supabase.from('artwork_likes').select('id', { count: 'exact', head: true }).eq('artwork_id', artworkId),
      supabase.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('artwork_id', artworkId),
    ]);
    setLikeCount(lc ?? 0);
    setCommentCount(cc ?? 0);
    if (user?.id) {
      const { count: myLike } = await supabase.from('artwork_likes').select('id', { count: 'exact', head: true }).eq('artwork_id', artworkId).eq('user_id', user.id);
      setLiked((myLike ?? 0) > 0);
    }
  }, [user]);

  const loadCommentsList = useCallback(async (artworkId: string) => {
    const { data } = await supabase
      .from('artwork_comments')
      .select('id, content, user_id, created_at, profiles!artwork_comments_user_id_fkey(username, name, avatar_url, user_type, verified)')
      .eq('artwork_id', artworkId)
      .order('created_at', { ascending: true });
    if (data) {
      setComments(data.map((c: any) => ({
        id: c.id,
        content: c.content,
        user_id: c.user_id,
        username: c.profiles?.username ?? '',
        name: c.profiles?.name ?? c.profiles?.username ?? '',
        avatar_url: c.profiles?.avatar_url ?? null,
        created_at: c.created_at,
        user_type: c.profiles?.user_type ?? 'audience',
        verified: !!c.profiles?.verified,
      })));
    }
  }, []);

  const toggleLike = async () => {
    const aw = artworks[currentIndex];
    if (!aw || !user?.id) return;
    if (liked) {
      await supabase.from('artwork_likes').delete().match({ artwork_id: aw.id, user_id: user.id });
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('artwork_likes').insert({ artwork_id: aw.id, user_id: user.id });
      setLiked(true);
      setLikeCount(c => c + 1);
    }
  };

  const submitComment = async () => {
    const aw = artworks[currentIndex];
    if (!aw || !user?.id || !commentText.trim()) return;
    await supabase.from('artwork_comments').insert({ artwork_id: aw.id, user_id: user.id, content: commentText.trim() });
    setCommentText('');
    setCommentCount(c => c + 1);
    loadCommentsList(aw.id);
  };

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const aw = artworks[currentIndex];
    if (aw && visible) {
      loadLikesComments(aw.id);
      setShowComments(false);
      setComments([]);
    }
  }, [currentIndex, visible, artworks, loadLikesComments]);

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
      onIndexChange?.(idx);
    }
  };

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= artworks.length) return;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
    onIndexChange?.(index);
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
          {artistProfile && (
            <Pressable
              style={styles.viewerArtistRow}
              onPress={() => { onClose(); }}
            >
              {artistProfile.avatar_url ? (
                <Image source={{ uri: artistProfile.avatar_url }} style={styles.viewerArtistAvatar} />
              ) : (
                <View style={[styles.viewerArtistAvatar, { backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {(artistProfile.name ?? artistProfile.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.viewerArtistName}>
                {artistProfile.name ?? artistProfile.username}
              </Text>
            </Pressable>
          )}
          {/* Tags */}
          {artwork && (() => {
            const tags = artwork.tags && artwork.tags.length > 0
              ? artwork.tags
              : artwork.medium
                ? artwork.medium.split(/[,،]/).map(s => s.trim()).filter(Boolean)
                : [];
            return tags.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewerTagsWrap} contentContainerStyle={styles.viewerTagsContent}>
                {tags.map((tag, i) => (
                  <View key={i} style={styles.viewerTag}>
                    <Text style={styles.viewerTagText}>#{tag}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null;
          })()}

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

          {/* Like + Comment + Pagination row */}
          <View style={styles.viewerBottomRow}>
            <View style={styles.viewerSocialRow}>
              {/* Like button */}
              <LikeDiamondButton liked={liked} count={likeCount} onPress={toggleLike} size={22} />
              {/* Comment button */}
              <Pressable onPress={() => { setShowComments(!showComments); if (!showComments && artwork) loadCommentsList(artwork.id); }} style={styles.viewerCommentBtn}>
                <Text style={styles.viewerCommentIcon}>💬</Text>
                {commentCount > 0 && <Text style={styles.viewerCommentCount}>{commentCount}</Text>}
              </Pressable>
            </View>
            {artworks.length > 1 && (
              <Text style={styles.viewerCounter}>
                {currentIndex + 1} / {artworks.length}
              </Text>
            )}
          </View>

          {/* Comments section */}
          {showComments && (
            <View style={styles.viewerCommentsSection}>
              <ScrollView style={styles.viewerCommentsList} showsVerticalScrollIndicator={false}>
                {comments.length === 0 ? (
                  <Text style={styles.viewerCommentsEmpty}>아직 댓글이 없습니다</Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.viewerCommentItem}>
                      <Pressable onPress={() => { onClose(); router.push(`/artist/${c.username}`); }}>
                        {c.avatar_url ? (
                          <Image source={{ uri: c.avatar_url }} style={styles.viewerCommentAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.viewerCommentAvatar, { backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{c.username.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <View style={styles.viewerCommentHeader}>
                          <Pressable onPress={() => { onClose(); router.push(`/artist/${c.username}`); }}>
                            <Text style={styles.viewerCommentUser}>{c.name}</Text>
                          </Pressable>
                          <View style={[styles.viewerCommentBadge, { backgroundColor: 'rgba(200,169,110,0.25)' }]}>
                            <Text style={styles.viewerCommentBadgeText}>
                              {c.user_type === 'creator' ? (c.verified ? '작가 인증' : '작가') : c.user_type === 'aspiring' ? '지망생' : '일반'}
                            </Text>
                          </View>
                          <Text style={styles.viewerCommentTime}>{timeAgo(c.created_at)}</Text>
                        </View>
                        <Text style={styles.viewerCommentText}>{c.content}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
              {user?.id && (
                <View style={styles.viewerCommentInputRow}>
                  <TextInput
                    style={styles.viewerCommentInput}
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="댓글 달기..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    maxLength={200}
                    onSubmitEditing={submitComment}
                    returnKeyType="send"
                  />
                  <Pressable onPress={submitComment} style={({ pressed }) => [styles.viewerCommentSend, pressed && { opacity: 0.6 }]}>
                    <Text style={styles.viewerCommentSendText}>게시</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Main Page ── */
export default function ArtistPortfolioScreen() {
  const { id: rawId, tab, artworkId, collectionId: paramCollectionId } = useLocalSearchParams<{ id: string; tab?: string; artworkId?: string; collectionId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const heroH = Math.min(screenH * 0.32, MAX_HERO_H);
  const contentW = Math.min(screenW, MAX_CONTENT_W);

  const [resolvedId, setResolvedId] = useState<string | null>(UUID_REGEX.test(rawId) ? rawId : null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artworksTotalCount, setArtworksTotalCount] = useState(0);
  const [hasMoreArtworks, setHasMoreArtworks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mouiCount, setMouiCount] = useState(0);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'works' | 'collections' | 'exhibitions'>(
    tab === 'exhibitions' ? 'exhibitions' : tab === 'collections' ? 'collections' : 'works',
  );

  // Collections
  type CollectionWithArtworks = {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    artworks: Artwork[];
  };
  const [collections, setCollections] = useState<CollectionWithArtworks[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [colVisibleCounts, setColVisibleCounts] = useState<Record<string, number>>({});
  const [colLikes, setColLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [colCommentCounts, setColCommentCounts] = useState<Record<string, number>>({});
  const [colCommentsOpen, setColCommentsOpen] = useState<string | null>(null);
  const [colCommentsList, setColCommentsList] = useState<{ id: string; content: string; username: string; name: string; avatar_url: string | null; created_at: string; user_type: string; verified: boolean }[]>([]);
  const [colCommentText, setColCommentText] = useState('');

  // Exhibition likes & comments
  const [exLikes, setExLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [exCommentCounts, setExCommentCounts] = useState<Record<string, number>>({});
  const [exCommentsOpen, setExCommentsOpen] = useState<string | null>(null);
  const [exCommentsList, setExCommentsList] = useState<{ id: string; content: string; username: string; name: string; avatar_url: string | null; created_at: string; user_type: string; verified: boolean }[]>([]);
  const [exCommentText, setExCommentText] = useState('');
  const colFilterScrollRef = useRef<ScrollView>(null);
  const colFilterScrollX = useRef(0);

  // Chat request state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatStatus, setChatStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');

  // Follower list modal
  const [followerModalVisible, setFollowerModalVisible] = useState(false);
  const [connectionTab, setConnectionTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<{ id: string; username: string; name: string | null; avatar_url: string | null; latest_artwork_url: string | null }[]>([]);
  const [followings, setFollowings] = useState<{ id: string; username: string; name: string | null; avatar_url: string | null; latest_artwork_url: string | null }[]>([]);

  // Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerArtworks, setViewerArtworks] = useState<Artwork[] | null>(null);
  const artworksRef = useRef<Artwork[]>([]);

  const scrollY = useSharedValue(0);
  const triggerLoadMore = useCallback(() => {
    if (hasMoreRef.current && !loadingMoreRef.current && resolvedId) {
      loadMoreArtworks(resolvedId);
    }
  }, [resolvedId]);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const { contentOffset, contentSize, layoutMeasurement } = e;
      if (contentSize.height > 0 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) {
        runOnJS(triggerLoadMore)();
      }
    },
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

  // Resolve username to UUID if needed
  useEffect(() => {
    if (!rawId) return;
    if (UUID_REGEX.test(rawId)) {
      setResolvedId(rawId);
    } else {
      // rawId is a username – look up the actual UUID
      supabase
        .from('profiles')
        .select('id')
        .eq('username', rawId)
        .single()
        .then(({ data }) => {
          setResolvedId(data?.id ?? null);
        });
    }
  }, [rawId]);

  useEffect(() => { if (resolvedId) loadData(resolvedId); }, [resolvedId]);
  useFocusEffect(useCallback(() => { if (resolvedId) loadData(resolvedId); }, [resolvedId]));

  const loadMoreArtworks = async (uid: string) => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const from = artworksRef.current.length;
    const to = from + ARTWORK_PAGE_SIZE - 1;
    const { data } = await supabase
      .from('artworks')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (data && data.length > 0) {
      setArtworks(prev => {
        const next = [...prev, ...data];
        artworksRef.current = next;
        return next;
      });
      if (data.length < ARTWORK_PAGE_SIZE) {
        setHasMoreArtworks(false);
        hasMoreRef.current = false;
      }
    } else {
      setHasMoreArtworks(false);
      hasMoreRef.current = false;
    }
    setLoadingMore(false);
    loadingMoreRef.current = false;
  };

  const loadData = async (uid: string) => {
    setLoading(true);
    const [profileRes, artworksRes, followCountRes, exhibitionsRes, mouiRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('artworks').select('*', { count: 'exact' }).eq('user_id', uid).order('created_at', { ascending: false }).range(0, ARTWORK_PAGE_SIZE - 1),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('exhibitions').select('*').eq('user_id', uid).eq('is_published', true).order('created_at', { ascending: false }),
      (supabase as any).from('moui_posts').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'open'),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    const totalArtworks = artworksRes.count ?? 0;
    setArtworksTotalCount(totalArtworks);
    if (artworksRes.data) {
      setArtworks(artworksRes.data);
      artworksRef.current = artworksRes.data;
      const more = artworksRes.data.length < totalArtworks;
      setHasMoreArtworks(more);
      hasMoreRef.current = more;
    }
    setFollowerCount(followCountRes.count ?? 0);
    const { count: fgCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid);
    setFollowingCount(fgCount ?? 0);
    setMouiCount(mouiRes.count ?? 0);
    if (exhibitionsRes.data) {
      setExhibitions(exhibitionsRes.data);
      // Load exhibition likes & comment counts
      const exLikesMap: Record<string, { liked: boolean; count: number }> = {};
      const exCcMap: Record<string, number> = {};
      await Promise.all(exhibitionsRes.data.map(async (ex: any) => {
        const [{ count: lc }, { count: cc }] = await Promise.all([
          supabase.from('exhibition_likes').select('id', { count: 'exact', head: true }).eq('exhibition_id', ex.id),
          supabase.from('exhibition_comments').select('id', { count: 'exact', head: true }).eq('exhibition_id', ex.id),
        ]);
        let myLiked = false;
        if (user?.id) {
          const { count: ml } = await supabase.from('exhibition_likes').select('id', { count: 'exact', head: true }).eq('exhibition_id', ex.id).eq('user_id', user.id);
          myLiked = (ml ?? 0) > 0;
        }
        exLikesMap[ex.id] = { liked: myLiked, count: lc ?? 0 };
        exCcMap[ex.id] = cc ?? 0;
      }));
      setExLikes(exLikesMap);
      setExCommentCounts(exCcMap);
    }

    // Fetch collections with their artworks
    const { data: colData } = await supabase
      .from('artwork_collections')
      .select('id, title, description, cover_image_url')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true });
    if (colData && colData.length > 0) {
      const colsWithArt: CollectionWithArtworks[] = await Promise.all(
        colData.map(async (col) => {
          const { data: links } = await supabase
            .from('collection_artworks')
            .select('artwork_id')
            .eq('collection_id', col.id)
            .order('sort_order', { ascending: true });
          const artworkIds = links?.map((l: any) => l.artwork_id) ?? [];
          let colArtworks: Artwork[] = [];
          if (artworkIds.length > 0) {
            const { data: awData } = await supabase
              .from('artworks')
              .select('*')
              .in('id', artworkIds);
            if (awData) {
              // Maintain sort order
              const awMap = new Map(awData.map(a => [a.id, a]));
              colArtworks = artworkIds.map(id => awMap.get(id)).filter(Boolean) as Artwork[];
            }
          }
          return { ...col, artworks: colArtworks };
        }),
      );
      setCollections(colsWithArt);
      // Load collection likes & comment counts
      const likesMap: Record<string, { liked: boolean; count: number }> = {};
      const ccMap: Record<string, number> = {};
      await Promise.all(colsWithArt.map(async (c) => {
        const [{ count: lc }, { count: cc }] = await Promise.all([
          supabase.from('collection_likes').select('id', { count: 'exact', head: true }).eq('collection_id', c.id),
          supabase.from('collection_comments').select('id', { count: 'exact', head: true }).eq('collection_id', c.id),
        ]);
        let myLiked = false;
        if (user?.id) {
          const { count: ml } = await supabase.from('collection_likes').select('id', { count: 'exact', head: true }).eq('collection_id', c.id).eq('user_id', user.id);
          myLiked = (ml ?? 0) > 0;
        }
        likesMap[c.id] = { liked: myLiked, count: lc ?? 0 };
        ccMap[c.id] = cc ?? 0;
      }));
      setColLikes(likesMap);
      setColCommentCounts(ccMap);
      // URL에 collectionId가 있으면 works 탭에서 해당 아카이브 선택
      if (paramCollectionId && colsWithArt.find(c => c.id === paramCollectionId)) {
        setActiveTab('works');
        setSelectedCollectionId(paramCollectionId);
      }
    } else {
      setCollections([]);
    }

    if (user?.id && user.id !== uid) {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id)
        .eq('following_id', uid);
      setIsFollowing((count ?? 0) > 0);

      // 채팅 요청 상태 확인
      const { data: chatReq } = await supabase
        .from('chat_requests')
        .select('status')
        .eq('sender_id', user.id)
        .eq('receiver_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (chatReq) {
        setChatStatus(chatReq.status as any);
      } else {
        setChatStatus('none');
      }
    }
    setLoading(false);

    // Auto-open viewer if artworkId is in URL (supports both 1-based index and UUID)
    if (artworkId) {
      const num = parseInt(artworkId, 10);
      // 페이지네이션과 관계없이 전체 작품 로드
      const { data: allAw } = await supabase
        .from('artworks')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (allAw && allAw.length > 0) {
        let idx: number;
        if (!isNaN(num) && num >= 1 && num <= allAw.length) {
          idx = num - 1;
        } else {
          idx = allAw.findIndex((a) => a.id === artworkId);
        }
        if (idx >= 0) {
          setViewerArtworks(allAw);
          setViewerIndex(idx);
          setViewerVisible(true);
        }
      }
    }
  };

  const updateUrlArtwork = (index: number | null) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (index !== null) {
        url.searchParams.set('artworkId', String(index + 1)); // 0-based → 1-based
      } else {
        url.searchParams.delete('artworkId');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const toggleFollow = async () => {
    if (!user?.id || !resolvedId || user.id === resolvedId) return;
    if (isFollowing) {
      await supabase.from('follows').delete().match({ follower_id: user.id, following_id: resolvedId });
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: resolvedId });
      setFollowerCount((c) => c + 1);
    }
    setIsFollowing(!isFollowing);
  };

  const sendChatRequest = async () => {
    if (!user?.id || !resolvedId || !chatMessage.trim()) return;
    setChatSending(true);
    const { error } = await spendPoints(user.id, 300, '채팅 요청', 'chat_request');
    if (error) {
      Alert.alert('모의 부족', error);
      setChatSending(false);
      return;
    }
    const { error: insertErr } = await supabase.from('chat_requests').insert({
      sender_id: user.id,
      receiver_id: resolvedId,
      message: chatMessage.trim(),
    });
    setChatSending(false);
    if (insertErr) {
      Alert.alert('오류', '채팅 요청에 실패했습니다.');
      return;
    }
    setChatModalVisible(false);
    setChatMessage('');
    setChatStatus('pending');
    Alert.alert('완료', '채팅 요청을 보냈습니다!');
  };

  const loadConnectionList = async (p: any) => {
    const { data: aw } = await supabase
      .from('artworks')
      .select('image_url')
      .eq('user_id', p.id)
      .order('created_at', { ascending: false })
      .limit(1);
    return { ...p, latest_artwork_url: aw?.[0]?.image_url ?? null };
  };

  const openFollowerList = async () => {
    if (!resolvedId) return;
    const [{ data: fwData }, { data: fgData }] = await Promise.all([
      supabase.from('follows').select('follower_id, profiles!follows_follower_id_fkey(id, username, name, avatar_url)').eq('following_id', resolvedId),
      supabase.from('follows').select('following_id, profiles!follows_following_id_fkey(id, username, name, avatar_url)').eq('follower_id', resolvedId),
    ]);
    const fwList = fwData?.map((d: any) => d.profiles).filter(Boolean) ?? [];
    const fgList = fgData?.map((d: any) => d.profiles).filter(Boolean) ?? [];
    const [fwWithArt, fgWithArt] = await Promise.all([
      Promise.all(fwList.map(loadConnectionList)),
      Promise.all(fgList.map(loadConnectionList)),
    ]);
    setFollowers(fwWithArt);
    setFollowings(fgWithArt);
    setConnectionTab('followers');
    setFollowerModalVisible(true);
  };

  const toggleColLike = async (colId: string) => {
    if (!user?.id) return;
    const current = colLikes[colId];
    if (current?.liked) {
      await supabase.from('collection_likes').delete().match({ collection_id: colId, user_id: user.id });
      setColLikes(prev => ({ ...prev, [colId]: { liked: false, count: Math.max(0, (prev[colId]?.count ?? 1) - 1) } }));
    } else {
      await supabase.from('collection_likes').insert({ collection_id: colId, user_id: user.id });
      setColLikes(prev => ({ ...prev, [colId]: { liked: true, count: (prev[colId]?.count ?? 0) + 1 } }));
    }
  };

  const openColComments = async (colId: string) => {
    if (colCommentsOpen === colId) { setColCommentsOpen(null); return; }
    const { data } = await supabase
      .from('collection_comments')
      .select('id, content, user_id, created_at, profiles!collection_comments_user_id_fkey(username, name, avatar_url, user_type, verified)')
      .eq('collection_id', colId)
      .order('created_at', { ascending: true });
    setColCommentsList(data?.map((c: any) => ({
      id: c.id, content: c.content, username: c.profiles?.username ?? '', name: c.profiles?.name ?? c.profiles?.username ?? '', avatar_url: c.profiles?.avatar_url ?? null, created_at: c.created_at, user_type: c.profiles?.user_type ?? 'audience', verified: !!c.profiles?.verified,
    })) ?? []);
    setColCommentsOpen(colId);
    setColCommentText('');
  };

  const submitColComment = async () => {
    if (!user?.id || !colCommentsOpen || !colCommentText.trim()) return;
    await supabase.from('collection_comments').insert({ collection_id: colCommentsOpen, user_id: user.id, content: colCommentText.trim() });
    setColCommentText('');
    setColCommentCounts(prev => ({ ...prev, [colCommentsOpen]: (prev[colCommentsOpen] ?? 0) + 1 }));
    openColComments(colCommentsOpen);
  };

  const toggleExLike = async (exId: string) => {
    if (!user?.id) return;
    const current = exLikes[exId];
    if (current?.liked) {
      await supabase.from('exhibition_likes').delete().match({ exhibition_id: exId, user_id: user.id });
      setExLikes(prev => ({ ...prev, [exId]: { liked: false, count: Math.max(0, (prev[exId]?.count ?? 1) - 1) } }));
    } else {
      await supabase.from('exhibition_likes').insert({ exhibition_id: exId, user_id: user.id });
      setExLikes(prev => ({ ...prev, [exId]: { liked: true, count: (prev[exId]?.count ?? 0) + 1 } }));
    }
  };

  const openExComments = async (exId: string) => {
    if (exCommentsOpen === exId) { setExCommentsOpen(null); return; }
    const { data } = await supabase
      .from('exhibition_comments')
      .select('id, content, user_id, created_at, profiles!exhibition_comments_user_id_fkey(username, name, avatar_url, user_type, verified)')
      .eq('exhibition_id', exId)
      .order('created_at', { ascending: true });
    setExCommentsList(data?.map((c: any) => ({
      id: c.id, content: c.content, username: c.profiles?.username ?? '', name: c.profiles?.name ?? c.profiles?.username ?? '', avatar_url: c.profiles?.avatar_url ?? null, created_at: c.created_at, user_type: c.profiles?.user_type ?? 'audience', verified: !!c.profiles?.verified,
    })) ?? []);
    setExCommentsOpen(exId);
    setExCommentText('');
  };

  const submitExComment = async () => {
    if (!user?.id || !exCommentsOpen || !exCommentText.trim()) return;
    await supabase.from('exhibition_comments').insert({ exhibition_id: exCommentsOpen, user_id: user.id, content: exCommentText.trim() });
    setExCommentText('');
    setExCommentCounts(prev => ({ ...prev, [exCommentsOpen]: (prev[exCommentsOpen] ?? 0) + 1 }));
    openExComments(exCommentsOpen);
  };

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

  /* ── Gallery layout: single column feed ── */
  const galleryPad = 24;
  const feedCardW = contentW - galleryPad * 2;

  const isOwner = user?.id === resolvedId;
  const artistName = profile.name ?? profile.username;
  const avatarEmoji = USER_TYPE_EMOJI[profile.user_type] ?? '👀';
  const isCreator = profile.user_type === 'creator';
  const isVerifiedCreator = !!(profile as any)?.verified;
  const fieldItems = (profile.field ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const openViewer = (artworkIndex: number) => {
    setViewerIndex(artworkIndex);
    setViewerVisible(true);
    updateUrlArtwork(artworkIndex);
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
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ HERO SECTION ═══ */}
        <View style={[styles.heroWrap, { minHeight: heroH, backgroundColor: C.bg }]}>
          <Animated.View style={[styles.heroContent, heroContentStyle]}>
            <View
              style={[styles.heroPanel, { borderColor: C.border, backgroundColor: C.card }]}
            >
              <View style={styles.heroRow}>
                {/* ── Left: Avatar + Name + Badges ── */}
                <View style={styles.heroLeft}>
                  <View style={[styles.heroAvatarWrap, { borderColor: C.gold, backgroundColor: C.card }]}>
                    {profile.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.heroAvatar} resizeMode="cover" />
                    ) : (
                      <View style={[styles.heroAvatarFallback, { backgroundColor: 'rgba(200,169,110,0.12)' }]}>
                        <Text style={styles.heroAvatarEmoji}>{avatarEmoji}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.heroName, { color: C.fg }]} numberOfLines={1}>{artistName}</Text>
                  {isCreator && (
                    <View style={styles.heroBadgeRow}>
                      <View
                        style={[
                          styles.heroBadge,
                          {
                            borderColor: C.gold,
                            backgroundColor: 'rgba(200,169,110,0.1)',
                          },
                        ]}
                      >
                        <Text style={[styles.heroBadgeText, { color: C.gold }]}>
                          작가{' '}
                          <Text style={{ color: isVerifiedCreator ? '#22c55e' : C.danger }}>
                            {getCreatorVerificationStatusText(isVerifiedCreator)}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* ── Right: Fields + Buttons ── */}
                <View style={styles.heroRight}>
                  <View style={styles.heroFieldRow}>
                    {fieldItems.length > 0 ? (
                      fieldItems.map((field) => (
                        <View key={field} style={[styles.heroFieldChip, { borderColor: 'rgba(200,169,110,0.28)' }]}>
                          <Text style={styles.heroFieldEmoji}>{FIELD_ICON_MAP[field] ?? '🎯'}</Text>
                          <Text style={[styles.heroFieldChipText, { color: C.gold }]}>{field}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.heroFieldChip, { borderColor: C.border }]}>
                        <Text style={styles.heroFieldEmoji}>{USER_TYPE_EMOJI[profile.user_type] ?? '👀'}</Text>
                        <Text style={[styles.heroFieldChipText, { color: C.muted }]}>
                          {USER_TYPE_LABELS[profile.user_type] ?? profile.user_type}
                        </Text>
                      </View>
                    )}
                  </View>
                  {snsEntries.length > 0 && (
                    <View style={styles.heroSnsRow}>
                      {snsEntries.map(([key, url]) => {
                        const detected = detectSnsType(url);
                        return (
                          <Pressable
                            key={key}
                            style={[styles.heroSnsChip, { borderColor: 'rgba(200,169,110,0.28)' }]}
                            onPress={() => Linking.openURL(url)}
                          >
                            <Text style={{ fontSize: 10 }}>{detected.icon}</Text>
                            <Text style={[styles.heroSnsLabel, { color: C.gold }]}>{detected.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {!isOwner && (
                    <View style={styles.actionRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.followBtn,
                          { borderColor: C.gold },
                          !isFollowing && { backgroundColor: C.gold },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          if (!user?.id) {
                            if (Platform.OS === 'web') {
                              if (window.confirm('모의스트 가입이 필요합니다.\n가입하시겠습니까?')) router.push('/signup' as any);
                            } else {
                              Alert.alert('가��� 필요', '모의스트 가입이 필요합니다.', [
                                { text: '취소', style: 'cancel' },
                                { text: '가입하기', onPress: () => router.push('/signup' as any) },
                              ]);
                            }
                            return;
                          }
                          toggleFollow();
                        }}
                      >
                        <Text style={[styles.followBtnText, { color: C.bg }, isFollowing && { color: C.gold }]}>
                          {isFollowing ? '연결됨' : '연결하기'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.followBtn,
                          { borderColor: C.gold },
                          chatStatus !== 'pending' && { backgroundColor: C.gold },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          if (chatStatus === 'pending') return;
                          if (!user?.id) {
                            if (Platform.OS === 'web') {
                              if (window.confirm('모의스트 가입이 필요합니다.\n가입하시겠습니까?')) router.push('/signup' as any);
                            } else {
                              Alert.alert('가입 필요', '모의스트 가입이 필요합니다.', [
                                { text: '취소', style: 'cancel' },
                                { text: '가입하기', onPress: () => router.push('/signup' as any) },
                              ]);
                            }
                            return;
                          }
                          if (chatStatus === 'accepted') {
                            // TODO: 채팅방으로 이동
                            return;
                          }
                          setChatModalVisible(true);
                        }}
                      >
                        <Text style={[styles.followBtnText, {
                          color: chatStatus === 'pending' ? C.gold : C.bg,
                        }]}>
                          {chatStatus === 'pending' ? '수락 대기중'
                            : chatStatus === 'accepted' ? '💬 채팅'
                            : '채팅걸기'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Stats row (bottom) ── */}
              <View style={styles.statsRow}>
                <Pressable style={styles.statItem} onPress={() => setActiveTab('works')}>
                  <AnimatedCounter to={artworksTotalCount} style={[styles.statNumber, { color: activeTab === 'works' ? C.gold : C.fg }]} />
                  <Text style={[styles.statLabel, { color: activeTab === 'works' ? C.gold : C.muted }]}>작품</Text>
                  {activeTab === 'works' && <View style={[styles.statActiveDot, { backgroundColor: C.gold }]} />}
                </Pressable>
                <View style={[styles.statDot, { backgroundColor: C.mutedLight }]} />
                <Pressable style={styles.statItem} onPress={() => setActiveTab('collections')}>
                  <AnimatedCounter to={collections.length} style={[styles.statNumber, { color: activeTab === 'collections' ? C.gold : C.fg }]} />
                  <Text style={[styles.statLabel, { color: activeTab === 'collections' ? C.gold : C.muted }]}>아카이브</Text>
                  {activeTab === 'collections' && <View style={[styles.statActiveDot, { backgroundColor: C.gold }]} />}
                </Pressable>
                <View style={[styles.statDot, { backgroundColor: C.mutedLight }]} />
                <Pressable style={styles.statItem} onPress={() => setActiveTab('exhibitions')}>
                  <AnimatedCounter to={exhibitions.length} style={[styles.statNumber, { color: activeTab === 'exhibitions' ? C.gold : C.fg }]} />
                  <Text style={[styles.statLabel, { color: activeTab === 'exhibitions' ? C.gold : C.muted }]}>3D전시관</Text>
                  {activeTab === 'exhibitions' && <View style={[styles.statActiveDot, { backgroundColor: C.gold }]} />}
                </Pressable>
                <View style={[styles.statDot, { backgroundColor: C.mutedLight }]} />
                <Pressable style={styles.statItem} onPress={openFollowerList}>
                  <AnimatedCounter to={followerCount + followingCount} style={[styles.statNumber, { color: C.fg }]} />
                  <Text style={[styles.statLabel, { color: C.muted }]}>연결</Text>
                </Pressable>
                <View style={[styles.statDot, { backgroundColor: C.mutedLight }]} />
                <Pressable style={styles.statItem} onPress={() => {
                  const username = profile?.username;
                  if (username) router.push(`/(tabs)/moui?user=${username}` as any);
                }}>
                  <AnimatedCounter to={mouiCount} style={[styles.statNumber, { color: C.fg }]} />
                  <Text style={[styles.statLabel, { color: C.muted }]}>진행모임</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ═══ BIO SECTION ═══ */}
        {profile.bio && (
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={[styles.bioSection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
            <Text style={[styles.bioQuote, { color: C.gold }]}>{'"'}</Text>
            <Text style={[styles.bioText, { color: C.fg }]}>{profile.bio}</Text>
            <Text style={[styles.bioQuote, { color: C.gold, alignSelf: 'flex-end' }]}>{'"'}</Text>
            <View style={[styles.bioDivider, { backgroundColor: C.gold }]} />
          </Animated.View>
        )}

        {/* ═══ GALLERY / COLLECTIONS / EXHIBITIONS SECTION ═══ */}
        {activeTab === 'works' ? (
          <>
            {/* Collection filter circles */}
            {collections.length > 0 && (
              <View style={[styles.colFilterWrap, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
                {Platform.OS === 'web' && collections.length > 5 && (
                  <View style={styles.colFilterNavRow}>
                    <Pressable
                      style={({ pressed }) => [styles.colFilterNavBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => colFilterScrollRef.current?.scrollTo({ x: Math.max(0, colFilterScrollX.current - 252), animated: true })}
                    >
                      <Text style={[styles.colFilterNavText, { color: C.muted }]}>←</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.colFilterNavBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => colFilterScrollRef.current?.scrollTo({ x: colFilterScrollX.current + 252, animated: true })}
                    >
                      <Text style={[styles.colFilterNavText, { color: C.muted }]}>→</Text>
                    </Pressable>
                  </View>
                )}
                <ScrollView
                  ref={colFilterScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colFilterScroll}
                  onScroll={(e) => { colFilterScrollX.current = e.nativeEvent.contentOffset.x; }}
                  scrollEventThrottle={16}
                >
                  {/* 전체 보기 */}
                  <Pressable
                    style={styles.colFilterItem}
                    onPress={() => setSelectedCollectionId(null)}
                  >
                    <View style={[
                      styles.colFilterCircle,
                      { borderColor: selectedCollectionId === null ? C.gold : C.border },
                    ]}>
                      <View style={[styles.colFilterCircleInner, { backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' }]}>
                        <SpinningDiamond size={18} color={C.gold} active={selectedCollectionId === null} />
                      </View>
                    </View>
                    <Text style={[styles.colFilterName, { color: selectedCollectionId === null ? C.gold : C.muted }]}>전체</Text>
                  </Pressable>
                  {collections.map((col) => (
                    <Pressable
                      key={col.id}
                      style={styles.colFilterItem}
                      onPress={() => setSelectedCollectionId(prev => prev === col.id ? null : col.id)}
                    >
                      <View style={[
                        styles.colFilterCircle,
                        { borderColor: selectedCollectionId === col.id ? C.gold : C.border },
                      ]}>
                        {col.cover_image_url ? (
                          <Image source={{ uri: col.cover_image_url }} style={styles.colFilterCircleInner} resizeMode="cover" />
                        ) : (
                          <View style={[styles.colFilterCircleInner, { backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 20 }}>📂</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.colFilterName, { color: selectedCollectionId === col.id ? C.gold : C.muted }]} numberOfLines={1}>{col.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {(() => {
              const selectedCol = selectedCollectionId ? collections.find(c => c.id === selectedCollectionId) : null;
              const displayArtworks = selectedCol ? selectedCol.artworks : artworks;
              const sectionTitle = selectedCol ? selectedCol.title.toUpperCase() : 'WORKS';
              return displayArtworks.length > 0 ? (
                <View style={[styles.gallerySection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
                  <Text style={[styles.sectionLabel, { color: C.muted }]}>{sectionTitle}</Text>
                  <View style={[styles.sectionLabelLine, { backgroundColor: C.gold }]} />

                  {displayArtworks.map((aw) => {
                    const idx = selectedCol
                      ? selectedCol.artworks.findIndex(a => a.id === aw.id)
                      : artworks.findIndex(a => a.id === aw.id);
                    return (
                      <ArtworkCard
                        key={aw.id}
                        artwork={aw}
                        cardW={feedCardW}
                        onPress={() => {
                          if (selectedCol) {
                            setViewerArtworks(selectedCol.artworks);
                            setViewerIndex(idx >= 0 ? idx : 0);
                            setViewerVisible(true);
                          } else {
                            openViewer(idx);
                          }
                        }}
                        C={C}
                      />
                    );
                  })}

                  {!selectedCol && loadingMore && (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <ActivityIndicator color={C.gold} size="small" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptySection}>
                  <View style={[styles.emptyDiamond, { borderColor: C.gold }]} />
                  <Text style={[styles.emptyText, { color: C.muted }]}>아직 등록된 작품이 없습니다</Text>
                </View>
              );
            })()}
          </>
        ) : activeTab === 'collections' ? (
          collections.length > 0 ? (
            <View style={[styles.gallerySection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
              <Text style={[styles.sectionLabel, { color: C.muted }]}>ARCHIVE</Text>
              <View style={[styles.sectionLabelLine, { backgroundColor: C.gold }]} />

              {collections.map((col) => {
                const visibleCount = colVisibleCounts[col.id] ?? 3;
                const visibleArtworks = col.artworks.slice(0, visibleCount);
                const hasMore = col.artworks.length > visibleCount;
                return (
                <View key={col.id} style={[styles.colSection, { backgroundColor: C.card }]}>
                  <View style={styles.colHeader}>
                    {col.cover_image_url ? (
                      <Image
                        source={{ uri: col.cover_image_url }}
                        style={styles.colCoverImg}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Pressable style={styles.colHeaderText} onPress={() => {
                      setSelectedCollectionId(col.id);
                      setActiveTab('works');
                    }}>
                      <Text style={[styles.colTitle, { color: C.gold }]}>{col.title} 📎</Text>
                      {col.description ? (
                        <Text style={[styles.colDesc, { color: C.muted }]} numberOfLines={2}>{col.description}</Text>
                      ) : null}
                      <Text style={[styles.colCount, { color: C.mutedLight }]}>{col.artworks.length}개 작품</Text>
                    </Pressable>
                  </View>
                  <View style={styles.colGrid}>
                    {visibleArtworks.map((aw) => (
                      <Pressable
                        key={aw.id}
                        style={({ pressed }) => [styles.colGridItem, pressed && { opacity: 0.8 }]}
                        onPress={() => {
                          const colIdx = col.artworks.findIndex(a => a.id === aw.id);
                          setViewerArtworks(col.artworks);
                          setViewerIndex(colIdx >= 0 ? colIdx : 0);
                          setViewerVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: aw.image_url }}
                          style={styles.colGridImage}
                          resizeMode="cover"
                        />
                        <Text style={[styles.colGridTitle, { color: C.fg }]} numberOfLines={1}>{aw.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {hasMore && (
                    <Pressable
                      style={({ pressed }) => [styles.colMoreBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => setColVisibleCounts(prev => ({ ...prev, [col.id]: visibleCount + 3 }))}
                    >
                      <Text style={[styles.colMoreText, { color: C.gold }]}>+ {Math.min(3, col.artworks.length - visibleCount)}개 더보기</Text>
                    </Pressable>
                  )}

                  {/* Like + Comment for archive */}
                  <View style={styles.colSocialRow}>
                    <LikeDiamondButton
                      liked={colLikes[col.id]?.liked ?? false}
                      count={colLikes[col.id]?.count ?? 0}
                      onPress={() => toggleColLike(col.id)}
                      size={18}
                    />
                    <Pressable onPress={() => openColComments(col.id)} style={styles.colSocialBtn}>
                      <Text style={{ fontSize: 16 }}>💬</Text>
                      {(colCommentCounts[col.id] ?? 0) > 0 && (
                        <Text style={[styles.colSocialCount, { color: C.muted }]}>{colCommentCounts[col.id]}</Text>
                      )}
                    </Pressable>
                  </View>

                  {/* Comments expand */}
                  {colCommentsOpen === col.id && (
                    <View style={styles.colCommentsWrap}>
                      {colCommentsList.length === 0 ? (
                        <Text style={[styles.colCommentsEmpty, { color: C.muted }]}>아직 댓글이 없습니다</Text>
                      ) : (
                        colCommentsList.map((c) => (
                          <Pressable key={c.id} style={styles.colCommentRow} onPress={() => router.push(`/artist/${c.username}`)}>
                            {c.avatar_url ? (
                              <Image source={{ uri: c.avatar_url }} style={styles.colCommentAvatar} resizeMode="cover" />
                            ) : (
                              <View style={[styles.colCommentAvatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 8, fontWeight: '700', color: C.fg }}>{c.username.charAt(0)}</Text>
                              </View>
                            )}
                            <Text style={[styles.colCommentUser, { color: C.muted }]}>{c.name}</Text>
                            <View style={[styles.colCommentBadge, { backgroundColor: C.goldDim }]}>
                              <Text style={[styles.colCommentBadgeText, { color: C.gold }]}>
                                {c.user_type === 'creator' ? (c.verified ? '작가 인증' : '작가') : c.user_type === 'aspiring' ? '지망생' : '일반'}
                              </Text>
                            </View>
                            <Text style={[styles.colCommentTime, { color: C.mutedLight }]}>{timeAgo(c.created_at)}</Text>
                            <Text style={[styles.colCommentContent, { color: C.fg }]} numberOfLines={2}>{c.content}</Text>
                          </Pressable>
                        ))
                      )}
                      {user?.id && (
                        <View style={[styles.colCommentInputRow, { borderTopColor: C.border }]}>
                          <TextInput
                            style={[styles.colCommentInput, { color: C.fg, backgroundColor: C.bg, borderColor: C.border }]}
                            value={colCommentText}
                            onChangeText={setColCommentText}
                            placeholder="댓글 달기..."
                            placeholderTextColor={C.mutedLight}
                            maxLength={200}
                            onSubmitEditing={submitColComment}
                            returnKeyType="send"
                          />
                          <Pressable onPress={submitColComment} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                            <Text style={[styles.colCommentSendText, { color: C.gold }]}>게시</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <View style={[styles.emptyDiamond, { borderColor: C.gold }]} />
              <Text style={[styles.emptyText, { color: C.muted }]}>아직 등록된 아카이브가 없습니다</Text>
            </View>
          )
        ) : (
          exhibitions.length > 0 ? (
            <View style={[styles.gallerySection, { maxWidth: MAX_CONTENT_W, alignSelf: 'center', width: '100%' }]}>
              <Text style={[styles.sectionLabel, { color: C.muted }]}>3D EXHIBITIONS</Text>
              <View style={[styles.sectionLabelLine, { backgroundColor: C.gold }]} />

              {exhibitions.map((ex, idx) => {
                  const exNum = exhibitions.length - idx;
                  return (
                  <View key={ex.id} style={[styles.exCard, { backgroundColor: C.card }]}>
                    <Pressable
                      style={({ pressed }) => [styles.exCardInner, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push(`/3dexhibition/${profile.username}/${exNum}`)}
                    >
                      {ex.poster_image_url ? (
                        <Image
                          source={{ uri: ex.poster_image_url }}
                          style={styles.exCardPoster}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.exCardPosterEmpty, { backgroundColor: C.bg }]}>
                          <Text style={{ fontSize: 28 }}>
                            {ex.room_type === 'small' ? '🏠' : ex.room_type === 'large' ? '🏰' : '🏛️'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.exCardInfo}>
                        <Text style={[styles.exGridTitle, { color: C.fg }]} numberOfLines={1}>{ex.title}</Text>
                        {ex.description ? (
                          <Text style={[styles.exGridDesc, { color: C.muted }]} numberOfLines={1}>{ex.description}</Text>
                        ) : null}
                        <View style={[styles.exGridBadge, { backgroundColor: 'rgba(200,169,110,0.12)', alignSelf: 'flex-start', marginTop: 4 }]}>
                          <Text style={[styles.exGridBadgeText, { color: C.gold }]}>
                            {ex.room_type === 'small' ? '소형' : ex.room_type === 'medium' ? '중형' : ex.room_type === 'large' ? '대형' : ex.room_type}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {/* Like + Comment */}
                    <View style={styles.colSocialRow}>
                      <LikeDiamondButton
                        liked={exLikes[ex.id]?.liked ?? false}
                        count={exLikes[ex.id]?.count ?? 0}
                        onPress={() => toggleExLike(ex.id)}
                        size={18}
                      />
                      <Pressable onPress={() => openExComments(ex.id)} style={styles.colSocialBtn}>
                        <Text style={{ fontSize: 16 }}>💬</Text>
                        {(exCommentCounts[ex.id] ?? 0) > 0 && (
                          <Text style={[styles.colSocialCount, { color: C.muted }]}>{exCommentCounts[ex.id]}</Text>
                        )}
                      </Pressable>
                    </View>

                    {exCommentsOpen === ex.id && (
                      <View style={styles.colCommentsWrap}>
                        {exCommentsList.length === 0 ? (
                          <Text style={[styles.colCommentsEmpty, { color: C.muted }]}>아직 댓글이 없습니다</Text>
                        ) : (
                          exCommentsList.map((c) => (
                            <Pressable key={c.id} style={styles.colCommentRow} onPress={() => router.push(`/artist/${c.username}`)}>
                              {c.avatar_url ? (
                                <Image source={{ uri: c.avatar_url }} style={styles.colCommentAvatar} resizeMode="cover" />
                              ) : (
                                <View style={[styles.colCommentAvatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                                  <Text style={{ fontSize: 8, fontWeight: '700', color: C.fg }}>{c.username.charAt(0)}</Text>
                                </View>
                              )}
                              <Text style={[styles.colCommentUser, { color: C.muted }]}>{c.name}</Text>
                              <View style={[styles.colCommentBadge, { backgroundColor: C.goldDim }]}>
                                <Text style={[styles.colCommentBadgeText, { color: C.gold }]}>
                                  {c.user_type === 'creator' ? (c.verified ? '작가 인증' : '작가') : c.user_type === 'aspiring' ? '지망생' : '일반'}
                                </Text>
                              </View>
                              <Text style={[styles.colCommentTime, { color: C.mutedLight }]}>{timeAgo(c.created_at)}</Text>
                              <Text style={[styles.colCommentContent, { color: C.fg }]} numberOfLines={2}>{c.content}</Text>
                            </Pressable>
                          ))
                        )}
                        {user?.id && (
                          <View style={[styles.colCommentInputRow, { borderTopColor: C.border }]}>
                            <TextInput
                              style={[styles.colCommentInput, { color: C.fg, backgroundColor: C.bg, borderColor: C.border }]}
                              value={exCommentText}
                              onChangeText={setExCommentText}
                              placeholder="댓글 달기..."
                              placeholderTextColor={C.mutedLight}
                              maxLength={200}
                              onSubmitEditing={submitExComment}
                              returnKeyType="send"
                            />
                            <Pressable onPress={submitExComment} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                              <Text style={[styles.colCommentSendText, { color: C.gold }]}>게시</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  );
                })}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <View style={[styles.emptyDiamond, { borderColor: C.gold }]} />
              <Text style={[styles.emptyText, { color: C.muted }]}>아직 등록된 3D전시관이 없습니다</Text>
            </View>
          )
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
        artworks={viewerArtworks ?? artworks}
        initialIndex={viewerIndex}
        onClose={() => { setViewerVisible(false); setViewerArtworks(null); updateUrlArtwork(null); }}
        isOwner={isOwner}
        onEdit={handleEditArtwork}
        onDelete={handleDeleteArtwork}
        onIndexChange={(idx) => updateUrlArtwork(idx)}
        artistProfile={profile}
      />

      {/* Chat request modal */}
      <Modal visible={chatModalVisible} transparent animationType="fade" onRequestClose={() => setChatModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChatModalVisible(false)} />
          <View style={[styles.chatModalBox, { backgroundColor: C.card }]}>
            <Text style={[styles.chatModalTitle, { color: C.fg }]}>채팅 요청</Text>
            <Text style={[styles.chatModalDesc, { color: C.muted }]}>
              {profile?.name ?? profile?.username}님에게 채팅을 요청합니다.{'\n'}300 MOUI가 차감됩니다.
            </Text>
            <TextInput
              style={[styles.chatModalInput, { color: C.fg, borderColor: C.border, backgroundColor: C.bg }]}
              placeholder="채팅을 요청하는 이유를 적어주세요"
              placeholderTextColor={C.muted}
              value={chatMessage}
              onChangeText={setChatMessage}
              multiline
              maxLength={200}
            />
            <Pressable
              style={({ pressed }) => [
                styles.chatModalBtn,
                { backgroundColor: C.gold, opacity: (!chatMessage.trim() || chatSending) ? 0.5 : pressed ? 0.8 : 1 },
              ]}
              onPress={sendChatRequest}
              disabled={!chatMessage.trim() || chatSending}
            >
              {chatSending ? (
                <ActivityIndicator color={C.bg} size="small" />
              ) : (
                <Text style={[styles.chatModalBtnText, { color: C.bg }]}>300 MOUI로 채팅 요청</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Connection list modal */}
      <Modal visible={followerModalVisible} transparent animationType="fade" onRequestClose={() => setFollowerModalVisible(false)}>
        <View style={styles.chatModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFollowerModalVisible(false)} />
          <View style={[styles.chatModalBox, { backgroundColor: C.card, maxHeight: 450 }]}>
            <Text style={[styles.chatModalTitle, { color: C.fg }]}>연결</Text>
            {/* Tabs */}
            <View style={styles.connectionTabs}>
              <Pressable
                style={[styles.connectionTab, connectionTab === 'followers' && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
                onPress={() => setConnectionTab('followers')}
              >
                <Text style={[styles.connectionTabText, { color: connectionTab === 'followers' ? C.gold : C.muted }]}>
                  나를 연결한 {followers.length}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.connectionTab, connectionTab === 'following' && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
                onPress={() => setConnectionTab('following')}
              >
                <Text style={[styles.connectionTabText, { color: connectionTab === 'following' ? C.gold : C.muted }]}>
                  내가 연결한 {followings.length}
                </Text>
              </Pressable>
            </View>
            {(() => {
              const list = connectionTab === 'followers' ? followers : followings;
              return list.length === 0 ? (
                <Text style={[{ color: C.muted, textAlign: 'center', paddingVertical: 20, fontSize: 13 }]}>
                  {connectionTab === 'followers' ? '아직 따르는 사람이 없습니다' : '아직 따르는 사람이 없습니다'}
                </Text>
              ) : (
                <FlatList
                  data={list}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.followerRow, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        setFollowerModalVisible(false);
                        router.push(`/artist/${item.username}`);
                      }}
                    >
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.followerAvatar} resizeMode="cover" />
                      ) : (
                        <View style={[styles.followerAvatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg }}>
                            {(item.name ?? item.username ?? '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.followerName, { color: C.fg }]}>{item.name ?? item.username}</Text>
                        <Text style={[styles.followerUsername, { color: C.muted }]}>@{item.username}</Text>
                      </View>
                      {item.latest_artwork_url ? (
                        <Image source={{ uri: item.latest_artwork_url }} style={styles.followerArtwork} resizeMode="cover" />
                      ) : (
                        <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                      )}
                    </Pressable>
                  )}
                />
              );
            })()}
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'visible',
    paddingBottom: 16,
  },
  heroContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroPanel: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroLeft: {
    alignItems: 'center',
    gap: 5,
    minWidth: 70,
  },
  heroRight: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 6,
  },
  heroAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
  heroAvatarEmoji: {
    fontSize: 22,
  },
  heroName: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroTypeBadge: {
    backgroundColor: 'rgba(200,169,110,0.1)',
  },
  heroVerifyBadge: {
    backgroundColor: 'rgba(255,77,79,0.1)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  heroSnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  heroSnsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  heroSnsLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  heroFieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(200,169,110,0.1)',
  },
  heroFieldEmoji: {
    fontSize: 9,
  },
  heroFieldChipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  statActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },

  /* Action row */
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },

  /* Follow */
  followBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Chat Modal */
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  chatModalBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  chatModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  chatModalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatModalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chatModalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Follower list */
  connectionTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  connectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  connectionTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  followerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  followerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  followerUsername: {
    fontSize: 11,
    marginTop: 2,
  },
  followerArtwork: {
    width: 40,
    height: 40,
    borderRadius: 8,
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
  artCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  artInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 12,
  },
  artInfoTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  artInfoMore: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  artExpandedInfo: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  artExpandedMeta: {
    fontSize: 13,
    lineHeight: 20,
  },
  artExpandedDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },

  /* Exhibition Grid */
  exGrid: {
    gap: 12,
  },
  exGridCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
  },
  exGridPoster: {
    width: 100,
    height: 100,
  },
  exGridPosterEmpty: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exGridInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  exGridTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  exGridDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  exGridBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  exGridBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exGridBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    color: '#f5f5f5',
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
  viewerTagsWrap: {
    marginBottom: 12,
    maxHeight: 32,
  },
  viewerTagsContent: {
    gap: 6,
  },
  viewerTag: {
    backgroundColor: 'rgba(200,169,110,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  viewerTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8A96E',
    letterSpacing: 0.3,
  },
  viewerArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewerArtistAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  viewerArtistName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
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
  viewerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  viewerSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  viewerLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewerDiamond: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#C8A96E',
    transform: [{ rotate: '45deg' }],
  },
  viewerDiamondFilled: {
    backgroundColor: '#C8A96E',
    borderRadius: 4,
  },
  viewerLikeCount: {
    color: '#C8A96E',
    fontSize: 13,
    fontWeight: '700',
  },
  viewerCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewerCommentIcon: {
    fontSize: 18,
  },
  viewerCommentCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  viewerCommentsSection: {
    marginTop: 12,
    maxHeight: 200,
  },
  viewerCommentsList: {
    maxHeight: 140,
  },
  viewerCommentsEmpty: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  viewerCommentItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  viewerCommentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewerCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerCommentUser: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  viewerCommentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  viewerCommentBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#C8A96E',
    letterSpacing: 0.2,
  },
  viewerCommentTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '500',
  },
  viewerCommentText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  viewerCommentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 8,
  },
  viewerCommentInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewerCommentSend: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewerCommentSendText: {
    color: '#C8A96E',
    fontSize: 13,
    fontWeight: '800',
  },
  viewerCounter: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },
  /* Collection filter circles */
  colFilterWrap: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  colFilterNavRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  colFilterNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colFilterNavText: {
    fontSize: 13,
    fontWeight: '600',
  },
  colFilterScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  colFilterItem: {
    alignItems: 'center',
    width: 68,
  },
  colFilterCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    padding: 2,
  },
  colFilterCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  colFilterName: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  /* Collection tab styles */
  colSection: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  colHeader: {
    flexDirection: 'row',
    padding: 16,
    gap: 14,
  },
  colCoverImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  colHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  colTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  colDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  colCount: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  colGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  colGridItem: {
    width: '31%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  colGridImage: {
    width: '100%',
    aspectRatio: 1,
  },
  colGridTitle: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  colMoreBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  colMoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  /* Exhibition card (single column) */
  exCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  exCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exCardPoster: {
    width: 90,
    height: 90,
  },
  exCardPosterEmpty: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exCardInfo: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  colSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  colSocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colSocialDiamond: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#C8A96E',
    transform: [{ rotate: '45deg' }],
  },
  colSocialDiamondFilled: {
    backgroundColor: '#C8A96E',
    borderRadius: 3,
  },
  colSocialCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  colCommentsWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  colCommentsEmpty: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  colCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  colCommentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
  },
  colCommentUser: {
    fontSize: 11,
    fontWeight: '700',
  },
  colCommentBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
  },
  colCommentBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  colCommentTime: {
    fontSize: 9,
    fontWeight: '500',
  },
  colCommentContent: {
    fontSize: 12,
    flex: 1,
  },
  colCommentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  colCommentInput: {
    flex: 1,
    fontSize: 13,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  colCommentSendText: {
    fontSize: 13,
    fontWeight: '800',
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
