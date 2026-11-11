# TWI Gen — TI4 Imperial Companion

Twilight Imperium 4 companion: lobbies, faction draft, map setup, game day, results and stats.

- **Frontend:** React + Vite + TypeScript, Tailwind / shadcn-ui. Builds to static files in `dist/`.
- **Backend:** Supabase (Postgres + RLS, Auth, Storage, Edge Functions). Schema lives in `supabase/migrations/`.
- **iOS:** Capacitor wrapper around `dist/` (see `NATIVE_OAUTH_SETUP.md`).

## Local development

```bash
cp .env.example .env   # fill in your Supabase URL + anon key
npm install
npm run dev            # http://localhost:8080
```

`npm run build` → `dist/`, `npm test` → unit tests.

## Deploying the frontend

Any static host works. Settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20+ |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |

Client-side routes (e.g. `/lobby/TI4-ABCD`) need an SPA fallback to `index.html`:
- **Cloudflare Pages / Netlify:** `public/_redirects` (already included).
- **Vercel:** `vercel.json` (already included).

## Moving off Lovable Cloud — checklist

The frontend no longer depends on Lovable. Remaining steps:

1. **Create your own Supabase project** (supabase.com) and note its URL + anon key.
2. **Apply the schema:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <new-ref>
   npx supabase db push
   ```
   Update `supabase/config.toml` `project_id` to the new ref.
3. **Migrate data** from the Lovable Cloud database (tables in `public`, plus `auth.users` so
   existing accounts keep working, plus files in the `rules-pdfs` storage bucket). Ask Lovable
   for a database export / connection string, or recreate data by hand if it's small.
4. **Admin role:** a migration grants admin to a hard-coded user id. After migrating, make sure
   your user in the new project has a row in `public.user_roles` with role `admin`.
5. **Auth settings** (Supabase → Authentication → URL Configuration):
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback` and `com.twigen.app://auth-callback`
6. **Google sign-in** (Supabase → Authentication → Providers → Google): create a Google Cloud
   OAuth "Web application" client with redirect URI
   `https://<new-ref>.supabase.co/auth/v1/callback`, paste client id + secret.
7. **Deploy the frontend** with the new env vars (see above).
8. **Edge functions (not migrated yet):** `rules-chat` and `generate-faction-data` still call the
   Lovable AI gateway (`LOVABLE_API_KEY`), so the Rules Assistant and admin faction-data
   generator won't work on a non-Lovable project until they're switched to a direct AI API.
