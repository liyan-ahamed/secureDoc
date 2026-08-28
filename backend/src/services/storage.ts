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
