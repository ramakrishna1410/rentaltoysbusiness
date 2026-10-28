import { useInfiniteQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { COLOR_LABELS, COLOR_SWATCHES, INTEREST_LABELS, PARENT_GOAL_LABELS, PLAY_PLACE_LABELS, ageInMonths, type Page } from '@rentaltoys/shared';
import { parseDob } from '../components/KidForm';
import { DISPLAY_FONT, NavBar } from '../components/landing';
import { ErrorText, Muted, SkeletonTile, ToyTile } from '../components/ui';
import { api, useAuth } from '../lib/api';
import { draftQuery, useDraft } from '../lib/draft';
import { colors, radius } from '../lib/theme';
import type { ToyCard } from '../lib/types';

const PAGE_SIZE = 20;
const GAP = 12;
const SIDE = 16;
const MAX_WIDTH = 960;

/** The catalog ranked for a guest's "Get started" answers. Signing up happens only when they add a toy. */
export default function Explore() {
  const { ready, me } = useAuth();
  const { draft } = useDraft();
  const { width } = useWindowDimensions();
  const dob = draft ? parseDob(draft.dateOfBirth) : null;
  const ageMonths = dob ? ageInMonths(dob) : null;
  const query = draft ? draftQuery(draft, ageMonths) : '';

  const toys = useInfiniteQuery({
    queryKey: ['explore', query],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<Page<ToyCard>>(`/catalog?sort=best&pageSize=${PAGE_SIZE}&page=${pageParam}&${query}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  if (ready && me) return <Redirect href="/(tabs)/catalog" />;

  const contentW = Math.min(width, MAX_WIDTH);
  const cols = contentW >= 600 ? 3 : 2;
  const tileW = (contentW - SIDE * 2 - GAP * (cols - 1)) / cols;
  const items = toys.data?.pages.flatMap((p) => p.items) ?? [];
  const total = toys.data?.pages[0]?.total;
  const name = draft?.kidName.trim();

  const chips: { label: string; swatch?: string }[] = [];
  if (ageMonths !== null) chips.push({ label: ageMonths < 24 ? `${ageMonths} mo` : `${Math.floor(ageMonths / 12)} yrs` });
  for (const c of draft?.favoriteColors ?? []) {
    chips.push(c === 'MULTI' ? { label: 'Multicolour' } : c === 'DUAL' ? { label: 'Two-tone' } : { label: COLOR_LABELS[c], swatch: COLOR_SWATCHES[c] });
  }
  for (const i of draft?.interests ?? []) chips.push({ label: INTEREST_LABELS[i] });
  if (draft?.playPlace) chips.push({ label: PLAY_PLACE_LABELS[draft.playPlace] });
  for (const g of draft?.goals ?? []) chips.push({ label: PARENT_GOAL_LABELS[g] });

  const header = (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <Text style={{ ...DISPLAY_FONT, fontSize: 30, color: colors.ink }}>{name ? `Picked for ${name}` : 'Toys for your little one'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {chips.map((c) => (
          <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            {c.swatch ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.swatch, borderWidth: 1, borderColor: '#0002' }} /> : null}
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{c.label}</Text>
          </View>
        ))}
        <Pressable onPress={() => router.push('/start')} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.primaryDark, fontWeight: '800', fontSize: 13, padding: 4 }}>{chips.length ? 'Edit' : 'Answer 4 quick questions'}</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: colors.ink, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{name ? `Save ${name}'s picks` : 'Save your picks'}</Text>
          <Text style={{ color: '#fff', fontSize: 13 }}>Create a free account to add toys and choose a plan.</Text>
        </View>
        <Pressable onPress={() => router.push('/signup')} accessibilityRole="button" style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Sign up</Text>
        </Pressable>
      </View>
      <Muted>{total === undefined ? ' ' : `${total} toys available${chips.length ? ' · best matches first' : ''}`}</Muted>
      <ErrorText error={toys.error} />
    </View>
  );

  const skeletons = Array.from({ length: cols * 3 }, (_, i) => ({ id: `skeleton-${i}` }) as ToyCard);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar />
      <FlatList
        key={cols}
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
            <ToyTile
              toy={item}
              width={tileW}
              style={{ marginRight: 0, marginBottom: 16 }}
              onPress={() => router.push(`/toy/${item.id}`)}
              onAdded={() => router.push('/signup')}
            />
          )
        }
        onEndReached={() => {
          if (toys.hasNextPage && !toys.isFetchingNextPage) toys.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshing={toys.isRefetching && !toys.isFetchingNextPage}
        onRefresh={() => toys.refetch()}
        ListFooterComponent={toys.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
      />
    </View>
  );
}
