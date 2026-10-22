#!/bin/bash
set -euo pipefail

MEMCACHED_IP="192.168.56.34"
APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"

die() {
  echo "[memcached] ERROR: $*" >&2
  exit 1
}

echo "[memcached] Installing Memcached"
dnf -y --setopt=max_parallel_downloads=1 install memcached firewalld nmap-ncat

echo "[memcached] Writing /etc/sysconfig/memcached"
cat >/etc/sysconfig/memcached <<EOF
PORT="11211"
USER="memcached"
MAXCONN="512"
CACHESIZE="64"
OPTIONS="-l ${MEMCACHED_IP} -U 0"
EOF

# Wait for Vagrant's private address before systemd starts Memcached. Restarting
# on failure also handles a short network delay during a later VM boot.
mkdir -p /etc/systemd/system/memcached.service.d
cat >/etc/systemd/system/memcached.service.d/network.conf <<EOF
[Unit]
Wants=network-online.target
After=network-online.target

[Service]
ExecStartPre=/bin/bash -c 'for i in {1..30}; do ip -4 addr show | grep -q "${MEMCACHED_IP}" && exit 0; sleep 2; done; exit 1'
Restart=on-failure
RestartSec=3
EOF

systemctl daemon-reload
systemctl enable memcached
systemctl restart memcached

echo "[memcached] Restricting port 11211 to the two Tomcat VMs"
systemctl enable --now firewalld
for source_ip in "$APP01_IP" "$APP02_IP"; do
  rule="rule family=ipv4 source address=${source_ip}/32 port port=11211 protocol=tcp accept"
  firewall-cmd --permanent --query-rich-rule="$rule" >/dev/null 2>&1 || \
    firewall-cmd --permanent --add-rich-rule="$rule" >/dev/null
done
firewall-cmd --reload >/dev/null

for attempt in {1..20}; do
  if printf 'version\r\nquit\r\n' | nc -w 2 "$MEMCACHED_IP" 11211 | grep -q '^VERSION'; then
    echo "[memcached] Memcached provisioning completed"
    exit 0
  fi
  sleep 2
done

die "Memcached did not respond on ${MEMCACHED_IP}:11211"
