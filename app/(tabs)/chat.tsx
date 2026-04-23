import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/theme-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
        <Text style={[styles.headerTitle, { color: C.fg }]}>작당모의</Text>
      </Animated.View>

      <View style={styles.center}>
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={[styles.emptyTitle, { color: C.fg }]}>채팅 기능 준비 중</Text>
          <Text style={[styles.emptyDesc, { color: C.muted }]}>
            작가들과 실시간으로 소통할 수 있는{'\n'}채팅 기능이 곧 찾아옵니다
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
