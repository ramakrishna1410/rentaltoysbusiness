import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ToyImage } from '../../components/ToyImage';
import { Button, Card, Chip, ErrorText, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { api, useAuth } from '../../lib/api';
import { useBox } from '../../lib/box';
import { inr, type Subscription } from '../../lib/subscription';
import { colors } from '../../lib/theme';

interface Order {
  id: string;
  type: 'DELIVERY' | 'SWAP';
  status: string;
  scheduledDate: string;
  items: { id: string; direction: 'OUT' | 'RETURN'; toy: { name: string } }[];
}

const nextDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });

export default function MyToys() {
  const qc = useQueryClient();
  const { activeKidId } = useAuth();
  const box = useBox();
  const sub = useQuery({ queryKey: ['subscription'], queryFn: () => api.get<Subscription | null>('/subscriptions/current') });
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.get<Order[]>('/orders') });
  const [returning, setReturning] = useState<string[]>([]);
  const [date, setDate] = useState(nextDays(1)[0]);

  const place = useMutation({
    mutationFn: () =>
      api.post('/orders', {
        type: returning.length ? 'SWAP' : 'DELIVERY',
        kidId: activeKidId ?? undefined,
        toyIds: box.toys.map((t) => t.id),
        returnUnitIds: returning,
        scheduledDate: date.toISOString(),
      }),
    onSuccess: () => {
      box.clear();
      setReturning([]);
      qc.invalidateQueries();
    },
  });

  if (sub.isLoading) return <Loading />;
  const s = sub.data;
  const returnCredits = s?.toysAtHome.filter((t) => returning.includes(t.unitId)).reduce((a, t) => a + t.creditCost, 0) ?? 0;
  const creditsAfter = s ? s.plan.tier.toyCredits - s.remaining.credits - returnCredits + box.credits : 0;

  return (
    <Screen>
      <H1>My toys</H1>
      {!s ? (
        <Card>
          <Muted>No plan yet.</Muted>
          <Button title="See plans" onPress={() => router.push('/(tabs)/plans')} />
        </Card>
      ) : (
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 18, color: colors.ink }}>
            {s.plan.tier.name} · {s.plan.duration.name}
          </Text>
          <Muted>Status: {s.status.replace('_', ' ').toLowerCase()}</Muted>
          {s.status === 'PENDING_PAYMENT' ? (
            <Muted style={{ marginTop: 6 }}>
              First payment of {inr(s.invoices[0]?.amount ?? 0)} pending. Our team will confirm your payment and activate the plan.
            </Muted>
          ) : (
            <Muted style={{ marginTop: 6 }}>
              Left this month: {s.remaining.swaps} swaps · {s.remaining.deliveries} deliveries · {s.remaining.credits} of {s.plan.tier.toyCredits} toy credits
            </Muted>
          )}
          {s.missingPieceCharges > 0 ? <Text style={{ color: colors.danger, marginTop: 6 }}>{s.missingPieceCharges} missing piece(s) noted on returns.</Text> : null}
        </Card>
      )}

      {s?.toysAtHome.length ? (
        <View>
          <H2>At home</H2>
          <Muted style={{ marginBottom: 8 }}>Tap toys to send back in your next swap.</Muted>
          {s.toysAtHome.map((t) => {
            const on = returning.includes(t.unitId);
            return (
              <Pressable
                key={t.unitId}
                disabled={t.returnRequested}
                onPress={() => setReturning((r) => (on ? r.filter((x) => x !== t.unitId) : [...r, t.unitId]))}
              >
                <Card style={[{ flexDirection: 'row', alignItems: 'center' }, on && { borderColor: colors.primary, borderWidth: 2 }]}>
                  <ToyImage compact toy={t} style={{ width: 56, height: 56, borderRadius: 10 }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{t.name}</Text>
                    <Muted>{t.returnRequested ? 'Pickup scheduled' : on ? 'Returning in this swap' : `${t.creditCost} credit${t.creditCost > 1 ? 's' : ''}`}</Muted>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <H2>My box</H2>
      {box.toys.length === 0 ? <Muted>Add toys from the catalog to request a delivery.</Muted> : null}
      {box.toys.map((t) => (
        <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ToyImage compact toy={{ name: t.name, images: t.image ? [t.image] : [] }} style={{ width: 48, height: 48, borderRadius: 10 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{t.name}</Text>
            <Muted>{t.creditCost} credit{t.creditCost > 1 ? 's' : ''}</Muted>
          </View>
          <Button title="Remove" variant="ghost" onPress={() => box.remove(t.id)} />
        </Card>
      ))}
      {box.toys.length && s ? (
        <View>
          <Muted>
            Credits at home after this order: {creditsAfter} / {s.plan.tier.toyCredits}
          </Muted>
          <H2>Delivery day</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {nextDays(5).map((d) => (
              <Chip
                key={d.toISOString()}
                label={d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                selected={d.toDateString() === date.toDateString()}
                onPress={() => setDate(d)}
              />
            ))}
          </View>
          <ErrorText error={place.error} />
          <Button
            title={returning.length ? 'Request swap' : 'Request delivery'}
            loading={place.isPending}
            disabled={s.status !== 'ACTIVE' || creditsAfter > s.plan.tier.toyCredits}
            onPress={() => place.mutate()}
          />
        </View>
      ) : null}

      {orders.data?.length ? (
        <View>
          <H2>Orders</H2>
          {orders.data.map((o) => (
            <Card key={o.id}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                {o.type === 'SWAP' ? 'Swap' : 'Delivery'} · {new Date(o.scheduledDate).toLocaleDateString('en-IN')} · {o.status.toLowerCase()}
              </Text>
              <Muted>
                {o.items.map((i) => `${i.direction === 'OUT' ? '→' : '←'} ${i.toy.name}`).join('   ')}
              </Muted>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
