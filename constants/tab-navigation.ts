export const APP_TAB_ITEMS = [
  {
    tabName: 'index',
    path: '/(tabs)',
    icon: 'house.fill' as const,
    label: '홈',
  },
  {
    tabName: 'moui',
    path: '/(tabs)/moui',
    icon: 'bubble.left.and.bubble.right.fill' as const,
    label: '모임',
  },
  {
    tabName: 'explore',
    path: '/(tabs)/explore',
    icon: 'photo.fill' as const,
    label: '작품구경',
  },
  {
    tabName: 'chat',
    path: '/(tabs)/chat',
    icon: 'chat.fill' as const,
    label: '작당모의',
  },
  {
    tabName: 'profile',
    path: '/(tabs)/profile',
    icon: 'person.fill' as const,
    label: '내 정보',
  },
] as const;
