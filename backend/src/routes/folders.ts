import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { canAccessFolder, includeShareSummary } from '../services/accessControl';
import { logAction } from '../services/auditLog';

const router = Router();

router.use(authenticate);

const getOptionalParentId = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '' || value === 'root') {
    return null;
  }

  return String(value);
};

const getRouteParam = (value: unknown) => String(value);

const getFolderDescendantIds = async (ownerId: string, folderId: string) => {
  const ids = [folderId];
  const queue = [folderId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId, deletedAt: null },
      select: { id: true },
    });

    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }

  return ids;
};

const getFolderPath = async (ownerId: string, folderId: string) => {
  const path: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findFirst({
      where: { id: currentId, ownerId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });

    if (!folder) {
      break;
    }

    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return path;
};

// POST /api/folders
router.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const { name, parentId, orgId } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      res.status(400).json({
        success: false,
        error: { message: 'Folder name is required' },
      });
      return;
    }

    const normalizedParentId = getOptionalParentId(parentId) ?? null;

    if (normalizedParentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: normalizedParentId, ownerId, deletedAt: null },
      });

      if (!parent) {
        res.status(404).json({
          success: false,
          error: { message: 'Parent folder not found' },
        });
        return;
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name: trimmedName,
        ownerId,
        orgId: orgId || req.user!.orgId || null,
        parentId: normalizedParentId,
      },
    });

    res.status(201).json({ success: true, data: { folder } });
    await logAction(ownerId, 'CREATE', 'FOLDER', folder.id, { folderName: folder.name });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/folders
router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const parentId = getOptionalParentId(req.query.parentId);
    const orgId = req.query.orgId ? String(req.query.orgId) : undefined;

    const folders = await prisma.folder.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(parentId !== undefined && { parentId }),
        ...(orgId !== undefined && { orgId }),
      },
      include: includeShareSummary,
      orderBy: [{ name: 'asc' }],
    });

    res.json({ success: true, data: { folders } });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/folders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const folderId = getRouteParam(req.params.id);
    const access = await canAccessFolder(ownerId, folderId, 'VIEW');
    const folder = access.allowed
      ? await prisma.folder.findFirst({
          where: { id: folderId, deletedAt: null },
          include: includeShareSummary,
        })
      : null;

    if (!folder) {
      res.status(404).json({
        success: false,
        error: { message: 'Folder not found' },
      });
      return;
    }

    const [subfolders, files, path] = await Promise.all([
      prisma.folder.findMany({
        where: { ownerId: folder.ownerId, parentId: folder.id, deletedAt: null },
        include: includeShareSummary,
        orderBy: [{ name: 'asc' }],
      }),
      prisma.file.findMany({
        where: { ownerId: folder.ownerId, folderId: folder.id, deletedAt: null },
        include: includeShareSummary,
        orderBy: [{ updatedAt: 'desc' }],
      }),
      getFolderPath(folder.ownerId, folder.id),
    ]);

    res.json({ success: true, data: { folder, subfolders, files, path } });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// PATCH /api/folders/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const folderId = getRouteParam(req.params.id);
    const trimmedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!trimmedName) {
      res.status(400).json({
        success: false,
        error: { message: 'Folder name is required' },
      });
      return;
    }

    const existing = await prisma.folder.findFirst({
      where: { id: folderId, ownerId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { message: 'Folder not found' },
      });
      return;
    }

    const folder = await prisma.folder.update({
      where: { id: existing.id },
      data: { name: trimmedName },
    });

    res.json({ success: true, data: { folder } });
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// DELETE /api/folders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const folderId = getRouteParam(req.params.id);
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, ownerId, deletedAt: null },
    });

    if (!folder) {
      res.status(404).json({
        success: false,
        error: { message: 'Folder not found' },
      });
      return;
    }

    const folderIds = await getFolderDescendantIds(ownerId, folder.id);
    const deletedAt = new Date();

    await prisma.$transaction([
      prisma.file.updateMany({
        where: { ownerId, folderId: { in: folderIds }, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.folder.updateMany({
        where: { ownerId, id: { in: folderIds }, deletedAt: null },
        data: { deletedAt },
      }),
    ]);

    await logAction(ownerId, 'DELETE', 'FOLDER', folder.id, {
      folderName: folder.name,
      deletedFolderIds: folderIds,
    });
    res.json({ success: true, data: { deletedFolderIds: folderIds } });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

export default router;
