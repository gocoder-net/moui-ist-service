import { supabase } from './supabase';

export async function sendNotification({
  userId,
  type,
  title,
  body,
  fromUserId,
  targetId,
}: {
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'chat_request' | 'chat_accepted' | 'moui_join';
  title: string;
  body?: string;
  fromUserId?: string;
  targetId?: string;
}) {
  // Don't notify yourself
  if (fromUserId && fromUserId === userId) return;

  await (supabase as any).from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    from_user_id: fromUserId ?? null,
    target_id: targetId ?? null,
  });
}
