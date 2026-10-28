import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { INTEREST_LABELS, formatAgeRange } from '@rentaltoys/shared';
import { ToyImage } from '../../components/ToyImage';
import { Button, Card, Chip, ErrorText, H1, Loading, Muted, Screen } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import { useBox } from '../../lib/box';
import { colors, radius } from '../../lib/theme';
import type { ToyDetail } from '../../lib/types';

const MATERIAL: Record<string, string> = {
  PLASTIC: 'Plastic', WOODEN: 'Wooden', FABRIC_PLUSH: 'Soft plush', METAL: 'Metal', SILICONE_RUBBER: 'Silicone', MIXED: 'Mixed', OTHER: 'Other',
};

export default function ToyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeKidId } = useAuth();
  const box = useBox();
  const toy = useQuery({ queryKey: ['toy', id], queryFn: () => api.get<ToyDetail>(`/catalog/${id}${activeKidId ? `?kidId=${activeKidId}` : ''}`) });
  const { width } = useWindowDimensions();
  const [photoIdx, setPhotoIdx] = useState(0);
  const wish = useMutation({ mutationFn: () => api.post(`/catalog/${id}/wishlist`, { kidId: activeKidId ?? undefined }) });

  if (toy.isLoading) return <Loading />;
  if (!toy.data) return <ErrorText error={toy.error} />;
  const t = toy.data;
  const heroW = Math.min(width, 600) - 32;
  const rows: [string, string][] = [
    ['Age', formatAgeRange(t.ageMinMonths, t.ageMaxMonths)],
    ['Material', MATERIAL[t.material]],
    ['Power', t.powerType === 'ELECTRIC' ? `Electric · ${t.batteryCount ?? ''} × ${t.batteryType ?? 'battery'}` : 'No batteries needed'],
    ['Pieces', t.pieceType === 'SINGLE' ? 'Single piece' : `${t.pieceCount} pieces`],
    ['Size (L×B×H)', `${t.lengthCm} × ${t.breadthCm} × ${t.heightCm} cm`],
    ['Colour', t.color],
    ['Plan credits', t.creditCost === 2 ? 'Large toy · 2 credits' : '1 credit'],
  ];

  return (
    <Screen>
      {t.images.length > 1 ? (
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / heroW))}
            onScroll={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / heroW))}
            scrollEventThrottle={64}
          >
            {t.images.map((uri) => (
              <ToyImage key={uri} toy={t} uri={uri} style={[styles.hero, { width: heroW, height: heroW, marginBottom: 0 }]} />
            ))}
          </ScrollView>
          <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 6 }}>
            {photoIdx + 1} / {t.images.length} · swipe for more
          </Text>
        </View>
      ) : (
        <ToyImage toy={t} style={[styles.hero, { width: heroW, height: heroW }]} />
      )}
      <H1>{t.name}</H1>
      {t.brand ? <Muted>{t.brand}</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 }}>
        {t.interestTags.map((i) => (
          <Chip key={i} label={INTEREST_LABELS[i]} />
        ))}
      </View>
      <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>{t.description}</Text>
      <Card style={{ marginTop: 16 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={{ color: colors.muted }}>{k}</Text>
            <Text style={{ color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
          </View>
        ))}
      </Card>
      <Muted>
        {t.availableUnits > 0 ? `${t.availableUnits} available now` : 'All rented out right now'} · MRP ₹{t.mrp}
      </Muted>
      {box.has(t.id) ? (
        <Button title="In your box ✓ — view box" variant="outline" onPress={() => router.push('/(tabs)/mytoys')} />
      ) : (
        <Button
          title="Add to my box"
          disabled={t.availableUnits === 0}
          onPress={() => box.add({ id: t.id, name: t.name, creditCost: t.creditCost, image: t.images[0] })}
        />
      )}
      <Button title={wish.isSuccess ? 'Saved to wishlist ♥' : 'Save to wishlist'} variant="ghost" onPress={() => wish.mutate()} disabled={wish.isSuccess} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, marginBottom: 16, backgroundColor: colors.chip },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
});
