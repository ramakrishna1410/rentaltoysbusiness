import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatAgeRange } from '@rentaltoys/shared';
import { StageBadge } from '../../components/StageBadge';
import { Button, Card, ErrorText, Field, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Toy, Unit } from '../../lib/types';

export default function ToyAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const toy = useQuery({ queryKey: ['admin-toy', id], queryFn: () => api.get<Toy & { units: Unit[] }>(`/admin/toys/${id}`) });
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [labels, setLabels] = useState('');

  const procure = useMutation({
    mutationFn: () =>
      api.post<Unit>('/admin/units', {
        toyId: id,
        vendor: vendor || undefined,
        cost: Number(cost),
        pieceLabels: labels.trim() ? labels.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: (unit) => {
      qc.invalidateQueries();
      router.push(`/unit/${unit.id}`);
    },
  });

  if (toy.isLoading) return <Loading />;
  if (!toy.data) return <ErrorText error={toy.error} />;
  const t = toy.data;
  const rows: [string, string][] = [
    ['SKU', t.sku],
    ['Brand', t.brand ?? '—'],
    ['Colour', t.color],
    ['Dimensions (L×B×H)', `${t.lengthCm} × ${t.breadthCm} × ${t.heightCm} cm`],
    ['Weight', `${t.weightKg} kg`],
    ['Size class', t.sizeClass],
    ['Manufactured', t.manufacturingDate.slice(0, 10)],
    ['Age', formatAgeRange(t.ageMinMonths, t.ageMaxMonths)],
    ['Material', t.material],
    ['Type', t.powerType === 'ELECTRIC' ? `Electric · ${t.batteryCount ?? '?'} × ${t.batteryType}` : 'Non-electric'],
    ['Pieces', `${t.pieceType} · ${t.pieceCount}`],
    ['Interests', t.interestTags.join(', ') || '—'],
    ['Rentals', String(t.rentalCount)],
  ];

  return (
    <Screen>
      <H1>{t.name}</H1>
      <Card>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 }}>
            <Muted>{k}</Muted>
            <Text style={{ color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
          </View>
        ))}
      </Card>

      <H2>Procure a unit</H2>
      <Card>
        <Field label="Vendor" value={vendor} onChangeText={setVendor} />
        <Field label="Cost (₹)" keyboardType="number-pad" value={cost} onChangeText={setCost} />
        {t.pieceCount > 1 ? (
          <Field
            label={`Piece labels (optional, one per line, ${t.pieceCount} lines)`}
            multiline
            value={labels}
            onChangeText={setLabels}
            placeholder={'Engine\nCarriage 1\nTrack curve'}
          />
        ) : null}
        <Muted>Creates the unit in PROCUREMENT with {t.pieceCount > 1 ? `1 unit QR + ${t.pieceCount} piece QRs` : '1 QR'}, stored in the backend.</Muted>
        <ErrorText error={procure.error} />
        <Button title="Create unit & QR labels" loading={procure.isPending} disabled={!cost} onPress={() => procure.mutate()} />
      </Card>

      <H2>Units ({t.units.length})</H2>
      {t.units.map((u) => (
        <Pressable key={u.id} onPress={() => router.push(`/unit/${u.id}`)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '700', color: colors.ink }}>…{u.id.slice(-8)}</Text>
              <Muted>{u.bin ? `Bin ${u.bin.code}` : 'Not in a bin'}</Muted>
            </View>
            <StageBadge stage={u.stage} />
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
