import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  isValidEmail,
  isStrongPassword,
  isValidCEP,
  isValidCNPJ,
  sanitizePhone,
  sanitizeURL,
} from '../sanitize';

describe('sanitize', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const result = sanitizeString(input);
      expect(result).toBe('Hello');
    });

    it('should remove dangerous attributes', () => {
      const input = '<img src=x onerror="alert(1)">';
      const result = sanitizeString(input);
      expect(result).not.toContain('onerror');
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });

    it('should preserve safe text', () => {
      const input = 'Hello World 123';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World 123');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string properties', () => {
      const input = {
        name: '<script>alert()</script>John',
        email: 'test@example.com',
        age: 25,
      };

      const result = sanitizeObject(input);
      expect(result.name).toBe('John');
      expect(result.email).toBe('test@example.com');
      expect(result.age).toBe(25);
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          profile: {
            bio: '<script>alert()</script>Hello',
          },
        },
      };

      const result = sanitizeObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('Hello');
    });

    it('should sanitize arrays', () => {
      const input = {
        items: ['<script>a</script>', '<b>b</b>', 'c'],
      };

      const result = sanitizeObject(input);
      expect(result.items).toEqual(['', 'b', 'c']);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate strong passwords', () => {
      expect(isStrongPassword('Password123')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isStrongPassword('short')).toBe(false); // Muito curta
      expect(isStrongPassword('12345678')).toBe(false); // Apenas números
      expect(isStrongPassword('abcdefgh')).toBe(false); // Apenas letras
      expect(isStrongPassword('Pass123')).toBe(false); // Menos de 8 caracteres
    });
  });

  describe('isValidCEP', () => {
    it('should validate correct CEPs', () => {
      expect(isValidCEP('12345-678')).toBe(true);
      expect(isValidCEP('12345678')).toBe(true);
    });

    it('should reject invalid CEPs', () => {
      expect(isValidCEP('1234-5678')).toBe(false);
      expect(isValidCEP('12345')).toBe(false);
      expect(isValidCEP('abcde-fgh')).toBe(false);
    });
  });

  describe('isValidCNPJ', () => {
    it('should validate CNPJ with correct length', () => {
      expect(isValidCNPJ('12345678901234')).toBe(true);
    });

    it('should reject invalid CNPJs', () => {
      expect(isValidCNPJ('123456789')).toBe(false); // Muito curto
      expect(isValidCNPJ('123456789012345')).toBe(false); // Muito longo
      expect(isValidCNPJ('abcd1234567890')).toBe(false); // Letras
    });
  });

  describe('sanitizePhone', () => {
    it('should preserve valid phone characters', () => {
      expect(sanitizePhone('+55 (11) 98765-4321')).toBe('+55 (11) 98765-4321');
      expect(sanitizePhone('11987654321')).toBe('11987654321');
    });

    it('should remove invalid characters', () => {
      expect(sanitizePhone('+55 (11) 98765-4321 abc')).toBe('+55 (11) 98765-4321 ');
      expect(sanitizePhone('11#9876$5-4321')).toBe('11987654321');
    });
  });

  describe('sanitizeURL', () => {
    it('should allow valid HTTP/HTTPS URLs', () => {
      expect(sanitizeURL('https://example.com')).toBe('https://example.com/');
      expect(sanitizeURL('http://example.com/path')).toBe('http://example.com/path');
    });

    it('should reject invalid protocols', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
      expect(sanitizeURL('file:///etc/passwd')).toBe('');
      expect(sanitizeURL('ftp://example.com')).toBe('');
    });

    it('should reject malformed URLs', () => {
      expect(sanitizeURL('not a url')).toBe('');
      expect(sanitizeURL('htp://example.com')).toBe('');
    });
  });
});
