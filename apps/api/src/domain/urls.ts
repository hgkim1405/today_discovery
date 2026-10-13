import { isIP } from "node:net";

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    )
      return null;
    const ipHost = host.replace(/^\[|\]$/g, "");
    if (isIP(ipHost) !== 0) return null;
    return url.toString();
  } catch {
    return null;
  }
}
