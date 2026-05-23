# LaLaLaBuy Server Deployment

This folder contains a small deployment helper for serving the `lalalabuy` static page from a Linux server.

Expected server:

- Ubuntu 24.04 or 22.04
- SSH access as `root` or a sudo-enabled user
- Domain records pointing `lalalabuy.com` and `www.lalalabuy.com` to the server IP

Deploy flow:

```bash
sudo bash setup.sh
```

The script installs Nginx, copies the site files into `/var/www/lalalabuy`, writes an Nginx server block, and reloads Nginx.

After DNS is pointing to the server, SSL can be enabled with:

```bash
sudo certbot --nginx -d lalalabuy.com -d www.lalalabuy.com
```
