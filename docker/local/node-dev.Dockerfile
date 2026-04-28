FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/backoffice/package.json apps/backoffice/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY packages/api-logic/package.json packages/api-logic/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

CMD ["bash"]
