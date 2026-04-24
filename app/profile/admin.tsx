import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, Alert, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type VerificationRequest = {
  id: string;
  user_id: string;
  image_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: { username: string; name: string | null; avatar_url: string | null };
};

type Tab = 'pending' | 'processed';

function showAlert(title: string, msg: string) {
  Platform.OS === 'web' ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors: C } = useThemeMode();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('verification_requests')
      .select('id, user_id, image_url, status, created_at, updated_at, profiles(username, name, avatar_url)')
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data);
    setLoading(false);
  }, []);

  const pendingList = requests.filter(r => r.status === 'pending');
  const processedList = requests.filter(r => r.status !== 'pending');
  const currentList = tab === 'pending' ? pendingList : processedList;

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    const { error } = await supabase.rpc('admin_approve_verification', { request_id: requestId });
    setProcessingId(null);
    if (error) {
      showAlert('오류', error.message);
    } else {
      showAlert('완료', '인증이 승인되었습니다.');
      fetchRequests();
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    const { error } = await supabase.rpc('admin_reject_verification', { request_id: requestId });
    setProcessingId(null);
    if (error) {
      showAlert('오류', error.message);
    } else {
      showAlert('완료', '인증이 반려되었습니다.');
      fetchRequests();
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      {/* 헤더 */}
      <Animated.View entering={FadeIn.duration(300)} style={s.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}>
          <Text style={[s.backText, { color: C.fg }]}>{'‹'}</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: C.fg }]}>관리자</Text>
        <View style={s.backBtn} />
      </Animated.View>

      {/* 탭 */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, tab === 'pending' && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
          onPress={() => setTab('pending')}
        >
          <Text style={[s.tabText, { color: tab === 'pending' ? C.fg : C.muted }]}>
            대기 중 ({pendingList.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, tab === 'processed' && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
          onPress={() => setTab('processed')}
        >
          <Text style={[s.tabText, { color: tab === 'processed' ? C.fg : C.muted }]}>
            처리 완료 ({processedList.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : currentList.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[s.emptyCard, { backgroundColor: C.card }]}>
            <Text style={[s.emptyText, { color: C.muted }]}>
              {tab === 'pending' ? '대기 중인 인증 요청이 없습니다.' : '처리된 내역이 없습니다.'}
            </Text>
          </Animated.View>
        ) : (
          currentList.map((req, idx) => {
            const profile = req.profiles;
            const isProcessing = processingId === req.id;
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            return (
              <Animated.View
                key={req.id}
                entering={FadeInDown.delay(80 + idx * 60).duration(400)}
                style={[s.card, { backgroundColor: C.card }]}
              >
                {/* 사용자 정보 */}
                <View style={s.userRow}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: C.border }]} />
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.userName, { color: C.fg }]}>{profile?.name || profile?.username}</Text>
                    <Text style={[s.userHandle, { color: C.muted }]}>@{profile?.username}</Text>
                  </View>
                  {isPending ? (
                    <Text style={[s.dateText, { color: C.muted }]}>
                      {new Date(req.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                  ) : (
                    <View style={[s.statusBadge, { backgroundColor: isApproved ? '#1a3a1a' : '#3a1a1a' }]}>
                      <Text style={[s.statusText, { color: isApproved ? '#4ade80' : '#f87171' }]}>
                        {isApproved ? '승인' : '반려'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 처리 일시 (처리 완료 탭) */}
                {!isPending && (
                  <Text style={[s.processedDate, { color: C.muted }]}>
                    처리: {new Date(req.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}

                {/* 제출 이미지 */}
                <Image source={{ uri: req.image_url }} style={s.requestImage} contentFit="contain" />

                {/* 버튼 (pending만) */}
                {isPending && (
                  <View style={s.btnRow}>
                    <Pressable
                      style={({ pressed }) => [s.btn, s.rejectBtn, { borderColor: C.danger }, pressed && { opacity: 0.7 }]}
                      onPress={() => handleReject(req.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color={C.danger} size="small" />
                      ) : (
                        <Text style={[s.btnText, { color: C.danger }]}>반려</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [s.btn, s.approveBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.7 }]}
                      onPress={() => handleApprove(req.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={[s.btnText, { color: '#fff' }]}>승인</Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, fontWeight: '300' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userName: { fontSize: 14, fontWeight: '700' },
  userHandle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  dateText: { fontSize: 11, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  processedDate: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 10,
  },
  requestImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: '#1a1a1a',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    borderWidth: 1.5,
  },
  approveBtn: {},
  btnText: { fontSize: 14, fontWeight: '800' },
});
