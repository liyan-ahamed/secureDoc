import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = (): Buffer => {
  const rawKey = config.encryptionKey;

  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY is required for file encryption');
  }

  const hexKey = Buffer.from(rawKey, 'hex');
  if (hexKey.length === 32) {
    return hexKey;
  }

  const base64Key = Buffer.from(rawKey, 'base64');
  if (base64Key.length === 32) {
    return base64Key;
  }

  if (Buffer.byteLength(rawKey, 'utf8') === 32) {
    return Buffer.from(rawKey, 'utf8');
  }

  throw new Error('ENCRYPTION_KEY must be 32 bytes as hex, base64, or utf8');
};

export const encryptFile = (buffer: Buffer) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
};

export const decryptFile = (
  encryptedBuffer: Buffer,
  ivHex: string,
  authTagHex: string
) => {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};
