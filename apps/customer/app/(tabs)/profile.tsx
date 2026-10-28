import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { INTEREST_LABELS, ageInMonths } from '@rentaltoys/shared';
import { KidForm, emptyKid, kidBody, kidError, type KidDraft } from '../../components/KidForm';
import { Button, Card, ErrorText, H1, H2, Muted, Screen } from '../../components/ui';
import { api, useAuth, type Kid } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function Profile() {
  const { me, refresh, signOut } = useAuth();
  const [editing, setEditing] = useState<{ id?: string; draft: KidDraft } | null>(null);
  const save = useMutation({
    mutationFn: async (e: { id?: string; draft: KidDraft }) => {
      const body = kidBody(e.draft);
      return e.id ? api.patch(`/kids/${e.id}`, body) : api.post('/kids', body);
    },
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  if (!me) return null;
  const edit = (k: Kid) => setEditing({ id: k.id, draft: { name: k.name, dateOfBirth: k.dateOfBirth.slice(0, 10), interests: k.interests, favoriteColors: k.favoriteColors ?? [], playPlace: k.playPlace ?? null, goals: k.goals ?? [] } });

  return (
    <Screen>
      <H1>{me.name}</H1>
      <Muted>
        {me.email} · {me.phone}
      </Muted>
      <H2>Kids</H2>
      {me.kids.map((k) => {
        const m = ageInMonths(new Date(k.dateOfBirth));
        return (
          <Card key={k.id}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>
              {k.name} · {m < 24 ? `${m} months` : `${Math.floor(m / 12)} years`}
            </Text>
            <Muted>{k.interests.map((i) => INTEREST_LABELS[i]).join(', ') || 'No interests picked yet'}</Muted>
            <Button title="Edit" variant="ghost" onPress={() => edit(k)} />
          </Card>
        );
      })}
      {editing ? (
        <Card>
          <KidForm value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
          <ErrorText error={save.error} />
          <Button title="Save" disabled={!!kidError(editing.draft)} loading={save.isPending} onPress={() => save.mutate(editing)} />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
        </Card>
      ) : (
        <Button title="Add another kid" variant="outline" onPress={() => setEditing({ draft: emptyKid() })} />
      )}
      <Button
        title="Log out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
