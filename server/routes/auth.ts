import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const DEFAULT_PASSWORD = "esol123";

const ALLOWED_DOMAINS = [
  '@esolglobal.com',
  '@esol.com',
  '@otomashen.com'
];

function validateEmailDomain(email: string): boolean {
  const emailLower = email.toLowerCase();
  return ALLOWED_DOMAINS.some(domain => emailLower.endsWith(domain));
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'recruiter', 'candidate']).default('recruiter')
});

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.sentivox_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const { name, email, password, role } = registerSchema.parse(req.body);
      
      if (!validateEmailDomain(email)) {
        return res.status(403).json({ 
          message: "Unauthorized email domain. Please use @esolglobal.com, @esol.com, or @otomashen.com" 
        });
      }

      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        isDefaultPassword: false
      });

      console.log(`New user created: ${email} with role: ${role}`);

      res.json({
        message: "User created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Registration failed' });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      if (!validateEmailDomain(email)) {
        return res.status(403).json({ 
          message: "Unauthorized email domain. Please use @esolglobal.com, @esol.com, or @otomashen.com" 
        });
      }

      let user = await storage.getUserByEmail(email.toLowerCase());
      
      if (!user) {
        console.log(`Creating new recruiter with default password: ${email}`);
        const hashedDefaultPassword = await hashPassword(DEFAULT_PASSWORD);
        user = await storage.createUser({
          name: email.split('@')[0],
          email: email.toLowerCase(),
          password: hashedDefaultPassword,
          role: 'recruiter',
          isDefaultPassword: true
        });
        console.log(`New recruiter created: ${email} with default password`);
      }
      
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user._id, user.email, user.role);
      
      res.cookie('sentivox_token', token, getCookieOptions());

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: user.isDefaultPassword
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Login failed' });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
      const isDefaultPassword = user.password === defaultPasswordHash;

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: isDefaultPassword || user.isDefaultPassword
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie('sentivox_token', getCookieOptions());
    res.json({ message: "Logged out successfully" });
  });

  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      const isValid = await comparePassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user._id, {
        password: hashedPassword,
        isDefaultPassword: false
      });

      console.log(`Password changed successfully for user: ${user.email}`);

      res.json({ 
        success: true, 
        message: "Password changed successfully" 
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Password change failed' });
    }
  });
}
