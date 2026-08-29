import { FileStatus } from '@prisma/client';
import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createContentSnippet = (text: string, query: string): string | null => {
  const matchIndex = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (matchIndex === -1) return null;

  const contextLength = 65;
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + query.length + contextLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
};

// GET /api/search?q=...&type=file|folder|all&orgId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const type = (req.query.type as string) || 'all';
    const orgId = req.query.orgId as string | undefined;
    const userId = req.user!.userId;
    const activeOrgId = orgId || req.user!.orgId;
    const membership = activeOrgId
      ? await prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId: activeOrgId } } })
      : null;

    if (!q || q.trim().length === 0) {
      res.json({ success: true, data: { results: [] }});
      return;
    }

    const searchQuery = q.trim();
    const cacheKey = `search:${userId}:${searchQuery}`;

    // Try to get from cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('[Redis] Served Search from cache');
      res.json({
        success: true,
        data: { results: JSON.parse(cachedData) },
      });
      return;
    }

    // Build the access filter: owned by user OR shared with user
    const accessFilter = {
      OR: [
        { ownerId: userId },
        { shares: { some: { sharedWithId: userId, revokedAt: null } } }
      ],
      ...(orgId ? { orgId } : {}), // Optionally filter by orgId if provided
    };
    const fileAccessFilter = membership && activeOrgId
      ? {
          orgId: activeOrgId,
          OR: [{ status: FileStatus.APPROVED }, { ownerId: userId }],
        }
      : accessFilter;

    let files: any[] = [];
    let folders: any[] = [];

    if (type === 'all' || type === 'file') {
      files = await prisma.file.findMany({
        where: {
          deletedAt: null,
          AND: [
            fileAccessFilter,
            {
              OR: [
                { originalName: { contains: searchQuery, mode: 'insensitive' } },
                { extractedText: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          ],
        },
        include: {
          folder: { select: { id: true, name: true, parentId: true } },
          owner: { select: { id: true, name: true, email: true } }
        },
        take: 20,
      });
    }

    if (type === 'all' || type === 'folder') {
      folders = await prisma.folder.findMany({
        where: {
          name: { contains: searchQuery, mode: 'insensitive' },
          deletedAt: null,
          ...accessFilter,
        },
        include: {
          parent: { select: { id: true, name: true, parentId: true } },
          owner: { select: { id: true, name: true, email: true } }
        },
        take: 20,
      });
    }

    // Format results to include path and type indicator
    const formattedFiles = files.map(file => {
      const snippet = file.extractedText ? createContentSnippet(file.extractedText, searchQuery) : null;

      return {
        ...file,
        type: 'file',
        location: file.folder ? file.folder.name : 'My Drive',
        matchType: snippet ? 'content' : 'filename',
        ...(snippet ? { snippet } : {}),
      };
    });

    const formattedFolders = folders.map(folder => ({
      ...folder,
      type: 'folder',
      location: folder.parent ? folder.parent.name : 'My Drive'
    }));

    const results = [...formattedFolders, ...formattedFiles];

    // Save to cache with 60s TTL
    await redis.setex(cacheKey, 60, JSON.stringify(results));
    console.log('[Redis] Served Search from DB');

    res.json({
      success: true,
      data: { results }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: { message: 'Unexpected error during search' }});
  }
});

export default router;
