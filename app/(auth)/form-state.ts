/**
 * Shared shape for the auth form actions.
 *
 * Kept out of `actions.ts` because a "use server" module may only export async
 * functions -- exporting the initial-state object from there fails the build.
 */
export type AuthFormState = {
  error: string | null;
  notice: string | null;
};

export const emptyAuthFormState: AuthFormState = { error: null, notice: null };
