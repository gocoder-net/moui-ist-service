import { Platform } from 'react-native';

// MOUI-IST 브랜드 컬러
export const Brand = {
  gold: '#C8A96E',
  goldLight: '#E0C992',
  goldDim: '#A8905A',
  black: '#1A1A1A',
  white: '#FAFAF7',
  cream: '#F2EFE9',
  gray: '#8A8580',
  grayLight: '#C5C0BA',
  border: '#E8E5DF',
};

const tintColorLight = Brand.gold;
const tintColorDark = Brand.goldLight;

export const Colors = {
  light: {
    text: Brand.black,
    background: Brand.white,
    tint: tintColorLight,
    icon: Brand.gray,
    tabIconDefault: Brand.grayLight,
    tabIconSelected: Brand.gold,
  },
  dark: {
    text: '#F0ECE4',
    background: '#060606',
    tint: tintColorDark,
    icon: '#5A5550',
    tabIconDefault: '#5A5550',
    tabIconSelected: tintColorDark,
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
