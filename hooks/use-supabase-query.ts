import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { showAlert } from '@/lib/utils';

/**
 * 모든 화면에서 반복되는 Supabase 데이터 패칭 패턴을 캡슐화하는 훅.
 *
 * - `deps` 중 하나라도 falsy면 fetch를 스킵 (user?.id 대기 등)
 * - `useFocusEffect`로 화면 포커스 시 자동 리페치
 * - try/catch + 선택적 에러 알림
 */
export function useSupabaseQuery<T>(
  fetcher: () => Promise<T | null | undefined>,
  initialData: T,
  deps: unknown[],
  options?: { refreshOnFocus?: boolean; showError?: boolean },
): { data: T; loading: boolean; refetch: () => Promise<void> } {
  const { refreshOnFocus = true, showError = true } = options ?? {};
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    // deps 중 하나라도 falsy이면 스킵
    if (deps.some(d => !d)) return;
    setLoading(true);
    try {
      const result = await fetcher();
      if (mountedRef.current && result != null) {
        setData(result);
      }
    } catch (err) {
      if (showError) {
        showAlert('오류', '데이터를 불러오는데 실패했습니다.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      if (refreshOnFocus) refetch();
      return () => { mountedRef.current = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetch, refreshOnFocus]),
  );

  return { data, loading, refetch };
}
