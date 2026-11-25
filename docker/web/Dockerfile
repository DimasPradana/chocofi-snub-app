# SvelteKit web UI, built and served with Bun. Fully offline at runtime.
FROM oven/bun:1-debian AS build
WORKDIR /app
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

FROM oven/bun:1-debian
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/* \
 && git config --system --add safe.directory '*'
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    HOME=/tmp
USER bun
EXPOSE 3000
CMD ["bun", "build/index.js"]
