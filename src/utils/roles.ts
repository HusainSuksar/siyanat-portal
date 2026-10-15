export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'SIYANAT_HEAD' 
  | 'AVIT_HEAD' 
  | 'TANZEEM_HEAD' 
  | 'DEPT_HEAD' 
  | 'SUPERVISOR'
  | 'REQUESTER' 
  | 'EXECUTOR' 
  | 'TECHNICIAN'
  | 'RECEPTIONIST'
  | 'STANDARD_USER';

export const ELEVATED_REQUESTER_ROLES: UserRole[] = [
  'DEPT_HEAD', 
  'SUPER_ADMIN', 
  'ADMIN', 
  'SIYANAT_HEAD', 
  'AVIT_HEAD', 
  'TANZEEM_HEAD'
];

export const canBookFleet = (role: string | null | undefined): boolean => {
  if (!role) return false;
  return ELEVATED_REQUESTER_ROLES.includes(role as UserRole);
};

export const canBookAfterClassEvents = (role: string | null | undefined): boolean => {
  if (!role) return false;
  return ELEVATED_REQUESTER_ROLES.includes(role as UserRole);
};

export const isDepartmentHead = (role: string | null | undefined): boolean => {
  return role === 'DEPT_HEAD';
};

export const isTechnicianRole = (role: string | null | undefined): boolean => {
  return role === 'EXECUTOR' || role === 'TECHNICIAN';
};

export const isSupervisorRole = (role: string | null | undefined): boolean => {
  return role === 'SUPERVISOR';
};