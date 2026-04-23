import { useCallback, useRef, useState } from 'react';
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
  card: '#212a35',
  danger: '#D94040',
};

const USER_TYPE_LABELS = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
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

const ROOM_EMOJI: Record<string, string> = { small: '🏠', medium: '🏛️', large: '🏰' };
const ROOM_LABEL: Record<string, string> = { small: '소형', medium: '중형', large: '대형' };

/* ── 전시관 카드 ── */
function ExhibitionCard({ item, onPress, onEdit, onDelete }: { item: Exhibition; onPress: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.exCard}>
      <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]} onPress={onPress}>
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
        <TouchableOpacity style={styles.exEditBtn} activeOpacity={0.5} onPress={onEdit}>
          <Text style={styles.exEditText}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exDeleteBtn} activeOpacity={0.5} onPress={onDelete}>
          <Text style={styles.exDeleteText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── 메뉴 행/섹션 컴포넌트 ── */
type MenuItem = { icon: string; label: string; onPress: () => void; color?: string };

function MenuRow({ item, isLast }: { item: MenuItem; isLast: boolean }) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
        onPress={item.onPress}
      >
        <Text style={styles.menuIcon}>{item.icon}</Text>
        <Text style={[styles.menuLabel, item.color ? { color: item.color } : undefined]}>{item.label}</Text>
        <Text style={[styles.menuArrow, item.color ? { color: item.color } : undefined]}>›</Text>
      </Pressable>
      {!isLast && <View style={styles.menuDivider} />}
    </>
  );
}

function MenuSection({ title, items, delay }: { title: string; items: MenuItem[]; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400).springify()} style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {items.map((item, i) => (
        <MenuRow key={item.label} item={item} isLast={i === items.length - 1} />
      ))}
    </Animated.View>
  );
}

/* ── 메인 ── */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const userType = profile?.user_type ?? 'audience';
  const emoji = USER_TYPE_EMOJI[userType];
  const label = USER_TYPE_LABELS[userType];

  /* 전시관 데이터 */
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

  useFocusEffect(useCallback(() => { fetchExhibitions(); }, [fetchExhibitions]));

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

  /* 메뉴 아이템 */
  const workItems: MenuItem[] = [
    { icon: '🖼', label: '내 포트폴리오 보기', onPress: () => router.push(`/artist/${user?.id}`) },
    { icon: '＋', label: '작품 추가', onPress: () => router.push('/artwork/create') },
  ];

  const accountItems: MenuItem[] = [
    { icon: '🚪', label: '로그아웃', onPress: signOut, color: C.danger },
  ];

  let delayCounter = 300;
  const nextDelay = () => { delayCounter += 80; return delayCounter; };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.header}>
          <Text style={styles.headerTitle}>내 정보</Text>
          <Text style={styles.headerIcon}>⚙</Text>
        </Animated.View>

        {/* 프로필 카드 */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile?.name ?? '회원'}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{label}</Text>
                </View>
              </View>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
        </Animated.View>

        {/* 모의 포인트 */}
        <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={styles.pointsCard}>
          <View style={styles.pointsRow}>
            <View style={styles.pointsLeft}>
              <Text style={styles.pointsLabel}>◆ 모의</Text>
              <Text style={styles.pointsAmount}>
                {(profile?.points ?? 0).toLocaleString()}
                <Text style={styles.pointsUnit}> 모의</Text>
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.pointsDetailBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {}}
            >
              <Text style={styles.pointsDetailText}>내역</Text>
            </Pressable>
          </View>
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsInfoText}>1모의 = 100원</Text>
          </View>
        </Animated.View>

        {/* 내 전시관 */}
        {exhibitions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(nextDelay()).duration(400).springify()} style={styles.exSection}>
            <View style={styles.exSectionHeader}>
              <Text style={styles.sectionHeaderText}>🏛️ 내 전시관</Text>
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

        {/* 나의 작품 (creator only) */}
        {userType === 'creator' && user?.id && (
          <MenuSection title="나의 작품" items={workItems} delay={nextDelay()} />
        )}

        {/* 계정 */}
        <MenuSection title="계정" items={accountItems} delay={nextDelay()} />
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
    color: C.fg,
  },
  headerIcon: {
    fontSize: 20,
    color: C.muted,
  },

  /* 프로필 카드 */
  profileCard: {
    backgroundColor: C.card,
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
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: C.fg,
  },
  badge: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
  },
  email: {
    fontSize: 13,
    color: C.muted,
  },

  /* 포인트 카드 */
  pointsCard: {
    backgroundColor: C.card,
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
  pointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 1,
  },
  pointsAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: C.fg,
  },
  pointsUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
  },
  pointsDetailBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  pointsDetailText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  pointsInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  pointsInfoText: {
    fontSize: 11,
    color: C.mutedLight,
    letterSpacing: 0.5,
  },

  /* 메뉴 섹션 */
  section: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
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
    fontSize: 15,
    fontWeight: '600',
    color: C.fg,
  },
  menuArrow: {
    fontSize: 18,
    color: C.muted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 48,
  },

  /* 내 전시관 섹션 */
  exSection: {
    backgroundColor: C.card,
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
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: 1,
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
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  exCard: {
    width: 160,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.bg,
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
    backgroundColor: C.bg,
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
    borderColor: C.danger,
    backgroundColor: 'rgba(217,64,64,0.08)',
  },
  exDeleteText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.danger,
    letterSpacing: 0.5,
  },
});
