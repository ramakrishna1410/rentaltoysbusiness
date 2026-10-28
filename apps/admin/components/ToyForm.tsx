import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  COLOR_LABELS,
  COLOR_TYPES,
  COLOR_TYPE_LABELS,
  INTEREST_LABELS,
  INTERESTS,
  MATERIALS,
  TOY_COLORS,
  ageBandFor,
  colorError,
  colorLabel,
  sizeClassFor,
  type ColorType,
  type Interest,
  type Material,
  type PieceType,
  type PowerType,
  type ToyColor,
} from '@rentaltoys/shared';
import { colors } from '../lib/theme';
import type { Toy } from '../lib/types';
import { ColorChip } from './ColorChip';
import { Button, Card, Chip, Field, H2, Muted } from './ui';

const MATERIAL_LABEL: Record<Material, string> = {
  PLASTIC: 'Plastic', WOODEN: 'Wooden', FABRIC_PLUSH: 'Fabric / plush', METAL: 'Metal', SILICONE_RUBBER: 'Silicone / rubber', MIXED: 'Mixed', OTHER: 'Other',
};

const COLOR_TYPE_HELP: Record<ColorType, string> = {
  SINGLE: 'One dominant base colour. A red car with a few yellow stickers is Red.',
  DUAL: 'Exactly two main colours, e.g. Black & White or Red & Yellow.',
  MULTI: 'Many colours with no single base colour, e.g. rainbow stackers.',
};

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const years = (months: number) => String(Math.round((months / 12) * 100) / 100);

/** The body the API expects for POST /admin/toys and PATCH /admin/toys/:id. */
export type ToyBody = Record<string, unknown>;

interface Props {
  initial?: Toy;
  /** Units already have piece QR labels, so the piece count can't change. */
  lockPieces?: boolean;
  submitLabel: string;
  busy?: boolean;
  onSubmit(body: ToyBody): void;
}

