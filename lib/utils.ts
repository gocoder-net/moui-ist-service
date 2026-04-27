import { Platform, Alert } from 'react-native';
import { parseRegion } from '@/constants/regions';

/** 상대 시간 표시 (예: "방금", "3분 전", "2시간 전") */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}달 전`;
}

/** 크로스 플랫폼 alert (web → window.alert, native → Alert.alert) */
export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

/** 크로스 플랫폼 confirm (web → window.confirm, native → Alert with 취소/삭제) */
export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

/** 지역 라벨 축약 (예: "서울특별시 강남구" → "서울시 강남구") */
export function formatRegionLabel(region: string | null | undefined) {
  const parsed = parseRegion(region);
  if (!parsed) return region?.trim() ?? '';
  const compactProvince = parsed.province
    .replace('특별시', '시')
    .replace('광역시', '시')
    .replace('특별자치시', '시')
    .replace('특별자치도', '도');
  return `${compactProvince} ${parsed.district}`;
}

/** SNS URL에서 서비스 타입 감지 */
export function detectSnsType(url: string): { key: string; icon: string; label: string } {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am'))
    return { key: 'instagram', icon: '📸', label: 'Instagram' };
  if (lower.includes('threads.net'))
    return { key: 'threads', icon: '🧵', label: 'Threads' };
  if (lower.includes('twitter.com') || lower.includes('x.com'))
    return { key: 'twitter', icon: '🐦', label: 'X (Twitter)' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be'))
    return { key: 'youtube', icon: '🎬', label: 'YouTube' };
  if (lower.includes('tiktok.com'))
    return { key: 'tiktok', icon: '🎵', label: 'TikTok' };
  if (lower.includes('facebook.com') || lower.includes('fb.com'))
    return { key: 'facebook', icon: '👥', label: 'Facebook' };
  if (lower.includes('linkedin.com'))
    return { key: 'linkedin', icon: '💼', label: 'LinkedIn' };
  if (lower.includes('behance.net'))
    return { key: 'behance', icon: '🎨', label: 'Behance' };
  if (lower.includes('dribbble.com'))
    return { key: 'dribbble', icon: '🏀', label: 'Dribbble' };
  if (lower.includes('artstation.com'))
    return { key: 'artstation', icon: '🖼️', label: 'ArtStation' };
  if (lower.includes('pixiv.net'))
    return { key: 'pixiv', icon: '🖌️', label: 'Pixiv' };
  if (lower.includes('github.com'))
    return { key: 'github', icon: '💻', label: 'GitHub' };
  if (lower.includes('notion.so') || lower.includes('notion.site'))
    return { key: 'notion', icon: '🗂️', label: 'Notion' };
  if (lower.includes('blog.naver.com'))
    return { key: 'blog', icon: '📝', label: '네이버 블로그' };
  if (lower.includes('brunch.co.kr'))
    return { key: 'blog', icon: '🍞', label: '브런치' };
  if (lower.includes('tistory.com'))
    return { key: 'blog', icon: '📔', label: '티스토리' };
  if (lower.includes('medium.com'))
    return { key: 'blog', icon: '✒️', label: 'Medium' };
  if (lower.includes('soundcloud.com'))
    return { key: 'soundcloud', icon: '🔊', label: 'SoundCloud' };
  if (lower.includes('spotify.com'))
    return { key: 'spotify', icon: '🎧', label: 'Spotify' };
  if (lower.includes('bandcamp.com'))
    return { key: 'bandcamp', icon: '💿', label: 'Bandcamp' };
  if (lower.includes('vimeo.com'))
    return { key: 'vimeo', icon: '🎞️', label: 'Vimeo' };
  return { key: 'website', icon: '🌐', label: '웹사이트' };
}

/** 오늘 날짜를 YYYY-MM-DD 문자열로 반환 */
export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 오늘 날짜를 자정 Date 객체로 반환 */
export function getTodayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 어제 날짜를 YYYY-MM-DD 문자열로 반환 */
export function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 모집 기간 포맷 (예: "4/1 ~ 4/15") */
export function formatRecruitPeriod(start: string | null, end: string | null) {
  if (!end) return null;
  const fmt = (s: string) => {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  if (start) return `${fmt(start)} ~ ${fmt(end)}`;
  return `~ ${fmt(end)}`;
}

/** 만남 날짜 포맷 (예: "4/15(화) 14:00") */
export function formatMeetingDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[d.getDay()];
  if (hour === 0 && minute === 0) {
    return `${month}/${day}(${weekday})`;
  }
  return `${month}/${day}(${weekday}) ${hour}:${String(minute).padStart(2, '0')}`;
}
