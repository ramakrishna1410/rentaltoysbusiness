import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/api';
import { colors } from '../../lib/theme';

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const { ready, me } = useAuth();
  if (!ready) return <Loading />;
  if (!me) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('⌗') }} />
      <Tabs.Screen name="toys" options={{ title: 'Toys', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('⇄') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('…') }} />
    </Tabs>
  );
}
