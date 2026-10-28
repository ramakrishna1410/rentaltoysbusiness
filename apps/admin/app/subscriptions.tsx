import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from '@rentaltoys/shared';
import { Button, Card, Chip, ErrorText, Field, H1, Loading, Muted, Screen } from '../components/ui';
import { api } from '../lib/api';
import { colors } from '../lib/theme';

interface AdminSub {
  id: string;
  status: SubscriptionStatus;
  billingCycle: string;
  commitmentEnd: string;
  swapsUsed: number;
  deliveriesUsed: number;
  creditsInUse: number;
  missingPieceCharges: number;
  user: { name: string; phone: string };
  plan: { tier: { name: string }; duration: { name: string } };
  invoices: { id: string; seq: number; dueDate: string; amount: number; status: 'PENDING' | 'PAID'; paymentRef: string | null }[];
}

export default function Subscriptions() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const subs = useQuery({
    queryKey: ['admin-subs', status],
    queryFn: () => api.get<AdminSub[]>(`/admin/subscriptions${status ? `?status=${status}` : ''}`),
  });
  const markPaid = useMutation({
    mutationFn: (v: { id: string; paymentRef: string }) => api.post(`/admin/invoices/${v.id}/mark-paid`, { paymentRef: v.paymentRef }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subs'] }),
  });
  const action = useMutation({
    mutationFn: (v: { id: string; action: 'pause' | 'resume' | 'cancel' }) => api.post(`/admin/subscriptions/${v.id}/${v.action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subs'] }),
  });

  return (
    <Screen>
      <H1>Subscriptions</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="All" selected={!status} onPress={() => setStatus(null)} />
        {SUBSCRIPTION_STATUSES.map((s) => (
          <Chip key={s} label={s.replace('_', ' ').toLowerCase()} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>
      {subs.isLoading ? <Loading /> : null}
      <ErrorText error={subs.error ?? markPaid.error ?? action.error} />
      {subs.data?.map((s) => {
        const next = s.invoices.find((i) => i.status === 'PENDING');
        return (
          <Card key={s.id}>
            <Text style={{ fontWeight: '800', color: colors.ink }}>
              {s.user.name} · {s.plan.tier.name} {s.plan.duration.name} · {s.billingCycle.toLowerCase()} billing
            </Text>
            <Muted>
              {s.status} · ends {s.commitmentEnd.slice(0, 10)} · swaps used {s.swapsUsed} · deliveries {s.deliveriesUsed} · credits {s.creditsInUse}
              {s.missingPieceCharges ? ` · ${s.missingPieceCharges} missing pieces` : ''}
            </Muted>
            <Muted>
              Paid {s.invoices.filter((i) => i.status === 'PAID').length}/{s.invoices.length} instalments
            </Muted>
            {next ? (
              <View style={{ marginTop: 8 }}>
                <Field
                  label={`Instalment ${next.seq}: ₹${next.amount} due ${next.dueDate.slice(0, 10)} — payment reference`}
                  placeholder="UPI / bank ref"
                  value={refs[next.id] ?? ''}
                  onChangeText={(v) => setRefs((r) => ({ ...r, [next.id]: v }))}
                />
                <Button
                  title="Mark paid"
                  variant="outline"
                  disabled={!refs[next.id]}
                  onPress={() => markPaid.mutate({ id: next.id, paymentRef: refs[next.id] })}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {s.status === 'ACTIVE' ? <Button title="Pause" variant="ghost" onPress={() => action.mutate({ id: s.id, action: 'pause' })} /> : null}
              {s.status === 'PAUSED' ? <Button title="Resume" variant="ghost" onPress={() => action.mutate({ id: s.id, action: 'resume' })} /> : null}
              {s.status !== 'CANCELLED' && s.status !== 'EXPIRED' ? (
                <Button title="Cancel" variant="ghost" onPress={() => action.mutate({ id: s.id, action: 'cancel' })} />
              ) : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
