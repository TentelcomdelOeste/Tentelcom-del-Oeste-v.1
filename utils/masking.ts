/**
 * Utility functions for masking sensitive data in logs.
 */

const MASK = '***';

export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return MASK;
  const [name, domain] = email.split('@');
  return `${name.substring(0, 2)}***@${domain}`;
};

export const maskPhone = (phone: string): string => {
  if (!phone) return MASK;
  return `******${phone.substring(Math.max(0, phone.length - 4))}`;
};

export const maskToken = (token: string): string => {
  if (!token) return MASK;
  if (token.length < 6) return MASK;
  return `${token.substring(0, 3)}***${token.substring(token.length - 3)}`;
};

export const maskApiKey = (key: string): string => {
  if (!key) return MASK;
  return `${key.substring(0, 3)}***${key.substring(Math.max(3, key.length - 3))}`;
};

const SENSITIVE_KEYS = [
  'email',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'phone',
  'telefono',
  'authKey'
];

export const maskObject = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
      return data;
  }

  if (Array.isArray(data)) {
      return data.map(item => maskObject(item));
  }

  const masked: any = { ...data };

  for (const key in masked) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
          masked[key] = MASK;
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
          masked[key] = maskObject(masked[key]);
      }
  }

  return masked;
};
