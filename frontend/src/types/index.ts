export interface User {
  id: string;
  email: string;
  name: string;
  accountType: 'INDIVIDUAL' | 'ORGANIZATION';
  createdAt: string;
  orgMemberships?: OrgMembership[];
}

export interface OrgMembership {
  id: string;
  userId: string;
  orgId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  org: {
    id: string;
    name: string;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  accountType: 'INDIVIDUAL' | 'ORGANIZATION';
  orgName?: string;
}

export interface SecureFolder {
  id: string;
  name: string;
  ownerId: string;
  orgId?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  shares?: Share[];
}

export interface SecureFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  ownerId: string;
  orgId?: string | null;
  folderId?: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  driveType?: 'PERSONAL' | 'ORG';
  rejectionReason?: string | null;
  shares?: Share[];
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  size: number;
  createdAt: string;
  isCurrent?: boolean;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export type SharePermission = 'VIEW' | 'EDIT';

export interface ShareUser {
  id: string;
  name: string;
  email: string;
}

export interface Share {
  id: string;
  fileId?: string | null;
  folderId?: string | null;
  ownerId: string;
  sharedWithId?: string | null;
  permission: SharePermission;
  shareToken?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  owner?: ShareUser;
  sharedWith?: ShareUser | null;
  file?: SecureFile | null;
  folder?: SecureFolder | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: ShareUser;
}

export interface TrashItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  deletedAt: string;
  mimeType?: string;
  folderId?: string | null;
  parentId?: string | null;
}
