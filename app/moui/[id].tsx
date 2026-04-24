import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Linking,
  type NativeSyntheticEvent, type TextInputKeyPressEventData,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { parseRegion } from '@/constants/regions';
import { MOUI_CATEGORIES, TARGET_OPTIONS, FIELD_OPTIONS } from '@/constants/moui';

type MouiParticipant = {
  user_id: string;
  profiles: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    user_type: string;
  };
};

type MouiPost = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  fields: string | null;
  category: string | null;
  region: string | null;
  target_types: string | null;
  map_url: string | null;
  address: string | null;
  meeting_date: string | null;
  frequency: string | null;
  recruit_start: string | null;
  recruit_deadline: string | null;
  status: 'open' | 'closed';
  created_at: string;
  profiles?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    field: string | null;
    user_type: 'creator' | 'aspiring' | 'audience';
    verified: boolean;
  };
  moui_participants?: MouiParticipant[];
};

type ChatMessage = {
  id: string;
  moui_post_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function formatRegionLabel(region: string | null | undefined) {
  const parsed = parseRegion(region);
  if (!parsed) return region?.trim() ?? '';
  const compactProvince = parsed.province
    .replace('특별시', '시').replace('광역시', '시')
    .replace('특별자치시', '시').replace('특별자치도', '도');
  return `${compactProvince} ${parsed.district}`;
}

function formatMeetingDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[d.getDay()];
  if (hour === 0 && minute === 0) return `${month}/${day}(${weekday})`;
  return `${month}/${day}(${weekday}) ${hour}:${String(minute).padStart(2, '0')}`;
}

function formatRecruitPeriod(start: string | null, end: string | null) {
  if (!end) return null;
  const fmt = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
  if (start) return `${fmt(start)} ~ ${fmt(end)}`;
  return `~ ${fmt(end)}`;
}

