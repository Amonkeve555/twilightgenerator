# Native OAuth setup (iOS) — Google & Apple

The **code** for native Google/Apple sign-in is done. The buttons appear only in the
native app (web keeps its existing Lovable Google flow). They will not *work* until the
external provider config below is in place — until then, tapping them errors.

**How it works:** on native we call Supabase directly (not the Lovable web broker),
open the provider in the system browser, and the provider redirects back to
`com.twigen.app://auth-callback`. iOS routes that to the app, and
`App.tsx` → `handleAuthDeepLink()` exchanges the code for a session (PKCE).

Key files: `src/lib/nativeAuth.ts`, `src/App.tsx` (appUrlOpen listener),
`src/pages/Auth.tsx` (buttons), `ios/App/App/Info.plist` (URL scheme),
`src/integrations/supabase/client.ts` (`flowType: "pkce"`).

The custom scheme is **`com.twigen.app`** — if you change `appId` in
`capacitor.config.ts`, update it in `nativeAuth.ts` (`AUTH_REDIRECT_SCHEME`) and
`Info.plist` (`CFBundleURLSchemes`) to match.

---

## 1. Supabase — add the redirect URL (do this once, needed for both providers)

Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs** → add:

```
com.twigen.app://auth-callback
```

---

## 2. Google (works without an Apple Developer account — do this first)

1. **Google Cloud Console** → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** of type **Web application** (Supabase uses a web
   client for the token exchange, even on mobile). Add Supabase's callback as an
   authorized redirect URI:
   `https://oftksejsmmqoyxarupdb.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.
4. **Supabase Dashboard → Authentication → Providers → Google** → enable, paste the
   Client ID + secret, save.
5. Rebuild the app (`npm run build && npx cap sync ios`, then Run in Xcode) and tap
   **Continue with Google**. The system browser opens, you pick an account, and it
   returns to the app signed in.

> Note: this browser-based flow is enough to test and ship Google. If you later want
> the fully native Google account-picker sheet, that's an optional upgrade to the
> `@codetrix-studio/capacitor-google-auth` plugin + `signInWithIdToken`.

---

## 3. Apple (requires a paid Apple Developer account — $99/yr)

Apple's App Store rules **require** Sign in with Apple once you offer Google, so you'll
need this before submitting to the store.

1. **Apple Developer → Certificates, Identifiers & Profiles:**
   - App ID `com.twigen.app` → enable the **Sign in with Apple** capability.
   - Create a **Services ID** (e.g. `com.twigen.app.web`), enable Sign in with Apple,
     and set the Return URL to
     `https://oftksejsmmqoyxarupdb.supabase.co/auth/v1/callback`.
   - Create a **Sign in with Apple key (.p8)**; note the Key ID and your Team ID.
2. **Supabase Dashboard → Authentication → Providers → Apple** → enable, and fill in:
   - Services ID (client id), Team ID, Key ID, and the .p8 key contents.
3. In **Xcode** → App target → **Signing & Capabilities** → **+ Capability** →
   **Sign in with Apple**. (This requires the Developer account to be signed in.)
4. Rebuild and tap **Sign in with Apple**.

> The current implementation uses the same browser-redirect flow for Apple. It works,
> but for the most native experience (and to be safe with App Store review) you may
> later switch to `@capacitor-community/apple-sign-in` + `signInWithIdToken`. The
> browser flow is fine to get running first.

---

## Testing checklist

- [ ] Supabase redirect URL added (`com.twigen.app://auth-callback`)
- [ ] Google provider enabled in Supabase + Google Cloud web client created
- [ ] Google sign-in returns to the app signed in
- [ ] (When ready) Apple Developer account, Apple provider in Supabase, Xcode capability
- [ ] Apple sign-in returns to the app signed in
