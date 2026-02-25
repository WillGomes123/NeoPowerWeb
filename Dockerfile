# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de configuração de pacotes
COPY package.json package-lock.json* ./

# Usa npm install para ignorar possíveis problemas estritos do 'npm ci'
RUN npm install

# Copia todo o código fonte
COPY . .

# Injeta a variável de ambiente para que o Vite incorpore na build (Railway)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Realiza o build do projeto (pasta build/)
RUN npm run build


# Estágio 2: Serve
FROM node:20-alpine

WORKDIR /app

# Instala o servidor estático globalmente
RUN npm install -g serve

# Copia os artefatos gerados no estágio de build
COPY --from=builder /app/build ./build

# Expõe e inicia o servidor usando a variável de ambiente $PORT do Railway
CMD serve -s build -l tcp://0.0.0.0:${PORT:-3000}
