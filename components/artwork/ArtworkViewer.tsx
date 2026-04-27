import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/auth-context';
import { useVideoSettings } from '@/contexts/video-settings-context';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import { timeAgo } from '@/lib/utils';
import { LikeDiamondButton } from '@/components/ui/LikeDiamondButton';
import { META_KEY_LABEL } from '@/constants/artwork-form';
import { WebView } from 'react-native-webview';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Artwork = Database['public']['Tables']['artworks']['Row'];

type EmbedType = 'youtube' | 'vimeo' | 'soundcloud' | 'instagram';
function getEmbedUrl(url: string, opts?: { autoplay?: boolean; mute?: boolean }): { embedUrl: string; type: EmbedType } | null {
  if (!url) return null;
  const ap = opts?.autoplay ? 1 : 0;
  const mt = opts?.mute ? 1 : 0;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?playsinline=1&rel=0&autoplay=${ap}&mute=${mt}`, type: 'youtube' };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=${ap}&muted=${mt}`, type: 'vimeo' };
  if (url.includes('soundcloud.com/')) {
    return { embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23C8A96E&auto_play=${ap === 1 ? 'true' : 'false'}&show_artwork=true`, type: 'soundcloud' };
  }
  const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
  if (igMatch) return { embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed/`, type: 'instagram' };
  return null;
}

