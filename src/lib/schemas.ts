import { z } from 'zod';

/**
 * Schema para Login
 */
export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Schema para Registro
 */
export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[a-zA-Z]/, 'Senha deve conter pelo menos uma letra')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Schema para Vouchers
 */
export const voucherSchema = z.object({
  code: z.string().min(3, 'Código deve ter no mínimo 3 caracteres'),
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  type: z.enum(['percentage', 'fixed_brl', 'kwh'], {
    errorMap: () => ({ message: 'Tipo inválido' }),
  }),
  value: z.number().positive('Valor deve ser positivo'),
  is_active: z.boolean(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  total_quantity: z.number().nullable().optional(),
});

export type VoucherFormData = z.infer<typeof voucherSchema>;

/**
 * Schema para Usuários
 */
export const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[a-zA-Z]/, 'Senha deve conter pelo menos uma letra')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .optional(),
  role: z.enum(['admin', 'atem', 'comum']),
});

export type UserFormData = z.infer<typeof userSchema>;

/**
 * Schema para Locais
 */
export const locationSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  address: z.string().min(5, 'Endereço deve ter no mínimo 5 caracteres'),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  city: z.string().min(2, 'Cidade inválida'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  country: z.string().default('Brasil'),
  latitude: z.number().min(-90).max(90, 'Latitude inválida').optional(),
  longitude: z.number().min(-180).max(180, 'Longitude inválida').optional(),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ inválido (somente números)')
    .optional()
    .or(z.literal('')),
  phone: z.string().optional(),
  cor_fundo: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (use formato #RRGGBB)'),
  price_per_kwh: z.number().positive('Preço deve ser positivo').optional(),
});

export type LocationFormData = z.infer<typeof locationSchema>;

/**
 * Schema para Comandos OCPP
 */
export const ocppCommandSchema = z.discriminatedUnion('commandType', [
  z.object({
    commandType: z.literal('start'),
    idTag: z.string().min(1, 'ID Tag é obrigatório'),
  }),
  z.object({
    commandType: z.literal('stop'),
    transactionId: z.number().positive('ID da transação inválido'),
  }),
  z.object({
    commandType: z.literal('reset'),
    type: z.enum(['Hard', 'Soft']),
  }),
  z.object({
    commandType: z.literal('availability'),
    connectorId: z.number().int().positive('ID do conector inválido'),
    type: z.enum(['Operative', 'Inoperative']),
  }),
  z.object({
    commandType: z.literal('unlock'),
    connectorId: z.number().int().positive('ID do conector inválido'),
  }),
  z.object({
    commandType: z.literal('triggerMessage'),
    requestedMessage: z.enum(['StatusNotification', 'Heartbeat', 'MeterValues']),
  }),
]);

export type OCPPCommandFormData = z.infer<typeof ocppCommandSchema>;

/**
 * Schema para validação de CEP
 */
export const cepSchema = z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido');

/**
 * Schema para validação de CNPJ
 */
export const cnpjSchema = z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido');

/**
 * Schema para validação de telefone brasileiro
 */
export const phoneSchema = z
  .string()
  .regex(/^(\+55\s?)?(\(?\d{2}\)?\s?)?9?\d{4}-?\d{4}$/, 'Telefone inválido');
