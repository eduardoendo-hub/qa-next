# QA Next — landing page estática servida por nginx
FROM nginx:1.27-alpine

# Config (inclui healthcheck /healthz → "ok")
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Conteúdo da LP
COPY index.html styles.css app.js robots.txt sitemap.xml /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