export function ArtworkViewer({
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
  const videoSettings = useVideoSettings();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [viewerHovered, setViewerHovered] = useState(false);
  const flatListRef = useRef<FlatList<Artwork>>(null);
  const isWebViewer = Platform.OS === 'web';
  const viewerFrameWidth = isWebViewer ? Math.min(screenW * 0.88, 1280) : screenW;
  const viewerImageHeight = isWebViewer ? screenH * 0.72 : screenH * 0.6;
  const viewerNavOffset = isWebViewer ? Math.max((screenW - viewerFrameWidth) / 2 + 18, 18) : 18;

  const [embedExpanded, setEmbedExpanded] = useState(false);
  const [embedHidden, setEmbedHidden] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<{ id: string; content: string; user_id: string; username: string; name: string; avatar_url: string | null; created_at: string; user_type: string; verified: boolean }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null);

  // artistProfile이 없으면 artwork의 user_id로 자동 로드
  const displayProfile = artistProfile ?? loadedProfile;

  useEffect(() => {
    if (artistProfile || !visible) return;
    const aw = artworks[currentIndex];
    if (!aw) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', aw.user_id)
        .single();
      if (data) setLoadedProfile(data);
    })();
  }, [currentIndex, visible, artworks, artistProfile]);

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
      sendNotification({ userId: aw.user_id, type: 'like', title: `작품 "${aw.title}"에 좋아요`, fromUserId: user.id, targetId: aw.id });
    }
  };

  const submitComment = async () => {
    const aw = artworks[currentIndex];
    if (!aw || !user?.id || !commentText.trim()) return;
    const txt = commentText.trim();
    await supabase.from('artwork_comments').insert({ artwork_id: aw.id, user_id: user.id, content: txt });
    setCommentText('');
    setCommentCount(c => c + 1);
    loadCommentsList(aw.id);
    sendNotification({ userId: aw.user_id, type: 'comment', title: `작품 "${aw.title}"에 댓글`, body: txt, fromUserId: user.id, targetId: aw.id });
  };

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setEmbedExpanded(false);
    setEmbedHidden(false);
  }, [initialIndex]);

  useEffect(() => {
    if (!visible) {
      setEmbedExpanded(false);
      setEmbedHidden(false);
    }
  }, [visible]);

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
    setEmbedExpanded(false);
    setEmbedHidden(false);
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
          <ScrollView
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', minHeight: screenH }}
            style={{ width: viewerFrameWidth, height: screenH }}
          >
            <Image
              source={{ uri: item.image_url }}
              style={{ width: viewerFrameWidth, height: viewerImageHeight }}
              resizeMode="contain"
            />
          </ScrollView>
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
        <Pressable
          style={[styles.viewerCloseBtn, { top: insets.top + 12 }]}
          onPress={onClose}
        >
          <Text style={styles.viewerCloseText}>✕</Text>
        </Pressable>

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

        {!embedExpanded && !embedHidden && (() => {
          const meta = ((artwork as any)?.metadata ?? {}) as Record<string, string>;
          const linkUrl = meta?.link;
          if (!linkUrl) return null;
          const embed = getEmbedUrl(linkUrl, { autoplay: videoSettings.autoplay, mute: videoSettings.muted });
          if (!embed) return null;
          return (
            <View style={styles.embedMiniFloat}>
              <Pressable onPress={() => setEmbedExpanded(true)} style={styles.embedMiniInner}>
                <View style={{ flex: 1 }} pointerEvents="none">
                  {Platform.OS === 'web' ? (
                    <iframe
                      src={embed.embedUrl}
                      style={{ width: '100%', height: '100%', border: 'none' } as any}
                      allow="autoplay; encrypted-media"
                    />
                  ) : (
                    <WebView
                      source={{ uri: embed.embedUrl }}
                      style={{ flex: 1 }}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      scrollEnabled={false}
                    />
                  )}
                </View>
              </Pressable>
              <Pressable onPress={() => setEmbedHidden(true)} style={styles.embedMiniClose}>
                <Text style={styles.embedMiniCloseText}>✕</Text>
              </Pressable>
              <Pressable onPress={() => setEmbedExpanded(true)} style={styles.embedExpandHint}>
                <Text style={styles.embedExpandHintText}>크게 보기</Text>
              </Pressable>
            </View>
          );
        })()}

        {embedExpanded && (() => {
          const meta = ((artwork as any)?.metadata ?? {}) as Record<string, string>;
          const linkUrl = meta?.link;
          if (!linkUrl) return null;
          const embed = getEmbedUrl(linkUrl, { autoplay: true, mute: false });
          if (!embed) return null;
          const embedW = isWebViewer ? viewerFrameWidth : screenW;
          const embedH = embed.type === 'soundcloud' ? 166 : embed.type === 'instagram' ? Math.round(embedW * 1.2) : Math.round(embedW * 9 / 16);
          return (
            <View style={[styles.embedOverlay, { top: 0, bottom: 0 }]}>
              <View style={{ width: embedW, height: embedH, maxHeight: viewerImageHeight, borderRadius: 12, overflow: 'hidden' }}>
                {Platform.OS === 'web' ? (
                  <iframe
                    src={embed.embedUrl}
                    style={{ width: '100%', height: '100%', border: 'none' } as any}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <WebView
                    source={{ uri: embed.embedUrl }}
                    style={styles.embedWebView}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                    scrollEnabled={false}
                  />
                )}
              </View>
              <Pressable style={styles.embedCloseBtn} onPress={() => setEmbedExpanded(false)}>
                <Text style={styles.embedCloseBtnText}>영상 닫기</Text>
              </Pressable>
            </View>
          );
        })()}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.viewerBottom, { paddingBottom: insets.bottom + 24 }]}
          pointerEvents="box-none"
        >
          <View style={styles.viewerBottomInner}>
          {displayProfile && (
            <Pressable
              style={styles.viewerArtistRow}
              onPress={() => { onClose(); router.push(`/artist/${displayProfile.username}`); }}
            >
              {displayProfile.avatar_url ? (
                <Image source={{ uri: displayProfile.avatar_url }} style={styles.viewerArtistAvatar} />
              ) : (
                <View style={[styles.viewerArtistAvatar, { backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {(displayProfile.name ?? displayProfile.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.viewerArtistName}>
                {displayProfile.name ?? displayProfile.username}
              </Text>
            </Pressable>
          )}
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
              {(artwork as any)?.category && (
                <Text style={styles.viewerMeta}>{(artwork as any).category}</Text>
              )}
              {(artwork?.year || artwork?.medium) && (
                <Text style={styles.viewerMeta}>
                  {[artwork?.year, artwork?.medium].filter(Boolean).join(' · ')}
                </Text>
              )}
              {artwork?.width_cm && artwork?.height_cm && (
                <Text style={styles.viewerSize}>{artwork.width_cm} × {artwork.height_cm} cm</Text>
              )}
              {(() => {
                const meta = ((artwork as any)?.metadata ?? {}) as Record<string, string>;
                const skipKeys = new Set(['medium', 'technique', 'width_cm', 'height_cm', 'edition']);
                const entries = Object.entries(meta).filter(([k, v]) => v && !skipKeys.has(k));
                return entries.length > 0 ? entries.map(([k, v]) => (
                  k === 'link' ? (
                    <Pressable key={k} onPress={() => Linking.openURL(v)} style={styles.viewerLinkBtn}>
                      <Text style={styles.viewerLinkText}>외부에서 보기 ↗</Text>
                    </Pressable>
                  ) : (
                    <Text key={k} style={styles.viewerSize}>{META_KEY_LABEL[k] ?? k}: {v}</Text>
                  )
                )) : null;
              })()}
            </View>

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

          <View style={styles.viewerBottomRow}>
            <View style={styles.viewerSocialRow}>
              <LikeDiamondButton liked={liked} count={likeCount} onPress={toggleLike} size={22} />
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
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 60,
    alignItems: 'center',
  },
  viewerBottomInner: {
    width: '100%',
    maxWidth: 680,
    paddingHorizontal: 24,
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
  viewerLinkBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8A96E',
    alignSelf: 'flex-start',
  },
  viewerLinkText: {
    fontSize: 12,
    color: '#C8A96E',
    fontWeight: '600',
  },
  embedMiniFloat: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#000',
  },
  embedMiniInner: {
    flex: 1,
    overflow: 'hidden',
  },
  embedMiniClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  embedMiniCloseText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  embedExpandHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
  },
  embedExpandHintText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  embedOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 8,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  embedCloseBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  embedCloseBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  embedWebView: {
    flex: 1,
    backgroundColor: 'transparent',
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
});
