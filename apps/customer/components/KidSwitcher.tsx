import { ScrollView } from 'react-native';
import { useAuth } from '../lib/api';
import { Chip } from './ui';

export function KidSwitcher() {
  const { me, activeKidId, setActiveKidId } = useAuth();
  if (!me || me.kids.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      {me.kids.map((k) => (
        <Chip key={k.id} label={k.name} selected={k.id === activeKidId} onPress={() => setActiveKidId(k.id)} />
      ))}
    </ScrollView>
  );
}
