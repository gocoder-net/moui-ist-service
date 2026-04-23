import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, ActivityIndicator,
  TextInput, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type MouiPost = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  fields: string | null;
  status: 'open' | 'closed';
  created_at: string;
  profiles?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    field: string | null;
  };
};

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

export default function MouiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors: C } = useThemeMode();

  const [posts, setPosts] = useState<MouiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFields, setFormFields] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = async () => {
    const { data } = await (supabase as any)
      .from('moui_posts')
      .select('*, profiles(name, username, avatar_url, field)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchPosts(); }, []));

  const handleSubmit = async () => {
    if (!user) return;
    if (!formTitle.trim()) { showAlert('알림', '제목을 입력해주세요.'); return; }
    if (!formDesc.trim()) { showAlert('알림', '내용을 입력해주세요.'); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from('moui_posts').insert({
      user_id: user.id,
      title: formTitle.trim(),
      description: formDesc.trim(),
      fields: formFields.trim() || null,
      status: 'open',
    });
    if (error) {
      showAlert('오류', '게시 실패: ' + error.message);
    } else {
      setFormTitle('');
      setFormDesc('');
      setFormFields('');
      setShowForm(false);
      fetchPosts();
    }
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const renderPost = ({ item, index }: { item: MouiPost; index: number }) => {
    const author = item.profiles;
    const isOwner = item.user_id === user?.id;
    const isClosed = item.status === 'closed';

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <View style={[styles.postCard, { backgroundColor: C.card }, isClosed && { opacity: 0.5 }]}>
          {/* 작성자 */}
          <View style={styles.postHeader}>
            <View style={[styles.postAvatar, { backgroundColor: C.bg }]}>
              {author?.avatar_url ? (
                <Image source={{ uri: author.avatar_url }} style={styles.postAvatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.postAvatarEmoji}>👤</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.postAuthor, { color: C.fg }]}>{author?.name ?? '회원'}</Text>
              <Text style={[styles.postAuthorSub, { color: C.mutedLight }]}>
                @{author?.username}{author?.field ? ` · ${author.field}` : ''}
              </Text>
            </View>
            <Text style={[styles.postTime, { color: C.mutedLight }]}>{formatDate(item.created_at)}</Text>
          </View>

          {/* 본문 */}
          <Text style={[styles.postTitle, { color: C.fg }]}>{item.title}</Text>
          <Text style={[styles.postDesc, { color: C.muted }]} numberOfLines={4}>{item.description}</Text>

          {/* 분야 태그 */}
          {item.fields && (
            <View style={styles.postTagRow}>
              {item.fields.split(',').map(f => (
                <View key={f.trim()} style={[styles.postTag, { backgroundColor: C.gold + '22', borderColor: C.gold }]}>
                  <Text style={[styles.postTagText, { color: C.gold }]}>{f.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 상태 */}
          <View style={styles.postFooter}>
            <View style={[styles.statusBadge, { backgroundColor: isClosed ? C.danger + '22' : '#22c55e22' }]}>
              <Text style={[styles.statusText, { color: isClosed ? C.danger : '#22c55e' }]}>
                {isClosed ? '마감' : '모집 중'}
              </Text>
            </View>
            {isOwner && !isClosed && (
              <Pressable
                onPress={async () => {
                  await (supabase as any).from('moui_posts').update({ status: 'closed' }).eq('id', item.id);
                  fetchPosts();
                }}
                style={({ pressed }) => [styles.closeBtn, { borderColor: C.border }, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.closeBtnText, { color: C.muted }]}>마감하기</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.delay(50).duration(200)} style={[styles.header, { borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: C.fg }]}>작당모의</Text>
        <Pressable
          onPress={() => {
            if (!user) { showAlert('알림', '로그인이 필요합니다.'); return; }
            setShowForm(!showForm);
          }}
          style={({ pressed }) => [styles.headerBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.headerBtnText, { color: C.bg }]}>{showForm ? '취소' : '+ 모집'}</Text>
        </Pressable>
      </Animated.View>

      {/* 작성 폼 */}
      {showForm && (
        <Animated.View entering={FadeInDown.duration(300).springify()} style={[styles.formCard, { backgroundColor: C.card }]}>
          <Text style={[styles.formLabel, { color: C.muted }]}>제목</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="어떤 협업을 찾고 계신가요?"
            placeholderTextColor={C.mutedLight}
          />

          <Text style={[styles.formLabel, { color: C.muted }]}>상세 내용</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
            value={formDesc}
            onChangeText={setFormDesc}
            placeholder="프로젝트 설명, 원하는 역할, 일정 등을 적어주세요"
            placeholderTextColor={C.mutedLight}
            multiline
            textAlignVertical="top"
          />

          <Text style={[styles.formLabel, { color: C.muted }]}>찾는 분야 (선택)</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: C.bg, borderColor: C.border, color: C.fg }]}
            value={formFields}
            onChangeText={setFormFields}
            placeholder="예: 그림, 소리"
            placeholderTextColor={C.mutedLight}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [styles.formSubmitBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }, submitting && { opacity: 0.5 }]}
          >
            <Text style={[styles.formSubmitText, { color: C.bg }]}>{submitting ? '게시 중...' : '게시하기'}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* 게시물 리스트 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: C.fg }]}>아직 작당모의가 없어요</Text>
          <Text style={[styles.emptyDesc, { color: C.muted }]}>첫 번째 모의를 작당해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* 폼 */
  formCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  formTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  formSubmitBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  formSubmitText: {
    fontSize: 15,
    fontWeight: '800',
  },

  /* 리스트 */
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 4,
  },

  /* 게시물 카드 */
  postCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  postAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postAvatarEmoji: { fontSize: 18 },
  postAuthor: {
    fontSize: 14,
    fontWeight: '700',
  },
  postAuthorSub: {
    fontSize: 11,
  },
  postTime: {
    fontSize: 11,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  postDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  postTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
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
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  closeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
