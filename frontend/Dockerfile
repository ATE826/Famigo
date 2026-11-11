# 1. Собираем фронтенд. 2. Отдаём готовые файлы через nginx, он же проксирует /api на бэкенд.
# Фронтенд и API оказываются на одном адресе: не нужен CORS, а кука входа работает
# в самом строгом режиме SameSite=Strict.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx-unprivileged работает не от root и слушает порт 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
# Сайт собран с base '/Famigo/' (как на GitHub Pages), поэтому кладём его в эту папку.
COPY --from=build /app/dist /usr/share/nginx/html/Famigo
EXPOSE 8080
