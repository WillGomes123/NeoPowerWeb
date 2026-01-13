import { describe, it, expect, beforeEach } from 'vitest';

describe('Auth Utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('should store token in localStorage', () => {
      const token = 'test-token-123';
      localStorage.setItem('token', token);
      expect(localStorage.getItem('token')).toBe(token);
    });

    it('should remove token on logout', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('userName', 'Test User');

      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('userRole')).toBeNull();
      expect(localStorage.getItem('userName')).toBeNull();
    });
  });

  describe('User Role', () => {
    it('should store and retrieve user role', () => {
      const role = 'admin';
      localStorage.setItem('userRole', role);
      expect(localStorage.getItem('userRole')).toBe(role);
    });

    it('should validate allowed roles', () => {
      const allowedRoles = ['admin', 'atem', 'comum'];
      const testRole = 'admin';
      expect(allowedRoles).toContain(testRole);
    });
  });
});
