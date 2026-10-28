import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { ToyForm, describeError, type ToyBody } from '../../../components/ToyForm';
import { ErrorText, H1, Loading, Screen } from '../../../components/ui';
import { api } from '../../../lib/api';
import { colors } from '../../../lib/theme';
import type { Toy, Unit } from '../../../lib/types';

export default function EditToy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const toy = useQuery({ queryKey: ['admin-toy', id], queryFn: () => api.get<Toy & { units: Unit[] }>(`/admin/toys/${id}`) });
  const save = useMutation({
    mutationFn: (body: ToyBody) => api.patch<Toy>(`/admin/toys/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries();
      router.back();
    },
  });

  if (toy.isLoading) return <Loading />;
  if (!toy.data) return <ErrorText error={toy.error} />;
  return (
    <Screen>
      <H1>Edit {toy.data.name}</H1>
      <ToyForm
        initial={toy.data}
        lockPieces={toy.data.units.length > 0}
        submitLabel="Save changes"
        busy={save.isPending}
        onSubmit={(b) => save.mutate(b)}
      />
      {save.error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{describeError(save.error)}</Text> : null}
    </Screen>
  );
}
