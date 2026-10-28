import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { ToyForm, describeError, type ToyBody } from '../../components/ToyForm';
import { Muted, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Toy } from '../../lib/types';

export default function NewToy() {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: ToyBody) => api.post<Toy>('/admin/toys', body),
    onSuccess: (toy) => {
      qc.invalidateQueries({ queryKey: ['admin-toys'] });
      router.replace(`/toy/${toy.id}`);
    },
  });

  return (
    <Screen>
      <Muted>After saving you'll add photos on the toy's page (camera or gallery).</Muted>
      <ToyForm submitLabel="Save toy" busy={save.isPending} onSubmit={(b) => save.mutate(b)} />
      {save.error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{describeError(save.error)}</Text> : null}
    </Screen>
  );
}
