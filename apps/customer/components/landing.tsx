import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { DurationCode } from '@rentaltoys/shared';
import { api } from '../lib/api';
import type { Plan, PlanDuration, PlanTier } from '../lib/subscription';
import { inr } from '../lib/subscription';
import { colors, radius } from '../lib/theme';

export const BRAND = 'Rental Toys';
export const DISPLAY_FONT = { fontWeight: '900' as const, letterSpacing: -0.5 };
const MAX_W = 1200;

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

/** Centres content at the site's max width with side padding. */
export function Container({ children }: { children: React.ReactNode }) {
  const wide = useWide();
  return <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: wide ? 32 : 16 }}>{children}</View>;
}

function Logo({ size = 24 }: { size?: number }) {
  // Three blocks, the same mark as the mockup.
  return (
    <View style={{ width: size, height: size, justifyContent: 'flex-end' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', top: 0, left: size * 0.12, width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: colors.accent }} />
      <View style={{ position: 'absolute', top: 0, right: size * 0.12, width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: '#FDD835' }} />
      <View style={{ height: size * 0.65, borderRadius: size * 0.18, backgroundColor: colors.primary }} />
    </View>
  );
}

/** Brand at top left; Home, About us, (Plans on wide screens) and Login at top right. */
export function NavBar({ current }: { current?: 'home' | 'about' }) {
  const wide = useWide();
  const link = (label: string, onPress: () => void, active?: boolean) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <Text style={{ fontWeight: '700', fontSize: wide ? 16 : 14, color: active ? colors.primaryDark : colors.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.bg }}>
      <Container>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: wide ? 18 : 12 }}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel={`${BRAND} home`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size={wide ? 30 : 22} />
            <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 26 : 20, color: colors.primaryDark }}>{BRAND}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: wide ? 28 : 14 }}>
            {link('Home', () => router.replace('/'), current === 'home')}
            {link('About us', () => router.push('/about'), current === 'about')}
            {wide ? link('Plans', () => router.push('/?section=plans')) : null}
            <Pressable
              onPress={() => router.push('/login')}
              accessibilityRole="link"
              style={{ borderWidth: 2, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: wide ? 18 : 12, paddingVertical: wide ? 8 : 5 }}
            >
              <Text style={{ fontWeight: '800', color: colors.primaryDark, fontSize: wide ? 16 : 14 }}>Login</Text>
            </Pressable>
          </View>
        </View>
      </Container>
    </View>
  );
}

interface Slide {
  title: string;
  caption: string;
  color: string;
  videoUrl: string | null;
  posterUrl: string | null;
}

const PANEL_SECONDS = 6;

function SlideVideo({ uri, onEnd }: { uri: string; onEnd(): void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
  });
  useEffect(() => {
    // Calling play() inside the setup callback is too early on web (no <video> yet), so start
    // once mounted and again when the clip reports it's ready.
    player.play();
    const end = player.addListener('playToEnd', onEnd);
    const status = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') player.play();
      // A clip that fails to load shouldn't stall the carousel.
      if (status === 'error') onEnd();
    });
    return () => {
      end.remove();
      status.remove();
    };
  }, [player, onEnd]);
  return <VideoView player={player} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" nativeControls={false} />;
}

