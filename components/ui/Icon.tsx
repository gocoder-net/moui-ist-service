/**
 * 통합 아이콘 컴포넌트
 *
 * UI 아이콘(Phosphor)과 브랜드 로고(Simple Icons)를 하나의 인터페이스로 사용.
 *
 * @example
 * // UI 아이콘
 * <Icon name="heart" />
 * <Icon name="heart" weight="fill" color="#FF6B6B" />
 * <Icon name="magnifying-glass" size={20} weight="bold" />
 *
 * // 브랜드 아이콘
 * <Icon name="instagram" />                  // 단색 (currentColor)
 * <Icon name="instagram" brandColor />       // 원본 브랜드 컬러
 * <Icon name="kakao" brandColor size={24} />
 *
 * // 타입 명시 (이름이 겹칠 때)
 * <Icon name="x" type="ui" />     // Phosphor X (닫기)
 * <Icon name="x" type="brand" />  // Simple Icons X (구 트위터)
 *
 * ⚠️ 카카오 로그인 버튼:
 *    이 컴포넌트의 카카오 아이콘은 일반 참조용입니다.
 *    로그인 버튼에는 카카오 공식 가이드라인을 따르세요.
 *    https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide
 */

import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  PHOSPHOR_ICONS,
  BRAND_ICONS,
  type PhosphorIconName,
  type BrandIconName,
  type IconName,
  type IconWeight,
} from './icon-registry';

// ─── Props ─────────────────────────────────────────────────────────

interface IconBaseProps {
  /** 아이콘 이름. IconName 타입 또는 string (런타임 검증) */
  name: IconName | (string & {});
  /** "ui" (Phosphor) | "brand" (Simple Icons). 생략 �� 자동 판별. */
  type?: 'ui' | 'brand';
  /** 크기 (px). 기본값: UI 24, Brand 20 */
  size?: number;
  /** 색상. 기본 currentColor */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

interface UIIconProps extends IconBaseProps {
  /** Phosphor weight (UI 아이콘 전용) */
  weight?: IconWeight;
  brandColor?: never;
}

interface BrandIconProps extends IconBaseProps {
  weight?: never;
  /** true면 Simple Icons 원본 브랜드 색상 사용 */
  brandColor?: boolean;
}

export type IconProps = UIIconProps | BrandIconProps;

// ─── Helpers ───────────────────────────────────────────────────────

function resolveType(name: string, type?: 'ui' | 'brand'): 'ui' | 'brand' {
  if (type) return type;
  if (name in BRAND_ICONS) return 'brand';
  return 'ui';
}

// ─── Component ─────────────────────────────────────────────────────

export function Icon({
  name,
  type,
  size,
  weight = 'regular',
  color,
  brandColor = false,
  style,
}: IconProps) {
  const resolved = resolveType(name, type);

  // ── Phosphor (UI) ──
  if (resolved === 'ui') {
    const PhosphorComponent = PHOSPHOR_ICONS[name as PhosphorIconName];

    if (!PhosphorComponent) {
      if (__DEV__) {
        console.warn(`[Icon] Unknown UI icon: "${name}". Add it to icon-registry.ts`);
      }
      return null;
    }

    return (
      <PhosphorComponent
        size={size ?? 24}
        weight={weight}
        color={color ?? 'currentColor'}
        style={style}
      />
    );
  }

  // ── Simple Icons (Brand) ──
  const brand = BRAND_ICONS[name as BrandIconName];

  if (!brand) {
    if (__DEV__) {
      console.warn(`[Icon] Unknown brand icon: "${name}". Add it to icon-registry.ts`);
    }
    return null;
  }

  const iconSize = size ?? 20;
  const iconColor = brandColor ? `#${brand.hex}` : (color ?? 'currentColor');

  return (
    <Svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill={iconColor}
      style={style}
    >
      <Path d={brand.path} />
    </Svg>
  );
}

export default Icon;
