import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';
import { authenticate } from '../middleware/auth';
import { logAction } from '../services/auditLog';

const router = Router();
router.use(authenticate);

const getOrgAdmin = async (userId: string, orgId: string) => {
  const membership = await prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId } } });
  return membership && ['OWNER', 'ADMIN'].includes(membership.role) ? membership : null;
};

// GET /api/orgs/search?q=<query>
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) return res.json({ success: true, data: { orgs: [] } });
    const userId = req.user!.userId;
    const orgs = await prisma.org.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        NOT: [
          { members: { some: { userId } } },
          { joinRequests: { some: { userId, status: 'PENDING' } } },
        ],
      },
      select: { id: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
      take: 25,
    });
    res.json({ success: true, data: { orgs } });
  } catch (error) {
    console.error('Search organizations error:', error);
    res.status(500).json({ success: false, error: { message: 'Unable to search organizations' } });
  }
});

// POST /api/orgs/:id/join-request
router.post('/:id/join-request', async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params.id);
    const userId = req.user!.userId;
    const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    const member = await prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (member) return res.status(409).json({ success: false, error: { message: 'You already belong to this organization' } });
    const existing = await prisma.joinRequest.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (existing?.status === 'PENDING') return res.status(409).json({ success: false, error: { message: 'A join request is already pending' } });
    const joinRequest = existing
      ? await prisma.joinRequest.update({ where: { id: existing.id }, data: { status: 'PENDING', requestedAt: new Date(), respondedAt: null, respondedById: null } })
      : await prisma.joinRequest.create({ data: { orgId, userId } });
    await logAction(userId, 'ORG_JOIN_REQUESTED', 'ORG', orgId, { joinRequestId: joinRequest.id });
    res.status(201).json({ success: true, data: { joinRequest } });
  } catch (error) {
    console.error('Create join request error:', error);
    res.status(500).json({ success: false, error: { message: 'Unable to create join request' } });
  }
});

// GET /api/orgs/:id/join-requests
router.get('/:id/join-requests', async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params.id);
    if (!await getOrgAdmin(req.user!.userId, orgId)) return res.status(403).json({ success: false, error: { message: 'Owner or Admin access is required' } });
    const requests = await prisma.joinRequest.findMany({
      where: { orgId, status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { requestedAt: 'asc' },
    });
    res.json({ success: true, data: { requests, count: requests.length } });
  } catch (error) {
    console.error('List join requests error:', error);
    res.status(500).json({ success: false, error: { message: 'Unable to list join requests' } });
  }
});

const decideJoinRequest = (status: 'APPROVED' | 'REJECTED') => async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params.id);
    const requestId = String(req.params.requestId);
    const responderId = req.user!.userId;
    if (!await getOrgAdmin(responderId, orgId)) return res.status(403).json({ success: false, error: { message: 'Owner or Admin access is required' } });
    const joinRequest = await prisma.joinRequest.findFirst({ where: { id: requestId, orgId, status: 'PENDING' } });
    if (!joinRequest) return res.status(404).json({ success: false, error: { message: 'Pending join request not found' } });
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'APPROVED') await tx.orgMember.upsert({ where: { userId_orgId: { userId: joinRequest.userId, orgId } }, update: {}, create: { userId: joinRequest.userId, orgId, role: 'MEMBER' } });
      return tx.joinRequest.update({ where: { id: joinRequest.id }, data: { status, respondedAt: new Date(), respondedById: responderId } });
    });
    await Promise.all([
      logAction(responderId, status === 'APPROVED' ? 'ORG_JOIN_REQUEST_APPROVED' : 'ORG_JOIN_REQUEST_REJECTED', 'JOIN_REQUEST', joinRequest.id, { orgId, requestedUserId: joinRequest.userId }),
      redis.del(`user:${joinRequest.userId}`),
    ]);
    res.json({ success: true, data: { joinRequest: updated } });
  } catch (error) {
    console.error('Decide join request error:', error);
    res.status(500).json({ success: false, error: { message: 'Unable to process join request' } });
  }
};

router.post('/:id/join-requests/:requestId/approve', decideJoinRequest('APPROVED'));
router.post('/:id/join-requests/:requestId/reject', decideJoinRequest('REJECTED'));

// GET /api/orgs/:id/drive
router.get('/:id/drive', async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params.id);
    const userId = req.user!.userId;
    const membership = await prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!membership) return res.status(403).json({ success: false, error: { message: 'Organization membership is required' } });
    const isAdmin = ['OWNER', 'ADMIN'].includes(membership.role);
    const files = await prisma.file.findMany({
      where: { orgId, driveType: 'ORG', deletedAt: null, ...(isAdmin ? {} : { OR: [{ status: 'APPROVED' }, { ownerId: userId }] }) },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
    res.json({ success: true, data: { org, membership, files, folders: [] } });
  } catch (error) {
    console.error('List org drive error:', error);
    res.status(500).json({ success: false, error: { message: 'Unable to load organization drive' } });
  }
});

export default router;
