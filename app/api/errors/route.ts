import {
  createClientErrorEvent,
  reportErrorEvent,
} from "@/src/lib/observability/error-report";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return new Response(null, { status: 403 });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let report: unknown;
  try {
    report = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    return new Response(null, { status: 400 });
  }

  reportErrorEvent(createClientErrorEvent(report as Record<string, unknown>));
  return new Response(null, { status: 204 });
}
