import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, ActivityIndicator,
  Platform, Alert, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { parseRegion } from '@/constants/regions';
import { MOUI_CATEGORIES, TARGET_OPTIONS } from '@/constants/moui';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type MouiPost = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  fields: string | null;
  category: string | null;
  region: string | null;
  target_types: string | null;
  map_url: string | null;
  meeting_date: string | null;
  status: 'open' | 'closed';
  created_at: string;
  profiles?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    field: string | null;
    user_type: 'creator' | 'aspiring' | 'audience';
  };
};

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

function formatRegionLabel(region: string | null | undefined) {
  const parsed = parseRegion(region);
  if (!parsed) return region?.trim() ?? '';

  const compactProvince = parsed.province
    .replace('특별시', '시')
    .replace('광역시', '시')
    .replace('특별자치시', '시')
    .replace('특별자치도', '도');

  return `${compactProvince} ${parsed.district}`;
}

function formatMeetingDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[d.getDay()];
  if (hour === 0 && minute === 0) {
    return `${month}/${day}(${weekday})`;
  }
  return `${month}/${day}(${weekday}) ${hour}:${String(minute).padStart(2, '0')}`;
}

export default function MouiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors: C } = useThemeMode();
  const activityRegion = formatRegionLabel(profile?.region);

  const [posts, setPosts] = useState<MouiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchPosts = async () => {
    let query = (supabase as any)
      .from('moui_posts')
      .select('*, profiles(name, username, avatar_url, field, user_type)')
      .order('created_at', { ascending: false });
    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }
    const { data } = await query;
    if (data) setPosts(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchPosts(); }, [selectedCategory]));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const renderPost = ({ item, index }: { item: MouiPost; index: number }) => {
    const author = item.profiles;
    const isOwner = item.user_id === user?.id;
    const isClosed = item.status === 'closed';

    const targetKeys = item.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <View style={[styles.postCard, { backgroundColor: C.card }, isClosed && { opacity: 0.5 }]}>
          {/* 작성자 */}
          <View style={styles.postHeader}>
            <View style={[styles.postAvatar, { backgroundColor: C.bg }]}>
              {author?.avatar_url ? (
                <Image source={{ uri: author.avatar_url }} style={styles.postAvatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.postAvatarEmoji}>{author?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.postAuthor, { color: C.fg }]}>{author?.name ?? '회원'}</Text>
              <Text style={[styles.postAuthorSub, { color: C.mutedLight }]}>
                @{author?.username}{author?.field ? ` · ${author.field}` : ''}
              </Text>
            </View>
            <Text style={[styles.postTime, { color: C.mutedLight }]}>{formatDate(item.created_at)}</Text>
          </View>

          {/* 카테고리 칩 */}
          {item.category && (() => {
            const cat = MOUI_CATEGORIES.find(c => c.key === item.category);
            return cat ? (
              <View style={[styles.categorChipSmall, { backgroundColor: C.gold + '18' }]}>
                <Text style={styles.categorChipSmallText}>{cat.icon} {cat.label}</Text>
              </View>
            ) : null;
          })()}

          {/* 본문 */}
          <Text style={[styles.postTitle, { color: C.fg }]}>{item.title}</Text>
          <Text style={[styles.postDesc, { color: C.muted }]} numberOfLines={4}>{item.description}</Text>

          {/* 분야 태그 */}
          {item.fields && (
            <View style={styles.postTagRow}>
              {item.fields.split(',').map(f => (
                <View key={f.trim()} style={[styles.postTag, { backgroundColor: C.gold + '22', borderColor: C.gold }]}>
                  <Text style={[styles.postTagText, { color: C.gold }]}>{f.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 모집 대상 */}
          {targetKeys.length > 0 && (
            <View style={styles.postTagRow}>
              {targetKeys.map(key => {
                const t = TARGET_OPTIONS.find(o => o.key === key);
                return t ? (
                  <View key={key} style={[styles.postTag, { backgroundColor: C.card, borderColor: C.border }]}>
                    <Text style={[styles.postTagText, { color: C.muted }]}>{t.icon} {t.label}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}

          {/* 모임 일시 & 지도 링크 */}
          {(item.meeting_date || item.map_url) && (
            <View style={styles.metaRow}>
              {item.meeting_date && (
                <Text style={[styles.metaText, { color: C.muted }]}>
                  📅 {formatMeetingDate(item.meeting_date)}
                </Text>
              )}
              {item.map_url && (
                <Pressable onPress={() => { Linking.openURL(item.map_url!); }}>
                  <Text style={[styles.metaText, { color: C.gold }]}>
                    📍 지도 보기
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* 상태 */}
          <View style={styles.postFooter}>
            <View style={[styles.statusBadge, { backgroundColor: isClosed ? C.danger + '22' : '#22c55e22' }]}>
              <Text style={[styles.statusText, { color: isClosed ? C.danger : '#22c55e' }]}>
                {isClosed ? '마감' : '모집 중'}
              </Text>
            </View>
            {isOwner && !isClosed && (
              <Pressable
                onPress={async () => {
                  await (supabase as any).from('moui_posts').update({ status: 'closed' }).eq('id', item.id);
                  fetchPosts();
                }}
                style={({ pressed }) => [styles.closeBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.closeBtnText, { color: C.muted }]}>마감하기</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={[styles.header, { borderBottomColor: C.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: C.fg }]}>모임</Text>
          <Pressable
            onPress={() => router.push('/profile/detail?focus=region')}
            style={({ pressed }) => [
              styles.regionChip,
              {
                backgroundColor: activityRegion ? C.gold + '14' : C.card,
                borderColor: activityRegion ? C.gold + '55' : C.border,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text
              style={[
                styles.regionChipText,
                { color: activityRegion ? C.gold : C.muted },
              ]}
            >
              {activityRegion ? `📍 ${activityRegion}` : '📍 활동 지역 설정'}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
            router.push('/moui/create');
          }}
          style={({ pressed }) => [styles.headerBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.headerBtnText, { color: C.bg }]}>+ 모집</Text>
        </Pressable>
      </Animated.View>

      {/* 카테고리 필터 */}
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setSelectedCategory(null)}
          style={[
            styles.filterChip,
            { backgroundColor: selectedCategory === null ? C.gold : C.card },
          ]}
        >
          <Text style={[styles.filterChipText, { color: selectedCategory === null ? C.bg : C.muted }]}>
            전체
          </Text>
        </Pressable>
        {MOUI_CATEGORIES.map(cat => {
          const active = selectedCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setSelectedCategory(active ? null : cat.key)}
              style={[
                styles.filterChip,
                { backgroundColor: active ? C.gold : C.card },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? C.bg : C.muted }]}>
                {cat.icon} {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 게시물 리스트 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: C.fg }]}>아직 모임가 없어요</Text>
          <Text style={[styles.emptyDesc, { color: C.muted }]}>첫 번째 모의를 작당해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  regionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  regionChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* 필터 바 */
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* 리스트 */
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 4,
  },

  /* 게시물 카드 */
  postCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  postAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postAvatarEmoji: { fontSize: 18 },
  postAuthor: {
    fontSize: 14,
    fontWeight: '700',
  },
  postAuthorSub: {
    fontSize: 11,
  },
  postTime: {
    fontSize: 11,
  },
  categorChipSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  categorChipSmallText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  postDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  postTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  postTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  postTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 10,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  closeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
