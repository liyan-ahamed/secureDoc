import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';
import redis from '../config/redis';
import { authenticate, JwtPayload } from '../middleware/auth';
import { logAction } from '../services/auditLog';

const router = Router();

// Helper: generate JWT
const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

// Helper: strip password from user object
const sanitizeUser = (user: any) => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, accountType, name, orgName } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: { message: 'Email, password, and name are required' },
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 8 characters' },
      });
      return;
    }

    if (accountType === 'ORGANIZATION' && !orgName) {
      res.status(400).json({
        success: false,
        error: { message: 'Organization name is required for organization accounts' },
      });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: { message: 'An account with this email already exists' },
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    let orgId: string | undefined;
    let role: string | undefined;

    if (accountType === 'ORGANIZATION') {
      // Create org, user, and membership in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.org.create({
          data: { name: orgName },
        });

        const newUser = await tx.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            accountType: 'ORGANIZATION',
          },
        });

        await tx.orgMember.create({
          data: {
            userId: newUser.id,
            orgId: org.id,
            role: 'OWNER',
          },
        });

        return { user: newUser, org };
      });

      user = result.user;
      orgId = result.org.id;
      role = 'OWNER';
    } else {
      // Create individual user
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          accountType: 'INDIVIDUAL',
        },
      });
    }

    // Generate token
    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      ...(role && { role }),
      ...(orgId && { orgId }),
    };

    const token = generateToken(tokenPayload);
    await logAction(user.id, 'SIGNUP', 'USER', user.id, { email: user.email, accountType: user.accountType });

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password are required' },
      });
      return;
    }

    const limitKey = `login-attempts:${email}`;
    const attempts = await redis.get(limitKey);
    if (attempts && parseInt(attempts) >= 5) {
      res.status(429).json({
        success: false,
        error: { message: 'Too many failed login attempts. Please try again in 15 minutes.' },
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        orgMemberships: {
          include: { org: true },
        },
      },
    });

    if (!user) {
      const currentAttempts = await redis.incr(limitKey);
      if (currentAttempts === 1) await redis.expire(limitKey, 15 * 60);

      res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password' },
      });
      return;
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const currentAttempts = await redis.incr(limitKey);
      if (currentAttempts === 1) await redis.expire(limitKey, 15 * 60);

      res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password' },
      });
      return;
    }

    // Reset login attempts on success
    await redis.del(limitKey);

    // Build token payload
    const membership = user.orgMemberships[0]; // Primary org
    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      ...(membership && { role: membership.role, orgId: membership.orgId }),
    };

    const token = generateToken(tokenPayload);
    await logAction(user.id, 'LOGIN', 'USER', user.id, { email: user.email });

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const cacheKey = `user:${userId}`;

    // Try to get from cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.json({
        success: true,
        data: { user: JSON.parse(cachedData) },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgMemberships: {
          include: { org: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
      return;
    }

    const sanitizedUser = sanitizeUser(user);
    
    // Save to cache with 5 minute TTL
    await redis.setex(cacheKey, 5 * 60, JSON.stringify(sanitizedUser));

    res.json({
      success: true,
      data: { user: sanitizedUser },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

export default router;