/** Add/edit form with every micro-level toy detail. */
export function ToyForm({ initial, lockPieces, submitLabel, busy, onSubmit }: Props) {
  const [f, setF] = useState({
    sku: initial?.sku ?? '',
    name: initial?.name ?? '',
    brand: initial?.brand ?? '',
    description: initial?.description ?? '',
    lengthCm: initial ? String(initial.lengthCm) : '',
    breadthCm: initial ? String(initial.breadthCm) : '',
    heightCm: initial ? String(initial.heightCm) : '',
    weightKg: initial ? String(initial.weightKg) : '',
    manufacturingDate: initial?.manufacturingDate.slice(0, 10) ?? '',
    ageMin: initial ? years(initial.ageMinMonths) : '',
    ageMax: initial ? years(initial.ageMaxMonths) : '',
    mrp: initial ? String(initial.mrp) : '',
    batteryType: initial?.batteryType ?? '',
    batteryCount: initial?.batteryCount != null ? String(initial.batteryCount) : '',
    pieceCount: initial ? String(initial.pieceCount) : '1',
  });
  const [material, setMaterial] = useState<Material>(initial?.material ?? 'PLASTIC');
  const [power, setPower] = useState<PowerType>(initial?.powerType ?? 'NON_ELECTRIC');
  const [pieceType, setPieceType] = useState<PieceType>(initial?.pieceType ?? 'SINGLE');
  const [interests, setInterests] = useState<Interest[]>(initial?.interestTags ?? []);
  const [colorType, setColorType] = useState<ColorType>(initial?.colorType ?? 'SINGLE');
  const [primary, setPrimary] = useState<ToyColor | null>(initial?.primaryColor ?? null);
  const [secondary, setSecondary] = useState<ToyColor | null>(initial?.secondaryColor ?? null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const dims = { lengthCm: num(f.lengthCm), breadthCm: num(f.breadthCm), heightCm: num(f.heightCm) };
  const dimsOk = Object.values(dims).every((v) => v > 0) && num(f.weightKg) > 0;
  const size = dimsOk ? sizeClassFor(dims, num(f.weightKg)) : null;
  const ageMinM = Math.round(num(f.ageMin) * 12);
  const ageMaxM = Math.round(num(f.ageMax) * 12);
  const color = {
    colorType,
    primaryColor: colorType === 'MULTI' ? null : primary,
    secondaryColor: colorType === 'DUAL' ? secondary : null,
  };

  const problems = [
    !f.sku.trim() && 'SKU',
    !f.name.trim() && 'name',
    !dimsOk && 'dimensions and weight',
    !/^\d{4}-\d{2}-\d{2}$/.test(f.manufacturingDate) && 'manufacturing date (YYYY-MM-DD)',
    !(ageMaxM > ageMinM && ageMinM >= 0) && 'age range',
    !(num(f.mrp) >= 0) && 'MRP',
    power === 'ELECTRIC' && !f.batteryType.trim() && 'battery type',
    pieceType === 'MULTI' && !(num(f.pieceCount) > 1) && 'number of pieces',
    colorError(color) && 'colour',
  ].filter(Boolean) as string[];

  function submit() {
    onSubmit({
      sku: f.sku.trim().toUpperCase(),
      name: f.name.trim(),
      brand: f.brand.trim(),
      description: f.description,
      ...dims,
      weightKg: num(f.weightKg),
      manufacturingDate: f.manufacturingDate,
      ageMinMonths: ageMinM,
      ageMaxMonths: ageMaxM,
      material,
      powerType: power,
      batteryType: power === 'ELECTRIC' ? f.batteryType.trim() : undefined,
      batteryCount: power === 'ELECTRIC' && f.batteryCount ? num(f.batteryCount) : undefined,
      pieceType,
      pieceCount: pieceType === 'SINGLE' ? 1 : num(f.pieceCount),
      interestTags: interests,
      mrp: num(f.mrp),
      ...color,
      isActive,
    });
  }

  return (
    <View>
      <H2>Basics</H2>
      <Field label="SKU" autoCapitalize="characters" value={f.sku} onChangeText={set('sku')} placeholder="WD-ABACUS-01" />
      <Field label="Name" value={f.name} onChangeText={set('name')} />
      <Field label="Brand" value={f.brand} onChangeText={set('brand')} />
      <Field label="Description" multiline value={f.description} onChangeText={set('description')} />
      <Field label="MRP (₹)" keyboardType="number-pad" value={f.mrp} onChangeText={set('mrp')} />
      <Field label="Manufacturing date (YYYY-MM-DD)" value={f.manufacturingDate} onChangeText={set('manufacturingDate')} />

      <H2>Colour</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {COLOR_TYPES.map((t) => (
          <Chip key={t} label={COLOR_TYPE_LABELS[t]} selected={colorType === t} onPress={() => setColorType(t)} />
        ))}
      </View>
      <Muted style={{ marginBottom: 8 }}>{COLOR_TYPE_HELP[colorType]}</Muted>
      {colorType !== 'MULTI' ? (
        <View>
          <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 6 }}>{colorType === 'DUAL' ? 'First colour' : 'Base colour'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TOY_COLORS.map((c) => (
              <ColorChip key={c} color={c} label={COLOR_LABELS[c]} selected={primary === c} onPress={() => setPrimary(c)} />
            ))}
          </View>
        </View>
      ) : null}
      {colorType === 'DUAL' ? (
        <View>
          <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 6 }}>Second colour</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TOY_COLORS.filter((c) => c !== primary).map((c) => (
              <ColorChip key={c} color={c} label={COLOR_LABELS[c]} selected={secondary === c} onPress={() => setSecondary(c)} />
            ))}
          </View>
        </View>
      ) : null}
      <Muted>Shown to customers as: {colorError(color) ? '—' : colorLabel(color)}</Muted>

      <H2>Dimensions (boxed)</H2>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="L (cm)" keyboardType="decimal-pad" value={f.lengthCm} onChangeText={set('lengthCm')} /></View>
        <View style={{ flex: 1 }}><Field label="B (cm)" keyboardType="decimal-pad" value={f.breadthCm} onChangeText={set('breadthCm')} /></View>
        <View style={{ flex: 1 }}><Field label="H (cm)" keyboardType="decimal-pad" value={f.heightCm} onChangeText={set('heightCm')} /></View>
      </View>
      <Field label="Weight (kg)" keyboardType="decimal-pad" value={f.weightKg} onChangeText={set('weightKg')} />
      {size ? (
        <Card>
          <Muted>Size class: {size === 'LARGE' ? 'LARGE — 2 plan credits, floor-bay storage' : 'STANDARD — 1 plan credit, shelf storage'}</Muted>
        </Card>
      ) : null}

      <H2>Age category (years)</H2>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="From" keyboardType="decimal-pad" value={f.ageMin} onChangeText={set('ageMin')} placeholder="0.5" /></View>
        <View style={{ flex: 1 }}><Field label="To" keyboardType="decimal-pad" value={f.ageMax} onChangeText={set('ageMax')} placeholder="3" /></View>
      </View>
      {ageMaxM > ageMinM ? <Muted>Age band: {ageBandFor(ageMinM, ageMaxM)} years</Muted> : null}

      <H2>Material</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MATERIALS.map((m) => <Chip key={m} label={MATERIAL_LABEL[m]} selected={material === m} onPress={() => setMaterial(m)} />)}
      </View>

      <H2>Type</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Non-electric" selected={power === 'NON_ELECTRIC'} onPress={() => setPower('NON_ELECTRIC')} />
        <Chip label="Electric (needs battery)" selected={power === 'ELECTRIC'} onPress={() => setPower('ELECTRIC')} />
      </View>
      {power === 'ELECTRIC' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}><Field label="Battery type" value={f.batteryType} onChangeText={set('batteryType')} placeholder="AA / AAA / 12V" /></View>
          <View style={{ flex: 1 }}><Field label="Count" keyboardType="number-pad" value={f.batteryCount} onChangeText={set('batteryCount')} /></View>
        </View>
      ) : null}

      <H2>Pieces</H2>
      {lockPieces ? (
        <Muted style={{ marginBottom: 8 }}>
          {pieceType === 'SINGLE' ? 'Single piece' : `${f.pieceCount} pieces`} — locked because units already have piece QR labels.
        </Muted>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Single piece" selected={pieceType === 'SINGLE'} onPress={() => setPieceType('SINGLE')} />
            <Chip label="Multi piece" selected={pieceType === 'MULTI'} onPress={() => setPieceType('MULTI')} />
          </View>
          {pieceType === 'MULTI' ? (
            <Field label="Number of pieces (each gets its own QR label)" keyboardType="number-pad" value={f.pieceCount} onChangeText={set('pieceCount')} />
          ) : null}
        </View>
      )}

      <H2>Interest tags (drive recommendations)</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTERESTS.map((i) => (
          <Chip
            key={i}
            label={INTEREST_LABELS[i]}
            selected={interests.includes(i)}
            onPress={() => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
          />
        ))}
      </View>

      <H2>Visibility</H2>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Switch value={isActive} onValueChange={setIsActive} />
        <Text style={{ color: colors.ink, flex: 1 }}>
          {isActive ? 'Active — shown to customers when in storage' : 'Hidden — customers can’t see or order this toy'}
        </Text>
      </View>

      {problems.length ? <Muted style={{ marginTop: 8 }}>Still needed: {problems.join(', ')}</Muted> : null}
      <Button title={submitLabel} loading={busy} onPress={submit} disabled={problems.length > 0} />
    </View>
  );
}

/** Turns an API validation error into readable lines ("ageMaxMonths: Max age must be above min age"). */
export function describeError(e: unknown): string | null {
  if (!e) return null;
  const err = e as { message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
  const fields = Object.entries(err.details?.fieldErrors ?? {}).map(([k, v]) => `${k}: ${v.join(', ')}`);
  return [err.message, ...(err.details?.formErrors ?? []), ...fields].filter(Boolean).join('\n');
}
