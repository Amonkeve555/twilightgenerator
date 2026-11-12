import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "ti4-chunk-reload-at";

/**
 * React.lazy that recovers from a stale deploy.
 *
 * Page code is split into hashed files (JoinLobby-abc123.js). After a new
 * deploy those names change; a page opened before the deploy (or an old cached
 * index.html, e.g. in a chat app's browser) then asks for a file that no longer
 * exists. The host answers with index.html, the import fails and the screen
 * goes blank. Instead, reload once to pick up the current version.
 */
export function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      } catch {
        /* storage unavailable */
      }
      // Reload at most once per 30 s so a genuinely broken file can't loop forever.
      if (Date.now() - last > 30_000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
          /* storage unavailable */
        }
        window.location.reload();
        // Keep suspending until the reload happens.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
