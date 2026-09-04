FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV PLOTPROOF_DB_PATH=/data/plotproof.sqlite

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "src/server.js"]
