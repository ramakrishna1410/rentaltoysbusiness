import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { volumeCm3 } from '@rentaltoys/shared';
import { Card, ErrorText, H1, H2, Loading, Muted, Screen } from '../components/ui';
import { api } from '../lib/api';
import { colors } from '../lib/theme';

interface BinRow {
  id: string;
  code: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  maxWeightKg: number;
  usedVolumeCm3: number;
  usedWeightKg: number;
  pickCost: number;
  _count: { units: number };
}
interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  distanceToDispatchM: number;
  racks: { id: string; code: string; shelves: { id: string; level: number; bins: BinRow[] }[] }[];
}
interface Reslot {
  unitId: string;
  toy: string;
  bin: string;
  zone: string;
  velocity: string;
  expectedZone: string;
}

export default function Warehouse() {
  const zones = useQuery({ queryKey: ['warehouse'], queryFn: () => api.get<Zone[]>('/admin/warehouse') });
  const reslot = useQuery({ queryKey: ['reslot'], queryFn: () => api.get<Reslot[]>('/admin/warehouse/reslot') });
  if (zones.isLoading) return <Loading />;

  return (
    <Screen>
      <H1>Warehouse</H1>
      <Muted>Bins fill best-fit by size; fast-renting toys (A) sit near dispatch, slow ones (C) at the back.</Muted>
      <ErrorText error={zones.error} />
      <H2>Re-slot suggestions ({reslot.data?.length ?? 0})</H2>
      {reslot.data?.slice(0, 20).map((r) => (
        <Card key={r.unitId}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{r.toy}</Text>
          <Muted>
            In {r.bin} ({r.zone}) but demand is {r.velocity}-class → move to a {r.expectedZone} bin when next scanned
          </Muted>
        </Card>
      ))}
      {zones.data?.map((z) => (
        <View key={z.id}>
          <H2>
            {z.code} · {z.name} ({z.type}, {z.distanceToDispatchM} m to dispatch)
          </H2>
          {z.racks.map((r) =>
            r.shelves
              .slice()
              .reverse()
              .map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ width: 60, color: colors.muted, fontSize: 12 }}>
                    {r.code} L{s.level}
                  </Text>
                  {s.bins.map((b) => {
                    const pct = Math.round((b.usedVolumeCm3 / (volumeCm3(b) * 0.85)) * 100);
                    return (
                      <View
                        key={b.id}
                        style={{
                          width: 74,
                          padding: 4,
                          margin: 2,
                          borderRadius: 6,
                          backgroundColor: pct > 85 ? '#F8D7D7' : pct > 40 ? '#FFF1C9' : pct > 0 ? '#DDF3E4' : '#fff',
                          borderWidth: 1,
                          borderColor: colors.line,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>{b.code}</Text>
                        <Text style={{ fontSize: 10, color: colors.muted }}>
                          {b._count.units} toys · {pct}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )),
          )}
        </View>
      ))}
    </Screen>
  );
}
