import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import redis from '../config/redis';
import { authenticate } from '../middleware/auth';
import { logAction } from '../services/auditLog';

const router = Router();
router.use(authenticate);

// Helper to check org permission
const checkOrgPermission = async (req: Request, res: Response, orgId: string, allowedRoles: string[]) => {
  const userId = req.user!.userId;
  const membership = await prisma.orgMember.findUnique({
    where: {
      userId_orgId: { userId, orgId }
    }
  });

  if (!membership || !allowedRoles.includes(membership.role)) {
    res.status(403).json({ success: false, error: { message: 'Forbidden: Insufficient org permissions' }});
    return null;
  }
  return membership;
};

// GET /api/orgs/:id - org details + member list
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id as string;
    const membership = await checkOrgPermission(req, res, orgId, ['OWNER', 'ADMIN', 'MEMBER']);
    if (!membership) return;

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, createdAt: true }
            }
          }
        },
        invites: {
          where: { acceptedAt: null }
        }
      }
    });

    if (!org) {
      res.status(404).json({ success: false, error: { message: 'Organization not found' }});
      return;
    }

    res.json({
      success: true,
      data: { org }
    });
  } catch (error) {
    console.error('Get org error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error' }});
  }
});

// POST /api/orgs/:id/invite - Owner/Admin only
router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id as string;
    const { email, role } = req.body;
    
    if (!email || !role || !['ADMIN', 'MEMBER'].includes(role)) {
      res.status(400).json({ success: false, error: { message: 'Valid email and role (ADMIN or MEMBER) required' }});
      return;
    }

    const membership = await checkOrgPermission(req, res, orgId, ['OWNER', 'ADMIN']);
    if (!membership) return;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Check if already a member
      const existingMember = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId } }
      });

      if (existingMember) {
        res.status(400).json({ success: false, error: { message: 'User is already a member of this organization' }});
        return;
      }

      // Add them directly
      const newMember = await prisma.orgMember.create({
        data: {
          userId: user.id,
          orgId,
          role: role as any,
        }
      });
      await logAction(req.user!.userId, 'INVITE_USER_DIRECT', 'ORG', orgId, { email, role });
      
      res.json({
        success: true,
        data: { member: newMember, message: 'User added directly' }
      });
    } else {
      // Create an invite
      const existingInvite = await prisma.invite.findFirst({
        where: { orgId, email, acceptedAt: null }
      });

      if (existingInvite) {
        res.status(400).json({ success: false, error: { message: 'Pending invite already exists for this email' }});
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const invite = await prisma.invite.create({
        data: {
          orgId,
          email,
          role: role as any,
          token,
          expiresAt
        }
      });
      
      await logAction(req.user!.userId, 'CREATE_INVITE', 'ORG', orgId, { email, role });

      // In a real app we would send an email here. We just return the link.
      res.json({
        success: true,
        data: { invite, inviteLink: `/invite/${token}` }
      });
    }
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error' }});
  }
});

// POST /api/orgs/invite/:token/accept
router.post('/invite/:token/accept', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const userId = req.user!.userId;
    const userEmail = req.user!.email;

    const invite = await prisma.invite.findUnique({ where: { token } });

    if (!invite) {
      res.status(404).json({ success: false, error: { message: 'Invite not found' }});
      return;
    }

    if (invite.acceptedAt) {
      res.status(400).json({ success: false, error: { message: 'Invite already accepted' }});
      return;
    }

    if (invite.expiresAt < new Date()) {
      res.status(400).json({ success: false, error: { message: 'Invite has expired' }});
      return;
    }

    if (invite.email !== userEmail) {
      res.status(403).json({ success: false, error: { message: 'This invite is not for your email address' }});
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.orgMember.create({
        data: {
          userId,
          orgId: invite.orgId,
          role: invite.role,
        }
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() }
      });

      return member;
    });

    await logAction(userId, 'ACCEPT_INVITE', 'ORG', invite.orgId, { role: invite.role });
    await redis.del(`user:${userId}`);

    res.json({ success: true, data: { member: result }});
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error' }});
  }
});

// PATCH /api/orgs/:id/members/:userId - Owner/Admin only
router.patch('/:id/members/:targetUserId', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id as string;
    const targetUserId = req.params.targetUserId as string;
    const { role } = req.body;

    if (!role || !['ADMIN', 'MEMBER'].includes(role)) {
      res.status(400).json({ success: false, error: { message: 'Valid role (ADMIN or MEMBER) required' }});
      return;
    }

    const membership = await checkOrgPermission(req, res, orgId, ['OWNER', 'ADMIN']);
    if (!membership) return;

    const targetMember = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } }
    });

    if (!targetMember) {
      res.status(404).json({ success: false, error: { message: 'Member not found' }});
      return;
    }

    if (targetMember.role === 'OWNER') {
      res.status(403).json({ success: false, error: { message: 'Cannot change role of the owner' }});
      return;
    }

    if (membership.role === 'ADMIN' && targetMember.role === 'ADMIN') {
       res.status(403).json({ success: false, error: { message: 'Admin cannot change role of another Admin' }});
       return;
    }

    const updatedMember = await prisma.orgMember.update({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      data: { role: role as any }
    });

    await logAction(req.user!.userId, 'UPDATE_MEMBER_ROLE', 'ORG', orgId, { targetUserId, role });
    await redis.del(`user:${targetUserId}`);

    res.json({ success: true, data: { member: updatedMember }});
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error' }});
  }
});

// DELETE /api/orgs/:id/members/:userId - Owner/Admin only
router.delete('/:id/members/:targetUserId', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id as string;
    const targetUserId = req.params.targetUserId as string;

    const membership = await checkOrgPermission(req, res, orgId, ['OWNER', 'ADMIN']);
    if (!membership) return;

    const targetMember = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } }
    });

    if (!targetMember) {
      res.status(404).json({ success: false, error: { message: 'Member not found' }});
      return;
    }

    if (targetMember.role === 'OWNER') {
      res.status(403).json({ success: false, error: { message: 'Cannot remove the owner' }});
      return;
    }

    if (membership.role === 'ADMIN' && targetMember.role === 'ADMIN' && membership.userId !== targetUserId) {
       res.status(403).json({ success: false, error: { message: 'Admin cannot remove another Admin' }});
       return;
    }

    await prisma.orgMember.delete({
      where: { userId_orgId: { userId: targetUserId, orgId } }
    });

    await logAction(req.user!.userId, 'REMOVE_MEMBER', 'ORG', orgId, { targetUserId });
    await redis.del(`user:${targetUserId}`);

    res.json({ success: true, data: { message: 'Member removed successfully' }});
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error' }});
  }
});

export default router;
