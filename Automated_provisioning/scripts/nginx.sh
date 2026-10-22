#!/bin/bash
set -euo pipefail

WEB_IP="192.168.56.30"
APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"

die() {
  echo "[nginx] ERROR: $*" >&2
  exit 1
}

echo "[nginx] Installing Nginx and verification tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx curl ufw

echo "[nginx] Waiting for both Tomcat backends"
for backend in "$APP01_IP" "$APP02_IP"; do
  ready=false
  for attempt in {1..45}; do
    if curl --fail --silent --max-time 5 \
      "http://${backend}:8080/devops-dashboard/api/instance" >/dev/null; then
      ready=true
      break
    fi
    sleep 2
  done
  [[ "$ready" == true ]] || die "Tomcat backend ${backend}:8080 is unavailable"
done

echo "[nginx] Configuring round-robin proxying"
cat >/etc/nginx/conf.d/devops-dashboard.conf <<EOF
upstream automated_tomcat_backend {
    server ${APP01_IP}:8080 max_fails=1 fail_timeout=10s;
    server ${APP02_IP}:8080 max_fails=1 fail_timeout=10s;
    keepalive 8;
}

server {
    listen ${WEB_IP}:80;
    server_name auto-web01 ${WEB_IP};

    location = / {
        return 302 /devops-dashboard/;
    }

    location = /nginx-health {
        access_log off;
        default_type text/plain;
        return 200 "healthy\n";
    }

    location /devops-dashboard/ {
        proxy_pass http://automated_tomcat_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 3s;
        proxy_read_timeout 30s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
EOF

if [[ -L /etc/nginx/sites-enabled/default ]]; then
  unlink /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[nginx] Allowing HTTP only from the private lab network"
ufw allow 22/tcp >/dev/null
ufw allow from 192.168.56.0/24 to any port 80 proto tcp >/dev/null
ufw --force enable >/dev/null

curl --fail --silent --max-time 5 "http://${WEB_IP}/nginx-health" | grep -Fxq healthy || \
  die "The Nginx health endpoint failed"

app01_seen=false
app02_seen=false
for sample in {1..8}; do
  response=$(curl --fail --silent --max-time 5 \
    "http://${WEB_IP}/devops-dashboard/api/instance?sample=${sample}")
  grep -Fq '"instanceId":"app01"' <<<"$response" && app01_seen=true
  grep -Fq '"instanceId":"app02"' <<<"$response" && app02_seen=true
done
[[ "$app01_seen" == true && "$app02_seen" == true ]] || \
  die "Nginx round-robin verification did not observe both Tomcat instances"

echo "[nginx] Nginx provisioning completed"
