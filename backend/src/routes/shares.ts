import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { SharePermission } from '@prisma/client';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { nowShareFilter } from '../services/accessControl';
import { logAction } from '../services/auditLog';

const router = Router();

const getRouteParam = (value: unknown) => String(value);

const isPermission = (value: unknown): value is SharePermission => {
  return value === 'VIEW' || value === 'EDIT';
};

const getTarget = async (fileId?: string, folderId?: string) => {
  if (fileId) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
      select: { id: true, ownerId: true, originalName: true },
    });
    return file ? { type: 'FILE' as const, id: file.id, ownerId: file.ownerId, name: file.originalName } : null;
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null },
      select: { id: true, ownerId: true, name: true },
    });
    return folder ? { type: 'FOLDER' as const, id: folder.id, ownerId: folder.ownerId, name: folder.name } : null;
  }

  return null;
};

const shareInclude = {
  file: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      updatedAt: true,
      currentVersion: true,
      ownerId: true,
    },
  },
  folder: {
    select: {
      id: true,
      name: true,
      updatedAt: true,
      ownerId: true,
    },
  },
  owner: { select: { id: true, name: true, email: true } },
  sharedWith: { select: { id: true, name: true, email: true } },
};

// GET /api/shares/link/:token
router.get('/link/:token', async (req: Request, res: Response) => {
  try {
    const token = getRouteParam(req.params.token);
    const share = await prisma.share.findFirst({
      where: {
        shareToken: token,
        ...nowShareFilter(),
      },
      include: shareInclude,
    });

    if (!share) {
      res.status(404).json({
        success: false,
        error: { message: 'Share link not found or expired' },
      });
      return;
    }

    if (share.fileId) {
      await logAction(share.ownerId, 'LINK_ACCESS', 'SHARE', share.id, {
        targetType: 'FILE',
        fileName: share.file?.originalName,
      });
    }

    res.json({ success: true, data: { share } });
  } catch (error) {
    console.error('Access share link error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

router.use(authenticate);

// POST /api/shares
router.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const fileId = req.body.fileId ? String(req.body.fileId) : undefined;
    const folderId = req.body.folderId ? String(req.body.folderId) : undefined;
    const permission = isPermission(req.body.permission) ? req.body.permission : undefined;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const generateLink = Boolean(req.body.generateLink || req.body.linkShare);

    if ((fileId && folderId) || (!fileId && !folderId)) {
      res.status(400).json({
        success: false,
        error: { message: 'Exactly one of fileId or folderId is required' },
      });
      return;
    }

    if (!permission) {
      res.status(400).json({
        success: false,
        error: { message: 'Permission must be VIEW or EDIT' },
      });
      return;
    }

    const target = await getTarget(fileId, folderId);
    if (!target || target.ownerId !== ownerId) {
      res.status(404).json({
        success: false,
        error: { message: 'Share target not found' },
      });
      return;
    }

    let sharedWithId: string | null = null;
    let shareToken: string | null = null;
    let expiresAt: Date | null = null;

    if (generateLink) {
      shareToken = crypto.randomBytes(24).toString('hex');
      expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        res.status(400).json({
          success: false,
          error: { message: 'expiresAt must be a valid date' },
        });
        return;
      }
    } else {
      if (!email) {
        res.status(400).json({
          success: false,
          error: { message: 'Email is required for user shares' },
        });
        return;
      }

      const sharedWith = await prisma.user.findUnique({ where: { email } });
      if (!sharedWith) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
        return;
      }

      if (sharedWith.id === ownerId) {
        res.status(400).json({
          success: false,
          error: { message: 'You already own this item' },
        });
        return;
      }

      sharedWithId = sharedWith.id;
    }

    const existingDirectShare = !generateLink && sharedWithId
      ? await prisma.share.findFirst({
          where: {
            ownerId,
            sharedWithId,
            fileId: fileId || null,
            folderId: folderId || null,
            revokedAt: null,
            shareToken: null,
          },
        })
      : null;

    const share = existingDirectShare
      ? await prisma.share.update({
          where: { id: existingDirectShare.id },
          data: { permission },
          include: shareInclude,
        })
      : await prisma.share.create({
          data: {
            fileId: fileId || null,
            folderId: folderId || null,
            ownerId,
            sharedWithId,
            permission,
            shareToken,
            expiresAt,
          },
          include: shareInclude,
        });

    await logAction(ownerId, 'SHARE', 'SHARE', share.id, {
      targetType: target.type,
      targetId: target.id,
      targetName: target.name,
      sharedWithEmail: email || null,
      permission,
      linkShare: generateLink,
      updatedExisting: Boolean(existingDirectShare),
      expiresAt,
    });

    res.status(201).json({ success: true, data: { share } });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/shares/mine
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const shares = await prisma.share.findMany({
      where: { ownerId: req.user!.userId, revokedAt: null },
      include: shareInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { shares } });
  } catch (error) {
    console.error('List my shares error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/shares/shared-with-me
router.get('/shared-with-me', async (req: Request, res: Response) => {
  try {
    const shares = await prisma.share.findMany({
      where: {
        sharedWithId: req.user!.userId,
        ...nowShareFilter(),
      },
      include: shareInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { shares } });
  } catch (error) {
    console.error('List shared with me error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});
// PATCH /api/shares/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const shareId = getRouteParam(req.params.id);
    const permission = req.body.permission;

    if (!isPermission(permission)) {
      res.status(400).json({
        success: false,
        error: { message: 'Permission must be VIEW or EDIT' },
      });
      return;
    }

    const share = await prisma.share.findFirst({
      where: { id: shareId, ownerId: req.user!.userId, revokedAt: null },
      include: shareInclude,
    });

    if (!share) {
      res.status(404).json({
        success: false,
        error: { message: 'Share not found' },
      });
      return;
    }

    const updatedShare = await prisma.share.update({
      where: { id: share.id },
      data: { permission },
      include: shareInclude,
    });

    await logAction(req.user!.userId, 'UPDATE_SHARE_PERMISSION', 'SHARE', share.id, {
      fileId: share.fileId,
      folderId: share.folderId,
      sharedWithEmail: share.sharedWith?.email || null,
      linkShare: Boolean(share.shareToken),
      permission,
    });

    res.json({ success: true, data: { share: updatedShare } });
  } catch (error) {
    console.error('Update share permission error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// DELETE /api/shares/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const shareId = getRouteParam(req.params.id);
    const share = await prisma.share.findFirst({
      where: { id: shareId, ownerId: req.user!.userId, revokedAt: null },
      include: shareInclude,
    });

    if (!share) {
      res.status(404).json({
        success: false,
        error: { message: 'Share not found' },
      });
      return;
    }

    const revoked = await prisma.share.update({
      where: { id: share.id },
      data: { revokedAt: new Date() },
    });

    await logAction(req.user!.userId, 'REVOKE_SHARE', 'SHARE', share.id, {
      fileId: share.fileId,
      folderId: share.folderId,
      sharedWithEmail: share.sharedWith?.email || null,
      linkShare: Boolean(share.shareToken),
    });

    res.json({ success: true, data: { share: revoked } });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

export default router;
