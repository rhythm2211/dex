/**
 * Same-origin proxy to FastAPI with long timeouts (graph/ingest can take 60–120s).
 * Replaces fragile Next rewrites that drop connections (ECONNRESET) on large responses.
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.INTERNAL_API_URL ||
  "http://127.0.0.1:8000";

const PROXY_TIMEOUT_MS = 180_000;

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const subpath = pathSegments.join("/");
  const isHealth = subpath === "health";
  const target = isHealth
    ? `${BACKEND}/health`
    : `${BACKEND}/api/v1/${subpath}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection") return;
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const out = new NextResponse(body, { status: upstream.status });
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      out.headers.set(key, value);
    });
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error(`[api/backend] ${req.method} ${target} failed:`, message);
    return NextResponse.json(
      { error: `Backend unreachable: ${message}` },
      { status: 502 }
    );
  }
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}
