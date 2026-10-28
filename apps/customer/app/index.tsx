import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Container, DISPLAY_FONT, Footer, NavBar, PlansPreview, VideoCarousel, useWide } from '../components/landing';
import { Button, Loading } from '../components/ui';
import { useAuth } from '../lib/api';
import { colors, radius } from '../lib/theme';

const PROMISES = [
  ['Sanitised after every swap', 'Cleaned, dried and sealed before it ships'],
  ['Every piece accounted for', 'QR-checked in and out, so nothing goes missing'],
  ['Free doorstep swaps', 'Old toy out, new toy in, one visit'],
] as const;

/** Public landing page for the app and the website. Logged-in parents go straight to "For you". */
export default function Landing() {
  const { ready, me } = useAuth();
  const wide = useWide();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scroll = useRef<ScrollView>(null);
  const plansY = useRef(0);

  if (!ready) return <Loading />;
  if (me) return <Redirect href="/(tabs)/home" />;
  const start = () => router.push('/start');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar current="home" />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: wide ? 32 : 16 }}>
        <Container>
          <VideoCarousel />

          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 48 : 24, paddingTop: wide ? 64 : 28, alignItems: wide ? 'center' : 'stretch' }}>
            <View style={{ flex: wide ? 3 : undefined }}>
              <Text style={{ color: colors.primaryDark, fontWeight: '800', letterSpacing: 1, fontSize: 13 }}>TOY RENTAL FOR CHENNAI FAMILIES</Text>
              <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 56 : 36, lineHeight: wide ? 58 : 38, color: colors.ink, marginVertical: 10 }}>
                Fresh toys. Happy kids. Zero clutter.
              </Text>
              <Text style={{ fontSize: wide ? 19 : 16, lineHeight: wide ? 30 : 24, color: colors.ink, marginBottom: 10 }}>
                Kids outgrow toys in weeks, not years. Rental Toys brings handpicked, age-right toys to your doorstep, and swaps them the moment the excitement
                fades. Your little one keeps discovering; your home stays clutter-free.
              </Text>
              <Text style={{ fontSize: wide ? 19 : 16, lineHeight: wide ? 30 : 24, color: colors.ink, marginBottom: 18 }}>
                Every toy is sanitised after every return, checked piece by piece, and delivered by our own team with a smile.
              </Text>
              <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 12 }}>
                <Button title="Get started" onPress={start} style={{ paddingHorizontal: 36 }} />
                <Text style={{ color: colors.muted, textAlign: wide ? 'left' : 'center' }}>2 minutes · no payment needed to explore</Text>
              </View>
            </View>
            <View style={{ flex: wide ? 2 : undefined, gap: 12 }}>
              {PROMISES.map(([title, body]) => (
                <View key={title} style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16 }}>{title}</Text>
                  <Text style={{ color: colors.muted }}>{body}</Text>
                </View>
              ))}
            </View>
          </View>

          <View
            style={{ paddingTop: wide ? 72 : 36 }}
            onLayout={(e) => {
              plansY.current = e.nativeEvent.layout.y;
              if (section === 'plans') scroll.current?.scrollTo({ y: plansY.current, animated: true });
            }}
          >
            <PlansPreview onChoose={start} />
          </View>
        </Container>
        <Footer />
      </ScrollView>
    </View>
  );
}
