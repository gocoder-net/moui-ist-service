import { Platform } from 'react-native';

// MOUI-IST 브랜드 컬러
export const Brand = {
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  black: '#17171B',
  white: '#EEEEF0',
  cream: '#13141F',
  gray: '#6B6B7B',
  grayLight: '#4A4A58',
  border: '#1E1F2E',
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
