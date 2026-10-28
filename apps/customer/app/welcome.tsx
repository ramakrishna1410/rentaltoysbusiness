import { Redirect } from 'expo-router';

/** Old entry point; the landing page now lives at "/". */
export default function Welcome() {
  return <Redirect href="/" />;
}
