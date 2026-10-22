#!/bin/bash
set -euo pipefail

APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"
SHARE="/srv/nfs/shared"
SHARED_GID="2000"

die() {
  echo "[nfs] ERROR: $*" >&2
  exit 1
}

echo "[nfs] Installing NFSv4 server packages"
dnf -y --setopt=max_parallel_downloads=1 install nfs-utils firewalld

echo "[nfs] Creating the protected shared directory"
if getent group nfs-share >/dev/null; then
  [[ $(getent group nfs-share | cut -d: -f3) == "$SHARED_GID" ]] || \
    die "The existing nfs-share group does not use GID ${SHARED_GID}"
elif getent group "$SHARED_GID" >/dev/null; then
  die "GID ${SHARED_GID} is already assigned to another group"
else
  groupadd --gid "$SHARED_GID" nfs-share
fi

install -d -m 2775 -o root -g nfs-share "$SHARE"

echo "[nfs] Exporting only to the two Tomcat VMs"
mkdir -p /etc/exports.d
cat >/etc/exports.d/devops-dashboard.exports <<EOF
${SHARE} ${APP01_IP}(rw,sync,root_squash,no_subtree_check) ${APP02_IP}(rw,sync,root_squash,no_subtree_check)
EOF

systemctl enable --now nfs-server
exportfs -ra

echo "[nfs] Restricting NFSv4 port 2049 to the Tomcat VMs"
systemctl enable --now firewalld
for source_ip in "$APP01_IP" "$APP02_IP"; do
  rule="rule family=ipv4 source address=${source_ip}/32 port port=2049 protocol=tcp accept"
  firewall-cmd --permanent --query-rich-rule="$rule" >/dev/null 2>&1 || \
    firewall-cmd --permanent --add-rich-rule="$rule" >/dev/null
done
firewall-cmd --reload >/dev/null

exportfs -v | grep -Fq "$SHARE" || die "The NFS export was not activated"
ss -lnt | grep -q ':2049 ' || die "NFS is not listening on TCP port 2049"

echo "[nfs] NFS provisioning completed"
