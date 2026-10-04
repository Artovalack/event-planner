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

If you later add a real AI provider, you can also add keys for that provider in the same file.

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

For local development, use:
- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/**`

### Create the database table
Open SQL Editor in Supabase and run:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
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
  using (true);

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
  on public.events for insert to authenticated
  with check (true);

drop policy if exists "Authenticated users can update events" on public.events;
create policy "Authenticated users can update events"
  on public.events for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete events" on public.events;
create policy "Authenticated users can delete events"
  on public.events for delete to authenticated
  using (true);
```

This starter uses a shared event planner: any signed-in user can view and manage all events. Row-level security blocks anonymous access. For a private planner, add an `owner_id` column and change the policies to limit each operation to rows owned by `auth.uid()`.

If you already created the table and see `new row violates row-level security policy`, run the `alter table` and four `drop policy` / `create policy` sections above in Supabase **SQL Editor**. Then make sure you are signed in to the app and retry. The policies only allow signed-in users; do not fix this by enabling anonymous access or disabling row-level security.

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
The app includes an assistant API route at `/api/assistant`, but the current implementation is a starter/placeholder response. To make it truly AI-powered, connect it to an actual model provider such as OpenAI, Anthropic, or another supported provider and add the API key in your environment.

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
