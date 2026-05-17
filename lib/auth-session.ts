import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  canUsePOS,
  isOwnerRole,
} from "@/lib/permissions";

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

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
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

export function requireAuth(request: Request): GuardResult {
  const session = requireSession(request);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Unauthenticated.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  return {
    ok: true,
    session,
  };
}

export function requireOwner(request: Request): GuardResult {
  const auth = requireAuth(request);

  if (!auth.ok) {
    return auth;
  }

  if (!isOwnerRole(auth.session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Forbidden.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return auth;
}

export function requireCashier(request: Request): GuardResult {
  const auth = requireAuth(request);

  if (!auth.ok) {
    return auth;
  }

  if (!canUsePOS(auth.session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Forbidden.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return auth;
}
