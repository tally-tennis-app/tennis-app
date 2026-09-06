export type PublicEnv = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
}>;

export type EnvironmentSource = Record<string, string | undefined>;

const publicEnvironmentKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

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

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (parsedUrl.protocol !== "https:") {
      throw new Error("Expected HTTPS");
    }
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL");
  }

  return Object.freeze({ supabaseUrl, supabasePublishableKey });
}
