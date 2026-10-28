import { Redirect } from 'expo-router';
import { Loading } from '../components/ui';
import { useAuth } from '../lib/api';

export default function Index() {
  const { ready, me } = useAuth();
  if (!ready) return <Loading />;
  return <Redirect href={me ? '/(tabs)/dashboard' : '/login'} />;
}
