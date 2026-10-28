import { useState } from 'react';
import { Text, View } from 'react-native';
import { INTERESTS, INTEREST_LABELS, ageInMonths, type ColorFilter, type Interest, type ParentGoal, type PlayPlace } from '@rentaltoys/shared';
import { ColorPrefPicker, GoalPicker, PlayPlacePicker } from './PrefPickers';
import { Chip, Field, H2, Muted } from './ui';

export interface KidDraft {
  name: string;
  dateOfBirth: string;
  interests: Interest[];
  favoriteColors: ColorFilter[];
  playPlace: PlayPlace | null;
  goals: ParentGoal[];
}

export const emptyKid = (): KidDraft => ({ name: '', dateOfBirth: '', interests: [], favoriteColors: [], playPlace: null, goals: [] });

/** The body the API's kid schema expects. */
export function kidBody(k: KidDraft) {
  return {
    name: k.name.trim(),
    dateOfBirth: parseDob(k.dateOfBirth)!.toISOString(),
    interests: k.interests,
    favoriteColors: k.favoriteColors,
    playPlace: k.playPlace,
    goals: k.goals,
  };
}

const INTEREST_ICONS: Record<Interest, string> = {
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

export function parseDob(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) || d > new Date() ? null : d;
}

export function kidError(k: KidDraft): string | null {
  if (!k.name.trim()) return "Enter your kid's name";
  if (!parseDob(k.dateOfBirth)) return 'Enter date of birth as YYYY-MM-DD';
  return null;
}

export function KidForm({ value, onChange }: { value: KidDraft; onChange(v: KidDraft): void }) {
  const [touched, setTouched] = useState(false);
  const dob = parseDob(value.dateOfBirth);
  const months = dob ? ageInMonths(dob) : null;
  const toggle = (i: Interest) =>
    onChange({ ...value, interests: value.interests.includes(i) ? value.interests.filter((x) => x !== i) : [...value.interests, i] });

  return (
    <View>
      <Field label="Kid's name" value={value.name} onChangeText={(name) => onChange({ ...value, name })} />
      <Field
        label="Date of birth (YYYY-MM-DD)"
        placeholder="2021-06-15"
        value={value.dateOfBirth}
        onBlur={() => setTouched(true)}
        onChangeText={(dateOfBirth) => onChange({ ...value, dateOfBirth })}
        error={touched && value.dateOfBirth && !dob ? 'Use YYYY-MM-DD, not in the future' : undefined}
      />
      {months !== null ? <Muted>Age: {months < 24 ? `${months} months` : `${Math.floor(months / 12)} years ${months % 12} months`}</Muted> : null}
      <H2>What do they love?</H2>
      <Muted style={{ marginBottom: 10 }}>We show matching toys first. Pick as many as you like — you can change this later.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTERESTS.map((i) => (
          <Chip key={i} label={`${INTEREST_ICONS[i]} ${INTEREST_LABELS[i]}`} selected={value.interests.includes(i)} onPress={() => toggle(i)} />
        ))}
      </View>
      {value.interests.length === 0 ? <Text style={{ color: '#a08f80', marginTop: 4 }}>Not sure? Skip — we will learn from what they rent.</Text> : null}
      <H2>Favourite colours</H2>
      <ColorPrefPicker value={value.favoriteColors} onChange={(favoriteColors) => onChange({ ...value, favoriteColors })} />
      <H2>Where do they play most?</H2>
      <PlayPlacePicker value={value.playPlace} onChange={(playPlace) => onChange({ ...value, playPlace })} />
      <H2>What matters most to you?</H2>
      <GoalPicker value={value.goals} onChange={(goals) => onChange({ ...value, goals })} />
    </View>
  );
}
