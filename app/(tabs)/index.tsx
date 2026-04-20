import { StyleSheet, View, Text, Pressable, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const isWide = width > 600;

// 웹사이트 컬러 반전 버전
const C = {
  bg: '#FFFFFF',        // 순백
  fg: '#0A0A0A',        // 웹 #f0ece4 → 반전
  gold: '#C8A96E',      // 골드 유지
  goldLight: '#E0C992',
  muted: '#9A958E',     // 웹 #5a5550 → 반전
  border: '#DDD9D2',    // 웹 #1e1e1e → 반전
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 히어로 — 웹사이트 구조 그대로 반전 */}
        <View style={[styles.hero, { minHeight: height - insets.top - 80 }]}>

          {/* 네비 로고 */}
          <Text style={styles.navLogo}>
            MOUI<Text style={styles.gold}>-</Text>IST
          </Text>

          {/* 영문 서브 */}
          <Text style={styles.eyebrow}>MOUI-IST</Text>

          {/* 메인 타이틀 (한글) */}
          <Text style={styles.title}>
            모의스트
          </Text>

          {/* 태그라인 */}
          <Text style={styles.subtitle}>창작을 모의하는 커뮤니티</Text>

          {/* 설명 */}
          <Text style={styles.tagline}>
            작가, 지망생, 감상자가{'\n'}
            함께 <Text style={styles.taglineBold}>모의</Text>하는 창작 공간
          </Text>

          {/* 스크롤 인디케이터 */}
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollText}>SCROLL</Text>
            <View style={styles.scrollLine} />
          </View>
        </View>

        {/* 인용문 */}
        <View style={styles.quote}>
          <Text style={styles.quoteText}>
            당신의 작품을{'\n'}세상에 보여주세요
          </Text>
          <Text style={styles.quoteAttr}>포트폴리오 · 네트워킹 · 전시</Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>JOIN THE CONSPIRACY</Text>
          <Text style={styles.ctaHeading}>
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
    position: 'relative',
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
  eyebrow: {
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 6,
    color: C.gold,
    marginBottom: 28,
  },
  title: {
    fontSize: isWide ? 72 : 44,
    fontWeight: '900',
    letterSpacing: isWide ? 16 : 10,
    color: C.fg,
    textAlign: 'center',
    lineHeight: isWide ? 80 : 52,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 4,
    color: C.gold,
    marginTop: 12,
    marginBottom: 28,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(10,10,10,0.6)',
    textAlign: 'center',
  },
  taglineBold: {
    color: C.gold,
    fontWeight: '700',
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 28,
    alignItems: 'center',
    gap: 8,
  },
  scrollText: {
    fontSize: 8,
    fontWeight: '400',
    letterSpacing: 4,
    color: C.muted,
  },
  scrollLine: {
    width: 1,
    height: 32,
    backgroundColor: C.gold,
    opacity: 0.5,
  },
  quote: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: isWide ? 40 : 28,
    fontWeight: '200',
    color: C.fg,
    textAlign: 'center',
    lineHeight: isWide ? 56 : 42,
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
    fontSize: isWide ? 48 : 32,
    fontWeight: '900',
    color: C.fg,
    textAlign: 'center',
    lineHeight: isWide ? 60 : 44,
    marginBottom: 24,
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
