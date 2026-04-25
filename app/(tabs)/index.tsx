import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
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
    <Animated.View style={[{ width: size, height: size, borderWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] }, animStyle]} />
  );
}

/* ── 퀵 액션 카드 (보상 표시 포함) ── */
function QuickCard({
  icon, title, desc, delay: d, onPress, done, C, reward = 1000,
}: {
  icon: string; title: string; desc: string; delay: number; onPress?: () => void; done?: boolean; C: any; reward?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(d).duration(400).springify()}>
      <Pressable
        style={({ pressed }) => [styles.quickCard, { borderColor: C.border, backgroundColor: C.card }, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }, done && { opacity: 0.7, borderColor: 'rgba(200,169,110,0.25)' }]}
        onPress={onPress}
      >
        <Text style={[styles.quickIcon, done && { opacity: 0.4 }]}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.quickTitle, { color: C.fg }, done && { textDecorationLine: 'line-through', color: C.muted }]}>{title}</Text>
          <Text style={[styles.quickDesc, { color: C.muted }, done && { opacity: 0.4 }]}>{desc}</Text>
        </View>
        <View style={done ? styles.rewardBadgeDone : styles.rewardBadge}>
          <Text style={done ? [styles.rewardTextDone, { color: C.mutedLight }] : [styles.rewardText, { color: C.gold }]}>
            {done ? `${reward.toLocaleString()}모의 획득!` : `+${reward.toLocaleString()}모의`}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ── 출석 보상 ── */
