import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AuthError } from "@/lib/auth";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with structured error handling + logging.
 * - AuthError → proper status + user message
 * - Prisma known errors → 400/404 with safe message
 * - Unknown errors → 500 with generic message, full error logged server-side
 */
export function withApiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    const start = Date.now();
    const { method } = req;
    const url = req.nextUrl.pathname;

    try {
      const response = await handler(req, ctx);
      const ms = Date.now() - start;
      logger.info("api:ok", { method, url, status: response.status, ms });
      return response;
    } catch (err) {
      const ms = Date.now() - start;

      if (err instanceof AuthError) {
        logger.warn("api:auth-error", {
          method,
          url,
          status: err.status,
          message: err.message,
          ms,
        });
        return NextResponse.json(
          { error: err.message },
          { status: err.status },
        );
      }

      // Prisma known request errors
      if (isPrismaError(err, "P2025")) {
        logger.warn("api:not-found", { method, url, ms });
        return NextResponse.json(
          { error: "요청한 데이터를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      if (isPrismaError(err, "P2002")) {
        logger.warn("api:duplicate", { method, url, ms });
        return NextResponse.json(
          { error: "이미 존재하는 데이터입니다." },
          { status: 409 },
        );
      }

      // Unknown / unexpected
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error("api:unhandled", {
        method,
        url,
        error: message,
        stack,
        ms,
      });

      return NextResponse.json(
        { error: "서버에서 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
  };
}

function isPrismaError(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === code
  );
}
