import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { canAccessFile, canAccessFolder, includeShareSummary } from '../services/accessControl';
import { logAction } from '../services/auditLog';
import { decryptFile, encryptFile } from '../services/encryption';
import { readStoredFile, saveEncryptedFile } from '../services/storage';
import { extractSearchableText } from '../services/textExtraction';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.use(authenticate);

const getOptionalFolderId = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '' || value === 'root') {
    return null;
  }

  return String(value);
};

const getRouteParam = (value: unknown) => String(value);

const ensureFolderAccess = async (userId: string, folderId: string | null) => {
  if (!folderId) {
    return { allowed: true, ownerId: userId };
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, deletedAt: null },
    select: { id: true, ownerId: true },
  });

  if (!folder) {
    return { allowed: false };
  }

  if (folder.ownerId === userId) {
    return { allowed: true, ownerId: folder.ownerId };
  }

  const access = await canAccessFolder(userId, folder.id, 'EDIT');
  return { allowed: access.allowed, ownerId: folder.ownerId };
};

const sendDecryptedDownload = async (res: Response, file: {
  originalName: string;
  mimeType: string;
  storagePath: string;
  ivHex: string;
  authTagHex: string;
}) => {
  const encryptedBuffer = await readStoredFile(file.storagePath);
  const decryptedBuffer = decryptFile(encryptedBuffer, file.ivHex, file.authTagHex);
  const safeName = encodeURIComponent(file.originalName).replace(/['()]/g, escape);

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', decryptedBuffer.length);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.originalName.replace(/"/g, '')}"; filename*=UTF-8''${safeName}`
  );
  res.send(decryptedBuffer);
};

// POST /api/files/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const uploadedFile = req.file;
    const folderId = getOptionalFolderId(req.body.folderId) ?? null;
    const targetFileId = req.body.fileId ? String(req.body.fileId) : null;
    const orgId = req.body.orgId || req.user!.orgId || null;

    if (!uploadedFile) {
      res.status(400).json({
        success: false,
        error: { message: 'File is required' },
      });
      return;
    }

    const folderAccess = await ensureFolderAccess(ownerId, folderId);
    if (!folderAccess.allowed) {
      res.status(404).json({
        success: false,
        error: { message: 'Folder not found or edit access denied' },
      });
      return;
    }

    // Use the original, in-memory data for indexing. The on-disk copy remains encrypted.
    const extractedText = await extractSearchableText(uploadedFile.buffer, uploadedFile.mimetype);
    const { encryptedBuffer, ivHex, authTagHex } = encryptFile(uploadedFile.buffer);
    const storagePath = await saveEncryptedFile(crypto.randomUUID(), encryptedBuffer);
    const existingFile = targetFileId
      ? await prisma.file.findFirst({ where: { id: targetFileId, deletedAt: null } })
      : await prisma.file.findFirst({
          where: {
            ownerId: folderAccess.ownerId || ownerId,
            folderId,
            originalName: uploadedFile.originalname,
            deletedAt: null,
          },
        });

    if (existingFile) {
      const existingAccess = await canAccessFile(ownerId, existingFile.id, 'EDIT');
      if (!existingAccess.allowed) {
        res.status(403).json({
          success: false,
          error: { message: 'Edit access is required to upload a new version' },
        });
        return;
      }

      await prisma.$transaction([
        prisma.fileVersion.create({
          data: {
            fileId: existingFile.id,
            versionNumber: existingFile.currentVersion,
            storagePath: existingFile.storagePath,
            ivHex: existingFile.ivHex,
            authTagHex: existingFile.authTagHex,
            size: existingFile.size,
            uploadedById: ownerId,
          },
        }),
        prisma.file.update({
          where: { id: existingFile.id },
          data: {
            name: uploadedFile.originalname,
            originalName: uploadedFile.originalname,
            mimeType: uploadedFile.mimetype || 'application/octet-stream',
            size: uploadedFile.size,
            orgId,
            storagePath,
            ivHex,
            authTagHex,
            extractedText,
            currentVersion: { increment: 1 },
          },
        }),
      ]);

      const file = await prisma.file.findUnique({ where: { id: existingFile.id } });
      await logAction(ownerId, 'UPLOAD', 'FILE', existingFile.id, {
        fileName: uploadedFile.originalname,
        versionNumber: file?.currentVersion,
        isNewVersion: true,
      });
      res.json({
        success: true,
        data: { file, isNewVersion: true },
      });
      return;
    }

    const file = await prisma.file.create({
      data: {
        name: uploadedFile.originalname,
        originalName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype || 'application/octet-stream',
        size: uploadedFile.size,
        ownerId: folderAccess.ownerId || ownerId,
        orgId,
        folderId,
        storagePath,
        ivHex,
        authTagHex,
        extractedText,
      },
    });

    res.status(201).json({
      success: true,
      data: { file, isNewVersion: false },
    });
    await logAction(ownerId, 'UPLOAD', 'FILE', file.id, {
      fileName: file.originalName,
      size: file.size,
      isNewVersion: false,
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/files
router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const folderId = getOptionalFolderId(req.query.folderId);
    const orgId = req.query.orgId ? String(req.query.orgId) : undefined;

    const files = await prisma.file.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(folderId !== undefined && { folderId }),
        ...(orgId !== undefined && { orgId }),
      },
      include: includeShareSummary,
      orderBy: [{ updatedAt: 'desc' }],
    });

    res.json({ success: true, data: { files } });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/files/:id/download
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const fileId = getRouteParam(req.params.id);
    const access = await canAccessFile(req.user!.userId, fileId, 'VIEW');
    const file = access.allowed
      ? await prisma.file.findFirst({ where: { id: fileId, deletedAt: null } })
      : null;

    if (!file) {
      res.status(404).json({
        success: false,
        error: { message: 'File not found' },
      });
      return;
    }

    await sendDecryptedDownload(res, file);
    await logAction(req.user!.userId, 'DOWNLOAD', 'FILE', file.id, { fileName: file.originalName });
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Could not download file' },
    });
  }
});

