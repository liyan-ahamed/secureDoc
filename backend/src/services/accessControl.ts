import { SharePermission } from '@prisma/client';
import prisma from '../config/database';

type AccessResult = {
  allowed: boolean;
  permission?: SharePermission | 'OWNER';
  isOwner?: boolean;
};

export const nowShareFilter = () => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

const notExpiredShareOr = () => [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];

const permissionRank = (permission?: SharePermission | 'OWNER') => {
  if (permission === 'OWNER') {
    return 3;
  }
  if (permission === 'EDIT') {
    return 2;
  }
  if (permission === 'VIEW') {
    return 1;
  }
  return 0;
};

export const hasPermission = (
  actual: SharePermission | 'OWNER' | undefined,
  required: SharePermission
) => permissionRank(actual) >= permissionRank(required);

const getFolderAncestorIds = async (folderId: string | null) => {
  const ids: string[] = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await prisma.folder.findFirst({
      where: { id: currentId, deletedAt: null },
      select: { id: true, parentId: true },
    });

    if (!folder) {
      break;
    }

    ids.push(folder.id);
    currentId = folder.parentId;
  }

  return ids;
};

const bestPermission = (permissions: SharePermission[]) => {
  return permissions.includes('EDIT') ? 'EDIT' : permissions[0];
};

export const canAccessFile = async (
  userId: string,
  fileId: string,
  required: SharePermission = 'VIEW'
): Promise<AccessResult> => {
  const file = await prisma.file.findFirst({
    where: { id: fileId, deletedAt: null },
    select: { id: true, ownerId: true, folderId: true },
  });

  if (!file) {
    return { allowed: false };
  }

  if (file.ownerId === userId) {
    return { allowed: true, permission: 'OWNER', isOwner: true };
  }

  const folderIds = await getFolderAncestorIds(file.folderId);
  const shares = await prisma.share.findMany({
    where: {
      revokedAt: null,
      sharedWithId: userId,
      AND: [
        { OR: notExpiredShareOr() },
        {
          OR: [
            { fileId: file.id },
            ...(folderIds.length > 0 ? [{ folderId: { in: folderIds } }] : []),
          ],
        },
      ],
    },
    select: { permission: true },
  });

  const permission = bestPermission(shares.map((share) => share.permission));
  return {
    allowed: hasPermission(permission, required),
    permission,
    isOwner: false,
  };
};

export const canAccessFolder = async (
  userId: string,
  folderId: string,
  required: SharePermission = 'VIEW'
): Promise<AccessResult> => {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, deletedAt: null },
    select: { id: true, ownerId: true, parentId: true },
  });

  if (!folder) {
    return { allowed: false };
  }

  if (folder.ownerId === userId) {
    return { allowed: true, permission: 'OWNER', isOwner: true };
  }

  const folderIds = await getFolderAncestorIds(folder.id);
  const shares = await prisma.share.findMany({
    where: {
      revokedAt: null,
      sharedWithId: userId,
      AND: [
        { OR: notExpiredShareOr() },
        { folderId: { in: folderIds } },
      ],
    },
    select: { permission: true },
  });

  const permission = bestPermission(shares.map((share) => share.permission));
  return {
    allowed: hasPermission(permission, required),
    permission,
    isOwner: false,
  };
};

export const getFolderDescendantIds = async (folderId: string) => {
  const ids = [folderId];
  const queue = [folderId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.folder.findMany({
      where: { parentId, deletedAt: null },
      select: { id: true },
    });

    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }

  return ids;
};

export const includeShareSummary = {
  shares: {
    where: { revokedAt: null },
    select: {
      id: true,
      permission: true,
      shareToken: true,
      sharedWith: { select: { id: true, name: true, email: true } },
    },
  },
};
