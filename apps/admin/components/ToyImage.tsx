import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import type { Interest, Material, PowerType } from '@rentaltoys/shared';

export interface ToyImageSource {
  name: string;
  images: string[];
  interestTags?: Interest[];
  material?: Material;
  powerType?: PowerType;
}

const TINTS = ['#FFE3D6', '#DDF3EE', '#E6E9FF', '#FFF1C9', '#F3E2FA', '#DFF0D8'];

const TAG_EMOJI: Partial<Record<Interest, string>> = {
  ELECTRIC: '🔋',
  EDUCATIONAL_STEM: '🧪',
  WOODEN: '🪵',
  SOFT_PLUSH: '🧸',
  PRETEND_PLAY: '🎭',
  PUZZLES: '🧩',
  BUILDING_BLOCKS: '🧱',
  OUTDOOR_RIDE_ON: '🚲',
  MUSICAL: '🎹',
  ARTS_CRAFTS: '🎨',
};

function placeholderEmoji(t: ToyImageSource): string {
  if (t.material === 'WOODEN') return '🪵';
  if (t.material === 'FABRIC_PLUSH') return '🧸';
  for (const tag of t.interestTags ?? []) if (TAG_EMOJI[tag]) return TAG_EMOJI[tag]!;
  return t.powerType === 'ELECTRIC' ? '🔋' : '🎁';
}

function tintFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** The toy's cover photo, or a "photo coming soon" tile until staff upload one. */
export function ToyImage({ toy, style, uri, compact }: { toy: ToyImageSource; style: StyleProp<ImageStyle>; uri?: string; compact?: boolean }) {
  const src = uri ?? toy.images[0];
  if (src) return <Image source={{ uri: src }} style={style} resizeMode="cover" />;
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[flat as object, styles.placeholder, { backgroundColor: tintFor(toy.name) }]}>
      <Text style={{ fontSize: compact ? 22 : 40 }}>{placeholderEmoji(toy)}</Text>
      {compact ? null : <Text style={styles.soon}>Photo coming soon</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  soon: { marginTop: 6, fontSize: 11, color: '#7A7480', fontWeight: '600' },
});
