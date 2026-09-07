"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { AuthFormState } from "@/app/(auth)/form-state";
import { safeRedirectPath, signedInLandingPath } from "@/src/lib/auth/routes";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Absolute origin for links Supabase puts in emails.
 *
 * `x-forwarded-host` is set by the proxy in front of the app and is not
 * trustworthy on its own. Supabase validates every redirect against
 * `additional_redirect_urls` in `supabase/config.toml`, which is what actually
 * prevents a poisoned host header turning a confirmation email into an open
 * redirect. Keep that allow-list tight.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const next = safeRedirectPath(field(formData, "next")) ?? signedInLandingPath;

  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately identical for a wrong password and an unknown address, so
    // the form cannot be used to discover which emails have accounts.
    return { error: "That email and password do not match.", notice: null };
  }

  redirect(next);
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const displayName = field(formData, "displayName");
  const email = field(formData, "email");
  const password = field(formData, "password");

  if (!displayName || !email || !password) {
    return {
      error: "Fill in every field to create your account.",
      notice: null,
    };
  }

  if (displayName.length > 50) {
    return {
      error: "Display name must be 50 characters or fewer.",
      notice: null,
    };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", notice: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user() trigger to seed profiles.display_name.
      data: { display_name: displayName },
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message, notice: null };
  }

  return {
    error: null,
    notice: `Check ${email} for a confirmation link to finish setting up your account.`,
  };
}

export async function requestPasswordReset(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");

  if (!email) {
    return { error: "Enter the email address on your account.", notice: null };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/callback?next=%2Fupdate-password`,
  });

  // Reported the same way whether or not an account exists, for the same
  // enumeration reason as sign-in.
  return {
    error: null,
    notice: `If an account exists for ${email}, a reset link is on its way.`,
  };
}

export async function updatePassword(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = field(formData, "password");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", notice: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message, notice: null };
  }

  redirect(signedInLandingPath);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
