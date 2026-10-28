import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ageInMonths } from '@rentaltoys/shared';
import { parseDob } from '../components/KidForm';
import { Container, DISPLAY_FONT, useWide } from '../components/landing';
import { ColorPrefPicker, GoalPicker, InterestPicker, MAX_FAV_COLORS, PlayPlacePicker } from '../components/PrefPickers';
import { Button, Chip, Field, Muted } from '../components/ui';
import { emptyDraft, useDraft, type GuestDraft } from '../lib/draft';
import { colors } from '../lib/theme';

const STEPS = 4;

function ageText(dob: Date) {
  const m = ageInMonths(dob);
  return m < 24 ? `${m} months` : `${Math.floor(m / 12)} years ${m % 12} months`;
}

/** "Get started": four short questions, then a personalised catalog without signing up. */
export default function GetStarted() {
  const wide = useWide();
  const { draft, save } = useDraft();
  const [d, setD] = useState<GuestDraft>(draft ?? emptyDraft());
  const [step, setStep] = useState(1);
  const set = (patch: Partial<GuestDraft>) => setD((x) => ({ ...x, ...patch }));
  const name = d.kidName.trim() || 'your kid';
  const dob = parseDob(d.dateOfBirth);
  const pinOk = /^6\d{5}$/.test(d.pincode);
  const chennai = pinOk && d.pincode.startsWith('600');

  const canNext = step === 1 ? !!dob : step === 4 ? !d.pincode || pinOk : true;
  const finish = () => {
    save(d);
    router.replace('/explore');
  };
  const next = () => (step === STEPS ? finish() : setStep(step + 1));
  const back = () => (step === 1 ? router.back() : setStep(step - 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingVertical: 20, flexGrow: 1 }}>
        <Container>
          <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', gap: 14, flexGrow: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={back} accessibilityRole="button" hitSlop={10}>
                <Text style={{ color: colors.primaryDark, fontWeight: '800' }}>‹ Back</Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>
                Step {step} of {STEPS}
              </Text>
              <Pressable onPress={step === 1 ? finish : next} accessibilityRole="button" hitSlop={10}>
                <Text style={{ color: colors.muted }}>Skip</Text>
              </Pressable>
            </View>
            <View style={{ height: 8, backgroundColor: colors.line, borderRadius: 4 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS, now: step }}>
              <View style={{ width: `${(step / STEPS) * 100}%`, height: 8, backgroundColor: colors.primary, borderRadius: 4 }} />
            </View>

            {step === 1 ? (
              <View>
                <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 34 : 30, color: colors.ink }}>Tell us about your little one</Text>
                <Muted style={{ marginBottom: 14 }}>We'll only show toys that are right for their age.</Muted>
                <Field label="Kid's name" value={d.kidName} onChangeText={(kidName) => set({ kidName })} />
                <Field label="Date of birth (YYYY-MM-DD)" placeholder="2022-06-15" value={d.dateOfBirth} onChangeText={(dateOfBirth) => set({ dateOfBirth })} />
                {dob ? <Text style={{ color: '#1F8A7E', fontWeight: '700', marginBottom: 12 }}>{ageText(dob)}</Text> : null}
                <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 6 }}>Shop for (optional)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {['Boy', 'Girl', 'Prefer not to say'].map((g) => (
                    <Chip key={g} label={g} selected={d.gender === g} onPress={() => set({ gender: d.gender === g ? null : g })} />
                  ))}
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View>
                <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 34 : 30, color: colors.ink }}>Which colours does {name} love?</Text>
                <Muted style={{ marginBottom: 14 }}>Pick up to {MAX_FAV_COLORS}. Kids reach for their favourite colour first.</Muted>
                <ColorPrefPicker value={d.favoriteColors} onChange={(favoriteColors) => set({ favoriteColors })} />
              </View>
            ) : null}

            {step === 3 ? (
              <View>
                <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 34 : 30, color: colors.ink }}>What gets {name} excited?</Text>
                <Muted style={{ marginBottom: 14 }}>Pick everything that fits. Matching toys show up first.</Muted>
                <InterestPicker value={d.interests} onChange={(interests) => set({ interests })} />
              </View>
            ) : null}

            {step === 4 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ ...DISPLAY_FONT, fontSize: wide ? 34 : 30, color: colors.ink }}>Almost done!</Text>
                <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16, marginTop: 6 }}>Where does {name} play most?</Text>
                <PlayPlacePicker value={d.playPlace} onChange={(playPlace) => set({ playPlace })} />
                <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16, marginTop: 14 }}>What matters most to you?</Text>
                <GoalPicker value={d.goals} onChange={(goals) => set({ goals })} />
                <View style={{ marginTop: 8 }}>
                  <Field label="Your pincode" keyboardType="number-pad" maxLength={6} value={d.pincode} onChangeText={(pincode) => set({ pincode })} />
                  {pinOk ? (
                    <Text style={{ color: chennai ? '#1F8A7E' : colors.primaryDark, fontWeight: '700', marginTop: -6 }}>
                      {chennai ? '✓ We deliver here' : "We're Chennai-only for now. You can still explore, and we'll tell you when we reach you."}
                    </Text>
                  ) : d.pincode ? (
                    <Text style={{ color: colors.danger, marginTop: -6 }}>Enter a 6-digit pincode</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 'auto', paddingTop: 16, gap: 6 }}>
              <Button title={step === STEPS ? `Show ${name === 'your kid' ? 'my' : `${name}'s`} toys` : 'Next'} onPress={next} disabled={!canNext} />
              {step === STEPS ? <Muted style={{ textAlign: 'center' }}>No account needed yet. Sign up when you're ready to order.</Muted> : null}
            </View>
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}
