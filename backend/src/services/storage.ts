import fs from 'fs/promises';
import path from 'path';

export const uploadsDir = path.resolve(process.cwd(), 'uploads');

export const ensureUploadsDir = async () => {
  await fs.mkdir(uploadsDir, { recursive: true });
};

export const getUploadPath = (fileName: string) => {
  return path.join(uploadsDir, fileName);
};

export const saveEncryptedFile = async (fileName: string, buffer: Buffer) => {
  await ensureUploadsDir();
  const storagePath = getUploadPath(fileName);
  await fs.writeFile(storagePath, buffer);
  return storagePath;
};

export const readStoredFile = (storagePath: string) => {
  return fs.readFile(storagePath);
};

/** Remove an encrypted blob while ensuring database paths cannot escape uploads/. */
export const removeStoredFile = async (storagePath: string) => {
  const resolvedPath = path.resolve(storagePath);
  const relativePath = path.relative(uploadsDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Refusing to delete a path outside the uploads directory');
  }

  try {
    await fs.unlink(resolvedPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};
