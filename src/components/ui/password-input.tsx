"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react/ssr";
import { useState, type ComponentProps } from "react";

// Only the rendered type changes, so the name and autocomplete that password
// managers rely on stay intact. The toggle is a real button after the input.
export function PasswordInput({
  className,
  ...props
}: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="text-muted hover:text-ink-strong absolute inset-y-0 right-0 grid w-11 place-items-center"
      >
        {visible ? (
          <EyeSlashIcon aria-hidden weight="bold" className="size-5" />
        ) : (
          <EyeIcon aria-hidden weight="bold" className="size-5" />
        )}
      </button>
    </div>
  );
}
