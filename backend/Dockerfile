FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM base AS build
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

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
