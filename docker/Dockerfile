FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

WORKDIR /source
RUN corepack enable pnpm
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @one-router/web build \
    && pnpm --filter onerouter build \
    && pnpm --filter onerouter deploy --prod --legacy /runtime

FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

ENV NODE_ENV=production \
    ONE_ROUTER_HOST=0.0.0.0 \
    ONE_ROUTER_DATA_DIR=/data \
    ONE_ROUTER_CONFIG=/data/config.json \
    PORT=3000
WORKDIR /opt/one-router
COPY --from=build /runtime/ ./
COPY docker/entrypoint.sh /usr/local/bin/one-router-entrypoint
RUN mkdir -p /data \
    && chown 1000:1000 /data \
    && ln -s /opt/one-router/dist/index.js /usr/local/bin/one-router \
    && ln -s /opt/one-router/dist/index.js /usr/local/bin/onerouter \
    && chmod 755 /usr/local/bin/one-router-entrypoint

USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => { if (!r.ok) process.exitCode = 1 }).catch(() => { process.exitCode = 1 })"]
ENTRYPOINT ["/usr/local/bin/one-router-entrypoint"]
CMD ["one-router", "serve", "--port", "3000", "--no-open"]
