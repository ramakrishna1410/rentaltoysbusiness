import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STAGE_LABELS, formatAgeRange, type ToyStage } from '@rentaltoys/shared';
import { ToyImage } from '../../components/ToyImage';
import { Button, Card, ErrorText, Field, Loading, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Toy } from '../../lib/types';

export default function Toys() {
  const toys = useQuery({ queryKey: ['admin-toys'], queryFn: () => api.get<Toy[]>('/admin/toys') });
  const [q, setQ] = useState('');
  const list = toys.data?.filter((t) => `${t.name} ${t.sku} ${t.brand ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Screen>
      <Button title="+ Add new toy" onPress={() => router.push('/toy/new')} />
      <Field label="Search" placeholder="Name, SKU or brand" value={q} onChangeText={setQ} />
      {toys.isLoading ? <Loading /> : null}
      <ErrorText error={toys.error} />
      {list?.map((t) => (
        <Pressable key={t.id} onPress={() => router.push(`/toy/${t.id}`)}>
          <Card style={{ flexDirection: 'row', gap: 12 }}>
            <ToyImage compact toy={t} style={{ width: 64, height: 64, borderRadius: 10 }} />
            <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.ink }}>{t.name}</Text>
            <Muted>
              {t.sku} · {formatAgeRange(t.ageMinMonths, t.ageMaxMonths)} · {t.material.toLowerCase()} · {t.powerType === 'ELECTRIC' ? 'electric' : 'non-electric'} ·{' '}
              {t.pieceCount} pc · {t.sizeClass.toLowerCase()}
            </Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(t.unitsByStage ?? {}).map(([s, n]) => (
                <Text key={s} style={{ marginRight: 10, color: colors.muted, fontSize: 12 }}>
                  {STAGE_LABELS[s as ToyStage]}: {n}
                </Text>
              ))}
            </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
