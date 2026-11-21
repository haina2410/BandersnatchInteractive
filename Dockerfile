FROM nginx/nginx-unprivileged:stable-alpine-slim

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
COPY subtitle/ /usr/share/nginx/html/subtitle/

EXPOSE 8080
