import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/audit
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const action = req.query.action ? String(req.query.action) : undefined;
    const orgId = req.query.orgId ? String(req.query.orgId) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    let userIds = [userId];

    if (orgId) {
      const membership = await prisma.orgMember.findFirst({
        where: { orgId, userId, role: { in: ['OWNER', 'ADMIN'] } },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: { message: 'Org audit access requires owner or admin role' },
        });
        return;
      }

      const members = await prisma.orgMember.findMany({
        where: { orgId },
        select: { userId: true },
      });
      userIds = members.map((member) => member.userId);
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        userId: { in: userIds },
        ...(action && { action }),
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ success: true, data: { logs } });
  } catch (error) {
    console.error('List audit logs error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

export default router;
