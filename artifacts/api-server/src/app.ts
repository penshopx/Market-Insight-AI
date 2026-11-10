import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { isValidSession, isAuthEnabled } from "./lib/authSessions";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// ── Clerk proxy (must be before body parsers — streams raw bytes) ────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        const rawUrl = req.url?.split("?")[0];
        return {
          id: req.id,
          method: req.method,
          url: rawUrl?.replace(
            /^\/api\/mkr-shares\/[^/]+$/,
            "/api/mkr-shares/:token",
          ),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Clerk middleware ──────────────────────────────────────────────────────────
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ── Clerk webhook — raw body MUST be parsed before json() for svix verification ──
// This route is mounted directly on app so it receives the raw buffer.
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Re-route into the main router
    req.url = "/webhooks/clerk";
    router(req, res, next);
  },
);

// ── Platform authentication middleware ────────────────────────────────────────
// Only active when PLATFORM_PASSWORD env var is set.
// /api/auth/* is always public (login/logout/status endpoints).
// /api/me is always public (users need it to see their own review status).
app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  if (!isAuthEnabled()) { next(); return; }
  if (req.path.startsWith("/auth/")) { next(); return; }
  if (req.path === "/me") { next(); return; }
  if (req.method === "GET" && req.path.startsWith("/mkr-shares/")) { next(); return; }

  const token = req.cookies?.platform_session as string | undefined;
  if (isValidSession(token)) { next(); return; }

  res.status(401).json({ error: "Sesi tidak valid. Silakan login kembali.", code: "UNAUTHENTICATED" });
});

app.use("/api", router);

export default app;
