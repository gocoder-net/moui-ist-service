import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Profile = {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
};

export default function ChatRoomScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeMode();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Load chat data
  useEffect(() => {
    if (!requestId || !user?.id) return;

    const load = async () => {
      // Get request to find other user
      const { data: req } = await supabase
        .from('chat_requests')
        .select('*, sender:profiles!chat_requests_sender_id_fkey(id, name, username, avatar_url), receiver:profiles!chat_requests_receiver_id_fkey(id, name, username, avatar_url)')
        .eq('id', requestId)
        .single();

      if (req) {
        const other = req.sender_id === user.id ? (req as any).receiver : (req as any).sender;
        setOtherUser(other);
      }

      // Get messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      setMessages(msgs ?? []);
      setLoading(false);
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
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !user?.id || !requestId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const { error } = await supabase.from('chat_messages').insert({
      request_id: requestId,
      sender_id: user.id,
      content: text,
    });

    setSending(false);
    if (error) {
      setInputText(text);
    }
  }, [inputText, user?.id, requestId, sending]);

  const otherName = otherUser?.name ?? otherUser?.username ?? '...';

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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <IconSymbol name="chevron.left" size={20} color={C.fg} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.fg }]} numberOfLines={1}>{otherName}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id;
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              <View style={[
                styles.msgBubble,
                isMe
                  ? { backgroundColor: C.gold }
                  : { backgroundColor: C.card },
              ]}>
                <Text style={[styles.msgText, { color: isMe ? C.bg : C.fg }]}>{item.content}</Text>
              </View>
              <Text style={[styles.msgTime, { color: C.mutedLight }]}>
                {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
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
          onSubmitEditing={sendMessage}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  msgRow: {
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 4,
  },
  msgRowMe: {
    alignItems: 'flex-end',
  },
  msgBubble: {
    maxWidth: '75%',
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
