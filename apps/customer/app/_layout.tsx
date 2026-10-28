import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/api';
import { BoxProvider } from '../lib/box';
import { colors } from '../lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BoxProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Log in' }} />
            <Stack.Screen name="signup" options={{ title: 'Create account' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="toy/[id]" options={{ title: 'Toy details' }} />
          </Stack>
        </BoxProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
