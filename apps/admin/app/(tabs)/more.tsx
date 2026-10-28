import { router } from 'expo-router';
import { Button, H1, Muted, Screen } from '../../components/ui';
import { useAuth } from '../../lib/api';

export default function More() {
  const { me, signOut } = useAuth();
  return (
    <Screen>
      <H1>More</H1>
      <Muted style={{ marginBottom: 12 }}>
        Signed in as {me?.name} ({me?.role.toLowerCase()})
      </Muted>
      <Button title="Warehouse layout & re-slotting" variant="outline" onPress={() => router.push('/warehouse')} />
      <Button title="Subscriptions & payments" variant="outline" onPress={() => router.push('/subscriptions')} />
      <Button
        title="Log out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
