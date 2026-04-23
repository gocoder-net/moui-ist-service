import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';

const C = {
  bg: '#191f28',
  fg: '#f2f4f6',
  gold: '#C8A96E',
  goldLight: '#E0C992',
  muted: '#8b95a1',
  mutedLight: '#4e5968',
};

function FloatingShape({
  size,
  color,
  opacity,
  top,
  left,
  duration,
  delay,
  shape,
}: {
  size: number;
  color: string;
  opacity: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  shape: 'circle' | 'diamond' | 'ring' | 'line';
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-20, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(20, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    translateX.value = withDelay(
      delay + 500,
      withRepeat(
        withSequence(
          withTiming(12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
          withTiming(-12, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: duration * 4, easing: Easing.linear }),
        -1,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.85, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  const shapeStyle = (() => {
    switch (shape) {
      case 'circle':
        return {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
        };
      case 'diamond':
        return {
          width: size,
          height: size,
          borderWidth: 1,
          borderColor: color,
          opacity,
          transform: [{ rotate: '45deg' }],
        };
      case 'ring':
        return {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: color,
          opacity,
        };
      case 'line':
        return {
          width: size,
          height: 1,
          backgroundColor: color,
          opacity,
        };
    }
  })();

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: top as any,
          left: left as any,
        },
        animStyle,
      ]}
    >
      <View style={shapeStyle} />
    </Animated.View>
  );
}

function PlayfulDiamond() {
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const play = () => {
      rot.value = withSequence(
        // 빠르게 한 바퀴 돌기
        withTiming(360, { duration: 600, easing: Easing.in(Easing.cubic) }),
        // 살짝 지나쳤다 스프링으로 멈춤
        withSpring(360, { damping: 6, stiffness: 200 }),
        // 쉬기
        withDelay(1500, withTiming(360, { duration: 0 })),
        // 반대로 반 바퀴 빠르게
        withTiming(180, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        // 멈칫
        withSpring(180, { damping: 8, stiffness: 250 }),
        // 쉬기
        withDelay(2000, withTiming(180, { duration: 0 })),
        // 다시 정방향 한 바퀴 반
        withTiming(720, { duration: 800, easing: Easing.in(Easing.quad) }),
        withSpring(720, { damping: 5, stiffness: 180 }),
        // 쉬기
        withDelay(1200, withTiming(720, { duration: 0 })),
        // 살짝 까딱 (장난)
        withTiming(740, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withSpring(720, { damping: 10, stiffness: 300 }),
        // 쉬기 후 리셋
        withDelay(1500, withTiming(0, { duration: 0 })),
      );

      scale.value = withSequence(
        // 돌 때 살짝 커짐
        withTiming(1.1, { duration: 300 }),
        withTiming(1, { duration: 300 }),
        // 쉴 때 원래
        withDelay(1500, withTiming(1, { duration: 0 })),
        // 반대로 돌 때
        withTiming(0.9, { duration: 200 }),
        withSpring(1, { damping: 8 }),
        withDelay(2000, withTiming(1, { duration: 0 })),
        // 큰 회전
        withTiming(1.15, { duration: 400 }),
        withTiming(1, { duration: 400 }),
        withDelay(1200, withTiming(1, { duration: 0 })),
        // 까딱할 때 찌그러짐
        withTiming(1.05, { duration: 200 }),
        withSpring(1, { damping: 12 }),
        withDelay(1500, withTiming(1, { duration: 0 })),
      );
    };

    play();
    // 총: 600+200+1500+400+200+2000+800+200+1200+200+200+1500 ≈ 9000
    const interval = setInterval(play, 9200);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rot.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={diamondS.wrap}>
      <Animated.View style={[diamondS.box, animStyle]} />
    </View>
  );
}

const diamondS = StyleSheet.create({
  wrap: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
});

function BouncingChar({ char, index, isWide }: { char: string; index: number; isWide: boolean }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    const charDelay = index * 120;

    const runBounce = () => {
      translateY.value = withDelay(
        charDelay,
        withSequence(
          withTiming(-18, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 8, stiffness: 200, mass: 0.5 }),
        ),
      );
    };

    // 첫 바운스
    runBounce();

    // 5초마다 반복
    const interval = setInterval(runBounce, 5000);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.logo, isWide && styles.logoWide, animStyle]}>
      {char}
    </Animated.Text>
  );
}

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width > 500;
  const router = useRouter();

  const chars = ['모', '의', '스', '트'];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* 배경 떠다니는 도형들 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingShape shape="ring" size={50} color={C.gold} opacity={0.12} top="5%" left="5%" duration={6000} delay={0} />
        <FloatingShape shape="ring" size={70} color={C.goldLight} opacity={0.08} top="40%" left="50%" duration={7000} delay={800} />
        <FloatingShape shape="ring" size={48} color={C.gold} opacity={0.1} top="70%" left="10%" duration={5000} delay={400} />

        <FloatingShape shape="diamond" size={22} color={C.gold} opacity={0.25} top="12%" left="78%" duration={3500} delay={600} />
        <FloatingShape shape="diamond" size={16} color={C.gold} opacity={0.2} top="50%" left="88%" duration={4200} delay={200} />
        <FloatingShape shape="diamond" size={28} color={C.goldLight} opacity={0.15} top="80%" left="65%" duration={3800} delay={1000} />
        <FloatingShape shape="diamond" size={12} color={C.gold} opacity={0.3} top="30%" left="5%" duration={3000} delay={1400} />

        <FloatingShape shape="circle" size={8} color={C.gold} opacity={0.35} top="20%" left="25%" duration={2800} delay={300} />
        <FloatingShape shape="circle" size={6} color={C.goldLight} opacity={0.3} top="35%" left="70%" duration={2500} delay={900} />
        <FloatingShape shape="circle" size={10} color={C.gold} opacity={0.25} top="58%" left="35%" duration={3200} delay={500} />
        <FloatingShape shape="circle" size={5} color={C.gold} opacity={0.4} top="75%" left="80%" duration={2200} delay={1200} />
        <FloatingShape shape="circle" size={7} color={C.goldLight} opacity={0.3} top="88%" left="20%" duration={2600} delay={700} />
        <FloatingShape shape="circle" size={4} color={C.gold} opacity={0.45} top="45%" left="15%" duration={2000} delay={1100} />

        <FloatingShape shape="line" size={70} color={C.gold} opacity={0.15} top="18%" left="55%" duration={5000} delay={1500} />
        <FloatingShape shape="line" size={90} color={C.goldLight} opacity={0.1} top="65%" left="40%" duration={4500} delay={300} />
        <FloatingShape shape="line" size={50} color={C.gold} opacity={0.18} top="90%" left="55%" duration={3800} delay={800} />
      </View>

      {/* 상단 — 영문 로고 */}
      <View style={styles.top}>
        <Text style={styles.enLogo}>
          MOUI<Text style={styles.gold}>-</Text>IST
        </Text>
      </View>

      {/* 중앙 — 메인 */}
      <View style={styles.center}>
        <PlayfulDiamond />

        <View style={styles.logoRow}>
          {chars.map((char, i) => (
            <BouncingChar key={i} char={char} index={i} isWide={isWide} />
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.copy}>
          작가와 감상자가 만나는{'\n'}창작 커뮤니티
        </Text>
      </View>

      {/* 하단 — 버튼 */}
      <View style={styles.bottom}>
        <Pressable
          style={({ pressed }) => [styles.btnMain, pressed && styles.btnMainPressed]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnMainText}>시작하기</Text>
          <Text style={styles.btnArrow}>→</Text>
        </Pressable>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>이미 계정이 있나요?</Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>로그인</Text>
          </Pressable>
        </View>

        <Text style={styles.tagline}>
          작가와 감상자의 창작 커뮤니티
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 32,
  },

  top: {
    paddingTop: 20,
    alignItems: 'center',
  },
  enLogo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    color: C.fg,
  },
  gold: {
    color: C.gold,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorDiamond: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: C.gold,
    transform: [{ rotate: '45deg' }],
    marginBottom: 28,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 8,
  },
  logoWide: {
    fontSize: 52,
    letterSpacing: 12,
  },
  divider: {
    width: 24,
    height: 1,
    backgroundColor: C.gold,
    marginVertical: 20,
  },
  copy: {
    fontSize: 15,
    fontWeight: '300',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 26,
  },

  bottom: {
    paddingBottom: 36,
    gap: 16,
    alignItems: 'center',
  },
  btnMain: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.gold,
    paddingVertical: 17,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnMainPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  btnMainText: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  btnArrow: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '300',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loginText: {
    fontSize: 13,
    color: C.muted,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: C.gold,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 3,
    color: C.mutedLight,
    marginTop: 8,
  },
});
