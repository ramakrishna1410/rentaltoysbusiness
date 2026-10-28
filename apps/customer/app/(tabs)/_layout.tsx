import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/api';
import { useBox } from '../../lib/box';
import { colors } from '../../lib/theme';

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const { ready, me } = useAuth();
  const box = useBox();
  if (!ready) return <Loading />;
  if (!me) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTintColor: colors.ink }}>
      <Tabs.Screen name="home" options={{ title: 'For you', tabBarIcon: icon('★') }} />
      <Tabs.Screen name="catalog" options={{ title: 'Catalog', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: icon('◈') }} />
      <Tabs.Screen name="mytoys" options={{ title: 'My toys', tabBarIcon: icon('⬚'), tabBarBadge: box.toys.length || undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
