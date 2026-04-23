import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type PointEntry = {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string;
  created_at: string;
};

const TYPE_ICON: Record<string, string> = {
  mission: '🎯',
  reward: '🎁',
  purchase: '💰',
  spend: '🛒',
};

export default function PointsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors: C } = useThemeMode();

  const [history, setHistory] = useState<PointEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from('point_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: PointEntry[] | null }) => {
        if (data) setHistory(data);
        setLoading(false);
      });
  }, [user]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item, index }: { item: PointEntry; index: number }) => {
    const isPositive = item.amount > 0;
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <View style={[styles.historyItem, { backgroundColor: C.card }]}>
          <View style={[styles.historyIconWrap, { backgroundColor: C.bg }]}>
            <Text style={styles.historyIcon}>{TYPE_ICON[item.type] ?? '💎'}</Text>
          </View>
          <View style={styles.historyInfo}>
            <Text style={[styles.historyDesc, { color: C.fg }]}>{item.description}</Text>
            <Text style={[styles.historyDate, { color: C.mutedLight }]}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.historyAmountWrap}>
            <Text style={[styles.historyAmount, { color: isPositive ? '#4CAF50' : C.danger }]}>
              {isPositive ? '+' : ''}{item.amount.toLocaleString()}
            </Text>
            <Text style={[styles.historyBalance, { color: C.mutedLight }]}>{item.balance.toLocaleString()} MOUI</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.fg }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.fg }]}>포인트 내역</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* 잔액 카드 */}
      <Animated.View entering={FadeInDown.delay(100).duration(400).springify()} style={[styles.balanceCard, { backgroundColor: C.card }]}>
        <Text style={[styles.balanceLabel, { color: C.gold }]}>보유 MOU 포인트</Text>
        <Text style={[styles.balanceAmount, { color: C.fg }]}>
          {(profile?.points ?? 0).toLocaleString()}
          <Text style={[styles.balanceUnit, { color: C.muted }]}> MOUI</Text>
        </Text>
        <Text style={[styles.balanceSub, { color: C.mutedLight }]}>= {((profile?.points ?? 0) * 100).toLocaleString()}원</Text>
      </Animated.View>

      {/* 내역 리스트 */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>💎</Text>
          <Text style={[styles.emptyText, { color: C.muted }]}>아직 포인트 내역이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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

  balanceCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '900',
  },
  balanceUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  balanceSub: {
    fontSize: 13,
  },

  list: {
    paddingHorizontal: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIcon: {
    fontSize: 18,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 11,
  },
  historyAmountWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  historyBalance: {
    fontSize: 11,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    letterSpacing: 1,
  },
});
