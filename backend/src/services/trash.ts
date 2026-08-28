import prisma from '../config/database';
import { logAction } from './auditLog';
import { removeStoredFile } from './storage';

type DeletedFile = {
  id: string;
  originalName: string;
  storagePath: string;
  versions: { storagePath: string }[];
};

const deleteFilesFromStorage = async (files: DeletedFile[]) => {
  await Promise.all(files.flatMap((file) => [
    removeStoredFile(file.storagePath),
    ...file.versions.map((version) => removeStoredFile(version.storagePath)),
  ]));
};

export const getDeletedFolderIds = async (ownerId: string, folderId: string) => {
  const ids = [folderId];
  const queue = [folderId];

  while (queue.length) {
    const parentId = queue.shift()!;
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId },
      select: { id: true },
    });
    children.forEach((child) => { ids.push(child.id); queue.push(child.id); });
  }
  return ids;
};

export const permanentlyDeleteFiles = async (files: DeletedFile[], folderIds: string[] = []) => {
  await deleteFilesFromStorage(files);
  await prisma.$transaction([
    ...(files.length ? [prisma.file.deleteMany({ where: { id: { in: files.map((file) => file.id) } } })] : []),
    ...(folderIds.length ? [prisma.folder.deleteMany({ where: { id: { in: folderIds } } })] : []),
  ]);
};

export const purgeDeletedFile = async (userId: string, fileId: string, action: 'PERMANENT_DELETE' | 'AUTO_PURGE') => {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, deletedAt: { not: null } },
    include: { versions: { select: { storagePath: true } } },
  });
  if (!file) return null;
  await permanentlyDeleteFiles([file]);
  await logAction(userId, action, 'FILE', file.id, { fileName: file.originalName });
  return file;
};

export const purgeDeletedFolder = async (userId: string, folderId: string, action: 'PERMANENT_DELETE' | 'AUTO_PURGE') => {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, ownerId: userId, deletedAt: { not: null } } });
  if (!folder) return null;
  const folderIds = await getDeletedFolderIds(userId, folder.id);
  const files = await prisma.file.findMany({
    where: { ownerId: userId, folderId: { in: folderIds } },
    include: { versions: { select: { storagePath: true } } },
  });
  await permanentlyDeleteFiles(files, folderIds);
  await logAction(userId, action, 'FOLDER', folder.id, { folderName: folder.name, deletedFolderIds: folderIds });
  return folder;
};

export const autoPurgeTrash = async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const folders = await prisma.folder.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, ownerId: true, parentId: true },
  });
  const expiredFolderIds = new Set(folders.map((folder) => folder.id));

  // Purge only deleted-folder roots to avoid processing a descendant twice.
  for (const folder of folders.filter((folder) => !folder.parentId || !expiredFolderIds.has(folder.parentId))) {
    await purgeDeletedFolder(folder.ownerId, folder.id, 'AUTO_PURGE');
  }

  const files = await prisma.file.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, ownerId: true },
  });
  for (const file of files) await purgeDeletedFile(file.ownerId, file.id, 'AUTO_PURGE');
};
