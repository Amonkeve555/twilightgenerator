import { randomId } from "@/lib/uuid";
const KEY = "ti4-session-id";

export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(KEY, id);
  }
  return id;
}
