FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL
ARG VITE_CONTRACT_ADDRESS
ARG VITE_SEPOLIA_RPC_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS
ENV VITE_SEPOLIA_RPC_URL=$VITE_SEPOLIA_RPC_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
