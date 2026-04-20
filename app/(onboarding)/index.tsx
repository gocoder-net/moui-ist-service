import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

const C = {
  bg: '#FFFFFF',
  fg: '#0A0A0A',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#999999',
  mutedLight: '#CCCCCC',
  border: '#E8E5DF',
};

type UserType = 'creator' | 'aspiring' | 'audience';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!selected || !user) return;

    setLoading(true);
    await supabase
      .from('profiles')
      .update({
        user_type: selected,
        name: user.email?.split('@')[0] ?? 'User',
      })
      .eq('id', user.id);

    await refreshProfile();
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.enLogo}>
          MOUI<Text style={{ color: C.gold }}>-</Text>IST
        </Text>
        <View style={styles.decorDiamond} />
        <Text style={styles.title}>어떤 활동을 하고 싶으세요?</Text>
        <Text style={styles.subtitle}>나중에 언제든 변경할 수 있어요</Text>
      </View>

      {/* 선택 카드 */}
      <View style={styles.cards}>
        <Pressable
          style={[
            styles.card,
            selected === 'creator' && styles.cardSelected,
          ]}
          onPress={() => setSelected('creator')}
        >
          <Text style={styles.cardEmoji}>🎨</Text>
          <Text style={[styles.cardTitle, selected === 'creator' && styles.cardTitleSelected]}>
            작가
          </Text>
          <Text style={styles.cardDesc}>
            작품을 올리고{'\n'}감상자와 소통해요
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.card,
            selected === 'aspiring' && styles.cardSelected,
          ]}
          onPress={() => setSelected('aspiring')}
        >
          <Text style={styles.cardEmoji}>✏️</Text>
          <Text style={[styles.cardTitle, selected === 'aspiring' && styles.cardTitleSelected]}>
            지망생
          </Text>
          <Text style={styles.cardDesc}>
            창작을 배우고{'\n'}성장해 나가요
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.card,
            selected === 'audience' && styles.cardSelected,
          ]}
          onPress={() => setSelected('audience')}
        >
          <Text style={styles.cardEmoji}>👀</Text>
          <Text style={[styles.cardTitle, selected === 'audience' && styles.cardTitleSelected]}>
            감상자
          </Text>
          <Text style={styles.cardDesc}>
            작품을 감상하고{'\n'}작가를 응원해요
          </Text>
        </Pressable>
      </View>

      {/* 완료 버튼 */}
      <View style={styles.bottom}>
        <Pressable
          style={({ pressed }) => [
            styles.btnMain,
            !selected && styles.btnDisabled,
            pressed && selected && styles.btnPressed,
          ]}
          onPress={handleComplete}
          disabled={!selected || loading}
        >
          <Text style={styles.btnMainText}>
            {loading ? '설정 중...' : '시작하기'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 32,
  },

  header: {
    alignItems: 'center',
    paddingTop: 40,
    marginBottom: 48,
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
    marginBottom: 24,
  },
  decorDiamond: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: C.fg,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
  },

  cards: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  cardSelected: {
    borderColor: C.gold,
    backgroundColor: '#FDFBF7',
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.fg,
  },
  cardTitleSelected: {
    color: C.gold,
  },
  cardDesc: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },

  bottom: {
    paddingBottom: 36,
    paddingTop: 24,
  },
  btnMain: {
    backgroundColor: C.fg,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnMainText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
