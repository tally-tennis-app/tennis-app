import type { ComponentProps, ReactNode } from "react";

import { PasswordInput } from "@/src/components/ui/password-input";

export const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus aria-invalid:border-critical";

/**
 * Label above, hint below it, error below the input. The hint and error are
 * wired to the control with aria-describedby so a screen reader reads them.
 */
export function Field({
  label,
  name,
  hint,
  error,
  children,
  ...inputProps
}: ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string | null;
  /** A custom control (select, score input). Receives no props from Field. */
  children?: ReactNode;
}) {
  const id = inputProps.id ?? name;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = {
    id,
    name,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    className: inputClass,
    ...inputProps,
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ink-strong text-sm font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-muted -mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      {children ??
        (inputProps.type === "password" ? (
          <PasswordInput {...control} />
        ) : (
          <input {...control} />
        ))}
      {error ? (
        <p id={errorId} className="text-critical text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
