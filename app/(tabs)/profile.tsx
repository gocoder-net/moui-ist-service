import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
  border: '#333d4b',
};

const USER_TYPE_LABELS = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
const USER_TYPE_EMOJI = { creator: '🎨', aspiring: '✏️', audience: '👀' } as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();

  const userType = profile?.user_type ?? 'audience';
  const emoji = USER_TYPE_EMOJI[userType];
  const label = USER_TYPE_LABELS[userType];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.header}>
          <Text style={styles.headerTitle}>내 정보</Text>
        </Animated.View>

        {/* 프로필 카드 */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarEmoji}>{emoji}</Text>
          </View>
          <Text style={styles.name}>{profile?.name ?? '회원'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
        </Animated.View>

        {/* 로그아웃 */}
        <Animated.View entering={FadeInDown.delay(400).duration(400).springify()}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
            onPress={signOut}
          >
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </Animated.View>
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
    paddingHorizontal: 24,
    paddingBottom: 90,
  },
  header: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 36,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    backgroundColor: '#212a35',
    gap: 10,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 1,
  },
  email: {
    fontSize: 12,
    color: C.mutedLight,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D94040',
    backgroundColor: 'rgba(217,64,64,0.08)',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D94040',
    letterSpacing: 1,
  },
});
