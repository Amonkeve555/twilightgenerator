/**
 * Detect the built-in browsers of chat/social apps (Messenger, Instagram,
 * Facebook, TikTok, ...). Google refuses OAuth sign-in inside these embedded
 * browsers — the user picks an account and then gets
 * "400. The server cannot process the request because it is malformed."
 * So on those, we steer people to the real browser instead.
 */
import { isNativePlatform } from "@/lib/platform";

const IN_APP_UA =
  /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Twitter|Discord/i;

export type MobileOS = "ios" | "android" | "other";

export function getMobileOS(ua: string = navigator.userAgent): MobileOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  if (isNativePlatform()) return false; // our own Capacitor app is fine
  if (IN_APP_UA.test(ua)) return true;
  // Android WebView marks itself with "; wv)".
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return true;
  // iOS embedded WKWebView: no "Safari/" token (Safari, Chrome, Firefox, Edge all have it).
  if (getMobileOS(ua) === "ios" && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return true;
  return false;
}

/**
 * A link that asks the phone to open `url` in its real browser.
 * - iOS 17+: the x-safari-https scheme opens Safari.
 * - Android: an intent:// link opens the default browser (Chrome).
 * Returns null when there's no reliable way (user must use the app's menu).
 */
export function openInBrowserHref(url: string, os: MobileOS = getMobileOS()): string | null {
  const u = new URL(url);
  if (os === "ios") return `x-safari-${u.protocol.replace(":", "")}://${u.host}${u.pathname}${u.search}${u.hash}`;
  if (os === "android") {
    const scheme = u.protocol.replace(":", "");
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
}
