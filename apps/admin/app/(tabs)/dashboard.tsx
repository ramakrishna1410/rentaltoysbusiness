import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { STAGE_LABELS, TOY_STAGES } from '@rentaltoys/shared';
import { STAGE_COLORS } from '../../components/StageBadge';
import { Button, Card, ErrorText, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import { colors } from '../../lib/theme';

interface Summary {
  byStage: Record<string, number>;
  zones: { zone: string; type: string; bins: number; utilisationPct: number }[];
}

export default function Dashboard() {
  const { me } = useAuth();
  const summary = useQuery({ queryKey: ['summary'], queryFn: () => api.get<Summary>('/admin/summary') });
  const reslot = useQuery({ queryKey: ['reslot'], queryFn: () => api.get<unknown[]>('/admin/warehouse/reslot') });

  return (
    <Screen>
      <H1>Hello {me?.name}</H1>
      <Button title="Scan a toy" onPress={() => router.push('/(tabs)/scan')} />
      {summary.isLoading ? <Loading /> : null}
      <ErrorText error={summary.error} />
      {summary.data ? (
        <View>
          <H2>Toys by stage</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {TOY_STAGES.map((s) => (
              <Card key={s} style={{ width: 150, borderLeftWidth: 6, borderLeftColor: STAGE_COLORS[s], marginBottom: 0 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink }}>{summary.data.byStage[s] ?? 0}</Text>
                <Muted>{STAGE_LABELS[s]}</Muted>
              </Card>
            ))}
          </View>
          <H2>Warehouse space</H2>
          {summary.data.zones.map((z) => (
            <Card key={z.zone}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                {z.zone} · {z.type} · {z.bins} bins
              </Text>
              <View style={{ height: 10, backgroundColor: colors.line, borderRadius: 5, marginTop: 8 }}>
                <View style={{ width: `${Math.min(100, z.utilisationPct)}%`, height: 10, backgroundColor: colors.primary, borderRadius: 5 }} />
              </View>
              <Muted style={{ marginTop: 4 }}>{z.utilisationPct}% of usable volume used</Muted>
            </Card>
          ))}
          <Pressable onPress={() => router.push('/warehouse')}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink }}>Re-slot suggestions: {reslot.data?.length ?? '…'}</Text>
              <Muted>Toys whose demand no longer matches their zone. Tap to view the warehouse.</Muted>
            </Card>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
