#!/bin/bash
set -euo pipefail

[[ $# -eq 4 ]] || { echo "Usage: $0 VM_NAME APP_INSTANCE_ID REPOSITORY GIT_REF" >&2; exit 64; }

VM_NAME="$1"
APP_INSTANCE_ID="$2"
APP_REPOSITORY="$3"
APP_GIT_REF="$4"

TOMCAT_VERSION="10.1.24"
WEB_IP="192.168.56.30"
APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"
DB_IP="192.168.56.33"
MEMCACHED_IP="192.168.56.34"
RABBITMQ_IP="192.168.56.35"
NFS_IP="192.168.56.36"
SHARED_GID="2000"

die() {
  echo "[tomcat] ERROR: $*" >&2
  exit 1
}

[[ "$VM_NAME" == "auto-app01" || "$VM_NAME" == "auto-app02" ]] || die "Invalid VM name: ${VM_NAME}"
[[ "$APP_INSTANCE_ID" == "app01" || "$APP_INSTANCE_ID" == "app02" ]] || die "Invalid application instance ID"
[[ "$APP_REPOSITORY" == https://github.com/*/*.git ]] || die "The application repository must be a GitHub HTTPS URL"
[[ "$APP_GIT_REF" != -* && "$APP_GIT_REF" =~ ^[A-Za-z0-9._/-]+$ ]] || die "Invalid Git ref"
[[ -n "${DB_PASSWORD:-}" ]] || die "DB_PASSWORD was not provided"
[[ -n "${RABBITMQ_APP_PASSWORD:-}" ]] || die "RABBITMQ_APP_PASSWORD was not provided"
[[ -n "${RABBITMQ_MONITOR_PASSWORD:-}" ]] || die "RABBITMQ_MONITOR_PASSWORD was not provided"
for secret_name in DB_PASSWORD RABBITMQ_APP_PASSWORD RABBITMQ_MONITOR_PASSWORD; do
  secret_value=${!secret_name}
  [[ ${#secret_value} -ge 16 && "$secret_value" =~ ^[A-Za-z0-9._@%+=:-]+$ ]] || \
    die "${secret_name} has an invalid format"
done

echo "[tomcat] Installing Java 21, Maven, Git, NFS client, and utilities"
dnf -y --setopt=max_parallel_downloads=1 install \
  java-21-openjdk-devel maven git nfs-utils curl tar gzip rsync nmap-ncat firewalld

echo "[tomcat] Creating service accounts and the shared NFS group"
getent group tomcat >/dev/null || groupadd --system tomcat
id tomcat >/dev/null 2>&1 || \
  useradd --system --gid tomcat --home-dir /var/lib/tomcat --create-home --shell /sbin/nologin tomcat

if getent group nfs-share >/dev/null; then
  [[ $(getent group nfs-share | cut -d: -f3) == "$SHARED_GID" ]] || \
    die "The existing nfs-share group does not use GID ${SHARED_GID}"
elif getent group "$SHARED_GID" >/dev/null; then
  die "GID ${SHARED_GID} is already assigned to another group"
else
  groupadd --gid "$SHARED_GID" nfs-share
fi
usermod -aG nfs-share tomcat

echo "[tomcat] Installing Apache Tomcat ${TOMCAT_VERSION} in /opt/tomcat"
if [[ ! -x /opt/tomcat/bin/catalina.sh ]]; then
  cache_dir="/var/cache/tomcat"
  archive="apache-tomcat-${TOMCAT_VERSION}.tar.gz"
  base_url="https://archive.apache.org/dist/tomcat/tomcat-10/v${TOMCAT_VERSION}/bin"
  mkdir -p "$cache_dir" /opt/tomcat
  curl --fail --location --retry 3 --output "${cache_dir}/${archive}" "${base_url}/${archive}"
  curl --fail --location --retry 3 --output "${cache_dir}/${archive}.sha512" "${base_url}/${archive}.sha512"
  expected_checksum=$(awk 'NR == 1 {print $1}' "${cache_dir}/${archive}.sha512")
  actual_checksum=$(sha512sum "${cache_dir}/${archive}" | awk '{print $1}')
  [[ "$actual_checksum" == "$expected_checksum" ]] || die "Tomcat archive checksum verification failed"
  tar -xzf "${cache_dir}/${archive}" -C /opt/tomcat --strip-components=1
fi
chown -R tomcat:tomcat /opt/tomcat

echo "[tomcat] Configuring the persistent NFSv4 mount"
mkdir -p /mnt/nfs-shared
fstab_line="${NFS_IP}:/srv/nfs/shared /mnt/nfs-shared nfs4 rw,_netdev,nofail,x-systemd.automount 0 0"
existing_mount=$(awk '$2 == "/mnt/nfs-shared" && $1 !~ /^#/ {print}' /etc/fstab)
if [[ -n "$existing_mount" && "$existing_mount" != "$fstab_line" ]]; then
  die "/etc/fstab already contains a different /mnt/nfs-shared entry"
fi
grep -Fqx "$fstab_line" /etc/fstab || echo "$fstab_line" >>/etc/fstab
systemctl daemon-reload

for attempt in {1..30}; do
  mountpoint -q /mnt/nfs-shared || mount /mnt/nfs-shared >/dev/null 2>&1 || true
  mountpoint -q /mnt/nfs-shared && break
  (( attempt == 30 )) && die "NFS share did not mount from ${NFS_IP}"
  sleep 2
done

echo "[tomcat] Writing the protected application environment"
mkdir -p /etc/sysconfig
cat >/etc/sysconfig/tomcat-dashboard <<EOF
APP_ENV=production
APP_INSTANCE_ID=${APP_INSTANCE_ID}
VM_INSTANCE_NAME=${VM_NAME}

DB_HOST=${DB_IP}
DB_PORT=3306
DB_NAME=devops_demo
DB_USER=admin
DB_PASSWORD=${DB_PASSWORD}
DB_POOL_SIZE=5
DB_CONNECTION_TIMEOUT_MS=5000

MEMCACHED_HOST=${MEMCACHED_IP}
MEMCACHED_PORT=11211
CACHE_TTL_SECONDS=60
CACHE_OPERATION_TIMEOUT_MS=3000

RABBITMQ_HOST=${RABBITMQ_IP}
RABBITMQ_PORT=5672
RABBITMQ_VHOST=devops
RABBITMQ_USERNAME=devops_app
RABBITMQ_PASSWORD=${RABBITMQ_APP_PASSWORD}
RABBITMQ_MANAGEMENT_URL=http://${RABBITMQ_IP}:15672
RABBITMQ_MONITOR_USERNAME=devops_monitor
RABBITMQ_MONITOR_PASSWORD=${RABBITMQ_MONITOR_PASSWORD}

NGINX_HEALTH_URL=http://${WEB_IP}/nginx-health
APP01_HEALTH_URL=http://${APP01_IP}:8080/devops-dashboard/api/instance
APP02_HEALTH_URL=http://${APP02_IP}:8080/devops-dashboard/api/instance

NFS_MOUNT_PATH=/mnt/nfs-shared
NFS_EXPECTED_SERVER=${NFS_IP}
NFS_EXPECTED_EXPORT=/srv/nfs/shared
NFS_WRITE_PROBE_ENABLED=false

INFRA_MONITORING_ENABLED=true
INFRA_MONITORING_INTERVAL_SECONDS=15
INFRA_MONITORING_TIMEOUT_MS=3000
EOF
chown root:tomcat /etc/sysconfig/tomcat-dashboard
chmod 0640 /etc/sysconfig/tomcat-dashboard

java_home=$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")
cat >/etc/systemd/system/tomcat.service <<EOF
[Unit]
Description=Apache Tomcat for the DevOps Infrastructure Dashboard
Wants=network-online.target
After=network-online.target remote-fs.target
RequiresMountsFor=/mnt/nfs-shared

[Service]
Type=simple
User=tomcat
Group=tomcat
SupplementaryGroups=nfs-share
Environment=JAVA_HOME=${java_home}
Environment=CATALINA_HOME=/opt/tomcat
Environment=CATALINA_BASE=/opt/tomcat
EnvironmentFile=/etc/sysconfig/tomcat-dashboard
ExecStart=/opt/tomcat/bin/catalina.sh run
SuccessExitStatus=143
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

echo "[tomcat] Cloning or updating the application"
source_dir="/opt/devops-dashboard"
if [[ ! -d "${source_dir}/.git" ]]; then
  if [[ -e "$source_dir" && -n $(find "$source_dir" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
    die "${source_dir} exists but is not an empty Git checkout"
  fi
  mkdir -p "$source_dir"
  chown tomcat:tomcat "$source_dir"
  runuser -u tomcat -- git clone "$APP_REPOSITORY" "$source_dir"
fi

configured_origin=$(runuser -u tomcat -- git -C "$source_dir" remote get-url origin)
[[ "$configured_origin" == "$APP_REPOSITORY" ]] || die "The existing Git checkout uses a different origin"
[[ -z $(runuser -u tomcat -- git -C "$source_dir" status --porcelain --untracked-files=no) ]] || \
  die "The managed Git checkout has local changes; refusing to overwrite them"

runuser -u tomcat -- git -C "$source_dir" fetch --prune --tags origin
if runuser -u tomcat -- git -C "$source_dir" show-ref --verify --quiet "refs/remotes/origin/${APP_GIT_REF}"; then
  if runuser -u tomcat -- git -C "$source_dir" show-ref --verify --quiet "refs/heads/${APP_GIT_REF}"; then
    runuser -u tomcat -- git -C "$source_dir" checkout "$APP_GIT_REF"
  else
    runuser -u tomcat -- git -C "$source_dir" checkout --track -b "$APP_GIT_REF" "origin/${APP_GIT_REF}"
  fi
  runuser -u tomcat -- git -C "$source_dir" merge --ff-only "origin/${APP_GIT_REF}"
else
  runuser -u tomcat -- git -C "$source_dir" checkout --detach "$APP_GIT_REF"
fi

echo "[tomcat] Building the WAR with Maven"
runuser -u tomcat -- env \
  HOME=/var/lib/tomcat \
  JAVA_HOME="$java_home" \
  PATH="$java_home/bin:/usr/local/bin:/usr/bin:/bin" \
  MAVEN_OPTS='-Xms128m -Xmx384m' \
  NODE_OPTIONS='--max-old-space-size=384' \
  mvn -f "${source_dir}/pom.xml" clean package

built_war="${source_dir}/target/devops-dashboard.war"
[[ -s "$built_war" ]] || die "Maven did not create ${built_war}"

echo "[tomcat] Deploying the WAR"
deployed_war="/opt/tomcat/webapps/devops-dashboard.war"
new_checksum=$(sha256sum "$built_war" | awk '{print $1}')
old_checksum=""
[[ ! -f "$deployed_war" ]] || old_checksum=$(sha256sum "$deployed_war" | awk '{print $1}')

if [[ "$new_checksum" != "$old_checksum" ]]; then
  systemctl stop tomcat >/dev/null 2>&1 || true
  backup_dir="/var/backups/devops-dashboard"
  mkdir -p "$backup_dir"
  if [[ -f "$deployed_war" ]]; then
    mv "$deployed_war" "${backup_dir}/devops-dashboard-${old_checksum}.war"
  fi
  if [[ -d /opt/tomcat/webapps/devops-dashboard ]]; then
    mv /opt/tomcat/webapps/devops-dashboard \
      "${backup_dir}/devops-dashboard-$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  install -m 0644 -o tomcat -g tomcat "$built_war" "$deployed_war"
fi

echo "[tomcat] Restricting port 8080 to Nginx and the two application VMs"
systemctl enable --now firewalld
for source_ip in "$WEB_IP" "$APP01_IP" "$APP02_IP"; do
  rule="rule family=ipv4 source address=${source_ip}/32 port port=8080 protocol=tcp accept"
  firewall-cmd --permanent --query-rich-rule="$rule" >/dev/null 2>&1 || \
    firewall-cmd --permanent --add-rich-rule="$rule" >/dev/null
done
firewall-cmd --reload >/dev/null

systemctl enable tomcat
systemctl restart tomcat

for attempt in {1..45}; do
  response=$(curl --fail --silent --max-time 5 \
    http://127.0.0.1:8080/devops-dashboard/api/instance 2>/dev/null || true)
  grep -Fq "\"instanceId\":\"${APP_INSTANCE_ID}\"" <<<"$response" && {
    echo "[tomcat] ${VM_NAME} provisioning completed"
    exit 0
  }
  sleep 2
done

die "The dashboard did not become ready on Tomcat"
