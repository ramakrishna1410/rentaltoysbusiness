import 'dotenv/config';
import { createApp } from './app';
import { assertAuthConfig } from './lib/auth';

assertAuthConfig();
const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, '0.0.0.0', () => {
  console.log(`RentalToys API on port ${port}`);
});
