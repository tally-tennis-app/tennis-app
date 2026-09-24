import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

/** One title region per route: optional back link, title, context, action. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="text-muted hover:text-ink-strong inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold"
        >
          <ArrowLeftIcon aria-hidden weight="bold" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-title break-words">{title}</h1>
          {description ? (
            <div className="text-muted max-w-prose">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="type-section">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-line bg-surface border ${className}`}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "accent" | "positive" | "warning" | "critical";

const badgeTones: Record<Tone, string> = {
  neutral: "border-line-strong text-muted",
  accent: "border-accent text-accent",
  positive: "border-positive text-positive",
  warning: "border-warning text-warning",
  critical: "border-critical text-critical",
};

/** Status is never colour-only: a badge always carries its label as text. */
export function Badge({
  tone = "neutral",
  icon: BadgeIcon,
  children,
}: {
  tone?: Tone;
  icon?: Icon;
  children: string;
}) {
  return (
    <span
      className={`bg-surface inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap uppercase ${badgeTones[tone]}`}
    >
      {BadgeIcon ? (
        <BadgeIcon aria-hidden weight="bold" className="size-3.5" />
      ) : null}
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return role === "organizer" ? (
    <Badge tone="accent">Organizer</Badge>
  ) : (
    <Badge>Player</Badge>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/**
 * An uploaded picture when the player has one, initials otherwise. Decorative
 * either way: every avatar sits beside the name it belongs to.
 */
export function Avatar({
  name,
  size = "md",
  muted = false,
  src,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  /** Signed URL from the private avatars bucket. */
  src?: string | null;
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-16 text-xl",
  };

  if (src) {
    // A signed Supabase URL expires, so next/image would cache a dead upstream.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        src={src}
        className={`shrink-0 rounded-full object-cover ${sizes[size]} bg-surface-sunken`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${sizes[size]} ${
        muted ? "bg-surface-sunken text-muted" : "bg-action text-on-action"
      }`}
    >
      {initials(name)}
    </span>
  );
}

/** URL-driven tabs: each tab is a link, so the view is shareable. */
export function TabNav({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: { href: string; label: string; key: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="border-line -mx-4 border-b sm:mx-0">
      <ul className="relative flex overflow-x-auto px-4 sm:px-0">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold whitespace-nowrap ${
                  active
                    ? "border-accent text-ink-strong"
                    : "text-muted hover:text-ink-strong border-transparent"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="type-label text-muted">{label}</p>
      <p className="type-score text-ink-strong text-3xl">{value}</p>
      {detail ? <div className="text-muted text-sm">{detail}</div> : null}
    </div>
  );
}
