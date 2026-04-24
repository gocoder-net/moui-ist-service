export const MOUI_CATEGORIES = [
  { key: 'social',      icon: '🍻', label: '친목·네트워킹' },
  { key: 'collab',      icon: '🤝', label: '협업' },
  { key: 'exhibition',  icon: '🖼️', label: '전시·아트페어 방문' },
  { key: 'critique',    icon: '💬', label: '크리틱·피드백' },
  { key: 'study',       icon: '📖', label: '스터디·작업모임' },
  { key: 'competition', icon: '🏆', label: '전시 준비·공모' },
  { key: 'etc',         icon: '📌', label: '기타' },
] as const;

export const MOUI_POST_COST = 10;

export const FIELD_OPTIONS = [
  { key: '글',                icon: '✍️' },
  { key: '그림',              icon: '🎨' },
  { key: '영상',              icon: '🎬' },
  { key: '소리',              icon: '🎵' },
  { key: '사진',              icon: '📷' },
  { key: '입체/공간',         icon: '🗿' },
  { key: '디지털/인터랙티브', icon: '💻' },
  { key: '공연',              icon: '🎭' },
] as const;

/** 1차 모집 대상 */
export const TARGET_TOP = [
  { key: 'creator',  icon: '🎨', label: '작가' },
  { key: 'aspiring', icon: '✏️', label: '지망생' },
  { key: 'audience', icon: '👀', label: '일반' },
] as const;

/** 작가 세부 옵션 */
export const TARGET_CREATOR_SUB = [
  { key: 'verified',   icon: '✅', label: '인증 작가' },
  { key: 'unverified', icon: '🎨', label: '미인증 작가' },
] as const;

/** 전체 대상 (카드 표시용 — key로 라벨/아이콘 조회) */
export const TARGET_OPTIONS = [
  { key: 'verified',   icon: '✅', label: '인증 작가' },
  { key: 'unverified', icon: '🎨', label: '미인증 작가' },
  { key: 'aspiring',   icon: '✏️', label: '지망생' },
  { key: 'audience',   icon: '👀', label: '일반' },
] as const;
