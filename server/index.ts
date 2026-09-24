import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { startEmailAnalyticsScheduler } from "./email-analytics-scheduler";
import { setupVite, serveStatic, log } from "./vite";
import { stripe } from "./stripe-service";
import { handleStripeWebhook } from "./stripe-webhook";

const app = express();
app.use(compression()); // Enable gzip compression

// ── Stripe webhook: MUST be registered BEFORE express.json() ─────────────────
// Stripe needs the raw request body (Buffer) to verify the signature.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || !stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Stripe not configured or missing signature" });
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;

    // Step 1: verify signature — failure here means bad/tampered request
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error: any) {
      console.error("[Stripe Webhook] Signature verification FAILED:", error.message);
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Step 2: process the event — errors here must NOT return 400 (that causes Stripe to retry)
    console.log(`[Stripe Webhook] Received event: ${event.type} (id=${event.id})`);
    try {
      await handleStripeWebhook(event);
      console.log(`[Stripe Webhook] Successfully processed: ${event.type}`);
    } catch (error: any) {
      console.error(`[Stripe Webhook] Handler error for ${event.type}:`, error.message, error.stack);
      // Still return 200 so Stripe doesn't keep retrying — log the error and investigate
    }
    return res.status(200).json({ received: true });
  }
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Serve attached assets (like the logo)
app.use('/attached_assets', express.static('attached_assets'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Startup checks — refuse to boot if any required environment variable is missing
  const missingEnvVars: string[] = [];

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    missingEnvVars.push(
      "SESSION_SECRET (must be set and at least 32 characters)"
    );
  }
  if (!process.env.DATABASE_URL) {
    missingEnvVars.push("DATABASE_URL");
  }
  // STRIPE_SECRET_KEY is optional: without it, stripe-service.ts disables billing
  // and the Stripe routes return 503 "Stripe not configured".

  if (missingEnvVars.length > 0) {
    throw new Error(
      "[startup] Required environment variables are missing — application cannot start:\n" +
      missingEnvVars.map(v => `  • ${v}`).join("\n")
    );
  }

  const server = await registerRoutes(app);
  startEmailAnalyticsScheduler();

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const userId = (req as any).user?.id ?? 'unauthenticated';

    // Structured server-side log — never expose stack traces to the client
    console.error(`[${new Date().toISOString()}] HTTP ${status} error`, {
      url: req.method + ' ' + req.originalUrl,
      userId,
      errorType: err.name || 'Error',
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
    });

    // Return a safe message — no technical details to the client
    const clientMessage = status >= 500
      ? 'Internal Server Error'
      : (err.message || 'Request failed');

    res.status(status).json({ message: clientMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the host-assigned PORT (Railway), falling back to 5000.
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