// GET /api/files/:id/versions
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const fileId = getRouteParam(req.params.id);
    const access = await canAccessFile(req.user!.userId, fileId, 'VIEW');
    const file = access.allowed ? await prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
      select: {
        id: true,
        currentVersion: true,
        size: true,
        updatedAt: true,
        ownerId: true,
      },
    }) : null;

    if (!file) {
      res.status(404).json({
        success: false,
        error: { message: 'File not found' },
      });
      return;
    }

    const [versions, currentUploader] = await Promise.all([
      prisma.fileVersion.findMany({
        where: { fileId: file.id },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        orderBy: [{ versionNumber: 'desc' }],
      }),
      prisma.user.findUnique({
        where: { id: file.ownerId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        versions: [
          {
            id: 'current',
            fileId: file.id,
            versionNumber: file.currentVersion,
            size: file.size,
            createdAt: file.updatedAt,
            isCurrent: true,
            uploadedBy: currentUploader,
          },
          ...versions.map((version) => ({ ...version, isCurrent: false })),
        ],
      },
    });
  } catch (error) {
    console.error('List versions error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/files/:id/versions/:versionId/download
router.get('/:id/versions/:versionId/download', async (req: Request, res: Response) => {
  try {
    const fileId = getRouteParam(req.params.id);
    const versionId = getRouteParam(req.params.versionId);
    const access = await canAccessFile(req.user!.userId, fileId, 'VIEW');
    const file = access.allowed
      ? await prisma.file.findFirst({ where: { id: fileId, deletedAt: null } })
      : null;

    if (!file) {
      res.status(404).json({
        success: false,
        error: { message: 'File not found' },
      });
      return;
    }

    if (versionId === 'current') {
      await sendDecryptedDownload(res, file);
      await logAction(req.user!.userId, 'DOWNLOAD', 'FILE', file.id, {
        fileName: file.originalName,
        versionNumber: file.currentVersion,
      });
      return;
    }

    const version = await prisma.fileVersion.findFirst({
      where: { id: versionId, fileId: file.id },
    });

    if (!version) {
      res.status(404).json({
        success: false,
        error: { message: 'Version not found' },
      });
      return;
    }

    await sendDecryptedDownload(res, {
      originalName: file.originalName,
      mimeType: file.mimeType,
      storagePath: version.storagePath,
      ivHex: version.ivHex,
      authTagHex: version.authTagHex,
    });
    await logAction(req.user!.userId, 'DOWNLOAD', 'FILE', file.id, {
      fileName: file.originalName,
      versionNumber: version.versionNumber,
    });
  } catch (error) {
    console.error('Download version error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Could not download version' },
    });
  }
});

// POST /api/files/:id/versions/:versionId/restore
router.post('/:id/versions/:versionId/restore', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const fileId = getRouteParam(req.params.id);
    const versionId = getRouteParam(req.params.versionId);
    const access = await canAccessFile(ownerId, fileId, 'EDIT');
    const file = access.allowed
      ? await prisma.file.findFirst({ where: { id: fileId, deletedAt: null } })
      : null;

    if (!file) {
      res.status(404).json({
        success: false,
        error: { message: 'File not found' },
      });
      return;
    }

    if (versionId === 'current') {
      res.status(400).json({
        success: false,
        error: { message: 'The current version is already active' },
      });
      return;
    }

    const version = await prisma.fileVersion.findFirst({
      where: { id: versionId, fileId: file.id },
    });

    if (!version) {
      res.status(404).json({
        success: false,
        error: { message: 'Version not found' },
      });
      return;
    }

    await prisma.$transaction([
      prisma.fileVersion.create({
        data: {
          fileId: file.id,
          versionNumber: file.currentVersion,
          storagePath: file.storagePath,
          ivHex: file.ivHex,
          authTagHex: file.authTagHex,
          size: file.size,
          uploadedById: ownerId,
        },
      }),
      prisma.file.update({
        where: { id: file.id },
        data: {
          storagePath: version.storagePath,
          ivHex: version.ivHex,
          authTagHex: version.authTagHex,
          size: version.size,
          currentVersion: { increment: 1 },
        },
      }),
    ]);

    const restoredFile = await prisma.file.findUnique({ where: { id: file.id } });
    await logAction(ownerId, 'RESTORE', 'FILE', file.id, {
      fileName: file.originalName,
      restoredVersionNumber: version.versionNumber,
      newCurrentVersion: restoredFile?.currentVersion,
    });
    res.json({ success: true, data: { file: restoredFile } });
  } catch (error) {
    console.error('Restore version error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

// DELETE /api/files/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const fileId = getRouteParam(req.params.id);
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: req.user!.userId, deletedAt: null },
    });

    if (!file) {
      res.status(404).json({
        success: false,
        error: { message: 'File not found' },
      });
      return;
    }

    await prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    await logAction(req.user!.userId, 'DELETE', 'FILE', file.id, { fileName: file.originalName });
    res.json({ success: true, data: { deletedFileId: file.id } });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'An unexpected error occurred' },
    });
  }
});

export default router;
