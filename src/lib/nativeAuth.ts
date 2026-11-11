// Native (iOS/Android) OAuth for Supabase using the system browser + a custom
// URL-scheme deep link. This bypasses the Lovable web OAuth broker, which can
// only redirect to whitelisted web origins and therefore can't return into the
// native app.
//
// Flow:
//   1. supabase.auth.signInWithOAuth(..., { skipBrowserRedirect: true }) builds
//      the provider URL and stashes the PKCE code verifier in the client storage.
//   2. We open that URL in the system browser (SFSafariViewController on iOS).
//   3. The provider redirects to `${AUTH_REDIRECT_SCHEME}://auth-callback?code=...`.
//   4. iOS routes that custom scheme back to the app; App.tsx's appUrlOpen
//      listener calls handleAuthDeepLink(url), which exchanges the code for a
//      session using the same client (same storage → same PKCE verifier).
//
// Requirements to actually work at runtime:
//   - The provider (Google / Apple) must be configured in the Supabase dashboard.
//   - AUTH_REDIRECT_SCHEME must be added to the Supabase "Redirect URLs" allow-list
//     as `${AUTH_REDIRECT_SCHEME}://auth-callback`.
//   - The scheme must be registered in ios Info.plist (CFBundleURLTypes).
// See NATIVE_OAUTH_SETUP.md.

import { Browser } from "@capacitor/browser";
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Must match the CFBundleURLScheme in ios Info.plist and the Supabase redirect allow-list.
export const AUTH_REDIRECT_SCHEME = "com.twigen.app";
export const AUTH_REDIRECT_URL = `${AUTH_REDIRECT_SCHEME}://auth-callback`;

/** Start a native OAuth sign-in by opening the provider page in the system browser. */
export async function signInWithProviderNative(provider: Provider): Promise<{ error?: Error }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: AUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { error };
  if (!data?.url) return { error: new Error("No OAuth URL returned") };

  await Browser.open({ url: data.url, presentationStyle: "popover" });
  return {};
}

/**
 * Handle the deep link the provider redirects back to. Exchanges the auth code
 * for a session. Call from the appUrlOpen listener. Returns true if it handled
 * an auth callback URL.
 */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!url.startsWith(AUTH_REDIRECT_URL)) return false;

  // Close the in-app browser now that we're back.
  try {
    await Browser.close();
  } catch {
    /* no-op: browser may already be closed */
  }

  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const errorDescription = parsed.searchParams.get("error_description");

  if (errorDescription) {
    throw new Error(errorDescription);
  }
  if (!code) {
    throw new Error("No authorization code in redirect");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}
