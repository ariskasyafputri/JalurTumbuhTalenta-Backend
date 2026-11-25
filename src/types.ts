export type Role = 'candidate' | 'company' | 'admin' | 'super_admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  companyId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
