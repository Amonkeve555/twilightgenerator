import { describe, it, expect } from "vitest";
import { isInAppBrowser, getMobileOS, openInBrowserHref } from "@/lib/inAppBrowser";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iosMessenger:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/466.0.0.36.106;FBBV/600000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/cs_CZ;FBOP/5]",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,2; iOS 17_5; cs_CZ; cs; scale=3.00; 1179x2556; 609003397)",
  iosGenericWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
  androidMessenger:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240605.024; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/466.0.0.47.109;]",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("isInAppBrowser", () => {
  it.each([
    ["iosMessenger", true],
    ["iosInstagram", true],
    ["iosGenericWebView", true],
    ["androidMessenger", true],
    ["androidWebView", true],
    ["iosSafari", false],
    ["iosChrome", false],
    ["androidChrome", false],
    ["desktopChrome", false],
  ] as const)("%s -> %s", (key, expected) => {
    expect(isInAppBrowser(UA[key])).toBe(expected);
  });
});

describe("openInBrowserHref", () => {
  const url = "https://example.com/join/TI4-ABCD?x=1";
  it("uses the Safari scheme on iOS", () => {
    expect(getMobileOS(UA.iosMessenger)).toBe("ios");
    expect(openInBrowserHref(url, "ios")).toBe("x-safari-https://example.com/join/TI4-ABCD?x=1");
  });
  it("uses an intent link on Android", () => {
    const href = openInBrowserHref(url, "android")!;
    expect(href.startsWith("intent://example.com/join/TI4-ABCD?x=1#Intent;scheme=https;")).toBe(true);
    expect(href).toContain(`S.browser_fallback_url=${encodeURIComponent(url)}`);
  });
  it("gives no link elsewhere", () => {
    expect(openInBrowserHref(url, "other")).toBeNull();
  });
});
