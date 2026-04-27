import { Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

export function LikeDiamondButton({ liked, count, onPress, size = 18 }: { liked: boolean; count: number; onPress: () => void; size?: number }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const handlePress = () => {
    if (!liked) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 150 }),
        withTiming(1, { duration: 200 }),
      );
      rotation.value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(360, { duration: 0 }),
      );
      setTimeout(() => { rotation.value = 0; }, 700);
    }
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable onPress={handlePress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Animated.View style={[{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: '#C8A96E',
        transform: [{ rotate: '45deg' }],
      }, liked && { backgroundColor: '#C8A96E', borderRadius: size * 0.16 }, animStyle]} />
      {count > 0 && <Text style={{ color: '#C8A96E', fontSize: size * 0.7, fontWeight: '700' }}>{count}</Text>}
    </Pressable>
  );
}
