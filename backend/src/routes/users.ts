import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/users/search?q=<query>
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!query) {
      res.json({ success: true, data: { users: [] } });
      return;
    }

    const userId = req.user!.userId;
    const where = {
      id: { not: userId },
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { email: { contains: query, mode: 'insensitive' as const } },
      ],
    };
    const select = { id: true, name: true, email: true };

    // A user can belong to an organization through OrgMember. Prioritize people
    // in the caller's first organization, then fill remaining slots globally.
    const membership = await prisma.orgMember.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (!membership) {
      const users = await prisma.user.findMany({
        where,
        select,
        take: 10,
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: { users } });
      return;
    }

    const orgUsers = await prisma.user.findMany({
      where: { ...where, orgMemberships: { some: { orgId: membership.orgId } } },
      select,
      take: 10,
      orderBy: { name: 'asc' },
    });
    const remaining = 10 - orgUsers.length;
    const otherUsers = remaining > 0
      ? await prisma.user.findMany({
          where: {
            ...where,
            id: { notIn: [userId, ...orgUsers.map((user) => user.id)] },
          },
          select,
          take: remaining,
          orderBy: { name: 'asc' },
        })
      : [];

    res.json({ success: true, data: { users: [...orgUsers, ...otherUsers] } });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, error: { message: 'An unexpected error occurred' } });
  }
});

export default router;
