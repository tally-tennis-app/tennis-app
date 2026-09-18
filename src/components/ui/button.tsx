import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "quiet" | "critical";
type Size = "md" | "sm";

// Every size keeps a 44px minimum touch target (docs/design/ui-direction.md).
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-transform duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-action text-on-action hover:opacity-90",
  secondary:
    "border border-line-strong bg-surface text-ink-strong hover:bg-surface-sunken",
  quiet: "text-ink-strong underline-offset-4 hover:underline",
  // Outlined, so the label keeps AA contrast in both themes.
  critical:
    "border border-critical bg-surface text-critical hover:bg-surface-sunken",
};

const sizes: Record<Size, string> = {
  md: "px-5 text-base",
  sm: "px-3 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type Style = { variant?: Variant; size?: Size };

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & Style) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & Style) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props} />
  );
}
