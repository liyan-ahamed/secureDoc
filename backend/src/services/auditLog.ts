import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export const logAction = async (
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        metadata,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};
