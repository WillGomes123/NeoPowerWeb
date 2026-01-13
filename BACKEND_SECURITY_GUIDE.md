# 🔐 GUIA DE SEGURANÇA BACKEND - NEORPAC

**Data:** 03/12/2025
**Versão:** 1.0.0
**Prioridade:** CRÍTICA

---

## ⚠️ ATENÇÃO CRÍTICA

O frontend NeoRPAC implementa validações e controles de segurança, mas **NUNCA** confie apenas no frontend. Este guia documenta as implementações de segurança **obrigatórias** no backend.

---

## 1. VALIDAÇÃO DE PERMISSÕES (CRÍTICO)

### 🔴 Problema Identificado

Atualmente, a validação de roles (admin, atem, comum) está **apenas no frontend**:

```typescript
// src/App.tsx - FRONTEND APENAS!
if (requireAdmin && user.role !== 'admin') {
  return <Navigate to="/" replace />;
}
```

**Risco:** Um usuário malicioso pode manipular o localStorage e acessar rotas administrativas.

### ✅ Solução Obrigatória no Backend

#### 1.1 Middleware de Autenticação

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
```

#### 1.2 Middleware de Autorização por Role

```javascript
// middleware/authorize.js
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: `Seu role '${userRole}' não tem permissão para acessar este recurso`
      });
    }

    next();
  };
};

module.exports = { authorize };
```

#### 1.3 Aplicação nas Rotas

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Rota ADMIN-ONLY
router.get('/users',
  authenticateToken,
  authorize('admin'),
  async (req, res) => {
    // Apenas admins podem listar usuários
    const users = await User.find();
    res.json(users);
  }
);

// Rota ADMIN e ATEM
router.get('/locations',
  authenticateToken,
  authorize('admin', 'atem'),
  async (req, res) => {
    // Admins e ATEMs podem ver locais
    const locations = await Location.find();
    res.json(locations);
  }
);

// Rota TODOS OS AUTENTICADOS
router.get('/chargers',
  authenticateToken,
  authorize('admin', 'atem', 'comum'),
  async (req, res) => {
    // Todos os usuários autenticados podem ver carregadores
    const chargers = await Charger.find();
    res.json(chargers);
  }
);

module.exports = router;
```

---

## 2. VALIDAÇÃO DE INPUTS (CRÍTICO)

### 2.1 Instalação de Bibliotecas

```bash
npm install express-validator
npm install helmet
npm install express-rate-limit
```

### 2.2 Validação com express-validator

```javascript
// validators/user.validator.js
const { body, validationResult } = require('express-validator');

const userValidationRules = () => {
  return [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Senha deve ter no mínimo 8 caracteres')
      .matches(/[a-zA-Z]/)
      .withMessage('Senha deve conter letras')
      .matches(/[0-9]/)
      .withMessage('Senha deve conter números'),

    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres')
      .escape(), // Remove tags HTML
  ];
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      message: 'Dados inválidos'
    });
  }
  next();
};

module.exports = { userValidationRules, validate };
```

### 2.3 Aplicação nas Rotas

```javascript
// routes/users.js
const { userValidationRules, validate } = require('../validators/user.validator');

router.post('/register',
  userValidationRules(),
  validate,
  async (req, res) => {
    // Dados já validados e sanitizados
    const { email, password, name } = req.body;
    // ... criar usuário
  }
);
```

---

## 3. RATE LIMITING (ALTO)

### 3.1 Proteção contra Brute Force

```javascript
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Rate limiter geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente em 15 minutos',
});

// Rate limiter para login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de login
  message: 'Muitas tentativas de login, tente novamente em 15 minutos',
  skipSuccessfulRequests: true, // Não conta tentativas bem-sucedidas
});

// Rate limiter para criação de recursos
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // Máximo 10 criações por hora
  message: 'Limite de criação atingido, tente novamente em 1 hora',
});

module.exports = { generalLimiter, loginLimiter, createLimiter };
```

### 3.2 Aplicação no App

```javascript
// app.js
const { generalLimiter, loginLimiter } = require('./middleware/rateLimiter');

// Aplicar rate limiter geral em todas as rotas
app.use('/api/', generalLimiter);

// Rate limiter específico para login
app.use('/api/users/login', loginLimiter);
```

---

