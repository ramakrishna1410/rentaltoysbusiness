import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen}>
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
});
