# Free hosting setup (about 30 minutes, ₹0)

You'll end up with three links:

- **Customer website:** `https://rentaltoys-web.onrender.com`
- **Admin website:** `https://rentaltoys-admin.onrender.com`
- **API:** `https://rentaltoys-api.onrender.com`

Render adds a few letters to a name if it's taken (e.g. `rentaltoys-api-x7k2.onrender.com`). Use whatever Render shows.

## Before you start

- The code is on GitHub on the `main` branch.
- On GitHub, **Settings → General → Default branch** is set to `main`.

## Step 1: Database (Neon)

1. Go to **neon.tech** → **Sign up** → choose **Continue with GitHub**.
2. Create a project:
   - name: `rentaltoys`;
   - Postgres version: **16**;
   - region: **AWS Asia Pacific (Singapore)**.
3. On the project dashboard, click **Connect**.
4. Turn **OFF** "Connection pooling", then copy the connection string. It looks like
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
5. Keep it somewhere safe, like a password manager or a private note. **Never put it in the code or on GitHub.**

## Step 2: API and both websites (Render)

1. Go to **render.com** → **Get started** → **Sign up with GitHub**.
2. Allow Render to see the `rentaltoysbusiness` repository when GitHub asks.
3. In Render: **New** → **Blueprint** → choose `rentaltoysbusiness`, branch `main`. Render reads `render.yaml` and lists 3 services:
   `rentaltoys-api`, `rentaltoys-web` and `rentaltoys-admin`.
4. Fill in the values Render asks for:

| Setting | Value |
|---|---|
| `DATABASE_URL` | the Neon string from Step 1 |
| `ADMIN_EMAIL` | your admin login email |
| `ADMIN_PHONE` | a 10-digit mobile number |
| `ADMIN_PASSWORD` | a strong password, 10+ characters |
| `CORS_ORIGINS` | leave empty for now |
| `EXPO_PUBLIC_API_URL` (asked twice, once per website) | `https://rentaltoys-api.onrender.com` (adjust in step 6 if Render gives a different address) |

5. Click **Apply**. The first build takes about 5–10 minutes.
6. Open **rentaltoys-api** in Render and copy its address at the top (`https://…onrender.com`).
   - If it differs from what you entered for `EXPO_PUBLIC_API_URL`, open **rentaltoys-web** → **Environment**, fix the value
     and click **Save, rebuild and deploy**.
   - Do the same for **rentaltoys-admin**.
7. Check the API: open `https://<api address>/health`. It should show `{"ok":true}`. The first time can take ~50 seconds
   while it wakes up.

## Step 3: Try it

- **Customer website:** open the `rentaltoys-web` address. You should see the landing page. Try **Get started**.
- **Admin website:** open the `rentaltoys-admin` address and log in with your `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- The catalog starts **empty**: this is a fresh database. Add toys in the admin website:
  1. Toys → Add new toy;
  2. Procure unit;
  3. scan the unit to Sanitation, then to Storage.

  Or load the demo toys (next section).

## Optional: load the 28 demo toys into the online database

This **wipes the online database** and fills it with demo data. Only do it while you're testing.

1. On your PC, in Command Prompt, go to the project:
   ```bash
   cd C:\Users\Shanmith\rentaltoysbusiness
   ```
2. Run the demo setup against the online database. Paste your Neon string between the quotes:
   ```bash
   set "DATABASE_URL=postgresql://...your Neon string..." && npm run db:seed -w @rentaltoys/api
   ```
   (PowerShell: `$env:DATABASE_URL="postgresql://..."; npm run db:seed -w @rentaltoys/api`)
3. Close that terminal afterwards, so later commands don't use the online database by accident.
4. In Render, open **rentaltoys-api** → **Manual Deploy** → **Restart service**. On restart, your admin
   from `ADMIN_*` is created again.
5. The demo logins (`admin@rentaltoys.in` / `Admin@1234` and the others) now work online too.

## Phone apps (optional, also free)

The websites work on phones too. To install real Android apps that use the online API:

1. Create a free account at **expo.dev**.
2. In `apps\customer\eas.json` and `apps\admin\eas.json`, set `EXPO_PUBLIC_API_URL` under `preview` to your API address.
   Commit and push.
3. Build the customer app:
   ```bash
   cd apps\customer && npx eas-cli build --profile preview --platform android
   ```
   It asks you to log in to Expo the first time. The build runs on Expo's servers (~15 min), then gives a link to an `.apk`.
4. Do the same in `apps\admin`.
5. Send the `.apk` links on WhatsApp. Android asks to "allow installing unknown apps" the first time.

## Good to know

- **Auto-deploy:** every `git push` to `main` rebuilds the API and both websites automatically in about 5–10 minutes.
- **Sleeping:** the free API sleeps after 15 minutes idle, so the first click afterwards takes ~30–50 seconds. Expected.
- **Free limits:** Render gives 750 free hours a month (enough for one always-sleeping-when-idle API). Neon gives 0.5 GB
  of storage, enough for testing including a few hundred photos.
- **Landing videos:** the API serves them from the repo. To use them online, commit the `.mp4` files in
  `apps/api/media/landing/` and push.
- **Upgrade for launch:** switch `rentaltoys-api` to the Starter plan in Render (no sleeping).
