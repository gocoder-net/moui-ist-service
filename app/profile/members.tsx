import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, TextInput,
  Platform, Alert, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type Member = {
  id: string;
  username: string;
  name: string | null;
  real_name: string | null;
  user_type: 'creator' | 'aspiring' | 'audience';
  verified: boolean;
  avatar_url: string | null;
  region: string | null;
  field: string | null;
  points: number;
  created_at: string;
};

const USER_TYPE_LABEL: Record<string, string> = {
  creator: '작가',
  aspiring: '지망생',
  audience: '일반',
};

function getMemberTypeLabel(m: Member) {
  if (m.user_type === 'creator') return m.verified ? '작가 인증' : '작가 인증 전';
  return USER_TYPE_LABEL[m.user_type] ?? m.user_type;
}

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useThemeMode();

  const isAdmin = profile?.username === 'gocoder';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, name, real_name, user_type, verified, avatar_url, region, field, points, created_at')
      .order('created_at', { ascending: false });
    if (data) setMembers(data as Member[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) { router.back(); return; }
    fetchMembers();
  }, []);

  const filtered = search.trim()
    ? members.filter(m => {
        const q = search.trim().toLowerCase();
        return m.username.toLowerCase().includes(q)
          || m.name?.toLowerCase().includes(q)
          || m.real_name?.toLowerCase().includes(q);
      })
    : members;

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUserType, setEditUserType] = useState<string>('audience');
  const [editPoints, setEditPoints] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editVerified, setEditVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEdit = (m: Member) => {
    setEditMember(m);
    setEditName(m.name ?? '');
    setEditUsername(m.username);
    setEditUserType(m.user_type);
    setEditPoints(String(m.points));
    setEditRegion(m.region ?? '');
    setEditVerified(m.verified);
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_member', {
      target_user_id: editMember.id,
      new_username: editUsername.trim(),
      new_name: editName.trim() || null,
      new_user_type: editUserType,
      new_verified: editVerified,
      new_points: parseInt(editPoints) || 0,
      new_region: editRegion.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (Platform.OS === 'web') window.alert('수정 실패: ' + error.message);
      else Alert.alert('오류', '수정 실패: ' + error.message);
    } else {
      setEditMember(null);
      fetchMembers();
    }
  };

  /** 스토리지 버킷에서 유저 폴더 전체 삭제 */
  const clearBucket = async (bucket: string, userId: string) => {
    const { data: files } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map(f => `${userId}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    }
    // avatars 서브폴더 (artworks 버킷 안에 avatars/{userId}/)
    if (bucket === 'artworks') {
      const { data: avatarFiles } = await supabase.storage.from(bucket).list(`avatars/${userId}`, { limit: 1000 });
      if (avatarFiles && avatarFiles.length > 0) {
        const paths = avatarFiles.map(f => `avatars/${userId}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    }
  };

  const handleDeleteMember = (member: Member) => {
    if (member.username === 'gocoder') return; // 자기 자신은 삭제 불가

    const msg = `"${member.username}" 회원을 삭제하시겠습니까?\n\n모든 데이터(작품, 전시관, 모임, 채팅, 포인트 등)가 영구 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`;

    const doDelete = async () => {
      setDeletingId(member.id);
      try {
        // 1. 스토리지 파일 삭제 (RLS 우회 불가하므로 가능한 만큼 삭제)
        await Promise.all([
          clearBucket('artworks', member.id),
          clearBucket('bgm', member.id),
          clearBucket('chat-images', member.id),
        ]);

        // 2. DB 삭제 (RPC로 RLS 우회)
        const { error } = await supabase.rpc('admin_delete_member', { target_user_id: member.id });
        if (error) throw error;

        if (Platform.OS === 'web') window.alert('회원이 삭제되었습니다.');
        else Alert.alert('완료', '회원이 삭제되었습니다.');
        fetchMembers();
      } catch (err: any) {
        const errMsg = err?.message ?? '알 수 없는 오류';
        if (Platform.OS === 'web') window.alert('삭제 실패: ' + errMsg);
        else Alert.alert('오류', '삭제 실패: ' + errMsg);
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      doDelete();
    } else {
      Alert.alert('회원 삭제', msg, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: C.bg }]}>
      <View style={styles.innerContainer}>
        {/* 헤더 */}
        <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.fg }]}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.fg }]}>회원 리스트 ({members.length})</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* 검색 */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: search ? C.gold + '88' : C.border }]}>
            <Text style={{ color: C.muted, marginRight: 6 }}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="이름, 유저네임 검색"
              placeholderTextColor={C.muted}
              style={{ flex: 1, color: C.fg, fontSize: 13 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map((m, i) => (
              <Animated.View
                key={m.id}
                entering={FadeInDown.delay(50 + i * 30).duration(300).springify()}
                style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
              >
                <View style={styles.cardRow}>
                  {/* 아바타 */}
                  {m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 16 }}>👤</Text>
                    </View>
                  )}
                  {/* 정보 */}
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.username, { color: C.fg }]}>{m.username}</Text>
                      <View style={[styles.typeBadge, {
                        backgroundColor: m.user_type === 'creator' && m.verified ? C.gold + '22'
                          : m.user_type === 'creator' ? C.danger + '18'
                          : C.border,
                      }]}>
                        <Text style={[styles.typeText, {
                          color: m.user_type === 'creator' && m.verified ? C.gold
                            : m.user_type === 'creator' ? C.danger
                            : C.muted,
                        }]}>{getMemberTypeLabel(m)}</Text>
                      </View>
                    </View>
                    {(m.name || m.real_name) && (
                      <Text style={[styles.realName, { color: C.muted }]}>
                        {m.name}{m.real_name ? ` (${m.real_name})` : ''}
                      </Text>
                    )}
                    <View style={styles.metaRow}>
                      {m.region && <Text style={[styles.meta, { color: C.mutedLight }]}>📍 {m.region}</Text>}
                      {m.field && <Text style={[styles.meta, { color: C.mutedLight }]}>🎨 {m.field}</Text>}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, { color: C.mutedLight }]}>💰 {m.points.toLocaleString()} MOUI</Text>
                      <Text style={[styles.meta, { color: C.mutedLight }]}>가입 {formatDate(m.created_at)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => openEdit(m)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { borderColor: C.border, flex: 1 },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={{ color: C.fg, fontSize: 12, fontWeight: '700' }}>수정</Text>
                  </Pressable>
                  {m.username !== 'gocoder' && (
                    <Pressable
                      onPress={() => handleDeleteMember(m)}
                      disabled={deletingId === m.id}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { borderColor: C.danger + '44', flex: 1 },
                        pressed && { opacity: 0.6 },
                        deletingId === m.id && { opacity: 0.4 },
                      ]}
                    >
                      {deletingId === m.id ? (
                        <ActivityIndicator size="small" color={C.danger} />
                      ) : (
                        <Text style={{ color: C.danger, fontSize: 12, fontWeight: '700' }}>삭제</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            ))}
            {filtered.length === 0 && !loading && (
              <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                {search ? '검색 결과가 없습니다' : '회원이 없습니다'}
              </Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
        {/* 수정 모달 */}
        <Modal visible={!!editMember} transparent animationType="fade" onRequestClose={() => setEditMember(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditMember(null)}>
            <Pressable style={[styles.modalContent, { backgroundColor: C.bg }]} onPress={e => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: C.fg }]}>회원 수정</Text>
              <Text style={[styles.modalLabel, { color: C.muted }]}>유저네임</Text>
              <TextInput
                value={editUsername}
                onChangeText={setEditUsername}
                style={[styles.modalInput, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              />
              <Text style={[styles.modalLabel, { color: C.muted }]}>이름</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.modalInput, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
                placeholder="표시 이름"
                placeholderTextColor={C.mutedLight}
              />
              <Text style={[styles.modalLabel, { color: C.muted }]}>유형</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {(['creator', 'aspiring', 'audience'] as const).map(t => (
                  <Pressable
                    key={t}
                    onPress={() => setEditUserType(t)}
                    style={[
                      styles.typeChip,
                      { borderColor: editUserType === t ? C.gold : C.border, backgroundColor: editUserType === t ? C.gold + '22' : C.card },
                    ]}
                  >
                    <Text style={{ color: editUserType === t ? C.gold : C.muted, fontSize: 11, fontWeight: '700' }}>
                      {USER_TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {editUserType === 'creator' && (
                <>
                  <Text style={[styles.modalLabel, { color: C.muted }]}>작가 인증</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    <Pressable
                      onPress={() => setEditVerified(true)}
                      style={[styles.typeChip, { borderColor: editVerified ? '#22c55e' : C.border, backgroundColor: editVerified ? '#22c55e22' : C.card }]}
                    >
                      <Text style={{ color: editVerified ? '#22c55e' : C.muted, fontSize: 11, fontWeight: '700' }}>✅ 인증</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditVerified(false)}
                      style={[styles.typeChip, { borderColor: !editVerified ? C.danger : C.border, backgroundColor: !editVerified ? C.danger + '18' : C.card }]}
                    >
                      <Text style={{ color: !editVerified ? C.danger : C.muted, fontSize: 11, fontWeight: '700' }}>❌ 인증 전</Text>
                    </Pressable>
                  </View>
                </>
              )}
              <Text style={[styles.modalLabel, { color: C.muted }]}>포인트</Text>
              <TextInput
                value={editPoints}
                onChangeText={setEditPoints}
                keyboardType="numeric"
                style={[styles.modalInput, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
              />
              <Text style={[styles.modalLabel, { color: C.muted }]}>지역</Text>
              <TextInput
                value={editRegion}
                onChangeText={setEditRegion}
                style={[styles.modalInput, { backgroundColor: C.card, borderColor: C.border, color: C.fg }]}
                placeholder="서울특별시 마포구"
                placeholderTextColor={C.mutedLight}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => setEditMember(null)}
                  style={[styles.modalBtn, { borderColor: C.border, flex: 1 }]}
                >
                  <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  disabled={saving}
                  style={[styles.modalBtn, { backgroundColor: C.gold, borderColor: C.gold, flex: 1, opacity: saving ? 0.5 : 1 }]}
                >
                  <Text style={{ color: C.bg, fontSize: 13, fontWeight: '700' }}>{saving ? '저장 중...' : '저장'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  realName: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 320,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
