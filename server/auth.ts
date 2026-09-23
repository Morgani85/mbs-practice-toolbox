import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { sendPasswordResetEmail } from "./email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Rate limiters for authentication endpoints
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again after 15 minutes." },
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many password reset requests. Please try again after 1 hour." },
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many registration attempts. Please try again after 1 hour." },
  });

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProd = process.env.NODE_ENV === "production";

  const cookieSettings: session.CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "lax" : undefined,
    maxAge: sessionTtl,
  };

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: cookieSettings,
  };

  app.set("trust proxy", 1);

  if (!isProd) {
    console.log("[session] Dev mode cookie config:", {
      httpOnly: cookieSettings.httpOnly,
      secure: cookieSettings.secure,
      sameSite: cookieSettings.sameSite ?? "(browser default)",
      maxAge: `${sessionTtl / 1000 / 60 / 60 / 24} days`,
    });
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          console.log('Passport LocalStrategy called with email:', email);
          const user = await storage.getUserByEmail(email);
          if (!user) {
            console.log('No user found with email:', email);
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          if (!user.password) {
            console.log('User has no password set:', email);
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          const passwordMatch = await comparePasswords(password, user.password);
          if (!passwordMatch) {
            console.log('Password mismatch for user:', email);
            return done(null, false, { message: 'Invalid email or password' });
          }

          // Check if user's organisation is suspended (superadmin bypasses this)
          if (user.role !== 'superadmin' && user.organisationId) {
            const org = await storage.getOrganisation(user.organisationId);
            if (org && org.isSuspended) {
              return done(null, false, { message: 'Your organisation has been suspended. Please contact support.' });
            }
          }
          
          console.log('Authentication successful for user:', email);
          return done(null, user);
        } catch (error) {
          console.error('Passport strategy error:', error);
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Legacy /api/register is disabled — new practices must sign up via /api/signup
  // which creates a proper organisation + admin user together.
  app.post("/api/register", (req, res) => {
    res.status(410).json({
      message: "This endpoint is no longer available. To create a new practice, please use /signup."
    });
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    console.log('Login request received:', { email: req.body.email });
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Authentication failed:', info);
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }
        
        console.log('User logged in successfully:', user.email);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  // Public organisation self-signup — creates a new org + admin user and logs them in
  app.post("/api/signup", registerLimiter, async (req, res, next) => {
    try {
      const { firmName, firstName, lastName, email, password } = req.body;

      if (!firmName || !firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      // Generate a URL-safe slug from the firm name
      const baseSlug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existingSlug = await storage.getOrganisationBySlug(baseSlug);
      const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;

      const hashedPassword = await hashPassword(password);
      const { org: _org, user } = await storage.createOrganisationWithAdmin(
        { name: firmName, slug },
        { email, password: hashedPassword, firstName, lastName }
      );

      req.login(user, async (err) => {
        if (err) return next(err);
        const org = await storage.getOrganisation(user.organisationId!);
        res.status(201).json({ ...user, organisation: org || null });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Forgot password route
  app.post("/api/forgot-password", forgotPasswordLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Return identical response regardless of whether email exists — prevents enumeration
        return res.status(200).json({ 
          message: "If an account exists with that email address you will receive a password reset link shortly"
        });
      }

      // Generate secure reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

      await storage.setPasswordResetToken(email, resetToken, resetExpires);

      // Send reset email asynchronously — never return the token in the response
      sendPasswordResetEmail({ to: email, firstName: user.firstName, resetToken }).catch(err =>
        console.error("Failed to send password reset email:", err)
      );

      res.status(200).json({ 
        message: "If an account exists with that email address you will receive a password reset link shortly"
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password route
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetExpires || new Date() > user.resetExpires) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await hashPassword(password);
      const updatedUser = await storage.resetPassword(token, hashedPassword);

      if (!updatedUser) {
        return res.status(400).json({ message: "Failed to reset password" });
      }

      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    // Strip sensitive fields before sending to the client
    const { password, invitationToken, invitationExpires, resetToken, resetExpires, ...safeUser } = user;
    if (safeUser.organisationId) {
      const org = await storage.getOrganisation(safeUser.organisationId);
      return res.json({ ...safeUser, organisation: org || null });
    }
    res.json({ ...safeUser, organisation: null });
  });
}

export const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const requirePermission = (permission: string) => {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user;
    if (!checkUserPermission(user, permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

// Middleware that attaches req.organisationId from the authenticated user record.
// Must run after isAuthenticated. Rejects requests from users not linked to an org.
export const requireOrganisation = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const orgId = req.user?.organisationId;
  if (!orgId) {
    return res.status(403).json({ message: "Your account is not linked to an organisation. Please contact an administrator." });
  }
  req.organisationId = orgId;
  next();
};

export const requireTeamAccess = (sources: ('paramsTeamId' | 'paramsId' | 'queryTeamId' | 'bodyTeamId')[]) => {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user;

    let teamId: number | undefined;
    for (const source of sources) {
      let val: number | undefined;
      if (source === 'paramsTeamId') val = parseInt(req.params.teamId);
      else if (source === 'paramsId') val = parseInt(req.params.id);
      else if (source === 'queryTeamId') val = parseInt(req.query.teamId as string);
      else if (source === 'bodyTeamId') val = parseInt(req.body?.teamId);
      if (val && !isNaN(val)) { teamId = val; break; }
    }

    if (!teamId || isNaN(teamId)) {
      if (user.role === "admin" || user.role === "manager" || user.role === "user") return next();
      return res.status(403).json({ message: "Team access required" });
    }

    // Verify the team belongs to the user's organisation (org isolation)
    if (user.organisationId) {
      const team = await storage.getTeam(teamId);
      if (!team || team.organisationId !== user.organisationId) {
        return res.status(403).json({ message: "You do not have access to this team" });
      }
    }

    // Admins, managers, and regular users can access any team within their org.
    // Viewers are read-only and remain restricted by team membership.
    if (user.role === "admin" || user.role === "manager" || user.role === "user") {
      return next();
    }

    const hasAccess = await storage.isUserInTeam(user.id, teamId);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this team" });
    }

    next();
  };
};

export const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: "Forbidden: superadmin access required" });
  }
  next();
};

function checkUserPermission(user: any, permission: string): boolean {
  if (!user || !user.role) return false;

  // Superadmin has no org-level permissions — platform only
  if (user.role === 'superadmin') return false;

  const rolePermissions: Record<string, string[]> = {
    admin: ['manage_users', 'manage_teams', 'view_dashboard', 'manage_data', 'view_reports'],
    manager: ['manage_teams', 'view_dashboard', 'manage_data', 'view_reports'],
    user: ['view_dashboard', 'manage_data', 'view_reports'],
    viewer: ['view_dashboard', 'view_reports']
  };

  const userPermissions = rolePermissions[user.role] || [];
  return userPermissions.includes(permission);
}