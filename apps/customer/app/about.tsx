import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Container, DISPLAY_FONT, Footer, NavBar, useWide } from '../components/landing';
import { Button } from '../components/ui';
import { colors, radius } from '../lib/theme';

const STEPS = [
  ['1. Pick', 'Tell us about your kid and choose toys picked for their age and interests.'],
  ['2. Play', 'We deliver sanitised, piece-checked toys to your door across Chennai.'],
  ['3. Swap', 'When the excitement fades, we collect the old toy and bring something new.'],
] as const;

export default function About() {
  const wide = useWide();
  const p = { fontSize: wide ? 18 : 16, lineHeight: wide ? 29 : 25, color: colors.ink, marginBottom: 14 } as const;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar current="about" />
      <ScrollView>
        <Container>
          <View style={{ maxWidth: 760, paddingTop: wide ? 56 : 24 }}>
            <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 48 : 32, color: colors.ink, marginBottom: 16 }}>About Rental Toys</Text>
            <Text style={p}>
              We're three parents-at-heart from Chennai who kept seeing the same thing: cupboards full of toys our kids loved for two weeks and then
              never touched again.
            </Text>
            <Text style={p}>
              Rental Toys fixes that. Instead of buying, families rent great toys, swap them when kids are ready for the next thing, and keep their homes
              clutter-free. Good toys get played with by many children instead of gathering dust.
            </Text>
            <Text style={p}>
              Safety comes first. Every toy is sanitised after every return, every piece is scanned in and out of our warehouse, and our own team
              delivers to your door.
            </Text>
          </View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14, marginTop: 16 }}>
            {STEPS.map(([t, b]) => (
              <View key={t} style={{ flex: wide ? 1 : undefined, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18 }}>
                <Text style={{ fontWeight: '900', fontSize: 20, color: colors.primaryDark }}>{t}</Text>
                <Text style={{ color: colors.ink, marginTop: 4 }}>{b}</Text>
              </View>
            ))}
          </View>
          <View style={{ maxWidth: 320, marginTop: 24 }}>
            <Button title="Get started" onPress={() => router.push('/start')} />
          </View>
        </Container>
        <Footer />
      </ScrollView>
    </View>
  );
}
