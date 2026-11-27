export type Role = 'candidate' | 'company' | 'admin' | 'super_admin';

export interface CompanyMembership {
  companyId: number;
  companyName: string;
  memberRole: 'owner' | 'recruiter';
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  companies: CompanyMembership[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
