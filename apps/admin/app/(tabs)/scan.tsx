import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STAGE_LABELS, parseQr, type ToyStage } from '@rentaltoys/shared';
import { Scanner } from '../../components/Scanner';
import { STAGE_COLORS, StageBadge } from '../../components/StageBadge';
import { Button, Card, ErrorText, Field, H1, H2, Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { NextStage, ScanResult, SlotSuggestion, Unit } from '../../lib/types';

interface MoveResult {
  before: ToyStage;
  after: ToyStage;
  missingPieceNos: number[];
}

export default function Scan() {
  const qc = useQueryClient();
  const [scan, setScan] = useState<{ payload: string; result: ScanResult } | null>(null);
  const [next, setNext] = useState<NextStage | null>(null);
  const [pieces, setPieces] = useState<string[]>([]);
  const [binCode, setBinCode] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<MoveResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const unit = scan?.result.unit;
  const suggestions = useQuery({
    queryKey: ['slots', unit?.id],
    enabled: !!unit && !!next?.needsBin,
    queryFn: () => api.get<{ velocity: string; expectedZone: string; suggestions: SlotSuggestion[] }>(`/admin/units/${unit!.id}/slot-suggestions`),
  });

  function reset() {
    setScan(null);
    setNext(null);
    setPieces([]);
    setBinCode(null);
    setReason('');
    setDone(null);
    setError(null);
  }

  async function onFirstScan(payload: string) {
    setError(null);
    try {
      const result = await api.get<ScanResult>(`/admin/scan/${encodeURIComponent(payload)}`);
      setScan({ payload, result });
      setPieces(result.kind === 'PIECE' ? [payload] : []);
    } catch (e) {
      setError(e);
    }
  }

  function onStepScan(payload: string) {
    if (!unit) return;
    const ref = parseQr(payload);
    setError(null);
    if (ref?.kind === 'BIN' && next?.needsBin) return setBinCode(ref.binCode);
    if (ref?.kind === 'PIECE' && ref.unitId === unit.id) return setPieces((p) => (p.includes(payload) ? p : [...p, payload]));
    if (ref?.kind === 'UNIT' && ref.unitId === unit.id) return;
    setError(new Error('That label belongs to a different toy or is not a bin.'));
  }

  async function confirm() {
    if (!unit || !next || !scan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<MoveResult>(`/admin/units/${unit.id}/move`, {
        expectedFromStage: unit.stage,
        toStage: next.stage,
        scannedPayload: scan.payload,
        pieceScans: pieces,
        toBinCode: binCode ?? undefined,
        orderId: next.needsOrder ? (unit.reservedForOrderId ?? undefined) : undefined,
        reason: reason || undefined,
      });
      setDone(res);
      qc.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <H1>Moved ✓</H1>
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.ink, marginBottom: 10 }}>{unit?.toy.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View>
              <Muted>Before</Muted>
              <StageBadge stage={done.before} big />
            </View>
            <Text style={{ fontSize: 24, color: colors.muted }}>→</Text>
            <View>
              <Muted>After</Muted>
              <StageBadge stage={done.after} big />
            </View>
          </View>
          {binCode && done.after === 'STORAGE' ? <Muted style={{ marginTop: 10 }}>Stored in bin {binCode}</Muted> : null}
          {done.missingPieceNos.length ? (
            <Text style={{ color: colors.danger, marginTop: 10 }}>Missing pieces: {done.missingPieceNos.join(', ')}</Text>
          ) : null}
        </Card>
        <Button title="Scan next toy" onPress={reset} />
        {unit ? <Button title="Open unit history" variant="outline" onPress={() => router.push(`/unit/${unit.id}`)} /> : null}
      </Screen>
    );
  }

  if (!scan) {
    return (
      <Screen>
        <H1>Scan a label</H1>
        <Scanner onScan={onFirstScan} prompt="Scan the toy's unit label, any piece label, or a bin label." />
        <ErrorText error={error} />
      </Screen>
    );
  }

  if (scan.result.kind === 'BIN' && scan.result.bin) {
    const bin = scan.result.bin;
    return (
      <Screen>
        <H1>Bin {bin.code}</H1>
        <Muted>
          {bin.shelf?.rack.zone.code} · rack {bin.shelf?.rack.code} · shelf {bin.shelf?.level}
        </Muted>
        <H2>{bin.units.length} toys stored</H2>
        {bin.units.map((u) => (
          <Pressable key={u.id} onPress={() => router.push(`/unit/${u.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{u.toy.name}</Text>
              <Muted>{u.id}</Muted>
            </Card>
          </Pressable>
        ))}
        <Button title="Scan something else" onPress={reset} />
      </Screen>
    );
  }

  const u = unit as Unit;
  const total = u.toy.pieceCount;
  const scannedNos = new Set(pieces.map((p) => parseQr(p)).flatMap((r) => (r?.kind === 'PIECE' ? [r.pieceNo] : [])));
  if (total === 1) scannedNos.add(1); // unit label stands for the only piece
  const missing = u.pieces.filter((p) => !scannedNos.has(p.pieceNo));
  const needPieces = !!next?.needsAllPieces && total > 1;
  const blockers = [
    needPieces && missing.length > 0 && next?.stage !== 'DAMAGE' && `Scan all ${total} pieces (${missing.length} left)`,
    next?.needsBin && !binCode && 'Scan the bin label',
    next?.needsOrder && !u.reservedForOrderId && 'This toy is not reserved for any order',
    next?.needsReason && !reason.trim() && 'Enter a reason',
  ].filter(Boolean) as string[];

  return (
    <Screen>
      <H1>{u.toy.name}</H1>
      <Muted>
        {u.toy.sku} · {total} piece{total > 1 ? 's' : ''} {scan.result.kind === 'PIECE' ? `· scanned piece ${scan.result.pieceNo}` : ''}
      </Muted>
      <Card style={{ marginTop: 12 }}>
        <Muted>Current stage (before)</Muted>
        <StageBadge stage={u.stage} big />
        {u.bin ? <Muted style={{ marginTop: 6 }}>In bin {u.bin.code}</Muted> : null}
        {u.reservedForOrderId ? <Muted style={{ marginTop: 6 }}>Reserved for order {u.reservedForOrderId.slice(-6)}</Muted> : null}
      </Card>

      {!next ? (
        <View>
          <H2>Move to (after)</H2>
          {scan.result.nextStages?.length ? null : <Muted>This toy is scrapped; no further moves.</Muted>}
          {scan.result.nextStages?.map((n) => (
            <Pressable key={n.stage} onPress={() => setNext(n)}>
              <Card style={{ borderLeftWidth: 6, borderLeftColor: STAGE_COLORS[n.stage] }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{STAGE_LABELS[n.stage]}</Text>
                <Muted>
                  {[n.needsAllPieces && total > 1 && 'scan all pieces', n.needsBin && 'scan bin', n.needsOrder && 'linked order', n.needsReason && 'reason']
                    .filter(Boolean)
                    .join(' · ') || 'scan to confirm'}
                </Muted>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <H2>
            {STAGE_LABELS[u.stage]} → {STAGE_LABELS[next.stage]}
          </H2>

          {needPieces ? (
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                Pieces scanned: {total - missing.length} / {total}
              </Text>
              {u.pieces.map((p) => (
                <Text key={p.id} style={{ color: scannedNos.has(p.pieceNo) ? colors.success : colors.muted, marginTop: 4 }}>
                  {scannedNos.has(p.pieceNo) ? '✓' : '○'} {p.pieceNo}. {p.label}
                </Text>
              ))}
              {missing.length && next.stage !== 'DAMAGE' ? (
                <Muted style={{ marginTop: 8 }}>Pieces missing? Go back and choose Damage instead.</Muted>
              ) : null}
            </Card>
          ) : null}

          {next.needsBin ? (
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                Suggested bins {suggestions.data ? `(demand ${suggestions.data.velocity} → ${suggestions.data.expectedZone} zone)` : ''}
              </Text>
              {suggestions.data?.suggestions.map((s, i) => (
                <View key={s.binId} style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: '700', color: binCode === s.binCode ? colors.success : colors.ink }}>
                    {i + 1}. {s.binCode} · score {s.score.toFixed(2)} {binCode === s.binCode ? '✓ scanned' : ''}
                  </Text>
                  <Muted>{s.reasons.join(' · ')}</Muted>
                </View>
              ))}
              {suggestions.data && !suggestions.data.suggestions.length ? <Text style={{ color: colors.danger }}>No bin has room for this toy.</Text> : null}
              {binCode ? <Muted style={{ marginTop: 8 }}>Bin scanned: {binCode}</Muted> : null}
            </Card>
          ) : null}

          {next.needsOrder ? (
            <Card>
              <Muted>{u.reservedForOrderId ? `Dispatching for order ${u.reservedForOrderId.slice(-6)}` : 'Not reserved for any order — cannot dispatch.'}</Muted>
            </Card>
          ) : null}

          {next.needsReason ? <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. wheel broken, 2 pieces missing" /> : null}

          {needPieces || next.needsBin ? (
            <Scanner compact onScan={onStepScan} prompt={next.needsBin ? 'Scan the bin label you are placing it in.' : 'Scan each piece label.'} />
          ) : null}

          <ErrorText error={error} />
          {blockers.length ? <Muted>{blockers.join(' · ')}</Muted> : null}
          <Button title={`Confirm move to ${STAGE_LABELS[next.stage]}`} disabled={blockers.length > 0} loading={busy} onPress={confirm} />
          <Button title="Choose a different stage" variant="ghost" onPress={() => setNext(null)} />
        </View>
      )}
      <Button title="Cancel" variant="ghost" onPress={reset} />
    </Screen>
  );
}
