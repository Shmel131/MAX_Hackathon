FROM node:20-alpine AS base
WORKDIR /app
# better-sqlite3 builds a small native addon at install time if no prebuilt
# binary matches this platform — these are the standard toolchain packages
# for that, kept in the build stage only so the runtime image stays slim.
RUN apk add --no-cache python3 make g++

# ---- deps & build ----
FROM base AS build
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 4000
VOLUME ["/app/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
