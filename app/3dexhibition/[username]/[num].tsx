import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ExhibitionViewerContent } from '@/app/exhibition/[id]';

const C = { bg: '#191f28', gold: '#C8A96E', muted: '#8b95a1' };

export default function ExhibitionByUsername() {
  const { username, num } = useLocalSearchParams<{ username: string; num: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [exhibitionId, setExhibitionId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !num) return;
    (async () => {
      // Resolve username → user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
      if (!profile) { setNotFound(true); return; }

      // Fetch nth exhibition (1-based, ordered by created_at)
      const idx = parseInt(num, 10);
      if (isNaN(idx) || idx < 1) { setNotFound(true); return; }

      const { data: exhibitions } = await supabase
        .from('exhibitions')
        .select('id')
        .eq('user_id', profile.id)
        .eq('is_published', true)
        .order('created_at', { ascending: true })
        .range(idx - 1, idx - 1);

      if (!exhibitions || exhibitions.length === 0) { setNotFound(true); return; }
      setExhibitionId(exhibitions[0].id);
    })();
  }, [username, num]);

  if (notFound) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.text}>전시관을 찾을 수 없습니다</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.gold }}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if (!exhibitionId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={styles.diamond} />
        <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 20 }} />
        <Text style={styles.text}>전시관 입장 중...</Text>
      </View>
    );
  }

  return <ExhibitionViewerContent exhibitionId={exhibitionId} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  diamond: { width: 14, height: 14, borderWidth: 1.5, borderColor: C.gold, transform: [{ rotate: '45deg' }] },
  text: { color: C.muted, fontSize: 13, letterSpacing: 1, marginTop: 16 },
});
