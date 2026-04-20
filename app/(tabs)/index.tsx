import { StyleSheet, View, Text, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 웹사이트 컬러 반전 버전
const C = {
  bg: '#FFFFFF',
  fg: '#0A0A0A',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#9A958E',
  border: '#DDD9D2',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width > 600;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 히어로 */}
        <View style={[styles.hero, { minHeight: height - insets.top - 80 }]}>

          {/* 네비 로고 */}
          <Text style={styles.navLogo}>
            MOUI<Text style={styles.gold}>-</Text>IST
          </Text>

          {/* 메인 영역 */}
          <View style={styles.heroCenter}>
            {/* 장식 라인 */}
            <View style={styles.decorLine} />

            {/* 메인 타이틀 (한글) */}
            <Text style={[styles.title, isWide && styles.titleWide]}>
              모의스트
            </Text>

            {/* 태그라인 */}
            <Text style={styles.subtitle}>창작을 모의하는 커뮤니티</Text>

            {/* 구분선 */}
            <View style={styles.divider} />

            {/* 설명 */}
            <Text style={styles.tagline}>
              작가, 지망생, 감상자가{'\n'}
              함께 <Text style={styles.taglineBold}>모의</Text>하는 창작 공간
            </Text>
          </View>
        </View>

        {/* 인용문 */}
        <View style={styles.quote}>
          <Text style={[styles.quoteText, isWide && styles.quoteTextWide]}>
            당신의 작품을{'\n'}세상에 보여주세요
          </Text>
          <Text style={styles.quoteAttr}>포트폴리오 · 네트워킹 · 전시</Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>JOIN THE CONSPIRACY</Text>
          <Text style={[styles.ctaHeading, isWide && styles.ctaHeadingWide]}>
            창작의 모의에{'\n'}함께하세요
          </Text>

          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>작가로 시작하기</Text>
          </Pressable>

          <Pressable style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>감상자로 둘러보기</Text>
          </Pressable>
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>© 2026 MOUI-IST  ·  ALL RIGHTS RESERVED</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  navLogo: {
    position: 'absolute',
    top: 24,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 6,
    color: C.fg,
  },
  gold: {
    color: C.gold,
  },
  heroCenter: {
    alignItems: 'center',
  },
  decorLine: {
    width: 1,
    height: 40,
    backgroundColor: C.gold,
    marginBottom: 32,
    opacity: 0.4,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 10,
    color: C.fg,
    textAlign: 'center',
    lineHeight: 52,
  },
  titleWide: {
    fontSize: 72,
    letterSpacing: 16,
    lineHeight: 80,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 4,
    color: C.gold,
    marginTop: 12,
  },
  divider: {
    width: 30,
    height: 1,
    backgroundColor: C.gold,
    marginVertical: 28,
    opacity: 0.5,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '300',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 26,
  },
  taglineBold: {
    color: C.gold,
    fontWeight: '700',
  },
  quote: {
    borderTopWidth: 1,
    borderColor: C.border,
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 28,
    fontWeight: '200',
    color: C.fg,
    textAlign: 'center',
    lineHeight: 42,
  },
  quoteTextWide: {
    fontSize: 40,
    lineHeight: 56,
  },
  quoteAttr: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 4,
    color: C.muted,
    marginTop: 20,
  },
  cta: {
    borderTopWidth: 1,
    borderColor: C.border,
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  ctaLabel: {
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 6,
    color: C.gold,
    marginBottom: 8,
  },
  ctaHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: C.fg,
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 24,
  },
  ctaHeadingWide: {
    fontSize: 48,
    lineHeight: 60,
  },
  btnPrimary: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: C.fg,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: C.bg,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
  },
  btnSecondary: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 3,
  },
  footer: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  footerLine: {
    width: 30,
    height: 1,
    backgroundColor: C.border,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    color: C.muted,
  },
});
