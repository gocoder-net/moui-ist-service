import { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, Pressable, SectionList, ActivityIndicator,
  Platform, Alert, Linking, TextInput, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  const { user: userParam } = useLocalSearchParams<{ user?: string }>();
  const { user, profile, adminMode } = useAuth();
  const { colors: C } = useThemeMode();
  const activityRegion = formatRegionLabel(profile?.region);

  const [posts, setPosts] = useState<MouiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState(userParam ?? '');
  const [showSearchBar, setShowSearchBar] = useState(!!(userParam));
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'joined' | 'mine'>('all');
  const [descPopup, setDescPopup] = useState<{ title: string; content: string } | null>(null);

  const myRegion = parseRegion(profile?.region);
  const myProvince = myRegion?.province;
  const myDistrict = myRegion?.district;

  const fetchPosts = async () => {
    setLoading(true);
    const query = (supabase as any)
      .from('moui_posts')
      .select('*, profiles(name, username, avatar_url, field, user_type, verified), moui_participants(user_id, profiles(name, username, avatar_url, user_type))')
      .order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setPosts(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchPosts(); }, []));

  const MAX_PARTICIPANTS = 30;

  const JOIN_COST = 50;

  const doJoin = async (postId: string) => {
    if (!user) return;
    // 포인트 차감
    const { data: profileData } = await supabase.from('profiles').select('points').eq('id', user.id).single();
    const currentPoints = profileData?.points ?? 0;
    if (currentPoints < JOIN_COST) {
      showAlert('알림', `모의(MOUI)가 부족합니다. (보유: ${currentPoints})`);
      return;
    }
    const newBalance = currentPoints - JOIN_COST;
    await supabase.from('profiles').update({ points: newBalance }).eq('id', user.id);
    await (supabase as any).from('point_history').insert({
      user_id: user.id,
      amount: -JOIN_COST,
      balance: newBalance,
      type: 'moui_join',
      description: '모임 참석',
    });
    await (supabase as any).from('moui_participants').insert({ moui_post_id: postId, user_id: user.id });
    fetchPosts();
  };

  const promptSignup = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('모의스트 가입이 필요합니다.\n가입하시겠습니까?')) {
        router.push('/signup' as any);
      }
    } else {
      Alert.alert('가입 필요', '모의스트 가입이 필요합니다.', [
        { text: '취소', style: 'cancel' },
        { text: '가입하기', onPress: () => router.push('/signup' as any) },
      ]);
    }
  };

  const handleJoin = (postId: string) => {
    if (!user) { promptSignup(); return; }
    const post = posts.find(p => p.id === postId);
    if (post && (post.moui_participants?.length ?? 0) >= MAX_PARTICIPANTS) {
      showAlert('알림', `참여 인원이 최대 ${MAX_PARTICIPANTS}명에 도달했습니다.`);
      return;
    }
    const msg = `${JOIN_COST} 모의(MOUI)를 사용합니다.`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      doJoin(postId);
    } else {
      Alert.alert('모임 참석', msg, [
        { text: '취소', style: 'cancel' },
        { text: '참석', onPress: () => doJoin(postId) },
      ]);
    }
  };

  const handleLeave = async (postId: string) => {
    if (!user) return;
    await (supabase as any).from('moui_participants').delete().eq('moui_post_id', postId).eq('user_id', user.id);
    fetchPosts();
  };

  const availableCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter(p => {
      const deadlineExpired = p.recruit_deadline && new Date(p.recruit_deadline) < new Date();
      const isClosed = p.status === 'closed' || !!deadlineExpired;
      const isOwner = p.user_id === user.id;
      const isJoined = p.moui_participants?.some(pt => pt.user_id === user.id);
      const isFull = (p.moui_participants?.length ?? 0) >= 30;
      return !isClosed && !isOwner && !isJoined && !isFull;
    }).length;
  }, [posts, user]);

  const myJoinedCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter(p => p.user_id !== user.id && p.moui_participants?.some(pt => pt.user_id === user.id)).length;
  }, [posts, user]);

  const myPostsCount = useMemo(() => {
    if (!user) return 0;
    return posts.filter(p => p.user_id === user.id).length;
  }, [posts, user]);

  const activeFilterTags = useMemo(() => {
    const tags: { label: string; clear: () => void }[] = [];
    for (const key of selectedCategories) {
      const cat = MOUI_CATEGORIES.find(c => c.key === key);
      if (cat) tags.push({ label: `${cat.icon} ${cat.label}`, clear: () => setSelectedCategories(prev => { const next = new Set(prev); next.delete(key); return next; }) });
    }
    if (selectedField) {
      const fo = FIELD_OPTIONS.find(o => o.key === selectedField);
      if (fo) tags.push({ label: `${fo.icon} ${fo.key}`, clear: () => setSelectedField(null) });
    }
    if (selectedTarget) {
      const t = TARGET_OPTIONS.find(o => o.key === selectedTarget);
      if (t) tags.push({ label: t.label, clear: () => setSelectedTarget(null) });
    }
    if (selectedDistance) {
      const distMap: Record<string, string> = { near: '📍 근처', close: '🚶 가까운', far: '🚀 먼' };
      tags.push({ label: distMap[selectedDistance], clear: () => setSelectedDistance(null) });
    }
    return tags;
  }, [selectedCategories, selectedDistance, selectedField, selectedTarget]);

  const activeFilterCount = activeFilterTags.length;
  const filterButtonActive = showFilterPanel || activeFilterCount > 0;
  const createButtonGradient = ['#201A12', '#15110D'] as const;
  const createButtonBorder = '#8F7443';
  const createButtonShadow = C.gold;
  const createButtonText = '#E3C78E';
  const createButtonIconBg = 'rgba(200,169,110,0.16)';

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setSelectedField(null);
    setSelectedTarget(null);
    setSelectedDistance(null);
  };

  const sections = useMemo(() => {
    let filtered = posts;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const exactUserMatch = filtered.filter(p => p.profiles?.username?.toLowerCase() === q);
      if (exactUserMatch.length > 0) {
        filtered = exactUserMatch;
      } else {
        filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
      }
    }

    if (selectedCategories.size > 0) {
      filtered = filtered.filter(p => p.category != null && selectedCategories.has(p.category));
    }

    if (selectedField) {
      filtered = filtered.filter(p => {
        const fields = p.fields?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
        return p.fields?.trim() === '전체' || fields.includes(selectedField);
      });
    }

    if (selectedTarget) {
      filtered = filtered.filter(p => {
        const targets = p.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
        return targets.includes(selectedTarget);
      });
    }

    // 탭 필터
    if (activeTab === 'available') {
      filtered = filtered.filter(p => {
        const deadlineExpired = p.recruit_deadline && new Date(p.recruit_deadline) < new Date();
        const isClosed = p.status === 'closed' || !!deadlineExpired;
        const isOwner = p.user_id === user?.id;
        const isJoined = user ? p.moui_participants?.some(pt => pt.user_id === user.id) : false;
        const isFull = (p.moui_participants?.length ?? 0) >= MAX_PARTICIPANTS;
        return !isClosed && !isOwner && !isJoined && !isFull;
      });
    } else if (activeTab === 'joined' && user) {
      filtered = filtered.filter(p => p.user_id !== user.id && p.moui_participants?.some(pt => pt.user_id === user.id));
    } else if (activeTab === 'mine' && user) {
      filtered = filtered.filter(p => p.user_id === user.id);
    }

    const sectionTitle = activeTab === 'available' ? '참여가능 모임' : activeTab === 'joined' ? '참여중 모임' : activeTab === 'mine' ? '만든 모임' : '모든 모임';

    if (!myProvince || !myDistrict) {
      return filtered.length > 0 ? [{ title: sectionTitle, data: filtered }] : [];
    }
    const near: MouiPost[] = [];
    const close: MouiPost[] = [];
    const far: MouiPost[] = [];
    for (const p of filtered) {
      const pr = parseRegion(p.region);
      if (!pr) { far.push(p); continue; }
      if (pr.province === myProvince && pr.district === myDistrict) {
        near.push(p);
      } else if (pr.province === myProvince) {
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
  }, [posts, myDistrict, myProvince, selectedCategories, selectedDistance, selectedField, selectedTarget, user, searchQuery, activeTab]);

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
    const authorName = author?.name ?? author?.username ?? '회원';
    const isOwner = item.user_id === user?.id;
    const deadlineExpired = item.recruit_deadline && new Date(item.recruit_deadline) < new Date();
    const isClosed = item.status === 'closed' || !!deadlineExpired;
    const participants = item.moui_participants ?? [];
    const isJoined = user ? participants.some(pt => pt.user_id === user.id) : false;
    const isFull = participants.length >= MAX_PARTICIPANTS;
    const showJoinBtn = !isOwner && !isClosed && !isJoined && !isFull;

    const targetKeys = item.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

    const remainingDays = item.recruit_deadline
      ? Math.max(0, Math.ceil((new Date(item.recruit_deadline).getTime() - Date.now()) / 86400000))
      : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <View style={[
          styles.postCard,
          { backgroundColor: isOwner ? C.goldDim : C.card, borderColor: isOwner ? C.gold : C.border, borderWidth: isOwner ? 1.5 : 1 },
          isClosed && { opacity: 0.85 },
        ]}>
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
              {isJoined && !isOwner && (
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
          <View style={styles.postAuthorMetaRow}>
            <Pressable
              onPress={() => author?.username && router.push(`/artist/${author.username}`)}
              style={styles.postAuthorMetaLink}
            >
              <View style={[styles.postAvatar, { backgroundColor: C.bg }]}>
                {author?.avatar_url ? (
                  <Image source={{ uri: author.avatar_url }} style={styles.postAvatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.postAvatarEmoji}>{author?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                )}
              </View>
              <Text style={[styles.postAuthorMetaName, { color: C.muted }]}>{authorName}</Text>
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
                      {author.user_type === 'aspiring' ? '지망생' : '일반'}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
            <Text style={[styles.postTitleMeta, { color: C.muted }]} numberOfLines={1}>
              {`· ${formatDate(item.created_at)}`}
            </Text>
          </View>

          {/* 본문 */}
          <View style={styles.descRow}>
            <Text style={[styles.postDesc, { color: C.fg, opacity: 0.7, flex: 1 }]} numberOfLines={1}>{item.description}</Text>
            <Pressable onPress={() => setDescPopup({ title: item.title, content: item.description })} style={({ pressed }) => [styles.descMoreBtn, pressed && { opacity: 0.6 }]}>
              <Text style={[styles.descMoreText, { color: C.gold }]}>더보기</Text>
            </Pressable>
          </View>

          {/* 정보 박스 */}
          <View style={[styles.infoBox, { backgroundColor: C.bg, borderColor: C.border }]}>
            {item.meeting_date && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: C.muted }]}>날짜</Text>
                {user ? (
                  <Text style={[styles.infoValue, { color: C.fg }]}>
                    {formatMeetingDate(item.meeting_date)}
                    {item.frequency && (item.frequency === 'regular' ? '  ·  정기' : '  ·  1회성')}
                  </Text>
                ) : (
                  <Text style={[styles.infoValue, { color: C.muted, opacity: 0.6 }]}>로그인 후 확인 가능</Text>
                )}
              </View>
            )}
            {(item.region || item.address) && (() => {
              const regionLabel = formatRegionLabel(item.region);
              const locationText = [regionLabel, item.address].filter(Boolean).join(' ');
              return locationText ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: C.muted }]}>장소</Text>
                  {!user ? (
                    <Text style={[styles.infoValue, { color: C.muted, opacity: 0.6 }]}>로그인 후 확인 가능</Text>
                  ) : item.map_url ? (
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
                  {user ? (
                    <Text style={[styles.infoValue, { color: C.fg }]}>{period}</Text>
                  ) : (
                    <Text style={[styles.infoValue, { color: C.muted, opacity: 0.6 }]}>로그인 후 확인 가능</Text>
                  )}
                </View>
              ) : null;
            })()}
            {item.fields && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: C.muted }]}>분야</Text>
                <View style={[styles.postTagRow, { flex: 1 }]}>
                  {item.fields.trim() === '전체' ? (
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
                  )}
                </View>
              </View>
            )}
            {targetKeys.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: C.muted }]}>대상</Text>
                <View style={[styles.postTagRow, { flex: 1 }]}>
                  {targetKeys.map(key => {
                    const t = TARGET_OPTIONS.find(o => o.key === key);
                    return t ? (
                      <View key={key} style={[styles.postTag, { backgroundColor: C.fg + '0A', borderColor: C.fg + '22' }]}>
                        <Text style={[styles.postTagText, { color: C.fg, opacity: 0.82 }]}>{t.icon} {t.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </View>
            )}
          </View>

          {/* 참여자 */}
          {(() => {
            const displayParticipants = participants.slice(0, 6);
            const moreCount = participants.length - 6;

            return (participants.length > 0 || (isFull && user && !isOwner && !isJoined)) ? (
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
                {isFull && user && !isOwner && !isJoined ? (
                  <Text style={[styles.participantsLabel, { color: C.danger }]}>인원이 가득 찼습니다</Text>
                ) : null}
              </View>
            ) : null;
          })()}

          {showJoinBtn && (
            <Pressable
              onPress={() => handleJoin(item.id)}
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: '#87CEEB', borderColor: '#7AC0DD' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.joinBtnText, { color: '#fff' }]}>참석</Text>
            </Pressable>
          )}

          {(isJoined || isOwner) && (
            <Pressable
              onPress={() => router.push(`/moui/${item.id}` as any)}
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: '#5cb85c', borderColor: '#4cae4c' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.joinBtnText, { color: '#fff' }]}>채팅 입장</Text>
            </Pressable>
          )}
          {(isOwner || adminMode) && (
            <View style={styles.ownerActionRow}>
              {isOwner && (
                <Pressable
                  onPress={() => router.push(`/moui/create?edit=${item.id}`)}
                  style={({ pressed }) => [styles.closeBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.closeBtnText, { color: C.muted }]}>수정하기</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  const msg = '이 모집글을 삭제하시겠습니까?';
                  const doDelete = async () => {
                    let error;
                    if (adminMode && !isOwner) {
                      ({ error } = await supabase.rpc('admin_delete_moui_post', { post_id: item.id }));
                    } else {
                      ({ error } = await (supabase as any).from('moui_posts').delete().eq('id', item.id));
                    }
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
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={[styles.header, { borderBottomColor: C.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: C.fg }]}>모임</Text>
        </View>
        <View style={styles.headerMetaRow}>
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
              numberOfLines={1}
              style={[
                styles.regionChipText,
                { color: activityRegion ? C.gold : C.muted },
              ]}
            >
              {activityRegion ? `📍 ${activityRegion}` : '📍 위치 설정'}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {/* 돋보기 */}
          <Pressable
            onPress={() => { setShowSearchBar(v => !v); if (showSearchBar) setSearchQuery(''); }}
            style={({ pressed }) => [
              styles.metaBtn,
              {
                borderColor: showSearchBar ? C.gold + '99' : C.border,
                backgroundColor: showSearchBar ? C.gold + '16' : C.card,
                paddingHorizontal: 7,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name={showSearchBar ? 'search' : 'search-outline'} size={11} color={showSearchBar ? C.gold : C.fg} />
          </Pressable>
          {/* 필터 */}
          <Pressable
            onPress={() => setShowFilterPanel(v => !v)}
            style={({ pressed }) => [
              styles.metaBtn,
              {
                borderColor: filterButtonActive ? C.gold + '99' : C.border,
                backgroundColor: filterButtonActive ? C.gold + '16' : C.card,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={showFilterPanel ? 'options' : 'options-outline'}
              size={11}
              color={filterButtonActive ? C.gold : C.fg}
            />
            <Text style={{ color: filterButtonActive ? C.gold : C.muted, fontSize: 11, fontWeight: '700' }}>
              필터
            </Text>
            {activeFilterCount > 0 && (
              <View style={[styles.filterToggleBadge, { backgroundColor: C.gold, borderColor: C.bg }]}>
                <Text style={[styles.filterToggleBadgeText, { color: C.bg }]}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
          {/* 만들기 */}
          <Pressable
            onPress={() => {
              if (!user) { promptSignup(); return; }
              router.push('/moui/create');
            }}
            style={({ pressed }) => [
              styles.metaBtn,
              {
                borderColor: '#3a6a9a',
                backgroundColor: '#1a3a5c',
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="add" size={11} color="#87CEEB" />
            <Text style={{ color: '#87CEEB', fontSize: 11, fontWeight: '700' }}>만들기</Text>
          </Pressable>
        </View>
        {showSearchBar && (
          <View style={[styles.searchBarWrap, { backgroundColor: C.card, borderColor: searchQuery ? C.gold + '88' : C.border }]}>
            <Ionicons name="search" size={14} color={searchQuery ? C.gold : C.muted} style={{ marginRight: 6 }} />
            <TextInput
              value={searchQuery}
              onChangeText={(text) => { setSearchQuery(text); if (text.trim()) setActiveTab('all'); }}
              placeholder="모임을 검색하세요"
              placeholderTextColor={C.muted}
              style={[styles.searchBarInput, { color: C.fg }]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>

      {/* 탭바: 전체 / 참여중 / 만든 모임 — 검색 중이면 숨김 */}
      {!searchQuery.trim() && <View style={styles.tabBar}>
        {([
          { key: 'all' as const, label: `전체 (${posts.length})` },
          { key: 'available' as const, label: `모집중${user && availableCount > 0 ? ` (${availableCount})` : ''}` },
          { key: 'joined' as const, label: `참여${user && myJoinedCount > 0 ? ` (${myJoinedCount})` : ''}` },
          { key: 'mine' as const, label: `내 모임${user && myPostsCount > 0 ? ` (${myPostsCount})` : ''}` },
        ]).map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive ? C.gold : C.bg,
                  borderColor: isActive ? C.gold : C.border,
                },
              ]}
            >
              <Text style={[styles.tabItemText, { color: isActive ? C.bg : C.muted }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>}

      {/* 필터 오버레이 */}
      <Modal
        visible={showFilterPanel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterPanel(false)}
      >
        <Pressable style={styles.filterOverlayBackdrop} onPress={() => setShowFilterPanel(false)}>
          <Pressable style={[styles.filterPanel, { backgroundColor: C.card, borderBottomColor: C.border }]} onPress={e => e.stopPropagation()}>
            {/* 카테고리 */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionLabel, { color: C.muted }]}>카테고리</Text>
              <View style={styles.filterChipRow}>
                <Pressable
                  onPress={() => setSelectedCategories(new Set())}
                  style={[styles.filterChip, { backgroundColor: selectedCategories.size === 0 ? C.gold : C.bg, borderColor: selectedCategories.size === 0 ? C.gold : C.border }]}
                >
                  <Text style={[styles.filterChipText, { color: selectedCategories.size === 0 ? C.bg : C.muted }]}>전체</Text>
                </Pressable>
                {MOUI_CATEGORIES.map(cat => {
                  const active = selectedCategories.has(cat.key);
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setSelectedCategories(prev => {
                        const next = new Set(prev);
                        if (next.has(cat.key)) next.delete(cat.key); else next.add(cat.key);
                        return next;
                      })}
                      style={[styles.filterChip, { backgroundColor: active ? C.gold : C.bg, borderColor: active ? C.gold : C.border }]}
                    >
                      <Text style={[styles.filterChipText, { color: active ? C.bg : C.muted }]}>{cat.icon} {cat.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 거리 */}
            {myRegion && (
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionLabel, { color: C.muted }]}>거리</Text>
                <View style={styles.filterChipRow}>
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
                        style={[styles.filterChip, { backgroundColor: active ? C.gold + '18' : C.bg, borderColor: active ? C.gold : C.border }]}
                      >
                        <Text style={[styles.filterChipText, { color: active ? C.gold : C.muted }]}>{d.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}



            {/* 활성 필터 태그 + 초기화 + 닫기 */}
            <View style={styles.activeFilterRow}>
              <View style={styles.activeFilterTags}>
                {activeFilterTags.map((tag, i) => (
                  <Pressable
                    key={i}
                    onPress={tag.clear}
                    style={[styles.activeFilterTag, { backgroundColor: C.gold + '18', borderColor: C.gold + '44' }]}
                  >
                    <Text style={[styles.activeFilterTagText, { color: C.gold }]}>{tag.label} ✕</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.filterActionBtns}>
                {activeFilterCount > 0 && (
                  <Pressable onPress={clearFilters} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <Text style={[styles.clearFiltersText, { color: C.danger }]}>초기화</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setShowFilterPanel(false)} style={({ pressed }) => [styles.filterCloseBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={[styles.filterCloseBtnText, { color: C.fg }]}>닫기</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 활성 필터가 있을 때 패널 닫혀있어도 태그 표시 */}
      {!showFilterPanel && activeFilterCount > 0 && (
        <View style={[styles.collapsedFilterRow, { borderBottomColor: C.border }]}>
          <View style={styles.activeFilterTags}>
            {activeFilterTags.map((tag, i) => (
              <Pressable
                key={i}
                onPress={tag.clear}
                style={[styles.activeFilterTag, { backgroundColor: C.gold + '18', borderColor: C.gold + '44' }]}
              >
                <Text style={[styles.activeFilterTagText, { color: C.gold }]}>{tag.label} ✕</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={clearFilters} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.clearFiltersText, { color: C.danger }]}>초기화</Text>
          </Pressable>
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

      {/* Description popup */}
      <Modal visible={!!descPopup} transparent animationType="fade" onRequestClose={() => setDescPopup(null)}>
        <Pressable style={styles.descPopupOverlay} onPress={() => setDescPopup(null)}>
          <View style={[styles.descPopupBox, { backgroundColor: C.card }]}>
            <Text style={[styles.descPopupTitle, { color: C.fg }]}>{descPopup?.title}</Text>
            <Text style={[styles.descPopupContent, { color: C.fg, opacity: 0.8 }]}>{descPopup?.content}</Text>
            <Pressable onPress={() => setDescPopup(null)} style={({ pressed }) => [styles.descPopupClose, { borderColor: C.border }, pressed && { opacity: 0.6 }]}>
              <Text style={[styles.descPopupCloseText, { color: C.muted }]}>닫기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    flexShrink: 1,
  },
  regionChip: {
    maxWidth: '100%',
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'relative',
  },
  regionChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  headerBtnGradient: {
    minHeight: 38,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtnIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },

  /* 필터 토글 */
  filterToggleBtn: {
    minHeight: 38,
    minWidth: 60,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    position: 'relative',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  filterToggleIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  filterToggleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  filterToggleBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  headerActionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },

  /* 필터 오버레이 */
  filterOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
  },
  filterPanel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  filterSection: {
    gap: 6,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  activeFilterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  activeFilterTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeFilterTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '700',
    paddingLeft: 8,
  },
  filterActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterCloseBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  /* 탭바 */
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
  },

  collapsedFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
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
  ownerLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: -2,
  },
  ownerLabelText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaveBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaveBadgeText: {
    fontSize: 12,
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
  postTitleMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  postAuthorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -2,
  },
  postAuthorMetaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  postAuthorMetaName: {
    fontSize: 12,
    fontWeight: '700',
  },
  postDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descMoreBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  descMoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  descPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  descPopupBox: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 500,
    width: '100%',
    maxHeight: '70%',
  },
  descPopupTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  descPopupContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  descPopupClose: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  descPopupCloseText: {
    fontSize: 13,
    fontWeight: '700',
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
  postMetaSection: {
    gap: 8,
    paddingTop: 2,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  postMetaLabel: {
    width: 54,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 28,
  },
  postTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
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
  ownerActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
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
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
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
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* 입장하기 버튼 */
  enterBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  enterBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },

});
