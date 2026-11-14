# Working agreement

## One shared branch: `main`

The team works on a single branch, `main`. No feature branches, no pull requests.

- Before starting work: `git checkout main && git pull`.
- When done (after `npm test` and `npm run typecheck` pass): `git add -A && git commit -m "..." && git push`.
- If the push is rejected because someone else pushed first: `git pull && git push`. If `git pull` reports a conflict,
  resolve it, keeping both people's changes, and re-run the checks before pushing.
- Claude sessions also commit and push to `main`. Say in the reply what was pushed.

## After every code change: give local setup and test steps

Whenever code is changed and pushed, end the reply with a **step-by-step procedure** the team can follow on their own
machine:

1. Pull the code (`git pull`; first-time clone for new team members).
2. Install and prepare (dependencies, database, env files), including any new step this change needs (new env var,
   migration, re-seed).
3. Run the API, the customer app and the admin app.
4. What to test for this change: which screen, which login, what to expect.

Rules:
- Use one-line commands wherever possible (chain with `&&`), each in its own `bash` code block so it can be copied alone.
- The developer works on Windows and switches between **PowerShell and Command Prompt**. Prefer commands that work in
  both (e.g. `copy apps\api\.env.example apps\api\.env`, backslash paths; avoid `cp`, `rm`, `export`, `if` syntax).
  Start each step list with `cd C:\Users\Shanmith\rentaltoysbusiness`, since new terminals open in the home folder.
- The branch is always `main`. Later pulls are just `git pull`; a first-time setup is
  `git clone https://github.com/ramakrishna1410/rentaltoysbusiness.git && cd rentaltoysbusiness`.
- Say clearly if a step resets local data (e.g. `npm run db:setup` wipes and reloads demo data).

## Project quick reference

- Monorepo (npm workspaces): `apps/api` (Express + Prisma/PostgreSQL), `apps/customer` and `apps/admin` (Expo SDK 54),
  `packages/shared` (plans, lifecycle, QR, slotting and recommendation algorithms, API client).
- Local DB: `docker compose up -d` (Postgres 16 on 5432, user/password `postgres`). Tests need a `rentaltoys_test` database.
- Demo logins: `admin@rentaltoys.in` / `Admin@1234`, `staff@rentaltoys.in` / `Staff@1234`, `parent@example.com` / `Parent@1234`.
- Checks before pushing: `npm test` and `npm run typecheck`.
- Never run `prisma db push --force-reset` or the demo seed against a non-local database.
