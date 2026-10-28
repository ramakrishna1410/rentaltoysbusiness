import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KidForm, emptyKid, kidBody, kidError, type KidDraft } from '../components/KidForm';
import { Button, ErrorText, Field, H1, Muted, Screen } from '../components/ui';
import { api, useAuth } from '../lib/api';
import { useBox } from '../lib/box';
import { useDraft } from '../lib/draft';

export default function Signup() {
  const { signIn } = useAuth();
  const box = useBox();
  const { draft, clear } = useDraft();
  const [step, setStep] = useState<1 | 2>(1);
  const [parent, setParent] = useState({ name: '', email: '', phone: '', password: '', addressLine: '', area: '', pincode: draft?.pincode ?? '' });
  // "Get started" answers carry over, so the parent only reviews them here.
  const [kid, setKid] = useState<KidDraft>(
    draft
      ? { name: draft.kidName, dateOfBirth: draft.dateOfBirth, interests: draft.interests, favoriteColors: draft.favoriteColors, playPlace: draft.playPlace, goals: draft.goals }
      : emptyKid(),
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof parent) => (v: string) => setParent((p) => ({ ...p, [k]: v }));

  const parentError = !parent.name.trim()
    ? 'Enter your name'
    : !/^\S+@\S+\.\S+$/.test(parent.email)
      ? 'Enter a valid email'
      : !/^[6-9]\d{9}$/.test(parent.phone)
        ? 'Enter a 10-digit mobile number'
        : parent.password.length < 8
          ? 'Password needs at least 8 characters'
          : parent.pincode && !/^6\d{5}$/.test(parent.pincode)
            ? 'Enter a Chennai / Tamil Nadu pincode'
            : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string }>('/auth/signup', {
        ...parent,
        email: parent.email.trim(),
        pincode: parent.pincode || undefined,
        addressLine: parent.addressLine || undefined,
        area: parent.area || undefined,
        kids: [kidBody(kid)],
      });
      await signIn(res.token);
      clear();
      // Toys picked as a guest are still in the box: take them straight to it.
      router.replace(box.toys.length ? '/(tabs)/mytoys' : '/(tabs)/home');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted>Step {step} of 2</Muted>
      {step === 1 ? (
        <View>
          <H1>About you</H1>
          <Field label="Your name" value={parent.name} onChangeText={set('name')} />
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={parent.email} onChangeText={set('email')} />
          <Field label="Mobile number" keyboardType="phone-pad" maxLength={10} value={parent.phone} onChangeText={set('phone')} />
          <Field label="Password" secureTextEntry value={parent.password} onChangeText={set('password')} />
          <Field label="Delivery address" value={parent.addressLine} onChangeText={set('addressLine')} />
          <Field label="Area (e.g. Adyar, Anna Nagar)" value={parent.area} onChangeText={set('area')} />
          <Field label="Pincode" keyboardType="number-pad" maxLength={6} value={parent.pincode} onChangeText={set('pincode')} />
          <Muted>{parentError ?? ' '}</Muted>
          <Button title="Next: your kid" onPress={() => setStep(2)} disabled={!!parentError} />
        </View>
      ) : (
        <View>
          <H1>About your kid</H1>
          {draft ? <Muted style={{ marginBottom: 8 }}>Filled in from your answers. Check and change anything.</Muted> : null}
          <KidForm value={kid} onChange={setKid} />
          <ErrorText error={error} />
          <Button title="Create account" onPress={submit} loading={busy} disabled={!!kidError(kid)} style={{ marginTop: 16 }} />
          <Button title="Back" variant="ghost" onPress={() => setStep(1)} />
        </View>
      )}
    </Screen>
  );
}
