import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  ADMIN_TOY_FILTERS,
  ADMIN_TOY_FILTER_LABELS,
  ADMIN_TOY_SORTS,
  ADMIN_TOY_SORT_LABELS,
  AGE_BANDS,
  STAGE_LABELS,
  TOY_STAGES,
  type AdminToyFilter,
  type AdminToySort,
  type Material,
  type Page,
} from '@rentaltoys/shared';
import { STAGE_COLORS } from '../../components/StageBadge';
import { ToyImage } from '../../components/ToyImage';
import { Button, Chip, ErrorText, Field, Muted } from '../../components/ui';
import { api } from '../../lib/api';
import { colors, radius } from '../../lib/theme';
import type { Toy } from '../../lib/types';

const PAGE_SIZE = 24;
const GAP = 12;
const SIDE = 16;
const MAX_WIDTH = 1200;

const MATERIALS: [Material, string][] = [
  ['WOODEN', 'Wooden'],
  ['PLASTIC', 'Plastic'],
  ['FABRIC_PLUSH', 'Plush'],
  ['METAL', 'Metal'],
  ['MIXED', 'Mixed'],
];

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Page buttons around the current page: ‹ Prev 1 … 4 [5] 6 … 12 Next › */
function pageList(page: number, totalPages: number): (number | '…')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage(p: number): void }) {
  if (totalPages <= 1) return null;
  const btn = (label: string, target: number, opts: { active?: boolean; disabled?: boolean } = {}) => (
    <Pressable
      key={label}
      disabled={opts.disabled}
      onPress={() => onPage(target)}
      style={{
        minWidth: 38,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radius.sm,
        alignItems: 'center',
        backgroundColor: opts.active ? colors.primary : '#fff',
        borderWidth: 1,
        borderColor: opts.active ? colors.primary : colors.line,
        opacity: opts.disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontWeight: '700', color: opts.active ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginVertical: 16 }}>
      {btn('‹ Prev', page - 1, { disabled: page === 1 })}
      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <Text key={`gap-${i}`} style={{ alignSelf: 'center', color: colors.muted }}>
            …
          </Text>
        ) : (
          btn(String(p), p, { active: p === page })
        ),
      )}
      {btn('Next ›', page + 1, { disabled: page === totalPages })}
    </View>
  );
}

function ToyGridTile({ toy, width }: { toy: Toy; width: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/toy/${toy.id}`)}
      style={{ width, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 8, marginBottom: GAP }}
    >
      <ToyImage toy={toy} style={{ width: '100%', height: width * 0.7, borderRadius: radius.sm }} />
      <Text numberOfLines={2} style={{ fontWeight: '800', color: colors.ink, marginTop: 6 }}>
        {toy.name}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{toy.sku}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {TOY_STAGES.filter((s) => toy.unitsByStage?.[s]).map((s) => (
          <Text
            key={s}
            accessibilityLabel={`${toy.unitsByStage![s]} in ${STAGE_LABELS[s]}`}
            style={{ backgroundColor: STAGE_COLORS[s], color: '#fff', fontSize: 11, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}
          >
            {toy.unitsByStage![s]} {STAGE_LABELS[s].split(' ')[0].toLowerCase()}
          </Text>
        ))}
        {!toy.unitsByStage || Object.keys(toy.unitsByStage).length === 0 ? <Text style={{ fontSize: 11, color: colors.muted }}>No units yet</Text> : null}
      </View>
      {toy.photoCount === 0 ? <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>📷 Needs photos</Text> : null}
    </Pressable>
  );
}

export default function Toys() {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [filter, setFilter] = useState<AdminToyFilter | null>(null);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [sort, setSort] = useState<AdminToySort>('name');
  const [page, setPage] = useState(1);

  // Any change to the search or filters starts again from page 1.
  useEffect(() => setPage(1), [query, filter, ageBand, material, sort]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) p.set('q', query);
    if (filter) p.set('filter', filter);
    if (ageBand) p.set('ageBand', ageBand);
    if (material) p.set('material', material);
    return p.toString();
  }, [query, filter, ageBand, material, sort, page]);

  const toys = useQuery({
    queryKey: ['admin-toys', params],
    queryFn: () => api.get<Page<Toy>>(`/admin/toys?${params}`),
    placeholderData: keepPreviousData,
  });

  const contentW = Math.min(width, MAX_WIDTH);
  const cols = contentW >= 1000 ? 4 : contentW >= 700 ? 3 : 2;
  const tileW = (contentW - SIDE * 2 - GAP * (cols - 1)) / cols;
  const data = toys.data;

  const header = (
    <View>
      <Button title="+ Add new toy" onPress={() => router.push('/toy/new')} />
      <Field label="Search" placeholder="Name, SKU or brand" value={q} onChangeText={setQ} autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {ADMIN_TOY_FILTERS.map((f) => (
          <Chip key={f} label={ADMIN_TOY_FILTER_LABELS[f]} selected={filter === f} onPress={() => setFilter(filter === f ? null : f)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {AGE_BANDS.map((b) => (
          <Chip key={b.code} label={b.label} selected={ageBand === b.code} onPress={() => setAgeBand(ageBand === b.code ? null : b.code)} />
        ))}
        {MATERIALS.map(([m, label]) => (
          <Chip key={m} label={label} selected={material === m} onPress={() => setMaterial(material === m ? null : m)} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.muted, fontWeight: '700', marginRight: 8, marginBottom: 8 }}>Sort</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ADMIN_TOY_SORTS.map((s) => (
            <Chip key={s} label={ADMIN_TOY_SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </ScrollView>
      </View>
      <Muted style={{ marginBottom: 10 }}>
        {data
          ? data.total === 0
            ? 'No toys match.'
            : `Showing ${(data.page - 1) * data.pageSize + 1}–${(data.page - 1) * data.pageSize + data.items.length} of ${data.total} toys`
          : ' '}
      </Muted>
      <ErrorText error={toys.error} />
    </View>
  );

  const skeletons = Array.from({ length: cols * 2 }, (_, i) => ({ id: `skeleton-${i}` }) as Toy);

  return (
    <FlatList
      key={cols}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: SIDE, paddingBottom: 48, width: contentW, alignSelf: 'center' }}
      data={toys.isLoading ? skeletons : (data?.items ?? [])}
      keyExtractor={(t) => t.id}
      numColumns={cols}
      columnWrapperStyle={{ gap: GAP }}
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        toys.isLoading ? (
          <View style={{ width: tileW, height: tileW * 0.7 + 80, borderRadius: radius.md, backgroundColor: colors.line, marginBottom: GAP }} />
        ) : (
          <ToyGridTile toy={item} width={tileW} />
        )
      }
      refreshing={toys.isRefetching && !toys.isPlaceholderData}
      onRefresh={() => toys.refetch()}
      ListFooterComponent={data ? <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} /> : null}
    />
  );
}
