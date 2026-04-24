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
import { getCreatorVerificationStatusText } from '@/constants/creator-verification';

type ChatProfile = {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
  user_type: 'creator' | 'aspiring' | 'audience';
  verified: boolean;
  field: string | null;
  region: string | null;
};

type MouiChatItem = {
  id: string;
  title: string;
  category: string | null;
  last_message: string | null;
  last_message_at: string | null;
  participant_count: number;
  meeting_date: string | null;
  expires_at: string | null;
};

type ChatRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  expires_at: string | null;
  extended: boolean;
  sender_last_read_at: string | null;
  receiver_last_read_at: string | null;
  sender?: ChatProfile;
  receiver?: ChatProfile;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender_id?: string | null;
};

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();
  const { user } = useAuth();
  const router = useRouter();

  const [received, setReceived] = useState<ChatRequestRow[]>([]);
  const [active, setActive] = useState<ChatRequestRow[]>([]);
  const [sent, setSent] = useState<ChatRequestRow[]>([]);
  const [mouiChats, setMouiChats] = useState<MouiChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    // Received pending requests
    const { data: receivedData } = await supabase
      .from('chat_requests')
      .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url, user_type, verified, field, region)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Active (accepted) chats
    const { data: activeData } = await supabase
      .from('chat_requests')
      .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url, user_type, verified, field, region), receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url, user_type, verified, field, region)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Sent pending requests
    const { data: sentData } = await supabase
      .from('chat_requests')
      .select('*, receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url, user_type, verified, field, region)')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Auto-delete expired chats
    const now = new Date().toISOString();
    const expired = (activeData ?? []).filter(
      (c: any) => c.expires_at && c.expires_at < now,
    );
    for (const chat of expired) {
      // Delete uploaded images from storage
      const { data: imgMsgs } = await supabase
        .from('chat_messages')
        .select('image_url')
        .eq('request_id', chat.id)
        .not('image_url', 'is', null);
      if (imgMsgs && imgMsgs.length > 0) {
        const paths = imgMsgs
          .map((m: any) => m.image_url?.split('/chat-images/')[1])
          .filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('chat-images').remove(paths);
        }
      }
      await supabase.from('chat_messages').delete().eq('request_id', chat.id);
      await supabase.from('chat_requests').delete().eq('id', chat.id);
    }
    const validActive = (activeData ?? []).filter(
      (c: any) => !c.expires_at || c.expires_at >= now,
    );

    // Get last messages for active chats
    if (validActive.length > 0) {
      for (const chat of validActive) {
        const { data: msgData } = await supabase
          .from('chat_messages')
          .select('content, created_at, sender_id')
          .eq('request_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);
        (chat as any).last_message = msgData?.[0]?.content ?? null;
        (chat as any).last_message_at = msgData?.[0]?.created_at ?? null;
        (chat as any).last_message_sender_id = msgData?.[0]?.sender_id ?? null;
      }
    }

    // Moui group chats — posts I joined or own
    const { data: myParticipations } = await (supabase as any)
      .from('moui_participants')
      .select('moui_post_id')
      .eq('user_id', user.id);

    const { data: myMouiPosts } = await (supabase as any)
      .from('moui_posts')
      .select('id')
      .eq('user_id', user.id);

    const mouiPostIds = new Set<string>();
    for (const p of myParticipations ?? []) mouiPostIds.add(p.moui_post_id);
    for (const p of myMouiPosts ?? []) mouiPostIds.add(p.id);

    const mouiItems: MouiChatItem[] = [];
    for (const postId of mouiPostIds) {
      const { data: postData } = await (supabase as any)
        .from('moui_posts')
        .select('id, title, category, meeting_date, moui_participants(user_id)')
        .eq('id', postId)
        .single();
      if (!postData) continue;

      // Expires 7 days after meeting_date
      const mouiExpiresAt = postData.meeting_date
        ? new Date(new Date(postData.meeting_date).getTime() + 7 * 86400000).toISOString()
        : null;

      // Auto-delete expired moui chats
      if (mouiExpiresAt && mouiExpiresAt < now) {
        // Delete images from storage
        const { data: imgMsgs } = await (supabase as any)
          .from('moui_chat_messages')
          .select('image_url')
          .eq('moui_post_id', postId)
          .not('image_url', 'is', null);
        if (imgMsgs && imgMsgs.length > 0) {
          const paths = imgMsgs
            .map((m: any) => m.image_url?.split('/chat-images/')[1])
            .filter(Boolean);
          if (paths.length > 0) {
            await supabase.storage.from('chat-images').remove(paths);
          }
        }
        await (supabase as any).from('moui_chat_messages').delete().eq('moui_post_id', postId);
        await (supabase as any).from('moui_participants').delete().eq('moui_post_id', postId);
        await (supabase as any).from('moui_posts').delete().eq('id', postId);
        continue;
      }

      const { data: lastMsg } = await (supabase as any)
        .from('moui_chat_messages')
        .select('content, created_at')
        .eq('moui_post_id', postId)
        .order('created_at', { ascending: false })
        .limit(1);

      mouiItems.push({
        id: postData.id,
        title: postData.title,
        category: postData.category,
        last_message: lastMsg?.[0]?.content || null,
        last_message_at: lastMsg?.[0]?.created_at || null,
        participant_count: postData.moui_participants?.length ?? 0,
        meeting_date: postData.meeting_date,
        expires_at: mouiExpiresAt,
      });
    }

    setReceived((receivedData as any) ?? []);
    setActive(validActive as any);
    setSent((sentData as any) ?? []);
    setMouiChats(mouiItems);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAccept = async (requestId: string, senderId: string) => {
    // Update status + set expiry (7 days)
    const { error } = await supabase
      .from('chat_requests')
      .update({
        status: 'accepted',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
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

  const Badge = ({ profile }: { profile?: ChatProfile | null }) => {
    if (!profile) return null;
    if (profile.user_type === 'creator') {
      return (
        <View style={[styles.userBadge, { borderColor: C.gold, backgroundColor: C.goldDim }]}>
          <Text style={[styles.userBadgeText, { color: C.gold }]}>
            작가{' '}
            <Text style={{ color: profile.verified ? '#22c55e' : C.danger }}>
              {getCreatorVerificationStatusText(profile.verified)}
            </Text>
          </Text>
        </View>
      );
    }
    if (profile.user_type === 'aspiring') {
      return (
        <View style={[styles.userBadge, { borderColor: C.gold, backgroundColor: C.goldDim }]}>
          <Text style={[styles.userBadgeText, { color: C.gold }]}>지망생</Text>
        </View>
      );
    }
    return null;
  };

  const ProfileMeta = ({ profile }: { profile?: ChatProfile | null }) => {
    if (!profile) return null;
    const parts: string[] = [];
    if (profile.field) parts.push(profile.field);
    if (profile.region) parts.push(`📍 ${profile.region}`);
    if (parts.length === 0) return null;
    return <Text style={[styles.cardMeta, { color: C.mutedLight }]} numberOfLines={1}>{parts.join(' · ')}</Text>;
  };

  const Avatar = ({ profile }: { profile?: ChatProfile | null }) => (
    profile?.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.goldDim }]}>
        <Text style={{ fontSize: 18 }}>{profile?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
      </View>
    )
  );

  const sections = [
    ...(mouiChats.length > 0 ? [{ title: '모임 채팅', data: mouiChats as any[], type: 'moui' as const }] : []),
    ...(received.length > 0 ? [{ title: '받은 요청', data: received as any[], type: 'received' as const }] : []),
    ...(active.length > 0 ? [{ title: '일대일 채팅', data: active as any[], type: 'active' as const }] : []),
    ...(sent.length > 0 ? [{ title: '보낸 요청', data: sent as any[], type: 'sent' as const }] : []),
  ];

  const isEmpty = received.length === 0 && active.length === 0 && sent.length === 0 && mouiChats.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
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

            if (sec.type === 'moui') {
              const mouiItem = item as MouiChatItem;
              const mouiTimeAgo = mouiItem.last_message_at ? getRelativeTime(mouiItem.last_message_at) : null;
              const mouiExpiryLabel = mouiItem.expires_at
                ? `${new Date(mouiItem.expires_at).getMonth() + 1}/${new Date(mouiItem.expires_at).getDate()} 만료`
                : null;
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, { backgroundColor: C.card }, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/moui/${mouiItem.id}` as any)}
                >
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.goldDim }]}>
                      <Text style={{ fontSize: 18 }}>🤝</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.cardName, { color: C.fg }]} numberOfLines={1}>{mouiItem.title}</Text>
                        <View style={[styles.pendingBadge, { backgroundColor: C.goldDim }]}>
                          <Text style={[styles.pendingText, { color: C.gold }]}>{mouiItem.participant_count}명</Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        {mouiTimeAgo && (
                          <Text style={[styles.timeAgoText, { color: C.muted }]}>{mouiTimeAgo}</Text>
                        )}
                      </View>
                      {mouiExpiryLabel && (
                        <Text style={[styles.expiryText, { color: C.muted }]}>{mouiExpiryLabel}</Text>
                      )}
                      <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={1}>
                        {mouiItem.last_message ?? '아직 메시지가 없습니다'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }

            if (sec.type === 'received') {
              const sender = item.sender;
              return (
                <View style={[styles.card, { backgroundColor: C.card }]}>
                  <View style={styles.cardRow}>
                    <Pressable onPress={() => sender && router.push(`/artist/${sender.username}` as any)}>
                      <Avatar profile={sender} />
                    </Pressable>
                    <Pressable style={styles.cardInfo} onPress={() => sender && router.push(`/artist/${sender.username}` as any)}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.cardName, { color: C.fg }]}>{sender?.name ?? sender?.username}</Text>
                        <Badge profile={sender} />
                      </View>
                      <ProfileMeta profile={sender} />
                      <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={2}>{item.message}</Text>
                    </Pressable>
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
              const expiryLabel = item.expires_at
                ? `${new Date(item.expires_at).getMonth() + 1}/${new Date(item.expires_at).getDate()} 만료`
                : null;
              const timeAgo = item.last_message_at ? getRelativeTime(item.last_message_at) : null;
              const myLastRead = item.sender_id === user?.id
                ? item.sender_last_read_at
                : item.receiver_last_read_at;
              const hasUnread = !!(
                item.last_message_at &&
                item.last_message_sender_id !== user?.id &&
                (!myLastRead || item.last_message_at > myLastRead)
              );
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, { backgroundColor: C.card }, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/chat/${item.id}` as any)}
                >
                  <View style={styles.cardRow}>
                    <View>
                      <Pressable onPress={() => other && router.push(`/artist/${other.username}` as any)}>
                        <Avatar profile={other} />
                      </Pressable>
                      {hasUnread && (
                        <View style={[styles.unreadDot, { backgroundColor: C.gold }]} />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.cardName, { color: C.fg }]}>{other?.name ?? other?.username}</Text>
                        <Badge profile={other} />
                        {hasUnread && (
                          <View style={[styles.newBadge, { backgroundColor: C.gold }]}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }} />
                        {timeAgo && (
                          <Text style={[styles.timeAgoText, { color: C.muted }]}>{timeAgo}</Text>
                        )}
                      </View>
                      {expiryLabel && (
                        <Text style={[styles.expiryText, { color: C.muted }]}>{expiryLabel}</Text>
                      )}
                      <ProfileMeta profile={other} />
                      <Text style={[styles.cardMsg, { color: hasUnread ? C.fg : C.muted, fontWeight: hasUnread ? '600' : '400' }]} numberOfLines={1}>
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
                  <Pressable onPress={() => receiver && router.push(`/artist/${receiver.username}` as any)}>
                    <Avatar profile={receiver} />
                  </Pressable>
                  <Pressable style={styles.cardInfo} onPress={() => receiver && router.push(`/artist/${receiver.username}` as any)}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.cardName, { color: C.fg }]}>{receiver?.name ?? receiver?.username}</Text>
                      <Badge profile={receiver} />
                    </View>
                    <ProfileMeta profile={receiver} />
                    <Text style={[styles.cardMsg, { color: C.muted }]} numberOfLines={2}>{item.message}</Text>
                  </Pressable>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  userBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardMeta: {
    fontSize: 11,
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
  expiryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeAgoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  newBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
});
