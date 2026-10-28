import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { KidSwitcher } from '../../components/KidSwitcher';
import { Card, ErrorText, H1, H2, Muted, Screen, SkeletonTile, ToyTile } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import type { ToyCard } from '../../lib/types';

interface ForYou {
  kid: { id: string; name: string; ageMonths: number };
  allowance: { swaps: number; deliveries: number; credits: number } | null;
  sections: { key: string; title: string; toys: ToyCard[] }[];
}

export default function Home() {
  const { me, activeKidId } = useAuth();
  const q = useQuery({
    queryKey: ['for-you', activeKidId],
    enabled: !!activeKidId,
    queryFn: () => api.get<ForYou>(`/catalog/for-you?kidId=${activeKidId}`),
  });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <H1>Hi {me?.name.split(' ')[0]} 👋</H1>
      <KidSwitcher />
      {q.data?.allowance ? (
        <Card>
          <Muted>
            This month: {q.data.allowance.swaps} swaps · {q.data.allowance.deliveries} deliveries · {q.data.allowance.credits} toy credits free
          </Muted>
        </Card>
      ) : (
        <Card>
          <Muted>Choose a plan to start renting. Tap “Plans” below.</Muted>
        </Card>
      )}
      {q.isLoading
        ? [0, 1].map((row) => (
            <View key={row}>
              <View style={{ height: 18, width: 160, borderRadius: 6, backgroundColor: '#EFE6DC', marginTop: 16, marginBottom: 8 }} />
              <ScrollView horizontal scrollEnabled={false}>
                {[0, 1, 2].map((i) => (
                  <SkeletonTile key={i} />
                ))}
              </ScrollView>
            </View>
          ))
        : null}
      <ErrorText error={q.error} />
      {q.data?.sections.map((s) =>
        s.toys.length ? (
          <View key={s.key}>
            <H2>{s.title}</H2>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {s.toys.map((t) => (
                <ToyTile key={t.id} toy={t} onPress={() => router.push(`/toy/${t.id}`)} />
              ))}
            </ScrollView>
          </View>
        ) : null,
      )}
    </Screen>
  );
}
