# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_ANALYSIS_PROVIDER=mock
ARG VITE_MOCK_LATENCY_MS=2500
ARG VITE_MOCK_FAIL_FIRST_ATTEMPT=false
ARG APP_COMMIT=local
ARG VITE_CS_DIRECT_CONNECT_URL=
ARG VITE_CS_ENVIRONMENT_ID=
ARG VITE_CS_SCHEMA_NAME=
ARG VITE_CS_TENANT_ID=
ARG VITE_CS_CLIENT_ID=
ARG VITE_CS_CLOUD=Prod
ENV VITE_ANALYSIS_PROVIDER=$VITE_ANALYSIS_PROVIDER \
    VITE_MOCK_LATENCY_MS=$VITE_MOCK_LATENCY_MS \
    VITE_MOCK_FAIL_FIRST_ATTEMPT=$VITE_MOCK_FAIL_FIRST_ATTEMPT \
    APP_COMMIT=$APP_COMMIT \
    VITE_CS_DIRECT_CONNECT_URL=$VITE_CS_DIRECT_CONNECT_URL \
    VITE_CS_ENVIRONMENT_ID=$VITE_CS_ENVIRONMENT_ID \
    VITE_CS_SCHEMA_NAME=$VITE_CS_SCHEMA_NAME \
    VITE_CS_TENANT_ID=$VITE_CS_TENANT_ID \
    VITE_CS_CLIENT_ID=$VITE_CS_CLIENT_ID \
    VITE_CS_CLOUD=$VITE_CS_CLOUD
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/certs.sh /docker-entrypoint.d/05-shelfwise-certs.sh
RUN chmod +x /docker-entrypoint.d/05-shelfwise-certs.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
