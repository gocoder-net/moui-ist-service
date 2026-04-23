import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  Alert,
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
  icon, title, desc, delay: d, onPress, done, C,
}: {
  icon: string; title: string; desc: string; delay: number; onPress?: () => void; done?: boolean; C: any;
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
            {done ? '1,000모의 획득!' : '+1,000모의'}
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
  const { user, refreshProfile } = useAuth();
  const { colors: C } = useThemeMode();

  const [hasExhibition, setHasExhibition] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);

  // 출석
  const [attendanceDay, setAttendanceDay] = useState(0); // 현재까지 출석한 일수 (0~7)
  const [checkedToday, setCheckedToday] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const checkProgress = useCallback(async () => {
    if (!user) return;
    const [exRes, artRes] = await Promise.all([
      supabase.from('exhibitions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('artworks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    setHasExhibition((exRes.count ?? 0) > 0);
    setHasArtwork((artRes.count ?? 0) > 0);
  }, [user]);

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
  }, [checkProgress, fetchAttendance]));

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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 히어로 배너 */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={styles.heroBanner}>
          <Text style={[styles.heroLogo, { color: C.fg }]}>
            MOUI<Text style={{ color: C.gold }}>-</Text>IST
          </Text>
          <Text style={[styles.heroSub, { color: C.muted }]}>세상 모든 예술가를 위한 서비스</Text>
        </Animated.View>

        {/* 퀵 액션 */}
        <View style={styles.sectionHeader}>
          <Animated.Text entering={FadeIn.delay(200).duration(300)} style={[styles.sectionTitle, { color: C.fg }]}>
            시작하기
          </Animated.Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard
            icon="🎨" title="작품 업로드" desc="포트폴리오에 작품을 등록하세요"
            delay={250} done={hasArtwork} C={C}
            onPress={() => router.push('/artwork/create')}
          />
          <QuickCard
            icon="🏛️" title="전시관 만들기" desc="나만의 가상 전시 공간을 만드세요"
            delay={330} done={hasExhibition} C={C}
            onPress={() => router.push('/exhibition/create')}
          />
        </View>

        {/* 출석 이벤트 */}
        {user && (
          <Animated.View entering={FadeInDown.delay(400).duration(400).springify()} style={[styles.attendCard, { backgroundColor: C.card, borderColor: C.gold }]}>
            <View style={styles.attendHeader}>
              <Text style={[styles.attendTitle, { color: C.fg }]}>📅 출석 이벤트</Text>
              <Text style={[styles.attendSub, { color: C.muted }]}>7일 연속 출석하고 보상 받기!</Text>
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
        )}

        {/* 안내 카드 */}
        <Animated.View entering={FadeInDown.delay(600).duration(400).springify()} style={[styles.infoCard, { borderColor: C.gold, backgroundColor: C.card }]}>
          <View style={styles.infoIconWrap}>
            <PlayfulDiamond size={12} color={C.gold} />
          </View>
          <Text style={[styles.infoTitle, { color: C.fg }]}>곧 더 많은 기능이 찾아옵니다</Text>
          <Text style={[styles.infoDesc, { color: C.muted }]}>
            피드, 팔로우, 알림 등{'\n'}다양한 기능이 준비 중입니다
          </Text>
          <View style={[styles.infoBadge, { backgroundColor: C.border }]}>
            <Text style={[styles.infoBadgeText, { color: C.gold }]}>Coming Soon</Text>
          </View>
        </Animated.View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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

  infoCard: {
    marginTop: 24,
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
  infoBadge: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
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
  attendTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
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
    fontSize: 10,
    fontWeight: '600',
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
