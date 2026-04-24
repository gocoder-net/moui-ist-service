import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as ImagePicker from 'expo-image-picker';

type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
  user_type: 'creator' | 'aspiring' | 'audience';
};

export default function ChatRoomScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [extending, setExtending] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const iAmSenderRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  // Load chat data
  useEffect(() => {
    if (!requestId || !user?.id) return;

    const load = async () => {
      const { data: req } = await supabase
        .from('chat_requests')
        .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url, user_type), receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url, user_type)')
        .eq('id', requestId)
        .single();

      if (req) {
        const isSender = req.sender_id === user.id;
        iAmSenderRef.current = isSender;
        setOtherUser(isSender ? (req as any).receiver : (req as any).sender);
        setMyProfile(isSender ? (req as any).sender : (req as any).receiver);
        setExpiresAt((req as any).expires_at ?? null);
        setExtended((req as any).extended ?? false);
        // Other user's last read timestamp
        setOtherLastReadAt(
          isSender ? (req as any).receiver_last_read_at : (req as any).sender_last_read_at
        );
      }

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      setMessages(msgs ?? []);
      setLoading(false);

      // Mark as read
      supabase.rpc('mark_chat_read', { request_id: requestId });
    };

    load();
  }, [requestId, user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!requestId) return;

    const channel = supabase
      .channel(`chat:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Replace optimistic message or skip duplicate
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
          // Mark as read when receiving messages while in chat
          if (newMsg.sender_id !== user?.id) {
            supabase.rpc('mark_chat_read', { request_id: requestId });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as any;
          // Update the other user's last read time
          const otherRead = iAmSenderRef.current
            ? row.receiver_last_read_at
            : row.sender_last_read_at;
          if (otherRead) setOtherLastReadAt(otherRead);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !user?.id || !requestId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic: immediately add to local state
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      request_id: requestId,
      sender_id: user.id,
      content: text,
      image_url: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { error } = await supabase.from('chat_messages').insert({
      request_id: requestId,
      sender_id: user.id,
      content: text,
    });

    setSending(false);
    if (error) {
      // Remove optimistic message on failure, restore input
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInputText(text);
    }
  }, [inputText, user?.id, requestId, sending]);

  const pickAndSendImage = useCallback(async () => {
    if (!user?.id || !requestId || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    const uri = result.assets[0].uri;
    const fileName = `${user.id}/${requestId}_${Date.now()}.jpg`;

    // Optimistic
    const tempMsg: Message = {
      id: `temp-img-${Date.now()}`,
      request_id: requestId,
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

      const { error } = await supabase.from('chat_messages').insert({
        request_id: requestId,
        sender_id: user.id,
        content: '',
        image_url: imageUrl,
      });

      if (error) throw error;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      Alert.alert('오류', '이미지 전송에 실패했습니다.');
    }
    setSending(false);
  }, [user?.id, requestId, sending]);

  // Web: Enter to send, Shift+Enter for newline
  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e as any).shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const doEndChat = useCallback(async () => {
    if (!requestId) return;
    // Delete uploaded images from storage
    const { data: imgMsgs } = await supabase
      .from('chat_messages')
      .select('image_url')
      .eq('request_id', requestId)
      .not('image_url', 'is', null);
    if (imgMsgs && imgMsgs.length > 0) {
      const paths = imgMsgs
        .map((m: any) => m.image_url?.split('/chat-images/')[1])
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('chat-images').remove(paths);
      }
    }
    await supabase.from('chat_messages').delete().eq('request_id', requestId);
    await supabase.from('chat_requests').delete().eq('id', requestId);
    router.back();
  }, [requestId]);

  const endChat = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('이 채팅을 종료하시겠습니까?\n모든 메시지가 삭제됩니다.')) {
        doEndChat();
      }
    } else {
      Alert.alert('채팅 종료', '이 채팅을 종료하시겠습니까?\n모든 메시지가 삭제됩니다.', [
        { text: '취소', style: 'cancel' },
        { text: '종료', style: 'destructive', onPress: doEndChat },
      ]);
    }
  }, [doEndChat]);

  const doExtendChat = useCallback(async () => {
    if (!requestId) return;
    setExtending(true);
    const { error } = await supabase.rpc('extend_chat', { request_id: requestId });
    setExtending(false);
    if (error) {
      const msg = error.message.includes('Not enough points')
        ? 'MOUI가 부족합니다 (100 MOUI 필요)'
        : error.message.includes('Already extended')
        ? '이미 연장된 채팅입니다'
        : '연장에 실패했습니다';
      Alert.alert('오류', msg);
      return;
    }
    // Refresh state
    setExtended(true);
    setExpiresAt((prev) =>
      prev ? new Date(new Date(prev).getTime() + 7 * 86400000).toISOString() : null,
    );
    Alert.alert('완료', '채팅이 7일 연장되었습니다');
  }, [requestId]);

  const extendChat = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('100 MOUI를 사용하여 채팅을 7일 연장하시겠습니까?')) {
        doExtendChat();
      }
    } else {
      Alert.alert('기간 연장', '100 MOUI를 사용하여 채팅을 7일 연장하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '연장', onPress: doExtendChat },
      ]);
    }
  }, [doExtendChat]);

  const otherName = otherUser?.name ?? otherUser?.username ?? '...';
  const headerName = otherName === '...' ? otherName : `${otherName}님`;
  const expiryLabel = expiresAt
    ? `${new Date(expiresAt).getMonth() + 1}/${new Date(expiresAt).getDate()}까지`
    : null;

  const AvatarBubble = ({ profile }: { profile: Profile | null }) =>
    profile?.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} style={styles.msgAvatar} />
    ) : (
      <View style={[styles.msgAvatar, styles.msgAvatarFallback, { backgroundColor: C.goldDim }]}>
        <Text style={{ fontSize: 14 }}>{profile?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
      </View>
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.innerContainer}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
        <Pressable
          onPress={() => router.replace('/chat' as any)}
          style={({ pressed }) => [
            styles.backBtn,
            { borderColor: C.border, backgroundColor: C.card },
            pressed && { opacity: 0.75 },
          ]}
          hitSlop={12}
        >
          <IconSymbol name="chevron.left" size={20} color={C.fg} />
        </Pressable>
        <Pressable
          style={styles.headerCenter}
          onPress={() => otherUser && router.push(`/artist/${otherUser.username}` as any)}
        >
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: C.goldDim }]}>
              <Text style={{ fontSize: 14 }}>{otherUser?.user_type === 'creator' ? '🎨' : '✏️'}</Text>
            </View>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: C.fg }]} numberOfLines={1}>
              {headerName}
            </Text>
            <Text style={[styles.headerSub, { color: C.muted }]} numberOfLines={1}>
              {expiryLabel ? `${expiryLabel} · 일대일 채팅` : '일대일 채팅'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {extended ? (
            <View style={[styles.extendedBadge, { borderColor: C.muted + '55', backgroundColor: C.card }]}>
              <Text style={[styles.endBtnText, { color: C.muted }]}>연장 완료</Text>
            </View>
          ) : !isExpired ? (
            <Pressable
              onPress={extendChat}
              disabled={extending}
              style={({ pressed }) => [
                styles.extendBtn,
                { borderColor: C.gold, backgroundColor: C.goldDim },
                (pressed || extending) && { opacity: 0.6 },
              ]}
              hitSlop={12}
            >
              <Text style={[styles.endBtnText, { color: C.gold }]}>
                {extending ? '...' : '기간 연장'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={endChat}
            style={({ pressed }) => [
              styles.endBtn,
              { borderColor: C.danger + '55', backgroundColor: C.danger + '10' },
              pressed && { opacity: 0.75 },
            ]}
            hitSlop={12}
          >
            <Text style={[styles.endBtnText, { color: C.danger }]}>채팅 종료</Text>
          </Pressable>
        </View>
      </View>

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
          const showAvatar = !isMe && prevMsg?.sender_id !== item.sender_id;

          return (
            <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
              {!isMe && (
                showAvatar ? (
                  <Pressable onPress={() => otherUser && router.push(`/artist/${otherUser.username}` as any)}>
                    <AvatarBubble profile={otherUser} />
                  </Pressable>
                ) : <View style={styles.msgAvatarSpacer} />
              )}
              <View style={[styles.msgBody, isMe && styles.msgBodyMe]}>
                {showAvatar && (
                  <Text style={[styles.senderName, { color: C.muted }]}>
                    {otherUser?.name ?? otherUser?.username ?? ''}
                  </Text>
                )}
                {isMe && prevMsg?.sender_id !== item.sender_id && (
                  <Text style={[styles.senderName, { color: C.muted, textAlign: 'right' }]}>
                    {myProfile?.name ?? myProfile?.username ?? ''}
                  </Text>
                )}
                {item.image_url ? (
                  <Pressable onPress={() => {/* could open full-screen */}}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={[
                        styles.msgImage,
                        isMe
                          ? { borderBottomRightRadius: 4 }
                          : { borderBottomLeftRadius: 4 },
                      ]}
                      resizeMode="cover"
                    />
                  </Pressable>
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
                <View style={[styles.msgTimeRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
                  {isMe && otherLastReadAt && item.created_at <= otherLastReadAt && (
                    <Text style={[styles.readReceipt, { color: C.gold }]}>읽음</Text>
                  )}
                  <Text style={[styles.msgTime, { color: C.mutedLight }]}>
                    {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              {isMe && (
                prevMsg?.sender_id !== item.sender_id ? (
                  <Pressable onPress={() => router.push(`/artist/${myProfile?.username}` as any)}>
                    <AvatarBubble profile={myProfile} />
                  </Pressable>
                ) : <View style={styles.msgAvatarSpacer} />
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
            ref={inputRef}
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
  root: {
    flex: 1,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  endBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  endBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200,169,110,0.28)',
  },
  headerAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
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
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
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
  msgAvatarSpacer: {
    width: 28,
  },
  msgBody: {
    maxWidth: '70%',
    gap: 2,
  },
  msgBodyMe: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
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
  msgTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msgTime: {
    fontSize: 10,
    marginHorizontal: 4,
  },
  readReceipt: {
    fontSize: 10,
    fontWeight: '600',
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
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  extendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  extendedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
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
});