function Arrow({ dir, onPress }: { dir: 'prev' | 'next'; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous video' : 'Next video'}
      style={{
        position: 'absolute',
        top: '45%',
        [dir === 'prev' ? 'left' : 'right']: 12,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#ffffffe6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: -3 }}>{dir === 'prev' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

/**
 * The five landing videos, muted, one after another. Only the visible slide mounts a player, so
 * one clip downloads at a time. Slides without a clip show their colour panel for a few seconds.
 */
export function VideoCarousel() {
  const wide = useWide();
  const slides = useQuery({ queryKey: ['landing'], queryFn: () => api.get<{ slides: Slide[] }>('/landing'), staleTime: 10 * 60_000 });
  const list = slides.data?.slides ?? [];
  const [i, setI] = useState(0);
  const count = list.length || 1;
  const go = (n: number) => setI(((n % count) + count) % count);
  const slide = list[i];

  useEffect(() => {
    if (!slide || slide.videoUrl) return;
    const t = setTimeout(() => go(i + 1), PANEL_SECONDS * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slide?.videoUrl, count]);

  return (
    <View
      accessibilityLabel="See how Rental Toys works"
      style={{ height: wide ? 560 : 420, borderRadius: wide ? 28 : 22, overflow: 'hidden', backgroundColor: slide?.color ?? colors.line, justifyContent: 'flex-end' }}
    >
      {slide?.videoUrl ? <SlideVideo key={slide.videoUrl} uri={slide.videoUrl} onEnd={() => go(i + 1)} /> : null}
      {slide ? (
        <View style={{ padding: wide ? 40 : 20, paddingBottom: wide ? 48 : 44, backgroundColor: '#00000059' }}>
          <Text style={{ ...DISPLAY_FONT, color: '#fff', fontSize: wide ? 44 : 28, lineHeight: wide ? 48 : 31 }}>{slide.title}</Text>
          <Text style={{ color: '#fff', fontSize: wide ? 18 : 15, marginTop: 4, maxWidth: 560 }}>{slide.caption}</Text>
        </View>
      ) : null}
      {list.length > 1 ? (
        <>
          <Arrow dir="prev" onPress={() => go(i - 1)} />
          <Arrow dir="next" onPress={() => go(i + 1)} />
          <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {list.map((s, n) => (
              <Pressable
                key={s.title}
                onPress={() => go(n)}
                accessibilityRole="button"
                accessibilityLabel={`Show video ${n + 1}: ${s.title}`}
                hitSlop={8}
                style={{ width: n === i ? 28 : 9, height: 9, borderRadius: 5, backgroundColor: n === i ? '#fff' : '#ffffff80' }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const DURATION_ORDER: DurationCode[] = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

/** The 3 plan lengths × Basic/Pro/Ultra, priced from the live plan table. */
export function PlansPreview({ onChoose }: { onChoose(): void }) {
  const wide = useWide();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<{ tiers: PlanTier[]; durations: PlanDuration[]; plans: Plan[] }>('/plans') });
  const [duration, setDuration] = useState<DurationCode>('QUARTERLY');
  if (!plans.data || plans.data.plans.length === 0) return null;
  const { tiers, durations } = plans.data;
  const dur = durations.find((d) => d.code === duration);
  if (!dur) return null;
  const extras = [
    dur.months === 1 && 'Cancel anytime',
    dur.swapRollover && 'Unused swaps roll over',
    dur.pauseDays > 0 && `Pause up to ${dur.pauseDays} days`,
    dur.buyoutDiscountPct > 0 && `${dur.buyoutDiscountPct}% off if you keep a toy`,
    ...dur.extras,
  ].filter(Boolean);

  return (
    <View>
      <View style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', alignItems: wide ? 'flex-end' : 'stretch', gap: 12 }}>
        <View>
          <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 40 : 28, color: colors.ink }}>Pick a plan that fits</Text>
          <Text style={{ color: colors.muted, fontSize: wide ? 17 : 15, marginTop: 4 }}>Longer plans cost less per month. Quarterly and yearly can still be paid monthly.</Text>
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 4 }}>
          {DURATION_ORDER.map((code) => {
            const d = durations.find((x) => x.code === code);
            if (!d) return null;
            const on = code === duration;
            return (
              <Pressable
                key={code}
                onPress={() => setDuration(code)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: wide ? undefined : 1, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.sm, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '800', color: on ? '#fff' : colors.ink }}>{d.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 20 : 14, marginTop: 24 }}>
        {tiers.map((t) => {
          const plan = plans.data.plans.find((p) => p.tierCode === t.code && p.durationCode === duration);
          if (!plan?.prices.length) return null;
          const monthly = Math.min(...plan.prices.map((p) => Math.round(p.totalAmount / dur.months)));
          const popular = t.code === 'PRO';
          return (
            <View
              key={t.code}
              style={{ flex: wide ? 1 : undefined, backgroundColor: '#fff', borderRadius: 24, padding: wide ? 28 : 20, borderWidth: popular ? 2 : 1, borderColor: popular ? colors.primary : colors.line }}
            >
              {popular ? (
                <Text style={{ position: 'absolute', top: -12, left: 24, backgroundColor: colors.accent, color: '#fff', fontWeight: '800', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>
                  Most popular
                </Text>
              ) : null}
              <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 30 : 24, color: colors.ink }}>{t.name}</Text>
              <Text style={{ marginTop: 4 }}>
                <Text style={{ fontSize: wide ? 34 : 26, fontWeight: '900', color: colors.primaryDark }}>from {inr(monthly)}</Text>
                <Text style={{ color: colors.muted }}> /month</Text>
              </Text>
              <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 12 }} />
              <Text style={{ fontSize: 16, color: colors.ink, marginBottom: 4 }}>
                {t.toyCredits} toys at home (or {Math.floor(t.toyCredits / 2)} large{t.toyCredits % 2 ? ' + 1' : ''})
              </Text>
              <Text style={{ fontSize: 16, color: colors.ink, marginBottom: 4 }}>
                {t.swapsPerMonth} swap{t.swapsPerMonth > 1 ? 's' : ''} a month
              </Text>
              <Text style={{ fontSize: 16, color: colors.ink }}>
                {t.deliveriesPerMonth} free doorstep deliver{t.deliveriesPerMonth > 1 ? 'ies' : 'y'}
                {t.expressDelivery ? ' + express' : ''}
              </Text>
              <Pressable
                onPress={onChoose}
                accessibilityRole="button"
                style={{ marginTop: 16, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary, backgroundColor: popular ? colors.primary : '#fff' }}
              >
                <Text style={{ fontWeight: '800', color: popular ? '#fff' : colors.primaryDark }}>Choose {t.name}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {extras.length ? <Text style={{ color: '#1F8A7E', fontWeight: '700', marginTop: 14 }}>{extras.join(' · ')}</Text> : null}
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Large toys (ride-ons, kitchens, slides) use 2 credits.</Text>
    </View>
  );
}

export function Footer() {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff', marginTop: 48 }}>
      <Container>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 24 }}>
          <Text style={{ color: colors.muted }}>© {BRAND}, Chennai</Text>
          <Text style={{ color: colors.muted }}>Sanitised · Checked · Delivered with a smile</Text>
        </View>
      </Container>
    </View>
  );
}
