import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

type RouteCtx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: RouteCtx) {
  const { path } = await params;
  const segment = path.join("/");
  const target = `${API_ORIGIN}/api/${segment}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const userId = req.headers.get("x-user-id");
  if (userId) headers.set("x-user-id", userId);
  const locale = req.headers.get("x-locale");
  if (locale) headers.set("x-locale", locale);

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (cause) {
    console.error("[oracle proxy] cannot reach API:", target, cause);
    return NextResponse.json(
      {
        error:
          "Oracle API is not running on port 4000. Open a terminal and run: npm.cmd run dev:api",
      },
      { status: 503 }
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
