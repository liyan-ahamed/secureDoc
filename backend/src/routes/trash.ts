import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { logAction } from '../services/auditLog';
import { getDeletedFolderIds, permanentlyDeleteFiles, purgeDeletedFile, purgeDeletedFolder } from '../services/trash';

const router = Router();
router.use(authenticate);
const param = (value: unknown) => String(value);

// GET /api/trash
router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: { ownerId, deletedAt: { not: null } },
        select: { id: true, name: true, originalName: true, size: true, deletedAt: true, folderId: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.folder.findMany({
        where: { ownerId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true, parentId: true },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);
    res.json({ success: true, data: {
      items: [
        ...folders.map((folder) => ({ ...folder, type: 'folder' as const, size: 0 })),
        ...files.map((file) => ({ ...file, name: file.originalName || file.name, type: 'file' as const })),
      ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()),
    } });
  } catch (error) {
    console.error('List trash error:', error);
    res.status(500).json({ success: false, error: { message: 'Could not load trash' } });
  }
});

// POST /api/trash/:type/:id/restore
router.post('/:type/:id/restore', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const type = param(req.params.type);
    const id = param(req.params.id);
    if (type === 'file') {
      const file = await prisma.file.findFirst({ where: { id, ownerId, deletedAt: { not: null } } });
      if (!file) return void res.status(404).json({ success: false, error: { message: 'File not found in trash' } });
      await prisma.file.update({ where: { id }, data: { deletedAt: null } });
      await logAction(ownerId, 'RESTORE', 'FILE', id, { fileName: file.originalName });
      return void res.json({ success: true, data: { item: file } });
    }
    if (type === 'folder') {
      const folder = await prisma.folder.findFirst({ where: { id, ownerId, deletedAt: { not: null } } });
      if (!folder) return void res.status(404).json({ success: false, error: { message: 'Folder not found in trash' } });
      const folderIds = await getDeletedFolderIds(ownerId, id);
      await prisma.$transaction([
        prisma.folder.updateMany({ where: { id: { in: folderIds }, ownerId }, data: { deletedAt: null } }),
        prisma.file.updateMany({ where: { folderId: { in: folderIds }, ownerId }, data: { deletedAt: null } }),
      ]);
      await logAction(ownerId, 'RESTORE', 'FOLDER', id, { folderName: folder.name, restoredFolderIds: folderIds });
      return void res.json({ success: true, data: { item: folder } });
    }
    res.status(400).json({ success: false, error: { message: 'Type must be file or folder' } });
  } catch (error) {
    console.error('Restore trash item error:', error);
    res.status(500).json({ success: false, error: { message: 'Could not restore item' } });
  }
});

// DELETE /api/trash/empty
router.delete('/empty', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const [files, folders] = await Promise.all([
      prisma.file.findMany({ where: { ownerId, deletedAt: { not: null } }, include: { versions: { select: { storagePath: true } } } }),
      prisma.folder.findMany({ where: { ownerId, deletedAt: { not: null } }, select: { id: true, name: true } }),
    ]);
    await permanentlyDeleteFiles(files, folders.map((folder) => folder.id));
    await Promise.all([
      ...files.map((file) => logAction(ownerId, 'PERMANENT_DELETE', 'FILE', file.id, { fileName: file.originalName, emptiedTrash: true })),
      ...folders.map((folder) => logAction(ownerId, 'PERMANENT_DELETE', 'FOLDER', folder.id, { folderName: folder.name, emptiedTrash: true })),
    ]);
    res.json({ success: true, data: { deletedFiles: files.length, deletedFolders: folders.length } });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ success: false, error: { message: 'Could not empty trash' } });
  }
});

// DELETE /api/trash/:type/:id
router.delete('/:type/:id', async (req: Request, res: Response) => {
  try {
    const type = param(req.params.type);
    const id = param(req.params.id);
    const deleted = type === 'file'
      ? await purgeDeletedFile(req.user!.userId, id, 'PERMANENT_DELETE')
      : type === 'folder'
        ? await purgeDeletedFolder(req.user!.userId, id, 'PERMANENT_DELETE')
        : undefined;
    if (deleted === undefined) return void res.status(400).json({ success: false, error: { message: 'Type must be file or folder' } });
    if (!deleted) return void res.status(404).json({ success: false, error: { message: 'Item not found in trash' } });
    res.json({ success: true, data: { deletedItemId: id } });
  } catch (error) {
    console.error('Permanently delete trash item error:', error);
    res.status(500).json({ success: false, error: { message: 'Could not permanently delete item' } });
  }
});

export default router;
