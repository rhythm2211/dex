/**
 * Server-side FastAPI URL resolution for Next.js route handlers (NextAuth, proxies).
 * Prefer BACKEND_URL / INTERNAL_API_URL; fall back to same-origin /api/backend proxy.
 */

export function resolveServerV1Base(): string {
  const backend =
    process.env.BACKEND_URL?.replace(/\/$/, "") ||
    process.env.INTERNAL_API_URL?.replace(/\/$/, "");
  if (backend?.startsWith("http")) {
    return `${backend}/api/v1`;
  }

  const nextAuthOrigin =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
  const relative =
    backend?.startsWith("/")
      ? backend
      : process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (relative?.startsWith("/")) {
    return `${nextAuthOrigin}${relative}`;
  }

  return "http://127.0.0.1:8000/api/v1";
}

export function userByEmailUrl(email: string): string {
  return `${resolveServerV1Base()}/users/email/${encodeURIComponent(email)}`;
}

function isRetriableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = err.cause as { code?: string } | undefined;
  const code = cause?.code;
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ECONNABORTED"
  );
}

/** fetch with timeout and brief retries on transient connection errors (uvicorn reload, busy ingest). */
export async function fetchBackend(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
  retries = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      lastError = err;
      if (!isRetriableFetchError(err) || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
