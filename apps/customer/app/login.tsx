import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, H1, Screen } from '../components/ui';
import { api, useAuth } from '../lib/api';

export default function Login() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string }>('/auth/login', { login: login.trim(), password });
      await signIn(res.token);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Welcome back</H1>
      <Field label="Email or mobile" autoCapitalize="none" keyboardType="email-address" value={login} onChangeText={setLogin} />
      <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <ErrorText error={error} />
      <Button title="Log in" onPress={submit} loading={busy} disabled={!login || !password} />
    </Screen>
  );
}
