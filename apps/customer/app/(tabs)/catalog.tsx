import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { INTEREST_LABELS, INTERESTS, type Interest, type Material } from '@rentaltoys/shared';
import { KidSwitcher } from '../../components/KidSwitcher';
import { Chip, ErrorText, Field, Loading, Muted, Screen, ToyTile } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import type { ToyCard } from '../../lib/types';

const MATERIAL_FILTERS: [Material, string][] = [
  ['WOODEN', 'Wooden'],
  ['PLASTIC', 'Plastic'],
  ['FABRIC_PLUSH', 'Plush'],
  ['METAL', 'Metal'],
];

export default function Catalog() {
  const { activeKidId } = useAuth();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [electric, setElectric] = useState<boolean | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (activeKidId) p.set('kidId', activeKidId);
    if (material) p.set('material', material);
    if (electric !== null) p.set('powerType', electric ? 'ELECTRIC' : 'NON_ELECTRIC');
    if (interest) p.set('interest', interest);
    if (q.trim()) p.set('q', q.trim());
    return p.toString();
  }, [activeKidId, material, electric, interest, q]);

  const toys = useQuery({ queryKey: ['catalog', params], queryFn: () => api.get<ToyCard[]>(`/catalog?${params}`) });
  const cols = Math.max(2, Math.floor((Math.min(width, 900) - 32) / 172));
  const tileW = (Math.min(width, 900) - 32 - (cols - 1) * 12) / cols;

  return (
    <Screen>
      <KidSwitcher />
      <Field label="Search" placeholder="Search toys or brands" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="🔋 Electric" selected={electric === true} onPress={() => setElectric(electric === true ? null : true)} />
        <Chip label="No batteries" selected={electric === false} onPress={() => setElectric(electric === false ? null : false)} />
        {MATERIAL_FILTERS.map(([m, label]) => (
          <Chip key={m} label={label} selected={material === m} onPress={() => setMaterial(material === m ? null : m)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {INTERESTS.filter((i) => i !== 'ELECTRIC' && i !== 'WOODEN').map((i) => (
          <Chip key={i} label={INTEREST_LABELS[i]} selected={interest === i} onPress={() => setInterest(interest === i ? null : i)} />
        ))}
      </ScrollView>
      <Muted style={{ marginVertical: 8 }}>{activeKidId ? 'Sorted by what suits your kid best' : 'Most popular first'}</Muted>
      {toys.isLoading ? <Loading /> : null}
      <ErrorText error={toys.error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {toys.data?.map((t) => (
          <ToyTile key={t.id} toy={t} width={tileW} onPress={() => router.push(`/toy/${t.id}`)} />
        ))}
      </View>
      {toys.data?.length === 0 ? <Muted>No toys match these filters right now.</Muted> : null}
    </Screen>
  );
}
