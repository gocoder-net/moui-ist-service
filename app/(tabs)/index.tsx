import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';

const C = {
  bg: '#FFFFFF',
  fg: '#0A0A0A',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#999999',
  mutedLight: '#CCCCCC',
  border: '#E8E5DF',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();

  const userTypeLabels = { creator: '작가', aspiring: '지망생', audience: '감상자' } as const;
  const userTypeLabel = userTypeLabels[profile?.user_type ?? 'audience'];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <Text style={styles.enLogo}>
          MOUI<Text style={{ color: C.gold }}>-</Text>IST
        </Text>
        <Pressable onPress={signOut}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>

      {/* 환영 메시지 */}
      <View style={styles.welcome}>
        <View style={styles.decorDiamond} />
        <Text style={styles.greeting}>
          안녕하세요, {profile?.name ?? '회원'}님
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{userTypeLabel}</Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* 안내 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>모의스트에 오신 것을 환영합니다</Text>
        <Text style={styles.cardDesc}>
          곧 작품 업로드, 피드, 팔로우 등{'\n'}다양한 기능이 추가될 예정입니다.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },
  logoutText: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
  },

  welcome: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  decorDiamond: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
    marginBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: C.fg,
  },
  badge: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.gold,
  },
  email: {
    fontSize: 13,
    color: C.muted,
  },

  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.fg,
  },
  cardDesc: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
