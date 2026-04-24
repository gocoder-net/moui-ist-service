import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { getCreatorVerificationStatusText } from '@/constants/creator-verification';
import Animated, {
  FadeIn,
  FadeInDown,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const USER_TYPE_LABELS = { creator: '작가', aspiring: '지망생', audience: '일반' } as const;
const USER_TYPE_EMOJI = { creator: '🎨', aspiring: '✏️', audience: '👀' } as const;

/* ── 유틸 ── */
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

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
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

type RecentArtwork = {
  id: string;
  title: string;
  image_url: string;
};

type ArtworkCollection = {
  id: string;
  title: string;
  cover_image_url: string | null;
  artwork_count: number;
};

const ROOM_EMOJI: Record<string, string> = { small: '🏠', medium: '🏛️', large: '🏰' };
const ROOM_LABEL: Record<string, string> = { small: '소형', medium: '중형', large: '대형' };

/* ── PlayfulDiamond ── */
function PlayfulDiamond({ size = 14, color = '#C8A96E' }: { size?: number; color?: string }) {
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
        withTiming(1.1, { duration: 300 }),
        withTiming(1, { duration: 300 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
        withTiming(0.9, { duration: 200 }),
        withSpring(1, { damping: 8 }),
        withDelay(2000, withTiming(1, { duration: 0 })),
        withTiming(1.15, { duration: 400 }),
        withTiming(1, { duration: 400 }),
        withDelay(1200, withTiming(1, { duration: 0 })),
        withTiming(1.05, { duration: 200 }),
        withSpring(1, { damping: 12 }),
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
    <Animated.View
      style={[
        { width: size, height: size, borderWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] },
        animStyle,
      ]}
    />
  );
}

/* ── 전시관 카드 ── */
function ExhibitionCard({ item, onPress, onEdit, onDelete, C }: { item: Exhibition; onPress: () => void; onEdit: () => void; onDelete: () => void; C: any }) {
  return (
    <View style={[s.exCard, { borderColor: C.border, backgroundColor: C.bg }]}>
      <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]} onPress={onPress}>
        <View style={s.exPosterWrap}>
          {item.poster_image_url ? (
            <Image source={{ uri: item.poster_image_url }} style={s.exPoster} contentFit="cover" />
          ) : (
            <View style={[s.exPosterPlaceholder, { backgroundColor: C.bg }]}>
              <Text style={s.exPosterEmoji}>{ROOM_EMOJI[item.room_type] ?? '🏛️'}</Text>
            </View>
          )}
          <View style={s.exBadgeRow}>
            <View style={[s.exBadge, s.exThumbMarkBadge, { borderColor: 'rgba(200,169,110,0.45)' }]}>
              <Text style={s.exThumbMarkEmoji}>🏛️</Text>
            </View>
            <View style={s.exBadge}>
              <Text style={[s.exBadgeText, { color: C.muted }]}>{ROOM_LABEL[item.room_type] ?? item.room_type}</Text>
            </View>
            <View style={[s.exBadge, item.is_published && s.exBadgePublished]}>
              <Text style={[s.exBadgeText, { color: C.muted }, item.is_published && { color: C.gold }]}>
                {item.is_published ? '공개' : '비공개'}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.exTitleWrap}>
          <Text style={[s.exTitle, { color: C.fg }]} numberOfLines={1}>{item.title}</Text>
        </View>
      </Pressable>
      <View style={s.exBtnRow}>
        <TouchableOpacity style={[s.exEditBtn, { borderColor: C.gold }]} activeOpacity={0.5} onPress={onEdit}>
          <Text style={[s.exEditText, { color: C.gold }]}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.exDeleteBtn, { borderColor: C.danger }]} activeOpacity={0.5} onPress={onDelete}>
          <Text style={[s.exDeleteText, { color: C.danger }]}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── 최근 작품 카드 (프로필 미리보기) ── */
