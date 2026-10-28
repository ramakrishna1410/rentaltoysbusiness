import { Pressable, Text, View } from 'react-native';
import {
  COLOR_LABELS,
  COLOR_SWATCHES,
  INTERESTS,
  INTEREST_LABELS,
  PARENT_GOALS,
  PARENT_GOAL_LABELS,
  PLAY_PLACES,
  PLAY_PLACE_LABELS,
  TOY_COLORS,
  type ColorFilter,
  type Interest,
  type ParentGoal,
  type PlayPlace,
} from '@rentaltoys/shared';
import { colors, radius } from '../lib/theme';
import { Chip } from './ui';

export const MAX_FAV_COLORS = 3;

const INTEREST_HINTS: Record<Interest, string> = {
  WOODEN: 'Classic, eco-friendly',
  EDUCATIONAL_STEM: 'Counting, science, coding',
  PUZZLES: 'Shapes, maps, jigsaws',
  PRETEND_PLAY: 'Kitchens, doctor sets',
  BUILDING_BLOCKS: 'Bricks, magnetic tiles',
  ELECTRIC: 'RC cars, robots',
  SOFT_PLUSH: 'Teddies, puppets',
  MUSICAL: 'Pianos, xylophones',
  OUTDOOR_RIDE_ON: 'Bikes, slides, jeeps',
  ARTS_CRAFTS: 'Clay, easels, colouring',
};

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Up to three palette colours, plus "Bright multicolour" / "Two-tone"; "No preference" clears. */
export function ColorPrefPicker({ value, onChange }: { value: ColorFilter[]; onChange(v: ColorFilter[]): void }) {
  const palette = value.filter((c) => c !== 'MULTI' && c !== 'DUAL');
  const pick = (c: ColorFilter) => {
    if (value.includes(c)) return onChange(value.filter((x) => x !== c));
    if (c !== 'MULTI' && c !== 'DUAL' && palette.length >= MAX_FAV_COLORS) return;
    onChange([...value, c]);
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {TOY_COLORS.map((c) => {
          const on = value.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => pick(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={COLOR_LABELS[c]}
              style={{
                width: 76,
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: '#fff',
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.primary : colors.line,
                opacity: !on && palette.length >= MAX_FAV_COLORS ? 0.45 : 1,
              }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLOR_SWATCHES[c], borderWidth: 1, borderColor: '#0002' }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{c === 'NATURAL_WOOD' ? 'Wood' : COLOR_LABELS[c]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
        <Chip label="Bright multicolour" selected={value.includes('MULTI')} onPress={() => pick('MULTI')} />
        <Chip label="Two-tone" selected={value.includes('DUAL')} onPress={() => pick('DUAL')} />
        <Chip label="No preference" selected={value.length === 0} onPress={() => onChange([])} />
      </View>
    </View>
  );
}

export function InterestPicker({ value, onChange }: { value: Interest[]; onChange(v: Interest[]): void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {INTERESTS.map((i) => {
        const on = value.includes(i);
        return (
          <Pressable
            key={i}
            onPress={() => onChange(toggle(value, i))}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flexBasis: '47%',
              flexGrow: 1,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: on ? '#FFF1EC' : '#fff',
              borderWidth: on ? 2 : 1,
              borderColor: on ? colors.primary : colors.line,
            }}
          >
            <Text style={{ fontWeight: '800', color: colors.ink }}>{INTEREST_LABELS[i]}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{INTEREST_HINTS[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PlayPlacePicker({ value, onChange }: { value: PlayPlace | null; onChange(v: PlayPlace | null): void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {PLAY_PLACES.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(value === p ? null : p)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === p }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, backgroundColor: value === p ? colors.primary : colors.chip }}
        >
          <Text style={{ fontWeight: '700', color: value === p ? '#fff' : colors.ink }}>{PLAY_PLACE_LABELS[p]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function GoalPicker({ value, onChange }: { value: ParentGoal[]; onChange(v: ParentGoal[]): void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {PARENT_GOALS.map((g) => (
        <Chip key={g} label={PARENT_GOAL_LABELS[g]} selected={value.includes(g)} onPress={() => onChange(toggle(value, g))} />
      ))}
    </View>
  );
}
