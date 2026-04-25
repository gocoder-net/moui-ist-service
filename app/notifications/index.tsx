import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, Image, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  from_user_id: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
  from_user?: { username: string; name: string | null; avatar_url: string | null } | null;
};

const TYPE_EMOJI: Record<string, string> = {
  like: '◆',
  comment: '💬',
  follow: '🔗',
  chat_request: '✉️',
  chat_accepted: '💬',
  moui_join: '🤝',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}달 전`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useThemeMode();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_from_user_id_fkey(username, name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data.map((n: any) => ({
        ...n,
        from_user: n.profiles ?? null,
      })));
      // Mark all as read
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadNotifications(); }, [loadNotifications]));

  const handlePress = (n: Notification) => {
    if (n.type === 'like' || n.type === 'comment') {
      if (n.from_user?.username) router.push(`/artist/${n.from_user.username}` as any);
    } else if (n.type === 'follow') {
      if (n.from_user?.username) router.push(`/artist/${n.from_user.username}` as any);
    } else if (n.type === 'chat_request' || n.type === 'chat_accepted') {
      router.push('/(tabs)/chat' as any);
    } else if (n.type === 'moui_join' && n.target_id) {
      router.push(`/moui/${n.target_id}` as any);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={[styles.backText, { color: C.fg }]}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.fg }]}>알림</Text>
          <View style={{ width: 40 }} />
        </View>

        {notifications.length === 0 && !loading ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 32 }}>🔔</Text>
            <Text style={[styles.emptyText, { color: C.muted }]}>아직 알림이 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(50 + index * 30).duration(300).springify()}>
                <Pressable
                  style={({ pressed }) => [
                    styles.notifItem,
                    { backgroundColor: item.is_read ? C.bg : C.card, borderBottomColor: C.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handlePress(item)}
                >
                  {item.from_user?.avatar_url ? (
                    <Image source={{ uri: item.from_user.avatar_url }} style={styles.notifAvatar} resizeMode="cover" />
                  ) : (
                    <View style={[styles.notifAvatar, { backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 16 }}>{TYPE_EMOJI[item.type] ?? '🔔'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: C.fg }]}>{item.title}</Text>
                    {item.body && <Text style={[styles.notifBody, { color: C.muted }]} numberOfLines={2}>{item.body}</Text>}
                    <Text style={[styles.notifTime, { color: C.mutedLight }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                  <Text style={{ fontSize: 14 }}>{TYPE_EMOJI[item.type] ?? '🔔'}</Text>
                </Pressable>
              </Animated.View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  innerContainer: { flex: 1, maxWidth: 680, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40 },
  backText: { fontSize: 20, fontWeight: '300' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14 },
  list: { paddingBottom: 90 },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  notifAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  notifTitle: { fontSize: 13, fontWeight: '700' },
  notifBody: { fontSize: 12, marginTop: 2 },
  notifTime: { fontSize: 10, marginTop: 3 },
});
