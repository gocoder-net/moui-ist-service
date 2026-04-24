import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
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
import { TARGET_OPTIONS, FIELD_OPTIONS } from '@/constants/moui';
import * as ImagePicker from 'expo-image-picker';

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
  image_url: string | null;
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
  const [showInfo, setShowInfo] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Expiry: meeting_date + 7 days
  const expiresAt = post?.meeting_date
    ? new Date(new Date(post.meeting_date).getTime() + 7 * 86400000)
    : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const expiryLabel = expiresAt
    ? `${expiresAt.getMonth() + 1}/${expiresAt.getDate()} 만료`
    : null;

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
      image_url: null,
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

  const pickAndSendImage = useCallback(async () => {
    if (!user?.id || !postId || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    const uri = result.assets[0].uri;
    const fileName = `${user.id}/${postId}_${Date.now()}.jpg`;

    const tempMsg: ChatMessage = {
      id: `temp-img-${Date.now()}`,
      moui_post_id: postId,
      sender_id: user.id,
      content: '',
      image_url: uri,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const imageUrl = supabase.storage.from('chat-images').getPublicUrl(fileName).data.publicUrl;
      const { error } = await (supabase as any).from('moui_chat_messages').insert({
        moui_post_id: postId,
        sender_id: user.id,
        content: '',
        image_url: imageUrl,
      });
      if (error) throw error;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }
    setSending(false);
  }, [user?.id, postId, sending]);

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

  const participants = post.moui_participants ?? [];
  const targetKeys = post.target_types?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
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
              {participants.length}명 참여중{expiryLabel ? ` · ${expiryLabel}` : ''}
            </Text>
          </View>
          <View style={styles.infoToggle} />
        </View>

        {/* 참여자 (항상 표시) */}
        {participants.length > 0 && (
          <View style={[styles.participantsSection, { backgroundColor: C.card, borderBottomColor: C.border }]}>
            <Text style={[styles.participantsLabel, { color: C.muted }]}>참여자 ({participants.length}명)</Text>
            <View style={styles.participantAvatars}>
              {participants.slice(0, 8).map(pt => (
                <Pressable key={pt.user_id} onPress={() => pt.profiles?.username && router.push(`/artist/${pt.profiles.username}` as any)} style={styles.participantItem}>
                  <View style={[styles.participantAvatar, { backgroundColor: C.bg, borderColor: C.border }]}>
                    {pt.profiles?.avatar_url ? (
                      <Image source={{ uri: pt.profiles.avatar_url }} style={styles.participantAvatarImg} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 10 }}>{pt.profiles?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
                    )}
                  </View>
                  <Text style={[styles.participantName, { color: C.fg }]} numberOfLines={1}>
                    {pt.profiles?.name ?? pt.profiles?.username ?? ''}
                  </Text>
                </Pressable>
              ))}
              {participants.length > 8 && (
                <View style={styles.participantItem}>
                  <View style={[styles.participantAvatar, { backgroundColor: C.card, borderColor: C.border }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted }}>+{participants.length - 8}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 상세 정보 토글 */}
        <Pressable
          onPress={() => setShowInfo(v => !v)}
          style={[styles.detailToggle, { backgroundColor: C.card, borderBottomColor: C.border }]}
        >
          <Text style={[styles.detailToggleText, { color: C.muted }]}>
            {showInfo ? '상세정보 접기' : '상세정보 보기'}
          </Text>
          <IconSymbol name={showInfo ? 'chevron.up' : 'chevron.down'} size={12} color={C.muted} />
        </Pressable>

        {/* 상세 정보 (접이식) */}
        {showInfo && (
          <View style={[styles.infoSection, { backgroundColor: C.card, borderBottomColor: C.border }]}>
            {/* 정보 박스 */}
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

            {/* 태그: 분야 + 모집 대상 */}
            {(post.fields || targetKeys.length > 0) && (
              <View style={styles.postMetaSection}>
                {post.fields && (
                  <View style={styles.postMetaRow}>
                    <Text style={[styles.postMetaLabel, { color: C.muted }]}>분야</Text>
                    <View style={styles.postTagRow}>
                      {post.fields.trim() === '전체' ? (
                        <View style={[styles.postTag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                          <Text style={[styles.postTagText, { color: C.gold }]}>전체 분야</Text>
                        </View>
                      ) : (
                        post.fields.split(',').map(f => {
                          const fo = FIELD_OPTIONS.find(o => o.key === f.trim());
                          return (
                            <View key={f.trim()} style={[styles.postTag, { backgroundColor: C.gold + '15', borderColor: C.gold + '44' }]}>
                              <Text style={[styles.postTagText, { color: C.gold }]}>{fo ? `${fo.icon} ${f.trim()}` : f.trim()}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                )}
                {targetKeys.length > 0 && (
                  <View style={styles.postMetaRow}>
                    <Text style={[styles.postMetaLabel, { color: C.muted }]}>모집 대상</Text>
                    <View style={styles.postTagRow}>
                      {targetKeys.map(key => {
                        const t = TARGET_OPTIONS.find(o => o.key === key);
                        return t ? (
                          <View key={key} style={[styles.postTag, { backgroundColor: C.fg + '0A', borderColor: C.fg + '22' }]}>
                            <Text style={[styles.postTagText, { color: C.fg, opacity: 0.82 }]}>{t.icon} {t.label}</Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
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
                  {showAvatar && (
                    <Text style={[styles.senderName, { color: C.muted, textAlign: isMe ? 'right' : 'left' }]}>
                      {profile?.name ?? profile?.username ?? ''}
                    </Text>
                  )}
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={[
                        styles.msgImage,
                        isMe ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 },
                      ]}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[
                      styles.msgBubble,
                      isMe
                        ? { backgroundColor: C.gold, borderBottomRightRadius: 4 }
                        : { backgroundColor: C.card, borderBottomLeftRadius: 4 },
                    ]}>
                      <Text style={[styles.msgText, { color: isMe ? C.bg : C.fg }]}>{item.content}</Text>
                    </View>
                  )}
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
        {isExpired ? (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: C.border, backgroundColor: C.bg }]}>
            <View style={[styles.expiredBar, { backgroundColor: C.card }]}>
              <Text style={[styles.expiredText, { color: C.muted }]}>채팅이 만료되었습니다</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: C.border, backgroundColor: C.bg }]}>
            <Pressable
              style={({ pressed }) => [
                styles.imageBtn,
                { backgroundColor: C.card, borderColor: C.border },
                pressed && { opacity: 0.6 },
              ]}
              onPress={pickAndSendImage}
              disabled={sending}
              hitSlop={8}
            >
              <IconSymbol name="photo.fill" size={20} color={C.muted} />
            </Pressable>
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
        )}
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

  /* 참여자 섹션 (항상 표시) */
  participantsSection: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /* 상세정보 토글 */
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  /* Info section */
  infoSection: {
    padding: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  tagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postMetaSection: {
    gap: 8,
    paddingTop: 2,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  postMetaLabel: {
    width: 54,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 28,
  },
  postTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  postTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  postTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantsLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  participantAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  participantItem: {
    alignItems: 'center',
    width: 46,
    gap: 4,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  participantAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  participantName: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
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
  imageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  expiredBar: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  expiredText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
