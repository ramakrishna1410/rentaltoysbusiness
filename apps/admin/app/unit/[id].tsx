import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, Platform, Text, View } from 'react-native';
import { STAGE_LABELS } from '@rentaltoys/shared';
import { StageBadge } from '../../components/StageBadge';
import { Button, Card, ErrorText, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Unit } from '../../lib/types';

export default function UnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useQuery({ queryKey: ['unit', id], queryFn: () => api.get<Unit>(`/admin/units/${id}`) });

  async function printLabels() {
    const html = await api.text(`/admin/units/${id}/labels`);
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank');
      w?.document.write(html);
      w?.document.close();
      w?.print();
    } else {
      await Print.printAsync({ html });
    }
  }

  if (unit.isLoading) return <Loading />;
  if (!unit.data) return <ErrorText error={unit.error} />;
  const u = unit.data;
  const qrUrl = (qrId: string | null) => (qrId ? api.url(`/qr/${qrId}.png`) : undefined);

  return (
    <Screen>
      <H1>{u.toy.name}</H1>
      <Muted>
        Unit …{u.id.slice(-8)} · {u.toy.sku} · procured {u.procurementDate.slice(0, 10)} from {u.vendor ?? '—'} for ₹{u.cost}
      </Muted>
      <Card style={{ marginTop: 12 }}>
        <StageBadge stage={u.stage} big />
        <Muted style={{ marginTop: 6 }}>
          {u.bin ? `Bin ${u.bin.code} · ${u.bin.shelf?.rack.zone.code} · shelf ${u.bin.shelf?.level}` : 'Not in a bin'}
          {u.reservedForOrderId ? ` · reserved for order …${u.reservedForOrderId.slice(-6)}` : ''}
        </Muted>
      </Card>
      <Button title="Print QR labels (unit + every piece)" onPress={printLabels} />
      <Button title="Scan to move stage" variant="outline" onPress={() => router.push('/(tabs)/scan')} />

      <H2>QR labels</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Card style={{ alignItems: 'center', width: 150 }}>
          {qrUrl(u.qrImageId) ? <Image source={{ uri: qrUrl(u.qrImageId) }} style={{ width: 110, height: 110 }} /> : null}
          <Text style={{ fontWeight: '700', color: colors.ink, marginTop: 4 }}>Unit</Text>
        </Card>
        {u.toy.pieceCount > 1
          ? u.pieces.map((p) => (
              <Card key={p.id} style={{ alignItems: 'center', width: 150 }}>
                {qrUrl(p.qrImageId) ? <Image source={{ uri: qrUrl(p.qrImageId) }} style={{ width: 110, height: 110 }} /> : null}
                <Text numberOfLines={2} style={{ fontWeight: '700', color: colors.ink, marginTop: 4, textAlign: 'center' }}>
                  {p.pieceNo}. {p.label}
                </Text>
                <Text style={{ color: p.status === 'PRESENT' ? colors.success : colors.danger, fontSize: 12 }}>{p.status.toLowerCase()}</Text>
              </Card>
            ))
          : null}
      </View>

      <H2>Movement history (every scan)</H2>
      {u.movements?.map((m) => (
        <Card key={m.id}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>
            {m.fromStage ? STAGE_LABELS[m.fromStage] : 'New'} → {STAGE_LABELS[m.toStage]}
          </Text>
          <Muted>
            {new Date(m.scannedAt).toLocaleString('en-IN')} · by {m.scannedBy.name}
            {m.pieceScan && m.pieceScan.total > 1 ? ` · pieces ${m.pieceScan.scanned.length}/${m.pieceScan.total}` : ''}
            {m.reason ? ` · ${m.reason}` : ''}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