## 4. PROTEÇÃO XSS E INJECTION (ALTO)

### 4.1 Helmet para Headers de Segurança

```javascript
// app.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
}));
```

### 4.2 Sanitização de Dados

```javascript
// utils/sanitize.js
const DOMPurify = require('isomorphic-dompurify');

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }
  return input;
};

const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = { sanitizeInput, sanitizeObject };
```

---

## 5. PROTEÇÃO CSRF (MÉDIO)

### 5.1 Implementação de Tokens CSRF

```javascript
// middleware/csrf.js
const csrf = require('csurf');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

module.exports = { csrfProtection };
```

### 5.2 Aplicação em Formulários

```javascript
// routes/forms.js
const { csrfProtection } = require('../middleware/csrf');

// Gerar token CSRF
router.get('/form-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Validar token em POST
router.post('/submit', csrfProtection, (req, res) => {
  // Token validado automaticamente
  res.json({ success: true });
});
```

---

## 6. HTTPS E COOKIES SEGUROS (CRÍTICO)

### 6.1 Configuração de Cookies

```javascript
// config/session.js
const session = require('express-session');

const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Não acessível via JavaScript
    secure: process.env.NODE_ENV === 'production', // Apenas HTTPS
    sameSite: 'strict', // Proteção contra CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
};

module.exports = { sessionConfig };
```

### 6.2 JWT com Refresh Tokens

```javascript
// utils/jwt.js
const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Token de acesso expira em 15 minutos
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // Refresh token expira em 7 dias
  );
};

module.exports = { generateAccessToken, generateRefreshToken };
```

---

## 7. LOGGING E MONITORAMENTO (ALTO)

### 7.1 Winston Logger

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Middleware para log de requisições
const logRequest = (req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.user?.id || 'anonymous'
  });
  next();
};

module.exports = { logger, logRequest };
```

---

## 8. CHECKLIST DE IMPLEMENTAÇÃO

### Crítico (Implementar Imediatamente)
- [ ] Middleware de autenticação (authenticateToken)
- [ ] Middleware de autorização por role (authorize)
- [ ] Aplicar authorize em TODAS as rotas protegidas
- [ ] Validação de inputs com express-validator
- [ ] Helmet para headers de segurança
- [ ] HTTPS em produção

### Alto (Implementar esta Semana)
- [ ] Rate limiting para login (loginLimiter)
- [ ] Rate limiting geral (generalLimiter)
- [ ] Sanitização de inputs com DOMPurify
- [ ] Logging com Winston
- [ ] Refresh tokens JWT

### Médio (Implementar neste Mês)
- [ ] Proteção CSRF
- [ ] Monitoramento de segurança
- [ ] Backup automático de banco
- [ ] Testes de segurança automatizados

---

## 9. VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS

```bash
# .env (NUNCA COMMITAR!)
JWT_SECRET=<chave-segura-64-caracteres>
REFRESH_TOKEN_SECRET=<chave-diferente-64-caracteres>
SESSION_SECRET=<chave-segura-session>
NODE_ENV=production
DATABASE_URL=<url-banco>
ALLOWED_ORIGINS=https://seu-dominio.com
```

**Gerar secrets seguros:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 10. TESTES DE SEGURANÇA

### 10.1 Teste de Autorização

```javascript
// tests/security/auth.test.js
describe('Authorization Tests', () => {
  it('should deny access to admin routes for non-admin users', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${userToken}`) // Token de user comum
      .expect(403);

    expect(response.body.error).toBe('Acesso negado');
  });

  it('should allow admin access to admin routes', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

---

## ✅ CONCLUSÃO

Este guia documenta as implementações de segurança **OBRIGATÓRIAS** no backend. O frontend NeoRPAC já implementa as melhores práticas de segurança, mas **nunca** confie apenas no frontend.

**Prioridades:**
1. ✅ Implementar autenticação e autorização (CRÍTICO)
2. ✅ Validar todos os inputs (CRÍTICO)
3. ✅ Rate limiting (ALTO)
4. ✅ HTTPS e cookies seguros (CRÍTICO)
5. ✅ Logging e monitoramento (ALTO)

---

**Desenvolvido por:** Claude Code (Sonnet 4.5)
**Data:** 03/12/2025
**Próxima Revisão:** 03/03/2026
