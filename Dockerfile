# ---------- base ----------
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate

# ---------- dev ----------
FROM base AS dev
COPY . .
EXPOSE 3030
EXPOSE 9229
CMD ["npm", "run", "start:dev"]

# ---------- build ----------
FROM base AS build
COPY . .
RUN npm run build

# ---------- prod ----------
FROM node:22-slim AS prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist/
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma/
COPY --from=base /app/node_modules/@prisma ./node_modules/@prisma/
EXPOSE 3030
CMD ["node", "dist/main"]
