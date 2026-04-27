/* ── 작품 업로드 폼 타입 & 필드 정의 ── */

export type FormType = 'visual' | 'writing' | 'video' | 'audio' | 'performance';

/** 세부 분야 → 폼 타입 매핑 */
const SUB_FIELD_TO_FORM: Record<string, FormType> = {
  // visual
  '회화': 'visual',
  '일러스트': 'visual',
  '웹툰/만화': 'visual',
  '캘리그래피': 'visual',
  '판화': 'visual',
  '그래픽디자인': 'visual',
  '순수사진': 'visual',
  '상업사진': 'visual',
  '다큐멘터리사진': 'visual',
  '조각': 'visual',
  '도예/세라믹': 'visual',
  '설치미술': 'visual',
  '건축': 'visual',
  '공예': 'visual',
  '미디어아트': 'visual',
  'AI아트': 'visual',
  '제너레이티브': 'visual',
  '웹아트': 'visual',
  // writing
  '소설': 'writing',
  '시': 'writing',
  '에세이': 'writing',
  '웹소설': 'writing',
  '극본': 'writing',
  '평론': 'writing',
  '번역': 'writing',
  '칼럼': 'writing',
  // video
  '영화': 'video',
  '애니메이션': 'video',
  '다큐멘터리': 'video',
  '뮤직비디오': 'video',
  '숏폼': 'video',
  // audio
  '작곡': 'audio',
  '연주': 'audio',
  '보컬': 'audio',
  '프로듀싱': 'audio',
  '사운드아트': 'audio',
  'DJ': 'audio',
  // performance
  '연극': 'performance',
  '무용': 'performance',
  '뮤지컬': 'performance',
  '퍼포먼스': 'performance',
};

/** 세부 분야 텍스트로 폼 타입 결정 (기본 visual) */
export function getFormType(subField: string | null | undefined): FormType {
  if (!subField) return 'visual';
  return SUB_FIELD_TO_FORM[subField] ?? 'visual';
}

/** 폼 타입별 한글 라벨 */
export const FORM_TYPE_LABEL: Record<FormType, string> = {
  visual: '시각예술',
  writing: '글',
  video: '영상',
  audio: '소리',
  performance: '공연',
};

/** 폼 타입별 "제작연도" 라벨 & placeholder */
export const YEAR_FIELD_LABEL: Record<FormType, { label: string; placeholder: string }> = {
  visual: { label: '제작연도', placeholder: '예: 2024' },
  writing: { label: '발표연도', placeholder: '예: 2024' },
  video: { label: '제작연도', placeholder: '예: 2024' },
  audio: { label: '제작연도', placeholder: '예: 2024' },
  performance: { label: '공연연도', placeholder: '예: 2024' },
};

/** 메타데이터 필드 정의 */
export interface MetaFieldDef {
  key: string;
  label: string;
  placeholder: string;
  keyboard?: 'default' | 'number-pad' | 'decimal-pad' | 'url';
  required?: boolean;
  /** 이 필드가 특정 세부분야에서만 표시되도록 제한 (미설정 시 항상 표시) */
  onlyFor?: string[];
}

// ── 세부분야 그룹 (가독성용) ──
const V_PHYSICAL = ['회화', '일러스트', '캘리그래피', '판화', '조각', '도예/세라믹', '설치미술', '건축', '공예'];
const V_PHOTO = ['순수사진', '상업사진', '다큐멘터리사진'];
const V_DIGITAL = ['미디어아트', 'AI아트', '제너레이티브', '웹아트', '그래픽디자인'];
const V_EDITION = ['회화', '일러스트', '판화', '순수사진', '상업사진', '다큐멘터리사진'];
const W_HAS_GENRE = ['소설', '웹소설', '극본'];
const W_HAS_PAGES = ['소설', '시', '웹소설', '극본', '번역', '에세이'];
const W_HAS_EDITION = ['소설', '시'];
const W_HAS_PUBLISHER = ['소설', '시', '에세이', '웹소설', '극본', '평론', '번역'];

