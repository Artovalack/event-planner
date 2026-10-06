# Event Planner App

A full-stack event planner built with Next.js, Supabase, and a lightweight AI assistant endpoint. The app supports authentication, event listing/detail views, and a dashboard flow for managing events.

## Tech stack
- Next.js 14
- React
- TypeScript
- Supabase Auth + Postgres
- Vercel-ready deployment

## Project structure
```bash
planner/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── api/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── actions/
│   ├── components/
│   ├── lib/
│   ├── middleware.ts
│   └── types/
├── supabase/
├── tests/
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── tsconfig.json
├── README.md
└── package-lock.json
```

## Prerequisites
Before you start, install:
- Node.js 18+ or 20+
- npm
- A Supabase account
- A Vercel account if you want to deploy there

## 1) Clone and install
```bash
git clone <your-repo-url>
cd planner
npm install
```

## 2) Create your environment file
Create a `.env` file in the project root by copying the example:

```bash
cp .env.example .env
```

Then fill it in with your real values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For the Groq-powered event assistant, add your Groq API key as a server-only variable:

```env
GROQ_API_KEY=your-groq-api-key
```

The key is only read by the server API route and must not use a `NEXT_PUBLIC_` prefix.

## 3) Set up Supabase
### Create a Supabase project
1. Go to https://supabase.com
2. Create a new project
3. Wait for the database to finish provisioning
4. Open the project dashboard

### Configure authentication
In Supabase:
1. Go to Authentication > Settings
2. Enable Email sign-in if you want login/signup using email/password
3. Configure your Site URL and Redirect URLs for local development
4. Set the **Confirm signup** email template to use the OTP token shown below instead of `{{ .ConfirmationURL }}`. For the passwordless login-code option, set the **Magic Link** template to use the same token template.
5. Under Authentication > URL Configuration, allow the callback URLs `http://localhost:3000/auth/callback` and `https://your-production-domain/auth/callback`.
6. Set the Email OTP length to **6** in the Email provider settings. The app requires exactly six-digit email codes.

