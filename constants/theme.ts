import { Platform } from 'react-native';

// MOUI-IST 브랜드 컬러
export const Brand = {
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: 'rgba(200,169,110,0.12)',
  black: '#191f28',
  white: '#f2f4f6',
  cream: '#212a35',
  gray: '#8b95a1',
  grayLight: '#4e5968',
  border: '#333d4b',
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