/** 폼 타입별 메타데이터 필드 */
export const FORM_META_FIELDS: Record<FormType, MetaFieldDef[]> = {
  visual: [
    // 물리적 작품 필드
    { key: 'medium', label: '재료', placeholder: '예: 캔버스에 유채', onlyFor: V_PHYSICAL },
    { key: 'technique', label: '기법', placeholder: '예: 임파스토, 글레이징', onlyFor: V_PHYSICAL },
    { key: 'width_cm', label: '가로 (cm)', placeholder: '가로 (cm)', keyboard: 'decimal-pad', onlyFor: [...V_PHYSICAL, ...V_PHOTO] },
    { key: 'height_cm', label: '세로 (cm)', placeholder: '세로 (cm)', keyboard: 'decimal-pad', onlyFor: [...V_PHYSICAL, ...V_PHOTO] },
    { key: 'edition', label: '에디션', placeholder: '예: 1/10', onlyFor: V_EDITION },
    // 디지털/웹 링크
    { key: 'link', label: '웹툰 링크', placeholder: 'https://...', keyboard: 'url', required: true, onlyFor: ['웹툰/만화'] },
    { key: 'link', label: '작품 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: V_DIGITAL },
  ],
  writing: [
    { key: 'genre', label: '장르', placeholder: '예: SF, 판타지, 순문학', onlyFor: W_HAS_GENRE },
    { key: 'publisher', label: '출판사/플랫폼', placeholder: '예: 문학동네, 네이버시리즈', onlyFor: W_HAS_PUBLISHER },
    { key: 'page_count', label: '분량/페이지', placeholder: '예: 320p', keyboard: 'number-pad', onlyFor: W_HAS_PAGES },
    { key: 'edition', label: '에디션', placeholder: '예: 초판, 개정판', onlyFor: W_HAS_EDITION },
    // 링크: 세부분야별 맞춤 이름
    { key: 'link', label: '웹소설 링크', placeholder: 'https://...', keyboard: 'url', required: true, onlyFor: ['웹소설'] },
    { key: 'link', label: '칼럼 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['칼럼'] },
    { key: 'link', label: '평론 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['평론'] },
    { key: 'link', label: '작품 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['소설', '시', '에세이', '극본', '번역'] },
  ],
  video: [
    { key: 'genre', label: '장르', placeholder: '예: 드라마, 실험영화' },
    { key: 'duration', label: '러닝타임', placeholder: '예: 15분 30초' },
    { key: 'role', label: '역할', placeholder: '예: 감독, 촬영, 편집' },
    { key: 'link', label: '영상 링크', placeholder: 'https://...', keyboard: 'url', required: true },
  ],
  audio: [
    { key: 'genre', label: '장르', placeholder: '예: 앰비언트, 클래식' },
    { key: 'duration', label: '러닝타임', placeholder: '예: 4분 30초' },
    { key: 'instruments', label: '악기/도구', placeholder: '예: 피아노, Ableton' },
    { key: 'link', label: '음원 링크', placeholder: 'https://...', keyboard: 'url', required: true },
  ],
  performance: [
    { key: 'genre', label: '장르', placeholder: '예: 현대무용, 실험극' },
    { key: 'duration', label: '러닝타임', placeholder: '예: 1시간 30분' },
    { key: 'role', label: '역할', placeholder: '예: 연출, 배우' },
    { key: 'venue', label: '공연장', placeholder: '예: 대학로 소극장' },
    // 세부분야별 맞춤 링크 이름
    { key: 'link', label: '연극 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['연극'] },
    { key: 'link', label: '무용 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['무용'] },
    { key: 'link', label: '뮤지컬 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['뮤지컬'] },
    { key: 'link', label: '퍼포먼스 링크', placeholder: 'https://...', keyboard: 'url', onlyFor: ['퍼포먼스'] },
  ],
};

/** 메타데이터 key → 한글 라벨 (전시용) */
export const META_KEY_LABEL: Record<string, string> = {
  medium: '재료',
  technique: '기법',
  width_cm: '가로',
  height_cm: '세로',
  edition: '에디션',
  genre: '장르',
  publisher: '출판사/플랫폼',
  page_count: '분량',
  link: '링크',
  duration: '러닝타임',
  role: '역할',
  instruments: '악기/도구',
  venue: '공연장',
  performance_date: '공연일시',
};

/** 세부분야 → 상위분야 역매핑 */
export function getParentField(subField: string): string | null {
  for (const [parent, subs] of Object.entries(SUB_FIELDS)) {
    if (subs.includes(subField)) return parent;
  }
  return null;
}

/** 분야 카테고리 & 세부분야 (signup.tsx와 동일) */
export const FIELD_CATEGORIES = [
  { key: '글', icon: '✍️' },
  { key: '그림', icon: '🎨' },
  { key: '영상', icon: '🎬' },
  { key: '소리', icon: '🎵' },
  { key: '사진', icon: '📷' },
  { key: '입체/공간', icon: '🗿' },
  { key: '디지털/인터랙티브', icon: '💻' },
  { key: '공연', icon: '🎭' },
] as const;

export const SUB_FIELDS: Record<string, string[]> = {
  '글': ['소설', '시', '에세이', '웹소설', '극본', '평론', '번역', '칼럼', '기타'],
  '그림': ['회화', '일러스트', '웹툰/만화', '캘리그래피', '판화', '그래픽디자인', '기타'],
  '영상': ['영화', '애니메이션', '다큐멘터리', '뮤직비디오', '숏폼', '기타'],
  '소리': ['작곡', '연주', '보컬', '프로듀싱', '사운드아트', 'DJ', '기타'],
  '사진': ['순수사진', '상업사진', '다큐멘터리사진', '기타'],
  '입체/공간': ['조각', '도예/세라믹', '설치미술', '건축', '공예', '기타'],
  '디지털/인터랙티브': ['미디어아트', 'AI아트', '제너레이티브', '웹아트', '기타'],
  '공연': ['연극', '무용', '뮤지컬', '퍼포먼스', '기타'],
};
