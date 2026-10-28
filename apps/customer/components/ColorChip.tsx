import { Pressable, Text, View } from 'react-native';
import { COLOR_LABELS, COLOR_SWATCHES, type ColorFilter } from '@rentaltoys/shared';
import { colors } from '../lib/theme';

/** Round swatch for one colour, a half/half swatch for dual, a rainbow ring for multicolour. */
export function ColorSwatch({ color, size = 16 }: { color: ColorFilter; size?: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#0002', overflow: 'hidden' as const };
  if (color === 'MULTI') {
    return (
      <View style={[ring, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {['#E53935', '#FDD835', '#43A047', '#1E88E5'].map((c) => (
          <View key={c} style={{ width: size / 2, height: size / 2, backgroundColor: c }} />
        ))}
      </View>
    );
  }
  if (color === 'DUAL') {
    return (
      <View style={[ring, { flexDirection: 'row' }]}>
        <View style={{ flex: 1, backgroundColor: '#212121' }} />
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
      </View>
    );
  }
  return <View style={[ring, { backgroundColor: COLOR_SWATCHES[color] }]} />;
}

export const colorFilterLabel = (c: ColorFilter) => (c === 'MULTI' ? 'Multicolour' : c === 'DUAL' ? 'Dual colour' : COLOR_LABELS[c]);

export function ColorChip({ color, selected, onPress, label }: { color: ColorFilter; selected?: boolean; onPress?: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: selected ? colors.primary : colors.chip,
      }}
    >
      <ColorSwatch color={color} />
      <Text style={{ color: selected ? '#fff' : colors.ink, fontWeight: '600' }}>{label ?? colorFilterLabel(color)}</Text>
    </Pressable>
  );
}
