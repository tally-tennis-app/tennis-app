import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

type Tone = "info" | "positive" | "warning" | "critical";

const tones: Record<Tone, { icon: Icon; className: string }> = {
  info: { icon: InfoIcon, className: "border-line-strong text-ink" },
  positive: { icon: CheckCircleIcon, className: "border-positive text-ink" },
  warning: { icon: WarningIcon, className: "border-warning text-ink" },
  critical: { icon: WarningCircleIcon, className: "border-critical text-ink" },
};

const iconTone: Record<Tone, string> = {
  info: "text-muted",
  positive: "text-positive",
  warning: "text-warning",
  critical: "text-critical",
};

/**
 * Inline message. Critical alerts interrupt a screen reader; the rest are
 * polite status updates. The icon is decorative: the text carries the meaning.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { icon: ToneIcon, className } = tones[tone];

  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={`bg-surface flex gap-3 border-l-4 px-4 py-3 ${className}`}
    >
      <ToneIcon
        aria-hidden
        weight="bold"
        className={`mt-0.5 size-5 shrink-0 ${iconTone[tone]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? (
          <p className="text-ink-strong font-semibold">{title}</p>
        ) : null}
        {children ? <div className="text-sm">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Wraps a form's result so the change is announced, not just shown. */
export function FormMessage({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {error ? <Alert tone="critical">{error}</Alert> : null}
      {notice ? <Alert tone="positive">{notice}</Alert> : null}
    </div>
  );
}

export function EmptyState({
  icon: EmptyIcon,
  title,
  children,
  action,
}: {
  icon: Icon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong flex flex-col items-start gap-3 border border-dashed px-5 py-8 sm:px-8">
      <EmptyIcon aria-hidden weight="bold" className="text-accent size-7" />
      <h2 className="type-section">{title}</h2>
      {children ? (
        <div className="text-muted max-w-prose">{children}</div>
      ) : null}
      {action ? (
        <div className="mt-2 flex flex-wrap gap-3">{action}</div>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-surface-sunken animate-pulse ${className}`}
    />
  );
}
