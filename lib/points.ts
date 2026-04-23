import { supabase } from '@/lib/supabase';

/**
 * 포인트 차감. 잔액 부족 시 에러 반환.
 * @returns { error: string | null } 성공 시 null
 */
export async function spendPoints(
  userId: string,
  amount: number,
  description: string,
): Promise<{ error: string | null }> {
  // 1. 현재 잔액 조회
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single();

  if (fetchErr || !profile) {
    return { error: '프로필 정보를 불러올 수 없습니다.' };
  }

  const currentPoints = profile.points ?? 0;
  if (currentPoints < amount) {
    return { error: `모의가 부족합니다. (보유: ${currentPoints}모의, 필요: ${amount}모의)` };
  }

  const newBalance = currentPoints - amount;

  // 2. 포인트 차감
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateErr) {
    return { error: '포인트 차감에 실패했습니다.' };
  }

  // 3. 내역 기록
  await (supabase as any).from('point_history').insert({
    user_id: userId,
    amount: -amount,
    balance: newBalance,
    type: 'spend',
    description,
  });

  return { error: null };
}