For local development, use:
- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/**`

#### Six-digit email verification template
In Authentication > Email Templates > **Confirm signup**, use a custom HTML template that prints Supabase's `{{ .Token }}` value (not the confirmation URL). For example:

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#1d2a3b">
  <h1 style="font-size:24px">Verify your email</h1>
  <p>Enter this six-digit code in Event Planner to finish creating your account:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#f3f6fa;border-radius:8px;text-align:center">{{ .Token }}</p>
  <p>If you did not request this code, you can ignore this email.</p>
</div>
```

The signup form opens `/verify-otp` and verifies this code with Supabase Auth. The login page also offers a passwordless email-code option; set the **Magic Link** email template's HTML to the same pattern so it delivers the six-digit code rather than requiring the user to click a magic link. Configure code expiry and email rate limits under Supabase Auth settings.

If Supabase reports that it could not send the email, verify the **Magic Link** template and check the project's email/SMTP settings and Auth logs for the provider's delivery error. Supabase's built-in email service may have sending restrictions; configure a custom SMTP provider for reliable delivery.

#### Google and Facebook OAuth
In Supabase Authentication > Providers, enable Google and Facebook and enter each provider's client ID and secret. In each provider's developer console, set its OAuth callback/redirect URI to the Supabase callback shown in that provider's Supabase settings (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Add the app callback URL (`http://localhost:3000/auth/callback` and your production `/auth/callback` URL) to Supabase Authentication > URL Configuration > Redirect URLs. OAuth buttons use Supabase's hosted provider flow; the app callback exchanges the returned PKCE authorization code for a session.

#### Authenticator-app MFA
Signed-in users can open **Authenticator security** in the workspace sidebar or visit `/mfa`, scan the displayed QR code with a TOTP app, and verify a six-digit code to enable MFA. Once a verified TOTP factor exists, protected planner pages and APIs require an authenticator challenge after sign-in. MFA uses Supabase Auth factors and does not require an application database migration.

### Create the database table
Open SQL Editor in Supabase and run:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  date timestamptz,
  location text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Authenticated users can view events"
  on public.events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
  on public.events for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can update events" on public.events;
create policy "Authenticated users can update events"
  on public.events for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can delete events" on public.events;
create policy "Authenticated users can delete events"
  on public.events for delete to authenticated
  using (user_id = auth.uid());
```

This planner is private per user: each event belongs to the authenticated owner and only that user can view, edit, and delete it. Row-level security blocks anonymous access and prevents one user from reading another user's events. If an existing database already contains shared rows, add the `user_id` column and backfill it with the correct owner before re-running the policies.

If you already created the table and see `new row violates row-level security policy`, run the `alter table` and four `drop policy` / `create policy` sections above in Supabase **SQL Editor**. Then make sure you are signed in to the app and retry. The policies only allow signed-in users; do not fix this by enabling anonymous access or disabling row-level security.

### Add task, guest, budget, and vendor tables
After `public.events` exists, paste the full contents of [`supabase/migrations/20261005210000_create_planner_tables.sql`](./supabase/migrations/20261005210000_create_planner_tables.sql) into Supabase **SQL Editor** and run it. It creates the task/subtask, guest, budget item, and vendor tables, their event foreign keys and indexes, and authenticated-user row-level policies. The guest companion total is generated from its adult, child, and baby counts.

The app keeps a selected event for the signed-in session and scopes each feature query and mutation to that event. This starter is configured for per-user privacy: each event stores the authenticated owner and all related planner data is only accessible through events that belong to that user.

The `/tasks`, `/guests`, `/budget`, `/vendors`, and `/dashboard` routes use server-side initial data fetching and authenticated server actions. Dashboard and list print buttons open the browser's print dialog, where a user can choose **Save as PDF** for event summaries, guest lists, or task summaries.

### Get your Supabase keys
In Supabase:
1. Go to Project Settings > API
2. Copy:
   - Project URL
   - anon public key
   - service_role secret key

Use those values in your `.env` file.

## 4) Run locally
Start the app:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

You should be able to:
- visit the home page
- sign up or log in
- create, view, edit, and delete events while signed in
- sign out and return to the login page

## 5) Build and validate
Before deployment, verify the app builds successfully:

```bash
npm run build
```

Optional local lint check:

```bash
npm run lint
```

## 6) Deploying
### Best time to deploy
Deploy only after:
- Supabase database is created
- database table exists
- `.env` variables are set in production
- the app builds locally without errors

### Option A: Deploy to Vercel
1. Push the repo to GitHub
2. Import the repository into Vercel
3. In Project Settings > Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_API_URL`
   - `GROQ_API_KEY`
4. Deploy the project
5. After deployment, confirm the production URL is added to Supabase redirect settings

Set Supabase Auth redirect URLs to include:
- `https://your-project.vercel.app/**`
- `https://your-project.vercel.app`

### Option B: Deploy elsewhere
If you deploy on another platform, make sure the same environment variables are set in that platform’s environment config and that the app can access your Supabase project.

## 7) Recommended production checklist
Before going live, confirm:
- Supabase project is active
- Auth is enabled and configured
- Events table exists
- Production env variables are set correctly
- Database and app are using the same project URL
- Redirect URLs include your production domain
- `npm run build` succeeds in CI or on the deploy platform

## 8) Notes about the AI assistant
The signed-in dashboard includes an event assistant backed directly by Groq using Groq's recommended replacement model `openai/gpt-oss-20b` for the retired `llama-3.1-8b-instant` route. It supplies up to 50 visible events and event-scoped task/subtask, guest/invitation, budget/payment, and vendor details for the selected event, all subject to the signed-in user's Supabase row-level security policies. The API accepts a maximum of 20 recent messages and 12,000 characters per request. Add `GROQ_API_KEY` to your local server environment and to Vercel's project environment variables, then restart or redeploy the app. Never expose the key in browser code or prefix it with `NEXT_PUBLIC_`.

## 9) Troubleshooting
### App won’t start
Check:
- Node version is 18+
- dependencies are installed with `npm install`
- `.env` file exists and contains valid values

### Login/signup fails
Check:
- Supabase Auth is enabled
- email auth is enabled in Supabase
- site URL / redirect URL settings match your app URL

### Events page is empty
Check:
- the `public.events` table exists
- you inserted at least one row
- the app can reach the Supabase URL in the environment

## License
This project is licensed under the MIT License.
