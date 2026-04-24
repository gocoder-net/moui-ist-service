import { Platform } from 'react-native';

// MOUI-IST 브랜드 컬러
export const Brand = {
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  black: '#000000',
  white: '#f5f5f5',
  cream: '#121212',
  gray: '#a8a8a8',
  grayLight: '#363636',
  border: '#262626',
};

export type ThemeColors = {
  bg: string;
  fg: string;
  gold: string;
  goldLight: string;
  goldDim: string;
  muted: string;
  mutedLight: string;
  border: string;
  card: string;
  danger: string;
};

export const DarkColors: ThemeColors = {
  bg: '#000000',
  fg: '#f5f5f5',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#a8a8a8',
  mutedLight: '#363636',
  border: '#262626',
  card: '#121212',
  danger: '#D94040',
};

export const LightColors: ThemeColors = {
  bg: '#f5f6f8',
  fg: '#191f28',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
  border: '#e5e7eb',
  card: '#ffffff',
  danger: '#D94040',
};

const tintColor = Brand.gold;

export const Colors = {
  light: {
    text: Brand.white,
    background: Brand.black,
    tint: tintColor,
    icon: Brand.gray,
    tabIconDefault: Brand.grayLight,
    tabIconSelected: Brand.gold,
  },
  dark: {
    text: Brand.white,
    background: Brand.black,
    tint: tintColor,
    icon: Brand.gray,
    tabIconDefault: Brand.grayLight,
    tabIconSelected: Brand.gold,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
