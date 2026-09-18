"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeRedirectPath, signedInLandingPath } from "@/src/lib/auth/routes";
import { field, type ActionState } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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

/**
 * Supabase auth messages are written for developers. The few a player can
 * cause and fix get plain wording; anything else is reported generically
 * rather than exposing the raw text.
 */
function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "That email already has an account. Sign in, or reset your password.";
  }
  if (
    lower.includes("same as the old") ||
    lower.includes("different from the old")
  ) {
    return "Choose a password you have not used for this account before.";
  }
  if (lower.includes("weak") || lower.includes("password should")) {
    return "Choose a longer or less common password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (lower.includes("session") || lower.includes("not authenticated")) {
    return "Your reset link has expired. Request a new one.";
  }
  return "Something went wrong. Try again.";
}

export async function signIn(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const next = safeRedirectPath(field(formData, "next")) ?? signedInLandingPath;

  const values = { email };

  if (!email || !password) {
    return { error: "Enter your email and password.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately identical for a wrong password and an unknown address, so
    // the form cannot be used to discover which emails have accounts.
    return { error: "That email and password do not match.", values };
  }

  redirect(next);
}

export async function signUp(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const displayName = field(formData, "displayName");
  const email = field(formData, "email");
  const password = field(formData, "password");

  const values = { displayName, email };

  if (!displayName || !email || !password) {
    return { error: "Fill in every field to create your account.", values };
  }

  if (displayName.length > 50) {
    return { error: "Display name must be 50 characters or fewer.", values };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", values };
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
    return { error: authErrorMessage(error.message), values };
  }

  return {
    error: null,
    notice: `Check ${email} for a confirmation link to finish setting up your account.`,
    done: Date.now(),
    values,
  };
}

export async function requestPasswordReset(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = field(formData, "email");

  if (!email) {
    return { error: "Enter the email address on your account." };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/callback?next=%2Fupdate-password`,
  });

  // Reported the same way whether or not an account exists, for the same
  // enumeration reason as sign-in.
  return {
    error: null,
    notice: `If an account exists for ${email}, a reset link is on its way. It works once and expires after an hour.`,
    values: { email },
  };
}

export async function updatePassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = field(formData, "password");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: authErrorMessage(error.message) };
  }

  redirect(signedInLandingPath);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
