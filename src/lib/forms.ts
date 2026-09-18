/**
 * Shared result shape for server actions driven by useActionState.
 *
 * Lives outside any "use server" module, which may only export async functions.
 * `done` changes on every success so a dialog can close in response to the
 * server, never optimistically.
 */
export type ActionState = {
  error: string | null;
  notice?: string | null;
  done?: number;
  /** Submitted values, echoed back so a recoverable failure keeps the input. */
  values?: Record<string, string>;
};

export const emptyActionState: ActionState = { error: null };

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function success(notice?: string): ActionState {
  return { error: null, notice: notice ?? null, done: Date.now() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from a URL or form are untrusted; anything not shaped like one is dropped. */
export function asUuid(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value : undefined;
}
