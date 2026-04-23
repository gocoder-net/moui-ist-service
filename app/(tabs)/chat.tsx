import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Alert,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeMode } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type ChatRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: { id: string; name: string | null; username: string; avatar_url: string | null };
  receiver?: { id: string; name: string | null; username: string; avatar_url: string | null };
  last_message?: string | null;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();
  const { user } = useAuth();
  const router = useRouter();

  const [received, setReceived] = useState<ChatRequestRow[]>([]);
  const [active, setActive] = useState<ChatRequestRow[]>([]);
  const [sent, setSent] = useState<ChatRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    // Received pending requests
    const { data: receivedData } = await supabase
      .from('chat_requests')
      .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Active (accepted) chats
    const { data: activeData } = await supabase
      .from('chat_requests')
      .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url), receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Sent pending requests
    const { data: sentData } = await supabase
      .from('chat_requests')
      .select('*, receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url)')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get last messages for active chats
    if (activeData && activeData.length > 0) {
      for (const chat of activeData) {
        const { data: msgData } = await supabase
          .from('chat_messages')
          .select('content')
          .eq('request_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);
        (chat as any).last_message = msgData?.[0]?.content ?? null;
      }
    }

    setReceived((receivedData as any) ?? []);
    setActive((activeData as any) ?? []);
    setSent((sentData as any) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAccept = async (requestId: string, senderId: string) => {
    // Update status
    const { error } = await supabase
      .from('chat_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (error) { Alert.alert('오류', '수락에 실패했습니다.'); return; }

    // Give receiver 150 MOUI
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single();
      const newBalance = (profile?.points ?? 0) + 150;
      await supabase.from('profiles').update({ points: newBalance }).eq('id', user.id);
      await (supabase as any).from('point_history').insert({
        user_id: user.id,
        amount: 150,
        balance: newBalance,
        type: 'chat_accept',
        description: '채팅 수락 보상',
      });
    }
    loadData();
  };

  const handleReject = async (requestId: string) => {
    await supabase.from('chat_requests').update({ status: 'rejected' }).eq('id', requestId);
    loadData();
  };

  const getOtherUser = (item: ChatRequestRow) => {
    if (item.sender_id === user?.id) return item.receiver;
    return item.sender;
  };

  const Avatar = ({ url, name }: { url?: string | null; name?: string | null }) => (
    url ? (
      <Image source={{ uri: url }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.goldDim }]}>
        <Text style={{ fontSize: 18 }}>{name ? name[0] : '?'}</Text>
      </View>
    )
  );

  const sections = [
    ...(received.length > 0 ? [{ title: '받은 요청', data: received, type: 'received' as const }] : []),
    ...(active.length > 0 ? [{ title: '채팅', data: active, type: 'active' as const }] : []),
    ...(sent.length > 0 ? [{ title: '보낸 요청', data: sent, type: 'sent' as const }] : []),
  ];

  const isEmpty = received.length === 0 && active.length === 0 && sent.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
        <Text style={[styles.headerTitle, { color: C.fg }]}>작당모의</Text>
      </Animated.View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={[styles.emptyTitle, { color: C.fg }]}>아직 채팅이 없어요</Text>
            <Text style={[styles.emptyDesc, { color: C.muted }]}>
              탐색모의에서 작가를 찾아{'\n'}채팅을 걸어보세요
            </Text>
          </Animated.View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: C.bg }]}>
              <Text style={[styles.sectionTitle, { color: C.muted }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            const sec = section as (typeof sections)[number];

            if (sec.type === 'received') {
              const sender = item.sender;
              return (
                <View style={[styles.card, { backgroundColor: C.card }]}>
                  <View style={styles.cardRow}>
                    <Avatar url={sender?.avatar_url} name={sender?.name ?? sender?.username} />
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: C.fg }]}>{sender?.name ?? sender?.username}</Text>
                      <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={2}>{item.message}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [styles.rejectBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => handleReject(item.id)}
                    >
                      <Text style={[styles.rejectBtnText, { color: C.muted }]}>거절</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.acceptBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.8 }]}
                      onPress={() => handleAccept(item.id, item.sender_id)}
                    >
                      <Text style={[styles.acceptBtnText, { color: C.bg }]}>수락 (+150 MOUI)</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            if (sec.type === 'active') {
              const other = getOtherUser(item);
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, { backgroundColor: C.card }, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/chat/${item.id}` as any)}
                >
                  <View style={styles.cardRow}>
                    <Avatar url={other?.avatar_url} name={other?.name ?? other?.username} />
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: C.fg }]}>{other?.name ?? other?.username}</Text>
                      <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={1}>
                        {item.last_message ?? item.message}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }

            // sent
            const receiver = item.receiver;
            return (
              <View style={[styles.card, { backgroundColor: C.card }]}>
                <View style={styles.cardRow}>
                  <Avatar url={receiver?.avatar_url} name={receiver?.name ?? receiver?.username} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: C.fg }]}>{receiver?.name ?? receiver?.username}</Text>
                    <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={2}>{item.message}</Text>
                  </View>
                  <View style={[styles.pendingBadge, { backgroundColor: C.goldDim }]}>
                    <Text style={[styles.pendingText, { color: C.gold }]}>대기중</Text>
                  </View>
                </View>
              </View>
            );
          }}
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMsg: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  rejectBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  acceptBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