function ArtworkPreviewCard({
  item,
  onPress,
  onEdit,
  onDelete,
  C,
}: {
  item: RecentArtwork;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  C: any;
}) {
  return (
    <View style={[s.exCard, { borderColor: C.border, backgroundColor: C.bg }]}>
      <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]} onPress={onPress}>
        <View style={s.exPosterWrap}>
          <Image source={{ uri: item.image_url }} style={s.exPoster} contentFit="cover" />
          <View style={s.exBadgeRow}>
            <View style={[s.exBadge, s.exThumbMarkBadge, { borderColor: 'rgba(200,169,110,0.45)' }]}>
              <Text style={s.exThumbMarkEmoji}>🖼️</Text>
            </View>
          </View>
        </View>
        <View style={s.exTitleWrap}>
          <Text style={[s.exTitle, { color: C.fg }]} numberOfLines={1}>{item.title}</Text>
        </View>
      </Pressable>
      <View style={s.exBtnRow}>
        <TouchableOpacity style={[s.exEditBtn, { borderColor: C.gold }]} activeOpacity={0.5} onPress={onEdit}>
          <Text style={[s.exEditText, { color: C.gold }]}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.exDeleteBtn, { borderColor: C.danger }]} activeOpacity={0.5} onPress={onDelete}>
          <Text style={[s.exDeleteText, { color: C.danger }]}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── 메인 ── */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { colors: C } = useThemeMode();

  const userType = profile?.user_type ?? 'audience';
  const emoji = USER_TYPE_EMOJI[userType];
  const label = USER_TYPE_LABELS[userType];
  const avatarUrl = profile?.avatar_url;
  const verified = (profile as any)?.verified;

  /* 작가 인증 상태 */
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  const fetchVerificationStatus = useCallback(async () => {
    if (!user || verified) return;
    const { data } = await (supabase as any)
      .from('verification_requests')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setVerificationStatus(data[0].status);
    } else {
      setVerificationStatus('none');
    }
  }, [user, userType, verified]);

  /* 모임 */
  const [myMouiCount, setMyMouiCount] = useState(0);
  const [joinedMouiCount, setJoinedMouiCount] = useState(0);

  /* 전시관 · 최근 작품 */
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exNumMap, setExNumMap] = useState<Map<string, number>>(new Map());
  const [recentArtworks, setRecentArtworks] = useState<RecentArtwork[]>([]);
  const [collections, setCollections] = useState<ArtworkCollection[]>([]);
  const colScrollRef = useRef<ScrollView>(null);
  const colScrollX = useRef(0);
  const exScrollRef = useRef<ScrollView>(null);
  const exScrollX = useRef(0);
  const artScrollRef = useRef<ScrollView>(null);
  const artScrollX = useRef(0);

  const fetchExhibitions = useCallback(async () => {
    if (!user) return;
    // Fetch ordered by updated_at for display
    const { data } = await supabase
      .from('exhibitions')
      .select('id, title, room_type, poster_image_url, is_published, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(4);
    if (data) setExhibitions(data);

    // Compute creation-order number for URL (published only)
    const { data: allPublished } = await supabase
      .from('exhibitions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_published', true)
      .order('created_at', { ascending: true });
    if (allPublished) {
      const map = new Map<string, number>();
      allPublished.forEach((ex, i) => map.set(ex.id, i + 1));
      setExNumMap(map);
    }
  }, [user]);

  const fetchMouiCounts = useCallback(async () => {
    if (!user) return;
    const [{ count: created }, { count: joined }] = await Promise.all([
      (supabase as any).from('moui_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      (supabase as any).from('moui_participants').select('moui_post_id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    setMyMouiCount(created ?? 0);
    setJoinedMouiCount(joined ?? 0);
  }, [user]);

  const fetchRecentArtworks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('artworks')
      .select('id, title, image_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(4);
    if (data) setRecentArtworks(data as RecentArtwork[]);
  }, [user]);

  const fetchCollections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('artwork_collections')
      .select('id, title, cover_image_url')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    if (!data) return;
    // Count artworks per collection
    const withCounts: ArtworkCollection[] = await Promise.all(
      data.map(async (col) => {
        const { count } = await supabase
          .from('collection_artworks')
          .select('id', { count: 'exact', head: true })
          .eq('collection_id', col.id);
        return { ...col, artwork_count: count ?? 0 };
      }),
    );
    setCollections(withCounts);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchExhibitions();
      fetchRecentArtworks();
      fetchCollections();
      fetchVerificationStatus();
      fetchMouiCounts();
    }, [fetchExhibitions, fetchRecentArtworks, fetchCollections, fetchVerificationStatus, fetchMouiCounts]),
  );

  const handleDelete = useCallback((id: string) => {
    confirmAlert('전시관 삭제', '정말 삭제하시겠습니까?\n전시관과 관련 파일이 모두 삭제됩니다.', async () => {
      try {
        const { data: ex } = await supabase
          .from('exhibitions')
          .select('poster_image_url, wall_images, bgm_url')
          .eq('id', id)
          .single();

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
          if (artworkPaths.length > 0) await supabase.storage.from('artworks').remove(artworkPaths);
          if (bgmPaths.length > 0) await supabase.storage.from('bgm').remove(bgmPaths);
        }

        const { error: eaErr } = await supabase.from('exhibition_artworks').delete().eq('exhibition_id', id);
        if (eaErr) console.warn('exhibition_artworks 삭제 실패:', eaErr.message);

        const { error: exErr } = await supabase.from('exhibitions').delete().eq('id', id);
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

  const handleDeleteArtwork = useCallback(
    (item: RecentArtwork) => {
      confirmAlert('작품 삭제', '정말 삭제하시겠습니까?\n삭제한 작품은 되돌릴 수 없습니다.', async () => {
        try {
          if (item.image_url) {
            const parts = item.image_url.split('/artworks/');
            if (parts[1]) {
              await supabase.storage.from('artworks').remove([decodeURIComponent(parts[1])]);
            }
          }
          const { error } = await supabase.from('artworks').delete().eq('id', item.id);
          if (error) {
            if (Platform.OS === 'web') window.alert('삭제 실패: ' + error.message);
            return;
          }
          fetchRecentArtworks();
        } catch (err) {
          console.error('작품 삭제 중 오류:', err);
          if (Platform.OS === 'web') window.alert('삭제 실패: 알 수 없는 오류가 발생했습니다.');
        }
      });
    },
    [fetchRecentArtworks],
  );

  const handleDeleteCollection = useCallback(
    (col: ArtworkCollection) => {
      confirmAlert('컬렉션 삭제', `"${col.title}" 컬렉션을 삭제하시겠습니까?\n(작품은 삭제되지 않습니다)`, async () => {
        try {
          if (col.cover_image_url) {
            const parts = col.cover_image_url.split('/artworks/');
            if (parts[1]) {
              await supabase.storage.from('artworks').remove([decodeURIComponent(parts[1])]);
            }
          }
          await supabase.from('collection_artworks').delete().eq('collection_id', col.id);
          const { error } = await supabase.from('artwork_collections').delete().eq('id', col.id);
          if (error) {
            if (Platform.OS === 'web') window.alert('삭제 실패: ' + error.message);
            return;
          }
          fetchCollections();
        } catch (err) {
          console.error('컬렉션 삭제 중 오류:', err);
        }
      });
    },
    [fetchCollections],
  );

  let delayCounter = 300;
  const nextDelay = () => { delayCounter += 80; return delayCounter; };

  return (
    <View style={[s.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={s.innerContainer}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={s.header}>
          <Text style={[s.headerTitle, { color: C.fg }]}>내 정보</Text>
          <Pressable
            onPress={() => router.push('/profile/settings')}
            style={({ pressed }) => [s.settingsBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[s.settingsIcon, { color: C.muted }]}>⚙</Text>
          </Pressable>
        </Animated.View>

        {/* 프로필 카드 */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={[s.profileCard, { backgroundColor: C.card }]}>
          <Pressable
            style={({ pressed }) => [s.profileRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/profile/detail')}
          >
            <View style={[s.avatarWrap, { backgroundColor: C.bg, borderColor: C.gold }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImage} contentFit="cover" />
              ) : (
                <Text style={s.avatarEmoji}>{emoji}</Text>
              )}
            </View>
            <View style={s.profileInfo}>
              <View style={s.nameRow}>
                <Text style={[s.name, { color: C.fg }]}>{profile?.name ?? '회원'}</Text>
                {userType === 'creator' ? (
                  <View style={[s.badge, { backgroundColor: C.bg, borderColor: C.gold }]}>
                    <Text style={[s.badgeText, { color: C.gold }]}>
                      작가{' '}
                      <Text style={{ color: (profile as any)?.verified ? '#22c55e' : C.danger }}>
                        {getCreatorVerificationStatusText((profile as any)?.verified)}
                      </Text>
                    </Text>
                  </View>
                ) : (
                  <View style={[s.badge, { backgroundColor: C.bg, borderColor: C.gold }]}>
                    <Text style={[s.badgeText, { color: C.gold }]}>{label}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.email, { color: C.muted }]}>{user?.email}</Text>
            </View>
            <Text style={[s.profileArrow, { color: C.muted }]}>›</Text>
          </Pressable>
        </Animated.View>

        {/* 모의 포인트 */}
        <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.pointsCard, { backgroundColor: C.card }]}>
          <View style={s.pointsRow}>
            <View style={s.pointsLeft}>
              <View style={s.pointsLabelRow}>
                <PlayfulDiamond size={12} color={C.gold} />
                <Text style={[s.pointsLabel, { color: C.gold }]}>모의 포인트</Text>
              </View>
              <Text style={[s.pointsAmount, { color: C.fg }]}>
                {(profile?.points ?? 0).toLocaleString()}
                <Text style={[s.pointsUnit, { color: C.muted }]}> MOUI</Text>
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [s.pointsDetailBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/profile/points')}
            >
              <Text style={[s.pointsDetailText, { color: C.muted }]}>내역</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* 작가 인증 */}
        {!verified && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.verificationCard, { backgroundColor: C.card }]}>
            {verificationStatus === 'pending' ? (
              <View style={s.verificationRow}>
                <Text style={s.verificationIcon}>🔍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.verificationLabel, { color: C.muted }]}>작가 인증</Text>
                  <Text style={[s.verificationValue, { color: C.fg }]}>심사 중</Text>
                </View>
                <View style={[s.verificationPendingBadge, { backgroundColor: 'rgba(200,169,110,0.15)', borderColor: C.gold }]}>
                  <Text style={[s.verificationPendingText, { color: C.gold }]}>심사 중</Text>
                </View>
              </View>
            ) : (
              <View style={s.verificationRow}>
                <Text style={s.verificationIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.verificationLabel, { color: C.muted }]}>작가 인증</Text>
                  <Text style={[s.verificationValue, { color: C.fg }]}>
                    {verificationStatus === 'rejected' ? '반려되었습니다' : '인증이 필요합니다'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [s.verificationBtn, { borderColor: C.gold }, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/profile/verification')}
                >
                  <Text style={[s.verificationBtnText, { color: C.gold }]}>
                    {verificationStatus === 'rejected' ? '재신청하기' : '작가인증 하기'}
                  </Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        )}

        {/* 내 위치 */}
        <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.locationCard, { backgroundColor: C.card }]}>
          <View style={s.locationRow}>
            <Text style={s.locationIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.locationLabel, { color: C.muted }]}>내 위치</Text>
              <Text style={[s.locationValue, { color: C.fg }]}>
                {(profile as any)?.region ?? '미설정'}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [s.locationEditBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/profile/detail?focus=region')}
            >
              <Text style={[s.locationEditText, { color: C.muted }]}>{(profile as any)?.region ? '변경' : '설정'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* 나의 작품 (creator/aspiring) — 최근 수정 10개 미리보기 */}
        {(userType === 'creator' || userType === 'aspiring') && user?.id && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.exSection, { backgroundColor: C.card }]}>
            <View style={s.exSectionHeader}>
              <Text style={[s.sectionHeader, { color: C.muted, paddingLeft: 0, paddingTop: 0, paddingBottom: 0 }]}>🎨 나의 작품</Text>
              <View style={s.exHeaderRight}>
                {Platform.OS === 'web' && recentArtworks.length > 1 && (
                  <View style={s.exScrollBtns}>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => artScrollRef.current?.scrollTo({ x: Math.max(0, artScrollX.current - 172), animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => artScrollRef.current?.scrollTo({ x: artScrollX.current + 172, animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [s.exNewBtn, { borderColor: C.gold }, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/artwork/create')}
                >
                  <Text style={[s.exNewBtnText, { color: C.gold }]}>+ 작품 추가</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/artist/${profile?.username ?? user.id}`)}
            >
              <Text style={s.menuIcon}>🖼️</Text>
              <Text style={[s.menuLabel, { color: C.fg }]}>내 작품 보기</Text>
              <Text style={[s.menuArrow, { color: C.muted }]}>›</Text>
            </Pressable>
            <View style={[s.menuDivider, { backgroundColor: C.border, marginLeft: 48 }]} />
            {recentArtworks.length > 0 && (
              <ScrollView
                ref={artScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.exList}
                onScroll={(e) => { artScrollX.current = e.nativeEvent.contentOffset.x; }}
                scrollEventThrottle={16}
              >
                {recentArtworks.map((item) => (
                  <ArtworkPreviewCard
                    key={item.id}
                    item={item}
                    C={C}
                    onPress={() => router.push(`/artwork/create?artworkId=${item.id}`)}
                    onEdit={() => router.push(`/artwork/create?artworkId=${item.id}`)}
                    onDelete={() => handleDeleteArtwork(item)}
                  />
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* 나의 컬렉션 (creator/aspiring) */}
        {(userType === 'creator' || userType === 'aspiring') && user?.id && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.exSection, { backgroundColor: C.card }]}>
            <View style={s.exSectionHeader}>
              <Text style={[s.sectionHeader, { color: C.muted, paddingLeft: 0, paddingTop: 0, paddingBottom: 0 }]}>📂 나의 컬렉션</Text>
              <View style={s.exHeaderRight}>
                {Platform.OS === 'web' && collections.length > 1 && (
                  <View style={s.exScrollBtns}>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => colScrollRef.current?.scrollTo({ x: Math.max(0, colScrollX.current - 172), animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => colScrollRef.current?.scrollTo({ x: colScrollX.current + 172, animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [s.exNewBtn, { borderColor: C.gold }, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/collection/create')}
                >
                  <Text style={[s.exNewBtnText, { color: C.gold }]}>+ 새 컬렉션</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/artist/${profile?.username ?? user.id}?tab=collections`)}
            >
              <Text style={s.menuIcon}>📂</Text>
              <Text style={[s.menuLabel, { color: C.fg }]}>내 컬렉션 보기</Text>
              <Text style={[s.menuArrow, { color: C.muted }]}>›</Text>
            </Pressable>
            <View style={[s.menuDivider, { backgroundColor: C.border, marginLeft: 48 }]} />
            {collections.length > 0 && (
              <ScrollView
                ref={colScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.exList}
                onScroll={(e) => { colScrollX.current = e.nativeEvent.contentOffset.x; }}
                scrollEventThrottle={16}
              >
                {collections.map((col) => (
                  <View key={col.id} style={[s.collectionCard, { borderColor: C.border }]}>
                    {col.cover_image_url ? (
                      <Image source={{ uri: col.cover_image_url }} style={s.collectionCover} contentFit="cover" />
                    ) : (
                      <View style={[s.collectionCoverEmpty, { backgroundColor: C.bg }]}>
                        <Text style={{ fontSize: 28 }}>📂</Text>
                      </View>
                    )}
                    <View style={s.collectionInfo}>
                      <Text style={[s.collectionTitle, { color: C.fg }]} numberOfLines={1}>{col.title}</Text>
                      <Text style={[s.collectionCount, { color: C.muted }]}>{col.artwork_count}개 작품</Text>
                    </View>
                    <View style={s.collectionActions}>
                      <Pressable
                        style={({ pressed }) => [s.collectionActionBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => router.push(`/collection/create?collectionId=${col.id}`)}
                      >
                        <Text style={[s.collectionActionText, { color: C.gold }]}>수정</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.collectionActionBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => handleDeleteCollection(col)}
                      >
                        <Text style={[s.collectionActionText, { color: C.danger }]}>삭제</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* 내 전시관 */}
        {(userType === 'creator' || userType === 'aspiring') && user?.id && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.exSection, { backgroundColor: C.card }]}>
            <View style={s.exSectionHeader}>
              <Text style={[s.sectionHeader, { color: C.muted, paddingLeft: 0, paddingTop: 0, paddingBottom: 0 }]}>🏛️ 내 전시관</Text>
              <View style={s.exHeaderRight}>
                {Platform.OS === 'web' && exhibitions.length > 1 && (
                  <View style={s.exScrollBtns}>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => exScrollRef.current?.scrollTo({ x: Math.max(0, exScrollX.current - 172), animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.exScrollBtn, { borderColor: C.border }]}
                      activeOpacity={0.5}
                      onPress={() => exScrollRef.current?.scrollTo({ x: exScrollX.current + 172, animated: true })}
                    >
                      <Text style={[s.exScrollBtnText, { color: C.muted }]}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [s.exNewBtn, { borderColor: C.gold }, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/exhibition/create')}
                >
                  <Text style={[s.exNewBtnText, { color: C.gold }]}>+ 새 전시관</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/artist/${profile?.username ?? user?.id}?tab=exhibitions`)}
            >
              <Text style={s.menuIcon}>🎫</Text>
              <Text style={[s.menuLabel, { color: C.fg }]}>내 전시관 보기</Text>
              <Text style={[s.menuArrow, { color: C.muted }]}>›</Text>
            </Pressable>
            <View style={[s.menuDivider, { backgroundColor: C.border, marginLeft: 48 }]} />
            {exhibitions.length > 0 && (
              <ScrollView
                ref={exScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.exList}
                onScroll={(e) => { exScrollX.current = e.nativeEvent.contentOffset.x; }}
                scrollEventThrottle={16}
              >
                {exhibitions.map((item) => (
                  <ExhibitionCard
                    key={item.id}
                    item={item}
                    C={C}
                    onPress={() => {
                      const num = exNumMap.get(item.id);
                      if (num && profile?.username) {
                        router.push(`/3dexhibition/${profile.username}/${num}`);
                      } else {
                        router.push(`/exhibition/${item.id}`);
                      }
                    }}
                    onEdit={() => router.push(`/exhibition/create?editId=${item.id}`)}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* 내 모임 */}
        {user?.id && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={[s.exSection, { backgroundColor: C.card }]}>
            <View style={s.exSectionHeader}>
              <Text style={[s.sectionHeader, { color: C.muted, paddingLeft: 0, paddingTop: 0, paddingBottom: 0 }]}>🤝 내 모임</Text>
              <Pressable
                style={({ pressed }) => [s.exNewBtn, { borderColor: C.gold }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push('/moui/create')}
              >
                <Text style={[s.exNewBtnText, { color: C.gold }]}>+ 모임만들기</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(tabs)/moui?user=' + (profile?.username ?? '') as any)}
            >
              <Text style={s.menuIcon}>📋</Text>
              <Text style={[s.menuLabel, { color: C.fg }]}>내가 만든 모임</Text>
              <Text style={[s.mouiCount, { color: C.gold }]}>{myMouiCount}</Text>
              <Text style={[s.menuArrow, { color: C.muted }]}>›</Text>
            </Pressable>
            <View style={[s.menuDivider, { backgroundColor: C.border, marginLeft: 48 }]} />
            <Pressable
              style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}
              onPress={() => {
                router.push('/(tabs)/moui' as any);
                // 참여중 필터는 로그인 후 필터 패널에서 선택
              }}
            >
              <Text style={s.menuIcon}>🙋</Text>
              <Text style={[s.menuLabel, { color: C.fg }]}>참여중인 모임</Text>
              <Text style={[s.mouiCount, { color: C.gold }]}>{joinedMouiCount}</Text>
              <Text style={[s.menuArrow, { color: C.muted }]}>›</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },

  /* 헤더 */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
  },

  /* 프로필 카드 */
  profileCard: {
    borderRadius: 16,
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarEmoji: { fontSize: 24 },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  email: {
    fontSize: 13,
  },
  profileArrow: {
    fontSize: 22,
    marginLeft: 4,
  },

  /* 포인트 카드 */
  pointsCard: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsLeft: {
    gap: 4,
  },
  pointsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pointsAmount: {
    fontSize: 24,
    fontWeight: '900',
  },
  pointsUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  pointsDetailBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  pointsDetailText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pointsInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pointsInfoText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },

  /* 작가 인증 */
  verificationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationIcon: {
    fontSize: 20,
  },
  verificationLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  verificationValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  verificationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  verificationBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verificationPendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  verificationPendingText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* 내 위치 */
  locationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  locationEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  locationEditText: {
    fontSize: 12,
    fontWeight: '700',
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    paddingTop: 16,
    paddingLeft: 16,
    paddingBottom: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
  },
  menuIcon: {
    fontSize: 18,
    width: 32,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  menuArrow: {
    fontSize: 18,
  },
  mouiCount: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },
  menuDivider: {
    height: 1,
    marginLeft: 48,
  },

  /* 내 전시관 섹션 */
  exSection: {
    borderRadius: 16,
    marginBottom: 12,
    paddingBottom: 16,
  },
  exSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  exScrollBtnText: {
    fontSize: 14,
  },
  exNewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  exNewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exList: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  exCard: {
    width: 160,
    borderWidth: 1,
    borderRadius: 16,
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
  exThumbMarkBadge: {
    paddingHorizontal: 5,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exThumbMarkEmoji: {
    fontSize: 12,
    lineHeight: 14,
  },
  exBadgePublished: {
    backgroundColor: 'rgba(200,169,110,0.18)',
  },
  exBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
    backgroundColor: 'rgba(200,169,110,0.08)',
  },
  exEditText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(217,64,64,0.08)',
  },
  exDeleteText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  /* Collection card */
  collectionCard: {
    width: 156,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 4,
  },
  collectionCover: {
    width: '100%',
    height: 100,
  },
  collectionCoverEmpty: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionInfo: {
    padding: 8,
  },
  collectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  collectionCount: {
    fontSize: 10,
    marginTop: 2,
  },
  collectionActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  collectionActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  collectionActionText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
