#!/usr/bin/env bash
set -euo pipefail

DOMAIN="lalalabuy.com"
WWW_DOMAIN="www.lalalabuy.com"
SITE_ROOT="/var/www/lalalabuy"
NGINX_CONF="/etc/nginx/sites-available/lalalabuy.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run this script with sudo or as root." >&2
  exit 1
fi

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

mkdir -p "${SITE_ROOT}"
cp "${SCRIPT_DIR}/site/index.html" "${SITE_ROOT}/index.html"
chown -R www-data:www-data "${SITE_ROOT}"
find "${SITE_ROOT}" -type d -exec chmod 755 {} \;
find "${SITE_ROOT}" -type f -exec chmod 644 {} \;

cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    root ${SITE_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    access_log /var/log/nginx/lalalabuy.access.log;
    error_log /var/log/nginx/lalalabuy.error.log;
}
NGINX

ln -sfn "${NGINX_CONF}" /etc/nginx/sites-enabled/lalalabuy.com
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "LaLaLaBuy is deployed at ${SITE_ROOT}."
echo "Once DNS points to this server, run:"
echo "  sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
