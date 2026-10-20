# ---------- Build stage ----------
FROM node:20-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-slim
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist ./dist
# Receipt uploads are written here (note: on free hosting this disk is
# wiped on every redeploy/restart — fine for testing).
RUN mkdir -p uploads

# Hosting platforms set PORT; main.ts falls back to 3000.
EXPOSE 3000
CMD ["node", "dist/main.js"]
