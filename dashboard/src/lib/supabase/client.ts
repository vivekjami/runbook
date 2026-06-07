import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // During static builds without env vars set, return a dummy that won't crash
    // The real client is always available at runtime in the browser.
    if (typeof window === "undefined") {
      // Server/build context — throw a soft warning, not a crash
      console.warn("[RunBook] Supabase env vars not set — skipping client init during build.");
      return createBrowserClient("https://placeholder.supabase.co", "placeholder-key");
    }
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  return createBrowserClient(url, key);
}
