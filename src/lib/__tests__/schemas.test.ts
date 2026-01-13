import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  voucherSchema,
  userSchema,
  locationSchema,
  cepSchema,
  cnpjSchema,
  phoneSchema,
} from '../schemas';

describe('schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'user@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('E-mail inválido');
      }
    });

    it('should reject short password', () => {
      const data = {
        email: 'user@example.com',
        password: '12345',
      };

      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'StrongPass123',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject password without letter', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '12345678',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.message.includes('letra'))).toBe(true);
      }
    });

    it('should reject password without number', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'abcdefgh',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.message.includes('número'))).toBe(true);
      }
    });
  });

  describe('voucherSchema', () => {
    it('should validate correct voucher data', () => {
      const data = {
        code: 'ABC123',
        name: 'Desconto 10%',
        type: 'percentage' as const,
        value: 10,
        is_active: true,
      };

      const result = voucherSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const data = {
        code: 'ABC123',
        name: 'Desconto',
        type: 'invalid_type',
        value: 10,
        is_active: true,
      };

      const result = voucherSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative value', () => {
      const data = {
        code: 'ABC123',
        name: 'Desconto',
        type: 'percentage' as const,
        value: -10,
        is_active: true,
      };

      const result = voucherSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('locationSchema', () => {
    it('should validate correct location data', () => {
      const data = {
        name: 'Posto Central',
        address: 'Rua Principal, 123',
        cep: '12345-678',
        city: 'São Paulo',
        state: 'SP',
        cor_fundo: '#FF5733',
      };

      const result = locationSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid CEP', () => {
      const data = {
        name: 'Posto',
        address: 'Rua Principal, 123',
        cep: '123', // CEP inválido
        city: 'São Paulo',
        state: 'SP',
        cor_fundo: '#FF5733',
      };

      const result = locationSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid state', () => {
      const data = {
        name: 'Posto',
        address: 'Rua Principal, 123',
        cep: '12345-678',
        city: 'São Paulo',
        state: 'SPP', // Deve ter 2 caracteres
        cor_fundo: '#FF5733',
      };

      const result = locationSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid color', () => {
      const data = {
        name: 'Posto',
        address: 'Rua Principal, 123',
        cep: '12345-678',
        city: 'São Paulo',
        state: 'SP',
        cor_fundo: 'invalid-color',
      };

      const result = locationSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('userSchema', () => {
    it('should validate correct user data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'StrongPass123',
        role: 'admin' as const,
      };

      const result = userSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept optional password', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'comum' as const,
      };

      const result = userSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'invalid_role',
      };

      const result = userSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('cepSchema', () => {
    it('should validate correct CEPs', () => {
      expect(cepSchema.safeParse('12345-678').success).toBe(true);
      expect(cepSchema.safeParse('12345678').success).toBe(true);
    });

    it('should reject invalid CEPs', () => {
      expect(cepSchema.safeParse('123').success).toBe(false);
      expect(cepSchema.safeParse('abcde-fgh').success).toBe(false);
    });
  });

  describe('phoneSchema', () => {
    it('should validate correct phone numbers', () => {
      expect(phoneSchema.safeParse('(11) 98765-4321').success).toBe(true);
      expect(phoneSchema.safeParse('11987654321').success).toBe(true);
      expect(phoneSchema.safeParse('+55 11 98765-4321').success).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(phoneSchema.safeParse('123').success).toBe(false);
      expect(phoneSchema.safeParse('abcd').success).toBe(false);
    });
  });
});
