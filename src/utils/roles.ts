export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'SIYANAT_HEAD' 
  | 'AVIT_HEAD' 
  | 'TANZEEM_HEAD' 
  | 'DEPT_HEAD' 
  | 'REQUESTER' 
  | 'EXECUTOR' 
  | 'RECEPTIONIST';

export const ELEVATED_REQUESTER_ROLES: UserRole[] = [
  'DEPT_HEAD', 
  'SUPER_ADMIN', 
  'ADMIN', 
  'SIYANAT_HEAD', 
  'AVIT_HEAD', 
  'TANZEEM_HEAD'
];

export const canBookFleet = (role: string): boolean => {
  return ELEVATED_REQUESTER_ROLES.includes(role as UserRole);
};

export const canBookAfterClassEvents = (role: string): boolean => {
  return ELEVATED_REQUESTER_ROLES.includes(role as UserRole);
};

export const isDepartmentHead = (role: string): boolean => {
  return role === 'DEPT_HEAD';
};