/** 모임 참가자 */
export type MouiParticipant = {
  user_id: string;
  profiles: {
    name: string | null;
    username: string;
    avatar_url: string | null;
    user_type: string;
  };
};

/** 모임 게시글 */
export type MouiPost = {
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

/** 채팅 프로필 */
export type ChatProfile = {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
  user_type: 'creator' | 'aspiring' | 'audience';
  verified: boolean;
  field: string | null;
  region: string | null;
};

/** 채팅 요청 행 */
export type ChatRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  expires_at: string | null;
  extended: boolean;
  sender_last_read_at: string | null;
  receiver_last_read_at: string | null;
  sender?: ChatProfile;
  receiver?: ChatProfile;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender_id?: string | null;
};

/** 모임 채팅 아이템 */
export type MouiChatItem = {
  id: string;
  title: string;
  category: string | null;
  last_message: string | null;
  last_message_at: string | null;
  participant_count: number;
  meeting_date: string | null;
  expires_at: string | null;
};

/** 알림 */
export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  from_user_id: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
  from_user?: { username: string; name: string | null; avatar_url: string | null } | null;
};
