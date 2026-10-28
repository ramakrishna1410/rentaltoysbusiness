import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  CATALOG_SORTS,
  CATALOG_SORT_LABELS,
  INTEREST_LABELS,
  INTERESTS,
  type CatalogSort,
  type Interest,
  type Material,
  type Page,
} from '@rentaltoys/shared';
import { KidSwitcher } from '../../components/KidSwitcher';
import { Chip, ErrorText, Field, Muted, SkeletonTile, ToyTile } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { ToyCard } from '../../lib/types';

const PAGE_SIZE = 20;
const GAP = 12;
const SIDE = 16;
const MAX_WIDTH = 960;

const MATERIAL_FILTERS: [Material, string][] = [
  ['WOODEN', 'Wooden'],
  ['PLASTIC', 'Plastic'],
  ['FABRIC_PLUSH', 'Plush'],
  ['METAL', 'Metal'],
];

/** Waits until typing pauses so every keystroke doesn't hit the API. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Catalog() {
  const { activeKidId } = useAuth();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [material, setMaterial] = useState<Material | null>(null);
  const [electric, setElectric] = useState<boolean | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [sort, setSort] = useState<CatalogSort>('best');

  const params = useMemo(() => {
    const p = new URLSearchParams({ sort, pageSize: String(PAGE_SIZE) });
    if (activeKidId) p.set('kidId', activeKidId);
    if (material) p.set('material', material);
    if (electric !== null) p.set('powerType', electric ? 'ELECTRIC' : 'NON_ELECTRIC');
    if (interest) p.set('interest', interest);
    if (query) p.set('q', query);
    return p.toString();
  }, [activeKidId, material, electric, interest, query, sort]);

  const toys = useInfiniteQuery({
    queryKey: ['catalog', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<Page<ToyCard>>(`/catalog?${params}&page=${pageParam}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const contentW = Math.min(width, MAX_WIDTH);
  const cols = contentW >= 600 ? 3 : 2;
  const tileW = (contentW - SIDE * 2 - GAP * (cols - 1)) / cols;
  const items = toys.data?.pages.flatMap((p) => p.items) ?? [];
  const total = toys.data?.pages[0]?.total;

  const header = (
    <View>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ color: colors.muted, fontWeight: '700', marginRight: 8, marginBottom: 8 }}>Sort</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATALOG_SORTS.map((s) => (
            <Chip key={s} label={s === 'best' && !activeKidId ? 'Popular' : CATALOG_SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </ScrollView>
      </View>
      <Muted style={{ marginBottom: 10 }}>
        {total === undefined ? ' ' : `${total} toy${total === 1 ? '' : 's'} available${sort === 'best' && activeKidId ? ' · best matches first' : ''}`}
      </Muted>
      <ErrorText error={toys.error} />
    </View>
  );

  const skeletons = Array.from({ length: cols * 3 }, (_, i) => ({ id: `skeleton-${i}` }) as ToyCard);

  return (
    <FlatList
      key={cols /* numColumns can't change on the fly */}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: SIDE, paddingBottom: 48, width: contentW, alignSelf: 'center' }}
      data={toys.isLoading ? skeletons : items}
      keyExtractor={(t) => t.id}
      numColumns={cols}
      columnWrapperStyle={{ gap: GAP }}
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        toys.isLoading ? (
          <SkeletonTile width={tileW} style={{ marginRight: 0 }} />
        ) : (
          <ToyTile toy={item} width={tileW} style={{ marginRight: 0, marginBottom: 16 }} onPress={() => router.push(`/toy/${item.id}`)} />
        )
      }
      onEndReached={() => {
        if (toys.hasNextPage && !toys.isFetchingNextPage) toys.fetchNextPage();
      }}
      onEndReachedThreshold={0.6}
      refreshing={toys.isRefetching && !toys.isFetchingNextPage}
      onRefresh={() => toys.refetch()}
      ListEmptyComponent={toys.isLoading ? null : <Muted>No toys match these filters right now.</Muted>}
      ListFooterComponent={
        toys.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : items.length > 0 && !toys.hasNextPage ? (
          <Muted style={{ textAlign: 'center', marginVertical: 16 }}>That's all {total} toys 🎉</Muted>
        ) : null
      }
    />
  );
}
