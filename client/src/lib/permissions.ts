import type { User } from "@shared/schema";

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  
  switch (permission) {
    case 'strategic-planning-long-term':
      return user.role === 'admin' || user.role === 'manager';
    case 'admin':
      return user.role === 'admin';
    case 'manager':
      return user.role === 'admin' || user.role === 'manager';
    case 'user':
      return user.role === 'admin' || user.role === 'manager' || user.role === 'user';
    case 'viewer':
      return user.role === 'admin' || user.role === 'manager' || user.role === 'user' || user.role === 'viewer';
    default:
      return false;
  }
}

export function getUserRole(user: User | null): string | null {
  return user?.role || null;
}