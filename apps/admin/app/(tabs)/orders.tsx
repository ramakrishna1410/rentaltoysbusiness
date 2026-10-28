import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import type { ToyStage } from '@rentaltoys/shared';
import { StageBadge } from '../../components/StageBadge';
import { Card, ErrorText, H1, Loading, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

interface AdminOrder {
  id: string;
  type: 'DELIVERY' | 'SWAP';
  status: string;
  scheduledDate: string;
  subscription: { user: { name: string; phone: string; addressLine: string | null; area: string | null; pincode: string | null } };
  items: {
    id: string;
    direction: 'OUT' | 'RETURN';
    toy: { name: string; pieceCount: number };
    unit: { id: string; stage: ToyStage; bin: { code: string } | null } | null;
  }[];
}

/** Pick list: which unit to take from which bin, and what to collect back. */
export default function Orders() {
  const orders = useQuery({ queryKey: ['admin-orders'], queryFn: () => api.get<AdminOrder[]>('/admin/orders') });
  if (orders.isLoading) return <Loading />;
  return (
    <Screen>
      <H1>Orders</H1>
      <ErrorText error={orders.error} />
      {orders.data?.length === 0 ? <Muted>No orders yet.</Muted> : null}
      {orders.data?.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '800', color: colors.ink }}>
            {o.type} · {new Date(o.scheduledDate).toLocaleDateString('en-IN')} · {o.status}
          </Text>
          <Muted>
            {o.subscription.user.name} · {o.subscription.user.phone} · {[o.subscription.user.addressLine, o.subscription.user.area, o.subscription.user.pincode].filter(Boolean).join(', ')}
          </Muted>
          {o.items.map((i) => (
            <Pressable key={i.id} onPress={() => i.unit && router.push(`/unit/${i.unit.id}`)} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.ink }}>
                {i.direction === 'OUT' ? '→ Send' : '← Collect'} {i.toy.name} ({i.toy.pieceCount} pc)
                {i.direction === 'OUT' && i.unit?.bin ? ` · pick from ${i.unit.bin.code}` : ''}
              </Text>
              {i.unit ? <StageBadge stage={i.unit.stage} /> : null}
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
