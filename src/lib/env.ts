export type PublicEnv = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
}>;

export type EnvironmentSource = Record<string, string | undefined>;

const publicEnvironmentKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopback(hostname: string): boolean {
  return loopbackHostnames.has(hostname);
}

export function readPublicEnv(
  source: EnvironmentSource = process.env,
): PublicEnv {
  const missing = publicEnvironmentKeys.filter((key) => !source[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const supabasePublishableKey =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }

  // The local Supabase stack serves plain HTTP on a loopback port, so requiring
  // HTTPS everywhere would make `supabase start` unusable for development.
  // Every other host must still be HTTPS.
  if (parsedUrl.protocol !== "https:" && !isLoopback(parsedUrl.hostname)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS");
  }

  return Object.freeze({ supabaseUrl, supabasePublishableKey });
}
