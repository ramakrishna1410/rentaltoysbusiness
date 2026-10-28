import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '../components/ui';
import { colors } from '../lib/theme';

const POINTS = [
  ['🧸', 'Fresh toys every month', 'Sanitised, checked piece-by-piece and delivered across Chennai.'],
  ['🔁', 'Swap when they get bored', 'Pick Basic, Pro or Ultra and swap within your plan.'],
  ['🎯', 'Picked for your kid', 'Tell us their age and what they love; we show the right toys first.'],
] as const;

export default function Welcome() {
  return (
    <Screen>
      <View style={{ marginTop: 40 }}>
        <Text style={styles.brand}>RentalToys</Text>
        <Text style={styles.tag}>Rent. Play. Swap. Repeat.</Text>
        {POINTS.map(([icon, title, body]) => (
          <View key={title} style={styles.point}>
            <Text style={{ fontSize: 28 }}>{icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pointTitle}>{title}</Text>
              <Text style={{ color: colors.muted }}>{body}</Text>
            </View>
          </View>
        ))}
        <Button title="Get started" onPress={() => router.push('/signup')} style={{ marginTop: 24 }} />
        <Button title="I already have an account" variant="outline" onPress={() => router.push('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 40, fontWeight: '900', color: colors.primary },
  tag: { fontSize: 18, color: colors.ink, marginBottom: 28 },
  point: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  pointTitle: { fontWeight: '700', fontSize: 16, color: colors.ink },
});
