import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/api';
import { colors } from '../lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Staff login' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="toy/new" options={{ title: 'New toy' }} />
          <Stack.Screen name="toy/[id]" options={{ title: 'Toy' }} />
          <Stack.Screen name="toy/edit/[id]" options={{ title: 'Edit toy' }} />
          <Stack.Screen name="unit/[id]" options={{ title: 'Unit' }} />
          <Stack.Screen name="warehouse" options={{ title: 'Warehouse' }} />
          <Stack.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
