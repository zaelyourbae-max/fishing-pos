import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  canUsePOS,
  isOwnerRole,
} from "@/lib/permissions";
import { cookieSecure } from "@/lib/cookie-config";
import { prisma } from "@/lib/prisma";

export {
  canAccessCustomers,
  canAccessPurchases,
  canAccessReports,
  canAccessReturns,
  canAccessSettings,
  canAccessSuppliers,
  canManageProducts,
  canManageUsers,
  canUsePOS,
  canViewCostPrice,
  canViewProfit,
  isOwnerRole,
  isRoleSlug,
  type RoleSlug,
} from "@/lib/permissions";

const DEV_SESSION_SECRET = "dev-session-secret-change-me";
const MIN_SESSION_SECRET_LENGTH = 32;

function resolveSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProduction) {
      throw new Error(
        "SESSION_SECRET is required in production and must be at least 32 characters.",
      );
    }

    return DEV_SESSION_SECRET;
  }

  if (isProduction && secret === DEV_SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET must not use the development fallback value.",
    );
  }

  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters.",
    );
  }

  return secret;
}

const SESSION_SECRET = resolveSessionSecret();
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export type TokenPayload = {
  sub: number;
  email: string;
  role: string | null;
  exp: number;
};

type GuardResult =
  | {
      ok: true;
      session: TokenPayload;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string) {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<TokenPayload, "exp">) {
  const body = base64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  );
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as TokenPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pos_session="));

  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

export function requireSession(request: Request) {
  const token = tokenFromRequest(request);

  return token ? verifySessionToken(token) : null;
}

function unauthenticatedResponse(clearCookie = false) {
  const res = NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  if (clearCookie) {
    res.cookies.set("pos_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}

export async function requireAuth(request: Request): Promise<GuardResult> {
  const session = requireSession(request);

  if (!session) {
    return { ok: false, response: unauthenticatedResponse() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { isActive: true, deletedAt: true },
  });

  if (!user || !user.isActive || user.deletedAt !== null) {
    return { ok: false, response: unauthenticatedResponse(true) };
  }

  return { ok: true, session };
}

export async function requireOwner(request: Request): Promise<GuardResult> {
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth;
  }

  if (!isOwnerRole(auth.session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
    };
  }

  return auth;
}

export async function requireCashier(request: Request): Promise<GuardResult> {
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth;
  }

  if (!canUsePOS(auth.session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
    };
  }

  return auth;
}
