import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { formatAgeRange } from '@rentaltoys/shared';
import { colors, radius } from '../lib/theme';
import type { ToyCard as ToyCardData } from '../lib/types';
import { useBox } from '../lib/box';
import { ToyImage } from './ToyImage';

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pass both to enable pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === 'outline' && styles.btnOutline,
        variant === 'ghost' && styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text style={[styles.btnText, variant !== 'primary' && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, error && { borderColor: colors.danger }]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]} accessibilityState={{ selected }}>
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={styles.error}>{error instanceof Error ? error.message : String(error)}</Text>;
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
}

/**
 * Catalog tile: photo with size/stock badges, a quick add-to-box button, name, age and why it was picked.
 * `style` lets grids control spacing (horizontal rows keep the default right margin).
 */
export function ToyTile({
  toy,
  onPress,
  onAdded,
  width = 160,
  style,
}: {
  toy: ToyCardData;
  onPress?: () => void;
  /** Runs after the + button puts the toy in the box (guests are sent to sign up). */
  onAdded?: (toy: ToyCardData) => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const box = useBox();
  const inBox = box.has(toy.id);
  const imgH = width * 0.85;
  return (
    <Pressable onPress={onPress} style={[styles.tile, { width }, style]}>
      <View>
        <ToyImage toy={toy} style={{ width: '100%', height: imgH, borderRadius: radius.md, backgroundColor: colors.chip }} />
        <View style={styles.badges}>
          {toy.creditCost === 2 ? <Text style={[styles.badge, { backgroundColor: colors.ink }]}>Large · 2 credits</Text> : null}
          {toy.availableUnits === 1 ? <Text style={[styles.badge, { backgroundColor: colors.danger }]}>Few left</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inBox ? `${toy.name} is in your box` : `Add ${toy.name} to box`}
          onPress={(e) => {
            e.stopPropagation?.();
            if (inBox) box.remove(toy.id);
            else {
              box.add({ id: toy.id, name: toy.name, creditCost: toy.creditCost, image: toy.images[0] });
              onAdded?.(toy);
            }
          }}
          style={[styles.addBtn, inBox && { backgroundColor: colors.success }]}
        >
          <Text style={styles.addText}>{inBox ? '✓' : '+'}</Text>
        </Pressable>
      </View>
      <Text numberOfLines={2} style={styles.tileTitle}>
        {toy.name}
      </Text>
      <Text style={styles.tileMeta}>{formatAgeRange(toy.ageMinMonths, toy.ageMaxMonths)}</Text>
      {toy.reasons?.[0] ? (
        <Text numberOfLines={1} style={styles.reason}>
          {toy.reasons[0]}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Grey placeholder shown while toys load. */
export function SkeletonTile({ width = 160, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tile, { width }, style]}>
      <View style={{ width: '100%', height: width * 0.85, borderRadius: radius.md, backgroundColor: colors.line }} />
      <View style={[styles.skelLine, { width: '80%' }]} />
      <View style={[styles.skelLine, { width: '50%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, backgroundColor: colors.bg, flexGrow: 1 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 16, marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.md, alignItems: 'center', marginVertical: 6 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 12, fontSize: 16, color: colors.ink },
  error: { color: colors.danger, marginTop: 4 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.ink, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  tile: { marginRight: 12, marginBottom: 12 },
  tileTitle: { fontWeight: '700', color: colors.ink, marginTop: 6 },
  tileMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  reason: { color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '600' },
  badges: { position: 'absolute', top: 8, left: 8, right: 44, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { color: '#fff', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  addBtn: {
    position: 'absolute', right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  addText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  skelLine: { height: 10, borderRadius: 5, backgroundColor: colors.line, marginTop: 8 },
});
