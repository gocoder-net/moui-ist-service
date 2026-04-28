import type { IconName } from '@/components/ui/icon-registry';

type AppTabItem = {
  tabName: string;
  path: string;
  icon: IconName;
  label: string;
};

export const APP_TAB_ITEMS = [
  {
    tabName: 'index',
    path: '/(tabs)',
    icon: 'house',
    label: '홈',
  },
  {
    tabName: 'moui',
    path: '/(tabs)/moui',
    icon: 'handshake',
    label: '모임',
  },
  {
    tabName: 'explore',
    path: '/(tabs)/explore',
    icon: 'image',
    label: '작품구경',
  },
  {
    tabName: 'chat',
    path: '/(tabs)/chat',
    icon: 'chat-circle',
    label: '작당모의',
  },
  {
    tabName: 'profile',
    path: '/(tabs)/profile',
    icon: 'user',
    label: '내 정보',
  },
] as const satisfies readonly AppTabItem[];
