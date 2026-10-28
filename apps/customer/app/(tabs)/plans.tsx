import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BillingCycle, DurationCode, TierCode } from '@rentaltoys/shared';
import { Button, Card, Chip, ErrorText, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { CYCLE_LABEL, inr, type Plan, type PlanDuration, type PlanTier, type Subscription } from '../../lib/subscription';
import { colors, radius } from '../../lib/theme';

export default function Plans() {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<{ tiers: PlanTier[]; durations: PlanDuration[]; plans: Plan[] }>('/plans') });
  const current = useQuery({ queryKey: ['subscription'], queryFn: () => api.get<Subscription | null>('/subscriptions/current') });
  const [duration, setDuration] = useState<DurationCode>('QUARTERLY');
  const [tier, setTier] = useState<TierCode>('PRO');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');

  const subscribe = useMutation({
    mutationFn: (body: { planId: string; billingCycle: BillingCycle }) => api.post('/subscriptions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] });
      router.push('/(tabs)/mytoys');
    },
  });

  if (plans.isLoading) return <Loading />;
  if (!plans.data) return <ErrorText error={plans.error} />;
  const { tiers, durations } = plans.data;
  const dur = durations.find((d) => d.code === duration);
  const tierInfo = tiers.find((t) => t.code === tier);
  const plan = plans.data.plans.find((p) => p.tierCode === tier && p.durationCode === duration);
  const price = plan?.prices.find((p) => p.billingCycle === cycle) ?? plan?.prices[0];
  if (!dur || !tierInfo || !plan || !price) {
    return (
      <Screen>
        <H1>Choose your plan</H1>
        <Card>
          <Muted>Plans aren't set up yet. Please check back soon.</Muted>
          {__DEV__ ? <Muted style={{ marginTop: 6 }}>Developer: run `npm run db:setup` to load plans and demo data.</Muted> : null}
        </Card>
      </Screen>
    );
  }
  const pickDuration = (d: DurationCode) => {
    setDuration(d);
    setCycle('MONTHLY');
  };

  return (
    <Screen>
      <H1>Choose your plan</H1>
      <Muted>Longer plans cost less per month and add rollover, pause and buy-out discounts.</Muted>
      <View style={styles.segment}>
        {durations.map((d) => (
          <Pressable key={d.code} onPress={() => pickDuration(d.code)} style={[styles.segItem, d.code === duration && styles.segOn]}>
            <Text style={[styles.segText, d.code === duration && { color: '#fff' }]}>{d.name}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ backgroundColor: colors.chip }}>
        <Text style={{ fontWeight: '700', color: colors.ink }}>
          {dur.months === 1 ? 'Month-to-month, cancel anytime' : `${dur.months}-month plan · ${Math.round((1 - dur.priceFactor) * 100)}% off`}
        </Text>
        <Muted>
          {[
            dur.swapRollover && 'Unused swaps roll over',
            dur.pauseDays > 0 && `Pause up to ${dur.pauseDays} days`,
            dur.buyoutDiscountPct > 0 && `${dur.buyoutDiscountPct}% off if you keep a toy`,
            ...dur.extras,
          ]
            .filter(Boolean)
            .join(' · ') || 'Try us out with no commitment'}
        </Muted>
      </Card>

      {tiers.map((t) => {
        const p = plans.data.plans.find((x) => x.tierCode === t.code && x.durationCode === duration);
        if (!p?.prices.length) return null;
        const monthly = Math.min(...p.prices.map((x) => Math.round(x.totalAmount / dur.months)));
        const on = t.code === tier;
        return (
          <Pressable key={t.code} onPress={() => setTier(t.code)}>
            <Card style={on ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={styles.tierName}>{t.name}</Text>
                <Text style={styles.tierPrice}>
                  from {inr(monthly)}
                  <Text style={{ fontSize: 13, color: colors.muted }}>/mo</Text>
                </Text>
              </View>
              <Text style={styles.feature}>🧸 {t.toyCredits} toy credits at home — {t.toyCredits} toys or {Math.floor(t.toyCredits / 2)} large{t.toyCredits % 2 ? ' + 1' : ''}</Text>
              <Text style={styles.feature}>🔁 {t.swapsPerMonth} swap{t.swapsPerMonth > 1 ? 's' : ''} a month</Text>
              <Text style={styles.feature}>🚚 {t.deliveriesPerMonth} free doorstep deliver{t.deliveriesPerMonth > 1 ? 'ies' : 'y'} a month{t.expressDelivery ? ' + express' : ''}</Text>
            </Card>
          </Pressable>
        );
      })}

      <H2>How would you like to pay?</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {plan.prices.map((p) => (
          <Chip key={p.billingCycle} label={CYCLE_LABEL[p.billingCycle]} selected={p.billingCycle === price.billingCycle} onPress={() => setCycle(p.billingCycle)} />
        ))}
      </View>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>
          {price.instalmentCount > 1 ? `${price.instalmentCount} × ${inr(price.instalmentAmount)}` : inr(price.totalAmount)}
        </Text>
        <Muted>
          Total {inr(price.totalAmount)} for {dur.months} month{dur.months > 1 ? 's' : ''} ({inr(Math.round(price.totalAmount / dur.months))}/month)
        </Muted>
      </Card>
      <ErrorText error={subscribe.error} />
      {current.data ? (
        <Muted>You already have a {current.data.plan.tier.name} {current.data.plan.duration.name} plan.</Muted>
      ) : (
        <Button
          title={`Subscribe to ${tierInfo.name} ${dur.name}`}
          loading={subscribe.isPending}
          onPress={() => subscribe.mutate({ planId: plan.id, billingCycle: price.billingCycle })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginVertical: 14, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: colors.primary },
  segText: { fontWeight: '700', color: colors.ink },
  tierName: { fontSize: 20, fontWeight: '800', color: colors.ink },
  tierPrice: { fontSize: 18, fontWeight: '700', color: colors.primary },
  feature: { color: colors.ink, marginTop: 6 },
});