export default function MouiChatScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();
  const { user } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<MouiPost | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Load post data and messages
  useEffect(() => {
    if (!postId || !user?.id) return;
    const load = async () => {
      const { data: postData } = await (supabase as any)
        .from('moui_posts')
        .select('*, profiles(name, username, avatar_url, field, user_type, verified), moui_participants(user_id, profiles(name, username, avatar_url, user_type))')
        .eq('id', postId)
        .single();
      if (postData) setPost(postData);

      const { data: msgs } = await (supabase as any)
        .from('moui_chat_messages')
        .select('*')
        .eq('moui_post_id', postId)
        .order('created_at', { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);
    };
    load();
  }, [postId, user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`moui-chat:${postId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moui_chat_messages',
        filter: `moui_post_id=eq.${postId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages((prev) => {
          const optimisticIdx = prev.findIndex(
            (m) => m.id.startsWith('temp-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content,
          );
          if (optimisticIdx >= 0) {
            const next = [...prev];
            next[optimisticIdx] = newMsg;
            return next;
          }
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Build sender profile map from participants + owner
  const senderProfiles = useCallback(() => {
    if (!post) return {};
    const map: Record<string, { name: string | null; username: string; avatar_url: string | null; user_type: string }> = {};
    if (post.profiles) {
      map[post.user_id] = {
        name: post.profiles.name,
        username: post.profiles.username,
        avatar_url: post.profiles.avatar_url,
        user_type: post.profiles.user_type,
      };
    }
    for (const pt of post.moui_participants ?? []) {
      if (pt.profiles) map[pt.user_id] = pt.profiles;
    }
    return map;
  }, [post])();

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !user?.id || !postId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      moui_post_id: postId,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { error } = await (supabase as any).from('moui_chat_messages').insert({
      moui_post_id: postId,
      sender_id: user.id,
      content: text,
    });

    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInputText(text);
    }
  }, [inputText, user?.id, postId, sending]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e as any).shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.gold} />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: C.muted }}>모임을 찾을 수 없습니다</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: C.gold, fontWeight: '700' }}>돌아가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const author = post.profiles;
  const participants = post.moui_participants ?? [];
  const targetKeys = post.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const remainingDays = post.recruit_deadline
    ? Math.max(0, Math.ceil((new Date(post.recruit_deadline).getTime() - Date.now()) / 86400000))
    : null;
  const deadlineExpired = post.recruit_deadline && new Date(post.recruit_deadline) < new Date();
  const isClosed = post.status === 'closed' || !!deadlineExpired;
  const recruitPeriod = formatRecruitPeriod(post.recruit_start, post.recruit_deadline);

  const AvatarBubble = ({ senderId }: { senderId: string }) => {
    const profile = senderProfiles[senderId];
    return profile?.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} style={styles.msgAvatar} contentFit="cover" />
    ) : (
      <View style={[styles.msgAvatar, styles.msgAvatarFallback, { backgroundColor: C.goldDim }]}>
        <Text style={{ fontSize: 14 }}>{profile?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <IconSymbol name="chevron.left" size={20} color={C.fg} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: C.fg }]} numberOfLines={1}>
              {post.title}
            </Text>
            <Text style={[styles.headerSub, { color: C.muted }]}>
              {participants.length}명 참여중
            </Text>
          </View>
          <Pressable onPress={() => setShowInfo(v => !v)} style={styles.infoToggle} hitSlop={12}>
            <IconSymbol name={showInfo ? 'chevron.up' : 'info.circle'} size={18} color={C.gold} />
          </Pressable>
        </View>

        {/* Meeting Info (collapsible) */}
        {showInfo && (
          <ScrollView style={[styles.infoSection, { borderBottomColor: C.border }]} nestedScrollEnabled>
            <View style={styles.infoContent}>
              {/* Category + Status */}
              <View style={styles.infoTopRow}>
                {post.category && (() => {
                  const cat = MOUI_CATEGORIES.find(c => c.key === post.category);
                  return cat ? (
                    <View style={[styles.categoryChip, { backgroundColor: C.gold + '22', borderColor: C.gold + '55' }]}>
                      <Text style={[styles.categoryChipText, { color: C.gold }]}>{cat.icon} {cat.label}</Text>
                    </View>
                  ) : null;
                })()}
                <View style={[styles.statusBadge, { backgroundColor: isClosed ? C.danger + '22' : '#22c55e22' }]}>
                  <Text style={[styles.statusText, { color: isClosed ? C.danger : '#22c55e' }]}>
                    {isClosed ? '마감' : remainingDays !== null ? `D-${remainingDays}` : '모집 중'}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.descText, { color: C.fg, opacity: 0.7 }]}>{post.description}</Text>

              {/* Info box */}
              <View style={[styles.infoBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                {post.meeting_date && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: C.muted }]}>일시</Text>
                    <Text style={[styles.infoValue, { color: C.fg }]}>
                      {formatMeetingDate(post.meeting_date)}
                      {post.frequency && (post.frequency === 'regular' ? '  ·  정기' : '  ·  1회성')}
                    </Text>
                  </View>
                )}
                {(post.region || post.address) && (() => {
                  const regionLabel = formatRegionLabel(post.region);
                  const locationText = [regionLabel, post.address].filter(Boolean).join(' ');
                  return locationText ? (
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: C.muted }]}>장소</Text>
                      {post.map_url ? (
                        <Pressable onPress={() => Linking.openURL(post.map_url!)}>
                          <Text style={[styles.infoValue, { color: C.gold, textDecorationLine: 'underline' }]} numberOfLines={1}>{locationText}</Text>
                        </Pressable>
                      ) : (
                        <Text style={[styles.infoValue, { color: C.fg }]} numberOfLines={1}>{locationText}</Text>
                      )}
                    </View>
                  ) : null;
                })()}
                {recruitPeriod && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: C.muted }]}>모집</Text>
                    <Text style={[styles.infoValue, { color: C.fg }]}>{recruitPeriod}</Text>
                  </View>
                )}
              </View>

              {/* Tags */}
              {(post.fields || targetKeys.length > 0) && (
                <View style={styles.tagsSection}>
                  {post.fields && (
                    <View style={styles.tagRow}>
                      <Text style={[styles.tagLabel, { color: C.muted }]}>분야</Text>
                      <View style={styles.tagList}>
                        {post.fields.trim() === '전체' ? (
                          <View style={[styles.tag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                            <Text style={[styles.tagText, { color: C.gold }]}>전체 분야</Text>
                          </View>
                        ) : (
                          post.fields.split(',').map(f => {
                            const fo = FIELD_OPTIONS.find(o => o.key === f.trim());
                            return (
                              <View key={f.trim()} style={[styles.tag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                                <Text style={[styles.tagText, { color: C.gold }]}>{fo ? `${fo.icon} ${f.trim()}` : f.trim()}</Text>
                              </View>
                            );
                          })
                        )}
                      </View>
                    </View>
                  )}
                  {targetKeys.length > 0 && (
                    <View style={styles.tagRow}>
                      <Text style={[styles.tagLabel, { color: C.muted }]}>대상</Text>
                      <View style={styles.tagList}>
                        {targetKeys.map(key => {
                          const t = TARGET_OPTIONS.find(o => o.key === key);
                          return t ? (
                            <View key={key} style={[styles.tag, { backgroundColor: C.fg + '0A', borderColor: C.fg + '22' }]}>
                              <Text style={[styles.tagText, { color: C.fg, opacity: 0.82 }]}>{t.icon} {t.label}</Text>
                            </View>
                          ) : null;
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Participants */}
              {participants.length > 0 && (
                <View style={styles.participantsRow}>
                  <Text style={[styles.participantsLabel, { color: C.muted }]}>참여자 ({participants.length}명)</Text>
                  <View style={styles.participantAvatars}>
                    {participants.slice(0, 8).map(pt => (
                      <Pressable key={pt.user_id} onPress={() => pt.profiles?.username && router.push(`/artist/${pt.profiles.username}` as any)}>
                        <View style={[styles.participantAvatar, { backgroundColor: C.bg, borderColor: C.border }]}>
                          {pt.profiles?.avatar_url ? (
                            <Image source={{ uri: pt.profiles.avatar_url }} style={styles.participantAvatarImg} contentFit="cover" />
                          ) : (
                            <Text style={{ fontSize: 10 }}>{pt.profiles?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                    {participants.length > 8 && (
                      <View style={[styles.participantAvatar, { backgroundColor: C.card, borderColor: C.border }]}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted }}>+{participants.length - 8}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Author */}
              {author && (
                <Pressable
                  onPress={() => router.push(`/artist/${author.username}` as any)}
                  style={styles.authorRow}
                >
                  <View style={[styles.authorAvatar, { backgroundColor: C.bg }]}>
                    {author.avatar_url ? (
                      <Image source={{ uri: author.avatar_url }} style={styles.authorAvatarImg} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 10 }}>{author.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                    )}
                  </View>
                  <Text style={[styles.authorName, { color: C.muted }]}>주최: {author.name ?? author.username}</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMe = item.sender_id === user?.id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showAvatar = prevMsg?.sender_id !== item.sender_id;
            const profile = senderProfiles[item.sender_id];

            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                {!isMe && (
                  showAvatar ? (
                    <Pressable onPress={() => profile?.username && router.push(`/artist/${profile.username}` as any)}>
                      <AvatarBubble senderId={item.sender_id} />
                    </Pressable>
                  ) : <View style={styles.msgAvatarSpacer} />
                )}
                <View style={[styles.msgBody, isMe && styles.msgBodyMe]}>
                  {!isMe && showAvatar && (
                    <Text style={[styles.senderName, { color: C.muted }]}>
                      {profile?.name ?? profile?.username ?? ''}
                    </Text>
                  )}
                  <View style={[
                    styles.msgBubble,
                    isMe
                      ? { backgroundColor: C.gold, borderBottomRightRadius: 4 }
                      : { backgroundColor: C.card, borderBottomLeftRadius: 4 },
                  ]}>
                    <Text style={[styles.msgText, { color: isMe ? C.bg : C.fg }]}>{item.content}</Text>
                  </View>
                  <Text style={[styles.msgTime, { color: C.mutedLight, textAlign: isMe ? 'right' : 'left' }]}>
                    {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {isMe && (
                  showAvatar ? <AvatarBubble senderId={item.sender_id} /> : <View style={styles.msgAvatarSpacer} />
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: C.muted }]}>대화를 시작해보세요</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: C.border, backgroundColor: C.bg }]}>
          <TextInput
            style={[styles.input, { color: C.fg, backgroundColor: C.card, borderColor: C.border }]}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={C.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            onKeyPress={handleKeyPress}
            blurOnSubmit={false}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: C.gold, opacity: (!inputText.trim() || sending) ? 0.4 : pressed ? 0.8 : 1 },
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <IconSymbol name="paperplane.fill" size={18} color={C.bg} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  infoToggle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Info section */
  infoSection: {
    maxHeight: 320,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoContent: {
    padding: 16,
    gap: 10,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 30,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tagsSection: {
    gap: 6,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tagLabel: {
    width: 30,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 24,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  participantsRow: {
    gap: 6,
  },
  participantsLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  participantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  participantAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  authorAvatarImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  authorName: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Messages */
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  msgRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
  msgAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarSpacer: { width: 28 },
  msgBody: {
    maxWidth: '70%',
    gap: 2,
  },
  msgBodyMe: { alignItems: 'flex-end' },
  senderName: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    marginHorizontal: 4,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    fontSize: 14,
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
});
