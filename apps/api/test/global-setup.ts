import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.DATABASE_URL!;
  // Tests wipe tables between runs; never point them at a real database.
  if (!/\/[^/?]+_test(\?|$)/.test(url)) throw new Error(`Refusing to run tests against ${url}: database name must end in _test`);
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });
}