const ATTENDANCE_REWARDS = [50, 50, 50, 50, 50, 50, 500]; // 1~7일

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── 메인 화면 ── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { colors: C } = useThemeMode();

  const [hasExhibition, setHasExhibition] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [hasRegion, setHasRegion] = useState(false);
  const [hasThemeSet, setHasThemeSet] = useState(false);
  const [regionRewardClaimed, setRegionRewardClaimed] = useState(true);
  const [welcomeClaimed, setWelcomeClaimed] = useState(true); // 기본 true로 깜빡임 방지
  const [claimingWelcome, setClaimingWelcome] = useState(false);

  // 홈 피드
  type FeedActivity = { id: string; type: 'artwork' | 'exhibition' | 'collection'; image_url: string; title: string; artist_name: string; artist_avatar: string | null; artist_username: string; created_at: string };
  type PopularArtwork = { id: string; title: string; image_url: string; artist_name: string; artist_username: string; like_count: number };
  type NewArtist = { id: string; name: string | null; username: string; avatar_url: string | null; field: string | null; artwork_count: number };
  type NearbyMoui = { id: string; title: string; category: string | null; region: string | null; participant_count: number; max_participants: number | null; created_at: string };

  const [feedActivities, setFeedActivities] = useState<FeedActivity[]>([]);
  const [popularArtworks, setPopularArtworks] = useState<PopularArtwork[]>([]);
  const [newArtists, setNewArtists] = useState<NewArtist[]>([]);
  const [nearbyMouis, setNearbyMouis] = useState<NearbyMoui[]>([]);

  // 출석
  const [attendanceDay, setAttendanceDay] = useState(0); // 현재까지 출석한 일수 (0~7)
  const [checkedToday, setCheckedToday] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const heroSubtitle = profile?.user_type === 'aspiring'
    ? '당신도 작가가 될 수 있습니다.'
    : profile?.user_type === 'audience'
      ? '모든 예술인을 위한\n창작 커뮤니티'
      : '세상 모든 예술가를 위한 서비스';

  const checkProgress = useCallback(async () => {
    if (!user) return;
    const [exRes, artRes, welcomeRes, regionRewardRes, themeRewardRes, profileRes] = await Promise.all([
      supabase.from('exhibitions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('artworks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      (supabase as any).from('point_history').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'welcome'),
      (supabase as any).from('point_history').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'region_setup'),
      (supabase as any).from('point_history').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'theme_setup'),
      supabase.from('profiles').select('region').eq('id', user.id).single(),
    ]);
    setHasExhibition((exRes.count ?? 0) > 0);
    setHasArtwork((artRes.count ?? 0) > 0);
    setHasThemeSet((themeRewardRes.count ?? 0) > 0);
    setWelcomeClaimed((welcomeRes.count ?? 0) > 0);
    const regionSet = !!profileRes.data?.region;
    setHasRegion(regionSet);
    const regionRewarded = (regionRewardRes.count ?? 0) > 0;
    setRegionRewardClaimed(regionRewarded);

    // 위치 설정 후 자동 보상 지급
    if (regionSet && !regionRewarded) {
      const REWARD = 1000;
      const { data: prof } = await supabase.from('profiles').select('points').eq('id', user.id).single();
      const pts = prof?.points ?? 0;
      await supabase.from('profiles').update({ points: pts + REWARD }).eq('id', user.id);
      await (supabase as any).from('point_history').insert({
        user_id: user.id, amount: REWARD, balance: pts + REWARD,
        type: 'region_setup', description: '활동 지역 설정 보너스',
      });
      await refreshProfile();
      setRegionRewardClaimed(true);
      const msg = `📍 활동 지역 설정 완료! ${REWARD}모의를 받았습니다!`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('보상 지급', msg);
    }
  }, [user]);

  const loadHomeFeed = useCallback(async () => {
    if (!user) return;

    // 1. 연결한 사람들의 최신 활동
    const { data: myFollowings } = await supabase
      .from('follows').select('following_id').eq('follower_id', user.id);
    const followingIds = myFollowings?.map(f => f.following_id) ?? [];
    if (followingIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', followingIds);
      const pMap = new Map(profiles?.map(p => [p.id, p]) ?? []);
      const activities: FeedActivity[] = [];
      // 최신 작품
      const { data: aw } = await supabase.from('artworks').select('id, title, image_url, user_id, created_at')
        .in('user_id', followingIds).order('created_at', { ascending: false }).limit(5);
      aw?.forEach(a => { const p = pMap.get(a.user_id); if (p) activities.push({ id: `aw_${a.id}`, type: 'artwork', image_url: a.image_url, title: a.title, artist_name: p.name ?? p.username, artist_avatar: p.avatar_url, artist_username: p.username, created_at: a.created_at }); });
      // 최신 전시관
      const { data: ex } = await supabase.from('exhibitions').select('id, title, poster_image_url, user_id, created_at')
        .in('user_id', followingIds).eq('is_published', true).order('created_at', { ascending: false }).limit(3);
      ex?.forEach(e => { if (!e.poster_image_url) return; const p = pMap.get(e.user_id); if (p) activities.push({ id: `ex_${e.id}`, type: 'exhibition', image_url: e.poster_image_url, title: e.title, artist_name: p.name ?? p.username, artist_avatar: p.avatar_url, artist_username: p.username, created_at: e.created_at }); });
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFeedActivities(activities.slice(0, 6));
    }

    // 2. 인기 작품 (좋아요 많은 순)
    const { data: likeData } = await supabase.from('artwork_likes').select('artwork_id');
    const likeCounts = new Map<string, number>();
    likeData?.forEach(l => likeCounts.set(l.artwork_id, (likeCounts.get(l.artwork_id) ?? 0) + 1));
    if (likeCounts.size > 0) {
      const topIds = [...likeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
      const { data: topAw } = await supabase.from('artworks').select('id, title, image_url, user_id').in('id', topIds);
      if (topAw) {
        const userIds = [...new Set(topAw.map(a => a.user_id))];
        const { data: profs } = await supabase.from('profiles').select('id, name, username').in('id', userIds);
        const pMap = new Map(profs?.map(p => [p.id, p]) ?? []);
        setPopularArtworks(topIds.map(id => {
          const a = topAw.find(x => x.id === id);
          if (!a) return null;
          const p = pMap.get(a.user_id);
          return { id: a.id, title: a.title, image_url: a.image_url, artist_name: p?.name ?? p?.username ?? '', artist_username: p?.username ?? '', like_count: likeCounts.get(id) ?? 0 };
        }).filter(Boolean) as PopularArtwork[]);
      }
    }

    // 3. 새로운 작가
    const { data: newProfs } = await supabase.from('profiles').select('id, name, username, avatar_url, field, created_at')
      .in('user_type', ['creator', 'aspiring']).order('created_at', { ascending: false }).limit(10);
    if (newProfs) {
      const artistIds = newProfs.map(p => p.id);
      const { data: awCounts } = await supabase.from('artworks').select('user_id').in('user_id', artistIds);
      const countMap = new Map<string, number>();
      awCounts?.forEach(a => countMap.set(a.user_id, (countMap.get(a.user_id) ?? 0) + 1));
      setNewArtists(newProfs.filter(p => (countMap.get(p.id) ?? 0) > 0).map(p => ({
        id: p.id, name: p.name, username: p.username, avatar_url: p.avatar_url, field: p.field, artwork_count: countMap.get(p.id) ?? 0,
      })));
    }

    // 4. 근처 모임
    const myRegion = profile?.region;
    if (myRegion) {
      const { data: mouis } = await (supabase as any).from('moui_posts').select('id, title, category, region, max_participants, created_at')
        .eq('status', 'open').order('created_at', { ascending: false }).limit(10);
      if (mouis) {
        const nearby = mouis.filter((m: any) => m.region && myRegion && m.region.split(' ').slice(0, 2).join(' ') === myRegion.split(' ').slice(0, 2).join(' ')).slice(0, 3);
        const withCounts = await Promise.all(nearby.map(async (m: any) => {
          const { count } = await (supabase as any).from('moui_participants').select('moui_post_id', { count: 'exact', head: true }).eq('moui_post_id', m.id);
          return { ...m, participant_count: count ?? 0 };
        }));
        setNearbyMouis(withCounts);
      }
    }
  }, [user, profile]);

  const handleClaimWelcome = async () => {
    if (!user || claimingWelcome || welcomeClaimed) return;
    setClaimingWelcome(true);
    const REWARD = 1000;
    const { data: prof } = await supabase.from('profiles').select('points').eq('id', user.id).single();
    const currentPoints = prof?.points ?? 0;
    await supabase.from('profiles').update({ points: currentPoints + REWARD }).eq('id', user.id);
    await (supabase as any).from('point_history').insert({
      user_id: user.id,
      amount: REWARD,
      balance: currentPoints + REWARD,
      type: 'welcome',
      description: '모의스트 임명 보너스',
    });
    await refreshProfile();
    setWelcomeClaimed(true);
    setClaimingWelcome(false);
    const msg = `🎉 모의스트로 임명되었습니다! ${REWARD}모의를 받았습니다!`;
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('환영합니다!', msg);
  };

  // 출석 정보 가져오기
  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .order('checked_date', { ascending: false })
      .limit(7);
    if (!data || data.length === 0) {
      setAttendanceDay(0);
      setCheckedToday(false);
      return;
    }
    const today = getToday();
    const yesterday = getYesterday();
    const latest = data[0];

    if (latest.checked_date === today) {
      // 오늘 이미 출석함
      setCheckedToday(true);
      setAttendanceDay(latest.day_number);
    } else if (latest.checked_date === yesterday) {
      // 어제 출석함 → 연속 출석 가능
      setCheckedToday(false);
      setAttendanceDay(latest.day_number >= 7 ? 0 : latest.day_number);
    } else {
      // 연속 끊김 → 리셋
      setCheckedToday(false);
      setAttendanceDay(0);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    checkProgress();
    fetchAttendance();
    loadHomeFeed();
  }, [checkProgress, fetchAttendance, loadHomeFeed]));

  const handleCheckIn = async () => {
    if (!user || checkedToday || checkingIn) return;
    setCheckingIn(true);
    const nextDay = attendanceDay + 1;
    const reward = ATTENDANCE_REWARDS[nextDay - 1] ?? 50;
    const today = getToday();

    // 1. 출석 기록
    const { error } = await (supabase as any).from('attendance').insert({
      user_id: user.id,
      checked_date: today,
      day_number: nextDay,
      reward,
    });
    if (error) {
      const msg = '출석 체크에 실패했습니다.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
      setCheckingIn(false);
      return;
    }

    // 2. 포인트 지급
    const { data: prof } = await supabase.from('profiles').select('points').eq('id', user.id).single();
    const currentPoints = prof?.points ?? 0;
    await supabase.from('profiles').update({ points: currentPoints + reward }).eq('id', user.id);

    // 3. 내역 기록
    await (supabase as any).from('point_history').insert({
      user_id: user.id,
      amount: reward,
      balance: currentPoints + reward,
      type: 'reward',
      description: `출석 ${nextDay}일차 보상`,
    });

    await refreshProfile();
    setAttendanceDay(nextDay);
    setCheckedToday(true);
    setCheckingIn(false);

    const msg = nextDay === 7
      ? `🎉 7일 연속 출석! ${reward}모의를 받았습니다!`
      : `✅ ${nextDay}일차 출석! ${reward}모의를 받았습니다.`;
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('출석 완료', msg);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      {/* 배경 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={50} color={C.gold} opacity={0.08} top="5%" left="2%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={70} color={C.goldLight} opacity={0.05} top="50%" left="60%" duration={7000} delay={800} />
        <FloatingShape shape="diamond" size={20} color={C.gold} opacity={0.20} top="10%" left="82%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={14} color={C.gold} opacity={0.15} top="60%" left="5%" duration={4200} delay={200} />
        <FloatingShape shape="diamond" size={24} color={C.goldLight} opacity={0.10} top="80%" left="70%" duration={3800} delay={1000} />
        <FloatingShape shape="circle" size={7} color={C.gold} opacity={0.28} top="20%" left="25%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={5} color={C.goldLight} opacity={0.22} top="40%" left="75%" duration={2500} delay={900} />
        <FloatingShape shape="circle" size={8} color={C.gold} opacity={0.18} top="70%" left="35%" duration={3200} delay={500} />
        <FloatingShape shape="line" size={60} color={C.gold} opacity={0.10} top="15%" left="55%" duration={5000} delay={1500} />
        <FloatingShape shape="line" size={80} color={C.goldLight} opacity={0.07} top="65%" left="40%" duration={4500} delay={300} />
      </View>

      <View style={styles.innerContainer}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 히어로 배너 */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={styles.heroBanner}>
          <View style={styles.heroAccent}>
            <PlayfulDiamond size={16} color={C.gold} />
          </View>
          <Text style={[styles.heroLogo, { color: C.fg }]}>
            MOUI<Text style={{ color: C.gold }}>-</Text>IST
          </Text>
          <Text style={[styles.heroSub, { color: C.muted }]}>{heroSubtitle}</Text>
        </Animated.View>

        {/* 퀵 액션 - 모두 완료하면 숨김 */}
        {!(hasArtwork && hasExhibition && hasRegion && hasThemeSet) && (
        <>
        <View style={styles.sectionHeader}>
          <Animated.Text entering={FadeIn.delay(200).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
            시작하기
          </Animated.Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard
            icon="🎨" title="작품 업로드" desc="포트폴리오에 작품을 등록하세요"
            delay={300} done={hasArtwork} C={C}
            onPress={() => router.push('/artwork/create')}
          />
          <QuickCard
            icon="🏛️" title="전시관 만들기" desc="나만의 가상 전시 공간을 만드세요"
            delay={380} done={hasExhibition} C={C}
            onPress={() => router.push('/exhibition/create')}
          />
          <QuickCard
            icon="📍" title="내 위치 설정하기" desc="활동 지역을 설정하세요"
            delay={460} done={hasRegion} C={C}
            onPress={() => router.push('/profile/detail?focus=region')}
          />
          <QuickCard
            icon="🎨" title="화면 모드 선택" desc="다크/라이트 모드를 선택하세요"
            delay={540} done={hasThemeSet} C={C}
            reward={500}
            onPress={async () => {
              if (!hasThemeSet && user) {
                const REWARD = 500;
                const { data: prof } = await supabase.from('profiles').select('points').eq('id', user.id).single();
                const pts = prof?.points ?? 0;
                await supabase.from('profiles').update({ points: pts + REWARD }).eq('id', user.id);
                await (supabase as any).from('point_history').insert({
                  user_id: user.id, amount: REWARD, balance: pts + REWARD,
                  type: 'theme_setup', description: '화면 모드 설정 보너스',
                });
                await refreshProfile();
                setHasThemeSet(true);
              }
              router.push('/profile/settings');
            }}
          />
        </View>
        </>
        )}

        {/* 연결한 사람들의 최신 활동 */}
        {feedActivities.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Animated.Text entering={FadeIn.delay(520).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
                연결 활동
              </Animated.Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
              {feedActivities.map((item, idx) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(540 + idx * 50).duration(400).springify()}>
                  <Pressable
                    style={({ pressed }) => [styles.feedCard, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/artist/${item.artist_username}`)}
                  >
                    <Image source={{ uri: item.image_url }} style={styles.feedCardImage} resizeMode="cover" />
                    <View style={styles.feedCardInfo}>
                      <View style={styles.feedCardArtistRow}>
                        {item.artist_avatar ? (
                          <Image source={{ uri: item.artist_avatar }} style={styles.feedCardAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.feedCardAvatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: C.fg }}>{item.artist_name.charAt(0)}</Text>
                          </View>
                        )}
                        <Text style={[styles.feedCardArtistName, { color: C.muted }]} numberOfLines={1}>{item.artist_name}</Text>
                      </View>
                      <Text style={[styles.feedCardTitle, { color: C.fg }]} numberOfLines={1}>{item.title}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          </>
        )}

        {/* 인기 작품 */}
        {popularArtworks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Animated.Text entering={FadeIn.delay(600).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
                인기 작품
              </Animated.Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
              {popularArtworks.map((item, idx) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(620 + idx * 50).duration(400).springify()}>
                  <Pressable
                    style={({ pressed }) => [styles.feedCard, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/artist/${item.artist_username}`)}
                  >
                    <Image source={{ uri: item.image_url }} style={styles.feedCardImage} resizeMode="cover" />
                    <View style={styles.feedCardLikeBadge}>
                      <Text style={styles.feedCardLikeText}>◆ {item.like_count}</Text>
                    </View>
                    <View style={styles.feedCardInfo}>
                      <Text style={[styles.feedCardTitle, { color: C.fg }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.feedCardArtistName, { color: C.muted }]} numberOfLines={1}>{item.artist_name}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          </>
        )}

        {/* 새로운 작가 */}
        {newArtists.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Animated.Text entering={FadeIn.delay(680).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
                새로운 작가
              </Animated.Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
              {newArtists.map((item, idx) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(700 + idx * 50).duration(400).springify()}>
                  <Pressable
                    style={({ pressed }) => [styles.artistFeedCard, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/artist/${item.username}`)}
                  >
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.artistFeedAvatar} resizeMode="cover" />
                    ) : (
                      <View style={[styles.artistFeedAvatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 18, color: C.fg }}>🎨</Text>
                      </View>
                    )}
                    <Text style={[styles.artistFeedName, { color: C.fg }]} numberOfLines={1}>{item.name ?? item.username}</Text>
                    {item.field && <Text style={[styles.artistFeedField, { color: C.muted }]} numberOfLines={1}>{item.field}</Text>}
                    <Text style={[styles.artistFeedCount, { color: C.gold }]}>{item.artwork_count} 작품</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          </>
        )}

        {/* 근처 모임 */}
        {nearbyMouis.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Animated.Text entering={FadeIn.delay(760).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
                근처 모임
              </Animated.Text>
            </View>
            {nearbyMouis.map((item, idx) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(780 + idx * 60).duration(400).springify()}>
                <Pressable
                  style={({ pressed }) => [styles.mouiFeedCard, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/moui/${item.id}` as any)}
                >
                  <Text style={[styles.mouiFeedTitle, { color: C.fg }]} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.mouiFeedMeta}>
                    <Text style={[styles.mouiFeedMetaText, { color: C.muted }]}>{item.participant_count}명 참여</Text>
                    {item.region && <Text style={[styles.mouiFeedMetaText, { color: C.muted }]}>· {item.region}</Text>}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </>
        )}

        {/* 출석 이벤트 (하단) */}
        {user && (
          <>
            <View style={styles.sectionHeader}>
              <Animated.Text entering={FadeIn.delay(840).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
                출석 이벤트
              </Animated.Text>
            </View>

            <Animated.View entering={FadeInDown.delay(880).duration(400).springify()} style={[styles.attendCard, { backgroundColor: C.card, borderColor: C.gold }]}>
              <View style={styles.attendHeader}>
                <Text style={[styles.attendSub, styles.attendSubLead, { color: C.muted }]}>7일 연속 출석하고 보상 받기!</Text>
              </View>
              <View style={styles.attendDays}>
                {ATTENDANCE_REWARDS.map((reward, i) => {
                  const dayNum = i + 1;
                  const checked = dayNum <= attendanceDay;
                  const isCurrent = dayNum === attendanceDay + 1 && !checkedToday;
                  return (
                    <View key={dayNum} style={styles.attendDayCol}>
                      <View style={[
                        styles.attendDayCircle,
                        { borderColor: checked ? C.gold : C.border },
                        checked && { backgroundColor: C.gold },
                        isCurrent && { borderColor: C.gold, borderWidth: 2 },
                      ]}>
                        <Text style={[
                          styles.attendDayNum,
                          { color: checked ? C.bg : isCurrent ? C.gold : C.mutedLight },
                        ]}>{checked ? '✓' : dayNum}</Text>
                      </View>
                      <Text style={[styles.attendReward, { color: dayNum === 7 ? C.gold : C.mutedLight }]}>
                        {reward}
                        <Text style={styles.attendRewardUnit}> MOUI</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
              {!checkedToday ? (
                <Pressable
                  onPress={handleCheckIn}
                  disabled={checkingIn}
                  style={({ pressed }) => [styles.attendBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }, checkingIn && { opacity: 0.5 }]}
                >
                  <Text style={[styles.attendBtnText, { color: C.bg }]}>{checkingIn ? '출석 중...' : '출석하기'}</Text>
                </Pressable>
              ) : (
                <View style={[styles.attendBtn, { backgroundColor: C.border }]}>
                  <Text style={[styles.attendBtnText, { color: C.muted }]}>오늘 출석 완료!</Text>
                </View>
              )}
            </Animated.View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
      </View>

      {/* 모의스트 임명 팝업 */}
      {!welcomeClaimed && user && (
        <View style={styles.popupOverlay}>
          <Animated.View entering={FadeIn.duration(200)} style={styles.popupBackdrop} />
          <Animated.View entering={FadeInDown.delay(100).duration(500).springify()} style={[styles.popupCard, { backgroundColor: C.card }]}>
            <View style={styles.popupDiamondWrap}>
              <PlayfulDiamond size={24} color={C.gold} />
            </View>
            <Text style={[styles.popupTitle, { color: C.fg }]}>
              {profile?.name ?? '회원'}님
            </Text>
            <Text style={[styles.popupSubtitle, { color: C.gold }]}>
              모의스트로 임명합니다!
            </Text>
            <View style={[styles.popupDivider, { backgroundColor: C.gold }]} />
            <Text style={[styles.popupDesc, { color: C.muted }]}>
              모의스트에 오신 것을 환영합니다{'\n'}임명 보너스를 받아주세요
            </Text>
            <View style={[styles.popupRewardBox, { borderColor: C.gold }]}>
              <Text style={[styles.popupRewardAmount, { color: C.gold }]}>1,000</Text>
              <Text style={[styles.popupRewardUnit, { color: C.muted }]}>MOUI</Text>
            </View>
            <Pressable
              onPress={handleClaimWelcome}
              disabled={claimingWelcome}
              style={({ pressed }) => [
                styles.popupBtn,
                { backgroundColor: C.gold },
                pressed && { opacity: 0.8 },
                claimingWelcome && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.popupBtnText, { color: C.bg }]}>
                {claimingWelcome ? '지급 중...' : '보상 받기'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 24,
    paddingBottom: 90,
  },

  heroBanner: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  heroAccent: {
    marginBottom: 6,
  },
  heroLogo: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 10,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 3,
  },

  sectionHeader: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  quickGrid: {
    gap: 12,
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  quickIcon: {
    fontSize: 28,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickDesc: {
    fontSize: 12,
    lineHeight: 16,
  },

  /* 모의스트 임명 팝업 */
  popupOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  popupCard: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#C8A96E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  popupDiamondWrap: {
    marginBottom: 4,
  },
  popupTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  popupSubtitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  popupDivider: {
    width: 32,
    height: 1.5,
    marginVertical: 4,
  },
  popupDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  popupRewardBox: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginVertical: 4,
  },
  popupRewardAmount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  popupRewardUnit: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  popupBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  popupBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* 보상 뱃지 */
  rewardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(200,169,110,0.15)',
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rewardBadgeDone: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(200,169,110,0.08)',
  },
  rewardTextDone: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Home Feed */
  feedScroll: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  feedCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedCardImage: {
    width: '100%',
    height: 140,
  },
  feedCardInfo: {
    padding: 8,
    gap: 3,
  },
  feedCardArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedCardAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  feedCardArtistName: {
    fontSize: 9,
    fontWeight: '600',
    flex: 1,
  },
  feedCardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  feedCardLikeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  feedCardLikeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C8A96E',
  },
  artistFeedCard: {
    width: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 12,
    gap: 4,
  },
  artistFeedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  artistFeedName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  artistFeedField: {
    fontSize: 9,
    textAlign: 'center',
  },
  artistFeedCount: {
    fontSize: 9,
    fontWeight: '700',
  },
  mouiFeedCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  mouiFeedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  mouiFeedMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  mouiFeedMetaText: {
    fontSize: 11,
  },

  infoCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  infoIconWrap: {
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 21,
  },
  /* 출석 이벤트 */
  attendCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 8,
  },
  attendHeader: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  attendSubLead: {
    fontSize: 13,
    fontWeight: '600',
  },
  attendSub: {
    fontSize: 12,
  },
  attendDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  attendDayCol: {
    alignItems: 'center',
    gap: 4,
  },
  attendDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendDayNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  attendReward: {
    minWidth: 42,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  attendRewardUnit: {
    fontSize: 6,
    fontWeight: '600',
    letterSpacing: 0,
  },
  attendBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  attendBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
