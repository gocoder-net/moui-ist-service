/**
 * Icon Registry
 *
 * Phosphor Icons → UI 아이콘 (홈, 검색, 하트, 설정 등)
 * Simple Icons  → 브랜드 로고 (카카오, 네이버, 인스타그램 등)
 *
 * 새 아이콘이 필요하면 여기에 추가하세요.
 * Phosphor: https://phosphoricons.com
 * Simple Icons: https://simpleicons.org
 */

import type { IconWeight } from 'phosphor-react-native';
import {
  House,
  MagnifyingGlass,
  Heart,
  GearSix,
  List,
  ArrowLeft,
  ArrowRight,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  X,
  Plus,
  Minus,
  Check,
  Eye,
  EyeSlash,
  PencilSimple,
  Trash,
  ShareNetwork,
  Upload,
  Download,
  Camera,
  Image,
  User,
  Users,
  ChatCircle,
  Bell,
  Star,
  BookmarkSimple,
  MapPin,
  Calendar,
  Clock,
  Envelope,
  EnvelopeSimple,
  CalendarBlank,
  Lock,
  Phone,
  Globe,
  Link,
  PaperPlaneTilt,
  FunnelSimple,
  SlidersHorizontal,
  DotsThree,
  DotsThreeVertical,
  SignOut,
  Info,
  Warning,
  WarningCircle,
  CheckCircle,
  XCircle,
  Palette,
  PaintBrush,
  Diamond,
  Sparkle,
  Fire,
  Crown,
  // Category & field icons
  BeerStein,
  Handshake,
  FrameCorners,
  BookOpen,
  Trophy,
  PushPin,
  PencilLine,
  FilmStrip,
  MusicNotes,
  Cube,
  Desktop,
  MaskHappy,
  // Distance & transport
  PersonSimpleWalk,
  Rocket,
  // Buildings
  Bank,
  CastleTurret,
  // Points & rewards
  Crosshair,
  Target,
  Gift,
  Coins,
  ShoppingCart,
  Confetti,
  // Media & audio
  Headphones,
  Basketball,
  VinylRecord,
  SpeakerHigh,
  FilmSlate,
  Article,
  Notebook,
  Bread,
  Briefcase,
  Folder,
  Ticket,
  ClipboardText,
  HandWaving,
} from 'phosphor-react-native';

import {
  siKakaotalk,
  siNaver,
  siInstagram,
  siX,
  siGithub,
  siGoogle,
  siFacebook,
  siYoutube,
  siBehance,
  siDribbble,
  siPinterest,
  siTiktok,
  siSpotify,
  siApple,
  siThreads,
} from 'simple-icons';

// ─── Phosphor UI Icons ─────────────────────────────────────────────

export const PHOSPHOR_ICONS = {
  // Navigation
  house: House,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'caret-left': CaretLeft,
  'caret-right': CaretRight,
  'caret-down': CaretDown,
  'caret-up': CaretUp,

  // Actions
  'magnifying-glass': MagnifyingGlass,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  'pencil-simple': PencilSimple,
  trash: Trash,
  'share-network': ShareNetwork,
  upload: Upload,
  download: Download,
  'sign-out': SignOut,

  // Media
  camera: Camera,
  image: Image,
  eye: Eye,
  'eye-slash': EyeSlash,

  // Communication
  'chat-circle': ChatCircle,
  bell: Bell,
  envelope: Envelope,
  'envelope-simple': EnvelopeSimple,
  phone: Phone,
  'paper-plane-tilt': PaperPlaneTilt,

  // Social
  heart: Heart,
  star: Star,
  'bookmark-simple': BookmarkSimple,
  fire: Fire,

  // People
  user: User,
  users: Users,

  // Location & Time
  'map-pin': MapPin,
  calendar: Calendar,
  'calendar-blank': CalendarBlank,
  clock: Clock,

  // System
  'gear-six': GearSix,
  list: List,
  'funnel-simple': FunnelSimple,
  'sliders-horizontal': SlidersHorizontal,
  'dots-three': DotsThree,
  'dots-three-vertical': DotsThreeVertical,
  globe: Globe,
  link: Link,
  lock: Lock,
  info: Info,
  warning: Warning,
  'warning-circle': WarningCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,

  // Art / Creative
  palette: Palette,
  'paint-brush': PaintBrush,
  diamond: Diamond,
  sparkle: Sparkle,
  crown: Crown,

  // Categories (moui)
  'beer-stein': BeerStein,
  handshake: Handshake,
  'frame-corners': FrameCorners,
  'book-open': BookOpen,
  trophy: Trophy,
  'push-pin': PushPin,

  // Art fields
  'pencil-line': PencilLine,
  'film-strip': FilmStrip,
  'music-notes': MusicNotes,
  cube: Cube,
  desktop: Desktop,
  'mask-happy': MaskHappy,

  // Distance
  'person-simple-walk': PersonSimpleWalk,
  rocket: Rocket,

  // Buildings
  bank: Bank,
  'castle-turret': CastleTurret,

  // Points & rewards
  crosshair: Crosshair,
  target: Target,
  gift: Gift,
  coins: Coins,
  'shopping-cart': ShoppingCart,
  confetti: Confetti,

  // Extra media
  headphones: Headphones,
  basketball: Basketball,
  'vinyl-record': VinylRecord,
  'speaker-high': SpeakerHigh,
  'film-slate': FilmSlate,
  article: Article,
  notebook: Notebook,
  bread: Bread,
  briefcase: Briefcase,

  // Files & organization
  folder: Folder,
  ticket: Ticket,
  'clipboard-text': ClipboardText,
  'hand-waving': HandWaving,
} as const;

export type PhosphorIconName = keyof typeof PHOSPHOR_ICONS;

// ─── Simple Icons (Brand) ──────────────────────────────────────────

/**
 * Simple Icons 데이터 구조:
 * { title, slug, hex (브랜드 컬러), source, svg, path }
 *
 * ⚠️ 카카오 로그인 버튼은 공식 가이드라인을 따라야 합니다.
 *    Simple Icons의 카카오 아이콘은 일반 참조용이며,
 *    로그인 버튼에는 카카오 공식 SDK 또는 공식 에셋을 사용하세요.
 *    가이드라인: https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide
 */
export const BRAND_ICONS = {
  kakao: siKakaotalk,
  naver: siNaver,
  instagram: siInstagram,
  x: siX,
  twitter: siX, // alias
  github: siGithub,
  google: siGoogle,
  facebook: siFacebook,
  youtube: siYoutube,
  behance: siBehance,
  dribbble: siDribbble,
  pinterest: siPinterest,
  tiktok: siTiktok,
  spotify: siSpotify,
  apple: siApple,
  threads: siThreads,
} as const;

export type BrandIconName = keyof typeof BRAND_ICONS;

// ─── Combined Types ────────────────────────────────────────────────

export type IconName = PhosphorIconName | BrandIconName;

export { type IconWeight };
