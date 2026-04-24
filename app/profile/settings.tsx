import { StyleSheet, View, Text, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, profile } = useAuth();
  const { mode, colors: C, toggleTheme } = useThemeMode();
  const isAdmin = profile?.username === 'gocoder';

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.fg }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.fg }]}>설정</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* 테마 토글 */}
      <Animated.View entering={FadeInDown.delay(100).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
        <Text style={[styles.sectionTitle, { color: C.muted }]}>테마</Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: C.fg }]}>
            {mode === 'dark' ? '🌙 다크 모드' : '☀️ 라이트 모드'}
          </Text>
          <Switch
            value={mode === 'light'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#262626', true: C.gold }}
            thumbColor="#ffffff"
          />
        </View>
      </Animated.View>

      {/* 관리자 */}
      {isAdmin && (
        <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.muted }]}>관리자</Text>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/profile/admin')}
          >
            <Text style={[styles.rowLabel, { color: C.fg }]}>🛡️ 인증 심사</Text>
            <Text style={[styles.rowArrow, { color: C.muted }]}>›</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* 계정 */}
      <Animated.View entering={FadeInDown.delay(200).duration(400).springify()} style={[styles.card, { backgroundColor: C.card }]}>
        <Text style={[styles.sectionTitle, { color: C.muted }]}>계정</Text>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={signOut}
        >
          <Text style={[styles.rowLabel, { color: C.danger }]}>🚪 로그아웃</Text>
          <Text style={[styles.rowArrow, { color: C.danger }]}>›</Text>
        </Pressable>
      </Animated.View>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    paddingTop: 12,
    paddingLeft: 16,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowArrow: {
    fontSize: 20,
    fontWeight: '300',
  },
});
