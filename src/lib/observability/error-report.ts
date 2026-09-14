export type ApplicationErrorEvent = Readonly<{
  event: "application_error";
  occurredAt: string;
  source: "next-server" | "client-boundary";
  errorName?: string;
  message?: string;
  digest?: string;
  method?: string;
  pathname?: string;
  routePath?: string;
  routeType?: string;
  routerKind?: string;
  runtime?: string;
  environment?: string;
  commitSha?: string;
}>;

type EnvironmentSource = Record<string, string | undefined>;

type ServerErrorRequest = Readonly<{
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}>;

type ServerErrorContext = Readonly<{
  routerKind: string;
  routePath: string;
  routeType: string;
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
}>;

const DEFAULT_TEXT_LIMIT = 500;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SUPABASE_KEY_PATTERN = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi;

export function sanitizeErrorText(
  value: unknown,
  limit = DEFAULT_TEXT_LIMIT,
): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const sanitized = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(SUPABASE_KEY_PATTERN, "[redacted-key]")
    .trim();

  if (!sanitized) return undefined;
  return sanitized.slice(0, Math.max(0, limit));
}

export function safePathname(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";

  try {
    return (
      sanitizeErrorText(new URL(value, "http://local").pathname, 300) ?? "/"
    );
  } catch {
    return "/";
  }
}

function errorProperties(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: sanitizeErrorText(error.name, 100),
      message: sanitizeErrorText(error.message),
      digest: sanitizeErrorText(
        "digest" in error
          ? (error as Error & { digest?: unknown }).digest
          : undefined,
        100,
      ),
    };
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as Record<string, unknown>;
    return {
      errorName: sanitizeErrorText(candidate.name, 100),
      message: sanitizeErrorText(candidate.message),
      digest: sanitizeErrorText(candidate.digest, 100),
    };
  }

  return { message: sanitizeErrorText(error) };
}

function definedFields<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as T;
}

export function createServerErrorEvent(
  error: unknown,
  request: ServerErrorRequest,
  context: ServerErrorContext,
  environment: EnvironmentSource = process.env,
  occurredAt = new Date().toISOString(),
): ApplicationErrorEvent {
  return definedFields({
    event: "application_error" as const,
    occurredAt,
    source: "next-server" as const,
    ...errorProperties(error),
    method: sanitizeErrorText(request.method, 16),
    pathname: safePathname(request.path),
    routePath: safePathname(context.routePath),
    routeType: sanitizeErrorText(context.routeType, 40),
    routerKind: sanitizeErrorText(context.routerKind, 40),
    runtime: sanitizeErrorText(environment.NEXT_RUNTIME, 40),
    environment: sanitizeErrorText(
      environment.VERCEL_ENV ?? environment.NODE_ENV,
      40,
    ),
    commitSha: sanitizeErrorText(environment.VERCEL_GIT_COMMIT_SHA, 80),
  });
}

export function createClientErrorEvent(
  report: Record<string, unknown>,
  environment: EnvironmentSource = process.env,
  occurredAt = new Date().toISOString(),
): ApplicationErrorEvent {
  return definedFields({
    event: "application_error" as const,
    occurredAt,
    source: "client-boundary" as const,
    errorName: sanitizeErrorText(report.name, 100),
    message: sanitizeErrorText(report.message),
    digest: sanitizeErrorText(report.digest, 100),
    pathname: safePathname(report.pathname),
    runtime: "nodejs",
    environment: sanitizeErrorText(
      environment.VERCEL_ENV ?? environment.NODE_ENV,
      40,
    ),
    commitSha: sanitizeErrorText(environment.VERCEL_GIT_COMMIT_SHA, 80),
  });
}

export function reportErrorEvent(
  event: ApplicationErrorEvent,
  logger: (line: string) => void = console.error,
): void {
  try {
    logger(JSON.stringify(event));
  } catch {
    // Observability must never replace the original application behavior.
  }
}

export function reportClientBoundaryError(
  error: Error & { digest?: string },
  pathname = typeof window === "undefined" ? "/" : window.location.pathname,
): void {
  const body = JSON.stringify({
    name: sanitizeErrorText(error.name, 100),
    message: sanitizeErrorText(error.message),
    digest: sanitizeErrorText(error.digest, 100),
    pathname: safePathname(pathname),
  });

  try {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Rendering and retry remain available if the report transport is absent.
  }
}
