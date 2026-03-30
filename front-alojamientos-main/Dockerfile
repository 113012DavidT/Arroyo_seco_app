FROM node:20-alpine AS build
WORKDIR /app

ARG GOOGLE_MAPS_API_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY} npm run build:pwa

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/templates/default.conf.template
COPY docker/nginx/40-env.sh /docker-entrypoint.d/40-env.sh
RUN chmod +x /docker-entrypoint.d/40-env.sh

COPY --from=build /app/dist/arroyo-seco/browser /usr/share/nginx/html
COPY public/env.template.js /usr/share/nginx/html/env.template.js

EXPOSE 80
