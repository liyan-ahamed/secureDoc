FROM node:22-alpine AS builder

WORKDIR /app

# Copy Prisma schema (needed by postinstall prisma generate)
COPY prisma ./prisma

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy Prisma schema (needed by postinstall prisma generate)
COPY prisma ./prisma

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy built code from builder
COPY --from=builder /app/dist ./dist

EXPOSE 5000

# Start script: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
