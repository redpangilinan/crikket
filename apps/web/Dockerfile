FROM oven/bun:1.3.5-alpine

WORKDIR /app

ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}

COPY package.json bun.lock turbo.json tsconfig.json biome.jsonc ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile
RUN bun run --filter web build

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apps/web", "start", "--", "--port", "3001", "--hostname", "0.0.0.0"]
