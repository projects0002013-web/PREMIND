import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export interface CloudConfig {
  url: string;
  key: string;
}
export function parseCloudConfig(
  url?: string,
  key?: string,
): CloudConfig | null {
  if (!url && !key) return null;
  if (!url || !key) throw new Error("incomplete-config");
  const parsed = new URL(url);
  if (
    (parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error("invalid-url");
  if (!key.startsWith("sb_publishable_")) {
    try {
      const role = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role;
      if (role !== "anon") throw Error();
    } catch {
      throw new Error("public-key-required");
    }
  }
  return { url: parsed.origin, key };
}
let client: SupabaseClient | null = null;
let configError = false;
try {
  const config = parseCloudConfig(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
  if (config)
    client = createClient(config.url, config.key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
} catch {
  configError = true;
}
export { client, configError };
export const authRedirect = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href;
