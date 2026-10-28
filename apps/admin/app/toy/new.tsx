import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  INTEREST_LABELS,
  INTERESTS,
  MATERIALS,
  ageBandFor,
  sizeClassFor,
  type Interest,
  type Material,
  type PieceType,
  type PowerType,
} from '@rentaltoys/shared';
import { Button, Card, Chip, ErrorText, Field, H2, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import type { Toy } from '../../lib/types';

const MATERIAL_LABEL: Record<Material, string> = {
  PLASTIC: 'Plastic', WOODEN: 'Wooden', FABRIC_PLUSH: 'Fabric / plush', METAL: 'Metal', SILICONE_RUBBER: 'Silicone / rubber', MIXED: 'Mixed', OTHER: 'Other',
};

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export default function NewToy() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    sku: '', name: '', brand: '', description: '', image: '', color: '',
    lengthCm: '', breadthCm: '', heightCm: '', weightKg: '', manufacturingDate: '',
    ageMin: '', ageMax: '', mrp: '', batteryType: '', batteryCount: '', pieceCount: '1',
  });
  const [material, setMaterial] = useState<Material>('PLASTIC');
  const [power, setPower] = useState<PowerType>('NON_ELECTRIC');
  const [pieceType, setPieceType] = useState<PieceType>('SINGLE');
  const [interests, setInterests] = useState<Interest[]>([]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const dims = { lengthCm: num(f.lengthCm), breadthCm: num(f.breadthCm), heightCm: num(f.heightCm) };
  const dimsOk = Object.values(dims).every((v) => v > 0) && num(f.weightKg) > 0;
  const size = dimsOk ? sizeClassFor(dims, num(f.weightKg)) : null;
  const ageMinM = Math.round(num(f.ageMin) * 12);
  const ageMaxM = Math.round(num(f.ageMax) * 12);

  const save = useMutation({
    mutationFn: () =>
      api.post<Toy>('/admin/toys', {
        sku: f.sku.trim().toUpperCase(),
        name: f.name.trim(),
        brand: f.brand || undefined,
        description: f.description,
        images: f.image ? [f.image] : [],
        color: f.color,
        ...dims,
        weightKg: num(f.weightKg),
        manufacturingDate: f.manufacturingDate,
        ageMinMonths: ageMinM,
        ageMaxMonths: ageMaxM,
        material,
        powerType: power,
        batteryType: power === 'ELECTRIC' ? f.batteryType : undefined,
        batteryCount: power === 'ELECTRIC' && f.batteryCount ? num(f.batteryCount) : undefined,
        pieceType,
        pieceCount: pieceType === 'SINGLE' ? 1 : num(f.pieceCount),
        interestTags: interests,
        mrp: num(f.mrp),
      }),
    onSuccess: (toy) => {
      qc.invalidateQueries({ queryKey: ['admin-toys'] });
      router.replace(`/toy/${toy.id}`);
    },
  });

  return (
    <Screen>
      <H2>Basics</H2>
      <Field label="SKU" autoCapitalize="characters" value={f.sku} onChangeText={set('sku')} placeholder="WD-ABACUS-01" />
      <Field label="Name" value={f.name} onChangeText={set('name')} />
      <Field label="Brand" value={f.brand} onChangeText={set('brand')} />
      <Field label="Colour" value={f.color} onChangeText={set('color')} />
      <Field label="Description" multiline value={f.description} onChangeText={set('description')} />
      <Field label="Image URL" autoCapitalize="none" value={f.image} onChangeText={set('image')} />
      <Field label="MRP (₹)" keyboardType="number-pad" value={f.mrp} onChangeText={set('mrp')} />
      <Field label="Manufacturing date (YYYY-MM-DD)" value={f.manufacturingDate} onChangeText={set('manufacturingDate')} />

      <H2>Dimensions (boxed)</H2>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="L (cm)" keyboardType="decimal-pad" value={f.lengthCm} onChangeText={set('lengthCm')} /></View>
        <View style={{ flex: 1 }}><Field label="B (cm)" keyboardType="decimal-pad" value={f.breadthCm} onChangeText={set('breadthCm')} /></View>
        <View style={{ flex: 1 }}><Field label="H (cm)" keyboardType="decimal-pad" value={f.heightCm} onChangeText={set('heightCm')} /></View>
      </View>
      <Field label="Weight (kg)" keyboardType="decimal-pad" value={f.weightKg} onChangeText={set('weightKg')} />
      {size ? (
        <Card>
          <Muted>
            Size class: {size === 'LARGE' ? 'LARGE — 2 plan credits, floor-bay storage' : 'STANDARD — 1 plan credit, shelf storage'}
          </Muted>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Single piece" selected={pieceType === 'SINGLE'} onPress={() => setPieceType('SINGLE')} />
        <Chip label="Multi piece" selected={pieceType === 'MULTI'} onPress={() => setPieceType('MULTI')} />
      </View>
      {pieceType === 'MULTI' ? (
        <Field label="Number of pieces (each gets its own QR label)" keyboardType="number-pad" value={f.pieceCount} onChangeText={set('pieceCount')} />
      ) : null}

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

      <ErrorText error={save.error} />
      <Button title="Save toy" loading={save.isPending} onPress={() => save.mutate()} disabled={!f.sku || !f.name || !dimsOk} />
    </Screen>
  );
}
