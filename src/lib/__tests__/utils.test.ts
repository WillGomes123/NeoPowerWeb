import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('Utils', () => {
  describe('cn (className merger)', () => {
    it('should merge multiple class names', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
    });

    it('should ignore false/null/undefined values', () => {
      const result = cn('text-red-500', false, null, undefined, 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('false');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should merge conflicting tailwind classes correctly', () => {
      const result = cn('text-red-500', 'text-blue-500');
      // tailwind-merge should keep only the last conflicting class
      expect(result).toBe('text-blue-500');
    });
  });
});
