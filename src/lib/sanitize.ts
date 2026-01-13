import DOMPurify from 'dompurify';

/**
 * Sanitiza strings para prevenir XSS
 * Remove tags HTML e scripts maliciosos
 */
export const sanitizeString = (input: string): string => {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Sanitiza objeto removendo campos perigosos e sanitizando strings
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value) as T[Extract<keyof T, string>];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>) as T[Extract<
        keyof T,
        string
      >];
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      ) as T[Extract<keyof T, string>];
    }
  }

  return sanitized;
};

/**
 * Valida email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida senha forte
 */
export const isStrongPassword = (password: string): boolean => {
  // Mínimo 8 caracteres, pelo menos uma letra e um número
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

/**
 * Valida CEP brasileiro
 */
export const isValidCEP = (cep: string): boolean => {
  const cepRegex = /^\d{5}-?\d{3}$/;
  return cepRegex.test(cep);
};

/**
 * Valida CNPJ
 */
export const isValidCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  return cleanCNPJ.length === 14;
};

/**
 * Sanitiza número de telefone
 */
export const sanitizePhone = (phone: string): string => {
  return phone.replace(/[^\d+()-\s]/g, '');
};

/**
 * Sanitiza URL
 */
export const sanitizeURL = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Apenas permite http e https
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
};
