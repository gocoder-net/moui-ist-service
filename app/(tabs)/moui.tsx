import { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, Pressable, SectionList, ActivityIndicator,
  Platform, Alert, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { parseRegion } from '@/constants/regions';
import { MOUI_CATEGORIES, TARGET_OPTIONS, FIELD_OPTIONS } from '@/constants/moui';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type MouiParticipant = {
  user_id: string;
  profiles: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    user_type: string;
  };
};

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
  address: string | null;
  meeting_date: string | null;
  frequency: string | null;
  recruit_start: string | null;
  recruit_deadline: string | null;
  status: 'open' | 'closed';
  created_at: string;
  profiles?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    field: string | null;
    user_type: 'creator' | 'aspiring' | 'audience';
    verified: boolean;
  };
  moui_participants?: MouiParticipant[];
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

function formatRecruitPeriod(start: string | null, end: string | null) {
  if (!end) return null;
  const fmt = (s: string) => {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  if (start) return `${fmt(start)} ~ ${fmt(end)}`;
  return `~ ${fmt(end)}`;
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
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [showMyJoined, setShowMyJoined] = useState(false);
  const [showMyPosts, setShowMyPosts] = useState(false);

  const myRegion = parseRegion(profile?.region);

  const fetchPosts = async () => {
    let query = (supabase as any)
      .from('moui_posts')
      .select('*, profiles(name, username, avatar_url, field, user_type, verified), moui_participants(user_id, profiles(name, username, avatar_url, user_type))')
      .order('created_at', { ascending: false });
    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }
    const { data } = await query;
    if (data) setPosts(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchPosts(); }, [selectedCategory]));

  const MAX_PARTICIPANTS = 30;

  const handleJoin = async (postId: string) => {
    if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
    const post = posts.find(p => p.id === postId);
    if (post && (post.moui_participants?.length ?? 0) >= MAX_PARTICIPANTS) {
      showAlert('알림', `참여 인원이 최대 ${MAX_PARTICIPANTS}명에 도달했습니다.`);
      return;
    }
    await (supabase as any).from('moui_participants').insert({ moui_post_id: postId, user_id: user.id });
    fetchPosts();
  };

  const handleLeave = async (postId: string) => {
    if (!user) return;
    await (supabase as any).from('moui_participants').delete().eq('moui_post_id', postId).eq('user_id', user.id);
    fetchPosts();
  };

  const myJoinedCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter(p => p.moui_participants?.some(pt => pt.user_id === user.id)).length;
  }, [posts, user]);

  const myPostsCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter(p => p.user_id === user.id).length;
  }, [posts, user]);

  const sections = useMemo(() => {
    let filtered = posts;
    if ((showMyJoined || showMyPosts) && user) {
      filtered = filtered.filter(p => {
        const joined = showMyJoined && p.moui_participants?.some(pt => pt.user_id === user.id);
        const owned = showMyPosts && p.user_id === user.id;
        return joined || owned;
      });
    }

    const sectionTitle = showMyJoined && showMyPosts ? '내 모임' : showMyJoined ? '참여중 모임' : showMyPosts ? '내가 만든 모임' : '모든 모임';

    if (!myRegion) {
      return filtered.length > 0 ? [{ title: sectionTitle, data: filtered }] : [];
    }
    const near: MouiPost[] = [];
    const close: MouiPost[] = [];
    const far: MouiPost[] = [];
    for (const p of filtered) {
      const pr = parseRegion(p.region);
      if (!pr) { far.push(p); continue; }
      if (pr.province === myRegion.province && pr.district === myRegion.district) {
        near.push(p);
      } else if (pr.province === myRegion.province) {
        close.push(p);
      } else {
        far.push(p);
      }
    }

    if (selectedDistance === 'near') return near.length > 0 ? [{ title: '📍 근처 모임', data: near }] : [];
    if (selectedDistance === 'close') return close.length > 0 ? [{ title: '🚶 가까운 모임', data: close }] : [];
    if (selectedDistance === 'far') return far.length > 0 ? [{ title: '🚀 먼 모임', data: far }] : [];

    const result: { title: string; data: MouiPost[] }[] = [];
    if (near.length > 0) result.push({ title: '📍 근처 모임', data: near });
    if (close.length > 0) result.push({ title: '🚶 가까운 모임', data: close });
    if (far.length > 0) result.push({ title: '🚀 먼 모임', data: far });
    return result;
  }, [posts, myRegion?.province, myRegion?.district, selectedDistance, showMyJoined, showMyPosts, user]);

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
    const deadlineExpired = item.recruit_deadline && new Date(item.recruit_deadline) < new Date();
    const isClosed = item.status === 'closed' || !!deadlineExpired;
    const participants = item.moui_participants ?? [];
    const isJoined = user ? participants.some(pt => pt.user_id === user.id) : false;

    const targetKeys = item.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

    const remainingDays = item.recruit_deadline
      ? Math.max(0, Math.ceil((new Date(item.recruit_deadline).getTime() - Date.now()) / 86400000))
      : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <View style={[styles.postCard, { backgroundColor: C.card, borderColor: C.border }, isClosed && { opacity: 0.85 }]}>
          {/* 상단: 카테고리 + 참석취소 + 상태 배지 */}
          <View style={styles.cardTopRow}>
            {item.category && (() => {
              const cat = MOUI_CATEGORIES.find(c => c.key === item.category);
              return cat ? (
                <View style={[styles.categorChipSmall, { backgroundColor: C.gold + '22', borderColor: C.gold + '55' }]}>
                  <Text style={[styles.categorChipSmallText, { color: C.gold }]}>{cat.icon} {cat.label}</Text>
                </View>
              ) : <View />;
            })()}
            <View style={styles.cardTopRight}>
              {isJoined && (
                <Pressable
                  onPress={() => handleLeave(item.id)}
                  style={({ pressed }) => [styles.leaveBadge, { backgroundColor: C.danger + '15', borderColor: C.danger + '44' }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.leaveBadgeText, { color: C.danger }]}>참석 취소</Text>
                </Pressable>
              )}
              <View style={[styles.statusBadge, { backgroundColor: isClosed ? C.danger + '22' : '#22c55e22' }]}>
                <Text style={[styles.statusText, { color: isClosed ? C.danger : '#22c55e' }]}>
                  {isClosed ? (deadlineExpired ? '모집 마감' : '마감') : remainingDays !== null ? `D-${remainingDays}` : '모집 중'}
                </Text>
              </View>
            </View>
          </View>

          {/* 제목 */}
          <Text style={[styles.postTitle, { color: C.fg }]}>{item.title}</Text>

          {/* 본문 */}
          <Text style={[styles.postDesc, { color: C.fg, opacity: 0.7 }]} numberOfLines={3}>{item.description}</Text>

          {/* 정보 박스 */}
          <View style={[styles.infoBox, { backgroundColor: C.bg, borderColor: C.border }]}>
            {item.meeting_date && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: C.muted }]}>일시</Text>
                <Text style={[styles.infoValue, { color: C.fg }]}>
                  {formatMeetingDate(item.meeting_date)}
                  {item.frequency && (item.frequency === 'regular' ? '  ·  정기' : '  ·  1회성')}
                </Text>
              </View>
            )}
            {(item.region || item.address) && (() => {
              const regionLabel = formatRegionLabel(item.region);
              const locationText = [regionLabel, item.address].filter(Boolean).join(' ');
              return locationText ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: C.muted }]}>장소</Text>
                  {item.map_url ? (
                    <Pressable onPress={() => { Linking.openURL(item.map_url!); }}>
                      <Text style={[styles.infoValue, { color: C.gold, textDecorationLine: 'underline' }]} numberOfLines={1}>{locationText}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.infoValue, { color: C.fg }]} numberOfLines={1}>{locationText}</Text>
                  )}
                </View>
              ) : null;
            })()}
            {(() => {
              const period = formatRecruitPeriod(item.recruit_start, item.recruit_deadline);
              return period ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: C.muted }]}>모집</Text>
                  <Text style={[styles.infoValue, { color: C.fg }]}>{period}</Text>
                </View>
              ) : null;
            })()}
          </View>

          {/* 태그 영역: 분야 + 대상 */}
          <View style={styles.postTagRow}>
            {item.fields && (
              item.fields.trim() === '전체' ? (
                <View style={[styles.postTag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                  <Text style={[styles.postTagText, { color: C.gold }]}>🌐 전체 분야</Text>
                </View>
              ) : (
                item.fields.split(',').map(f => {
                  const fo = FIELD_OPTIONS.find(o => o.key === f.trim());
                  return (
                    <View key={f.trim()} style={[styles.postTag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                      <Text style={[styles.postTagText, { color: C.gold }]}>{fo ? `${fo.icon} ${f.trim()}` : f.trim()}</Text>
                    </View>
                  );
                })
              )
            )}
            {targetKeys.map(key => {
              const t = TARGET_OPTIONS.find(o => o.key === key);
              return t ? (
                <View key={key} style={[styles.postTag, { backgroundColor: C.fg + '0A', borderColor: C.fg + '22' }]}>
                  <Text style={[styles.postTagText, { color: C.fg, opacity: 0.7 }]}>{t.icon} {t.label}</Text>
                </View>
              ) : null;
            })}
          </View>

          {/* 참여자 */}
          {(() => {
            const isFull = participants.length >= MAX_PARTICIPANTS;
            const showJoinBtn = user && !isOwner && !isClosed && !isJoined && !isFull;
            const displayParticipants = participants.slice(0, 6);
            const moreCount = participants.length - 6;

            return (participants.length > 0 || showJoinBtn || (isFull && user && !isOwner && !isJoined)) ? (
              <View style={[styles.participantsSection, { borderTopColor: C.border }]}>
                {participants.length > 0 && (
                  <View style={styles.participantsList}>
                    <Text style={[styles.participantsLabel, { color: C.muted }]}>참여자 ({participants.length}/{MAX_PARTICIPANTS})</Text>
                    <View style={styles.participantAvatars}>
                      {displayParticipants.map(pt => (
                        <Pressable
                          key={pt.user_id}
                          onPress={() => pt.profiles?.username && router.push(`/artist/${pt.profiles.username}`)}
                          style={styles.participantItem}
                        >
                          <View style={[styles.participantAvatar, { backgroundColor: C.bg, borderColor: C.border }]}>
                            {pt.profiles?.avatar_url ? (
                              <Image source={{ uri: pt.profiles.avatar_url }} style={styles.participantAvatarImg} contentFit="cover" />
                            ) : (
                              <Text style={{ fontSize: 10 }}>{pt.profiles?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                            )}
                          </View>
                          <Text style={[styles.participantName, { color: C.fg }]} numberOfLines={1}>
                            {pt.profiles?.name ?? pt.profiles?.username ?? ''}
                          </Text>
                        </Pressable>
                      ))}
                      {moreCount > 0 && (
                        <View style={styles.participantItem}>
                          <View style={[styles.participantAvatar, { backgroundColor: C.card, borderColor: C.border }]}>
                            <Text style={[{ fontSize: 10, fontWeight: '700', color: C.muted }]}>+{moreCount}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
                {showJoinBtn ? (
                  <Pressable
                    onPress={() => handleJoin(item.id)}
                    style={({ pressed }) => [
                      styles.joinBtn,
                      { backgroundColor: C.gold, borderColor: C.gold },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.joinBtnText, { color: C.bg }]}>참석하기</Text>
                  </Pressable>
                ) : isFull && user && !isOwner && !isJoined ? (
                  <Text style={[styles.participantsLabel, { color: C.danger }]}>인원이 가득 찼습니다</Text>
                ) : null}
              </View>
            ) : null;
          })()}

          {/* 작성자 + 액션 */}
          <View style={[styles.postFooter, { borderTopColor: C.border }]}>
            <Pressable
              onPress={() => author?.username && router.push(`/artist/${author.username}`)}
              style={styles.authorRow}
            >
              <View style={[styles.postAvatar, { backgroundColor: C.bg }]}>
                {author?.avatar_url ? (
                  <Image source={{ uri: author.avatar_url }} style={styles.postAvatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.postAvatarEmoji}>{author?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                )}
              </View>
              <Text style={[styles.postAuthor, { color: C.muted }]}>{author?.name ?? '회원'}</Text>
              {author && (
                <View style={[styles.userTypeBadge, { borderColor: C.gold, backgroundColor: 'rgba(200,169,110,0.1)' }]}>
                  {author.user_type === 'creator' ? (
                    <Text style={[styles.userTypeBadgeText, { color: C.gold }]}>
                      작가 <Text style={{ color: author.verified ? '#22c55e' : C.danger }}>
                        {author.verified ? '인증' : '인증 전'}
                      </Text>
                    </Text>
                  ) : (
                    <Text style={[styles.userTypeBadgeText, { color: C.gold }]}>
                      {author.user_type === 'aspiring' ? '지망생' : '감상자'}
                    </Text>
                  )}
                </View>
              )}
              <Text style={[styles.postTime, { color: C.muted }]}>· {formatDate(item.created_at)}</Text>
            </Pressable>
            {isOwner && (
              <>
                <Pressable
                  onPress={() => router.push(`/moui/create?edit=${item.id}`)}
                  style={({ pressed }) => [styles.closeBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.closeBtnText, { color: C.muted }]}>수정하기</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const msg = '이 모집글을 삭제하시겠습니까?';
                    const doDelete = async () => {
                      const { error } = await (supabase as any).from('moui_posts').delete().eq('id', item.id);
                      if (error) { showAlert('오류', '삭제 실패: ' + error.message); }
                      else { fetchPosts(); }
                    };
                    if (Platform.OS === 'web') {
                      if (!window.confirm(msg)) return;
                      doDelete();
                    } else {
                      Alert.alert('삭제 확인', msg, [
                        { text: '취소', style: 'cancel' },
                        { text: '삭제', style: 'destructive', onPress: doDelete },
                      ]);
                    }
                  }}
                  style={({ pressed }) => [styles.closeBtn, { borderColor: C.danger + '55' }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.closeBtnText, { color: C.danger }]}>삭제하기</Text>
                </Pressable>
                {!isClosed && (
                  <Pressable
                    onPress={() => {
                      const msg = remainingDays !== null
                        ? `모집기간이 ${remainingDays}일 남았는데 마감하시겠습니까?`
                        : '모집을 마감하시겠습니까?';
                      if (Platform.OS === 'web') {
                        if (!window.confirm(msg)) return;
                        (supabase as any).from('moui_posts').update({ status: 'closed' }).eq('id', item.id).then(() => fetchPosts());
                      } else {
                        Alert.alert('마감 확인', msg, [
                          { text: '취소', style: 'cancel' },
                          { text: '마감', style: 'destructive', onPress: async () => {
                            await (supabase as any).from('moui_posts').update({ status: 'closed' }).eq('id', item.id);
                            fetchPosts();
                          }},
                        ]);
                      }
                    }}
                    style={({ pressed }) => [styles.closeBtn, { borderColor: C.gold + '55', backgroundColor: C.gold + '11' }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.closeBtnText, { color: C.gold }]}>마감하기</Text>
                  </Pressable>
                )}
              </>
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
              {activityRegion ? `📍 내 활동 지역: ${activityRegion}` : '📍 활동 지역 설정'}
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

      {/* 거리 필터 */}
      {myRegion && (
        <View style={styles.distanceBar}>
          {([
            { key: null, label: '전체' },
            { key: 'near', label: '📍 근처' },
            { key: 'close', label: '🚶 가까운' },
            { key: 'far', label: '🚀 먼' },
          ] as const).map(d => {
            const active = selectedDistance === d.key;
            return (
              <Pressable
                key={d.key ?? 'all'}
                onPress={() => setSelectedDistance(d.key)}
                style={[
                  styles.distanceChip,
                  { borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold + '18' : 'transparent' },
                ]}
              >
                <Text style={[styles.distanceChipText, { color: active ? C.gold : C.muted }]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 참여중 / 내가 만든 모임 토글 */}
      {user && (myJoinedCount > 0 || myPostsCount > 0) && (
        <View style={styles.joinedToggleBar}>
          {myJoinedCount > 0 && (
            <Pressable
              onPress={() => setShowMyJoined(v => !v)}
              style={[
                styles.joinedToggleChip,
                {
                  borderColor: showMyJoined ? C.gold : C.border,
                  backgroundColor: showMyJoined ? C.gold + '18' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.joinedToggleText, { color: showMyJoined ? C.gold : C.muted }]}>
                참여중 모임 ({myJoinedCount})
              </Text>
            </Pressable>
          )}
          {myPostsCount > 0 && (
            <Pressable
              onPress={() => setShowMyPosts(v => !v)}
              style={[
                styles.joinedToggleChip,
                {
                  borderColor: showMyPosts ? C.gold : C.border,
                  backgroundColor: showMyPosts ? C.gold + '18' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.joinedToggleText, { color: showMyPosts ? C.gold : C.muted }]}>
                내가 만든 모임 ({myPostsCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 게시물 리스트 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: C.fg }]}>아직 모임이 없어요</Text>
          <Text style={[styles.emptyDesc, { color: C.muted }]}>첫 번째 모의를 작당해보세요!</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, { color: C.fg }]}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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

  /* 거리 필터 */
  distanceBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  distanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  distanceChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* 리스트 */
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  leaveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categorChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categorChipSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  postDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 30,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  postTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  postAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  postAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  postAvatarEmoji: { fontSize: 12 },
  postAuthor: {
    fontSize: 12,
    fontWeight: '600',
  },
  userTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  userTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  postTime: {
    fontSize: 11,
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

  /* 참여자 */
  participantsSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  participantsList: {
    gap: 6,
  },
  participantsLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantItem: {
    alignItems: 'center',
    gap: 3,
    width: 44,
  },
  participantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  participantAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  participantName: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* 참여중 모임 토글 */
  joinedToggleBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  joinedToggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  joinedToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
