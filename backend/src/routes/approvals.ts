import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { logAction } from '../services/auditLog';

const router = Router();
router.use(authenticate);

const getAdminMembership = async (req: Request) => {
  const orgId = req.user!.orgId;
  if (!orgId) return null;
  return prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: req.user!.userId, orgId } },
  }).then((membership) => membership && ['OWNER', 'ADMIN'].includes(membership.role) ? membership : null);
};

const requireAdmin = async (req: Request, res: Response) => {
  const membership = await getAdminMembership(req);
  if (!membership) {
    res.status(403).json({ success: false, error: { message: 'Owner or Admin organization access is required' } });
    return null;
  }
  return membership;
};

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const membership = await requireAdmin(req, res);
    if (!membership) return;
    const files = await prisma.file.findMany({
      where: { orgId: membership.orgId, status: 'PENDING', deletedAt: null },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: { files, count: files.length } });
  } catch (error) {
    console.error('List pending approvals error:', error);
    res.status(500).json({ success: false, error: { message: 'An unexpected error occurred' } });
  }
});

const decide = (status: 'APPROVED' | 'REJECTED', action: string) => async (req: Request, res: Response) => {
  try {
    const membership = await requireAdmin(req, res);
    if (!membership) return;
    const fileId = String(req.params.fileId);
    const file = await prisma.file.findFirst({ where: { id: fileId, orgId: membership.orgId, status: 'PENDING', deletedAt: null } });
    if (!file) {
      res.status(404).json({ success: false, error: { message: 'Pending file not found in your organization' } });
      return;
    }
    const updatedFile = await prisma.file.update({ where: { id: file.id }, data: { status } });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    await logAction(req.user!.userId, action, 'FILE', file.id, {
      fileName: file.originalName,
      uploadedById: file.ownerId,
      ...(status === 'REJECTED' && reason ? { reason } : {}),
    });
    res.json({ success: true, data: { file: updatedFile } });
  } catch (error) {
    console.error('Decide approval error:', error);
    res.status(500).json({ success: false, error: { message: 'An unexpected error occurred' } });
  }
};

router.post('/:fileId/approve', decide('APPROVED', 'FILE_APPROVED'));
router.post('/:fileId/reject', decide('REJECTED', 'FILE_REJECTED'));

export default router;
