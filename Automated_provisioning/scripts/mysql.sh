#!/bin/bash
set -euo pipefail

DB_IP="192.168.56.33"
APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"
DB_USER="admin"

die() {
  echo "[mysql] ERROR: $*" >&2
  exit 1
}

[[ -n "${MYSQL_ROOT_PASSWORD:-}" ]] || die "MYSQL_ROOT_PASSWORD was not provided"
[[ -n "${DB_PASSWORD:-}" ]] || die "DB_PASSWORD was not provided"
[[ ${#MYSQL_ROOT_PASSWORD} -ge 16 && "$MYSQL_ROOT_PASSWORD" =~ ^[A-Za-z0-9._@%+=:-]+$ ]] || \
  die "MYSQL_ROOT_PASSWORD has an invalid format"
[[ ${#DB_PASSWORD} -ge 16 && "$DB_PASSWORD" =~ ^[A-Za-z0-9._@%+=:-]+$ ]] || \
  die "DB_PASSWORD has an invalid format"
[[ -f /tmp/devops-init.sql ]] || die "Repository db/init.sql was not uploaded"

echo "[mysql] Installing MySQL 8.0"

# Never erase an existing database directory. A MariaDB installation must be
# migrated or removed manually after its data has been backed up.
if rpm -q mariadb-server >/dev/null 2>&1; then
  die "MariaDB Server is installed. Back up and migrate it manually; /var/lib/mysql was not changed."
fi

if [[ -d /var/lib/mysql/mysql ]] && ! rpm -q mysql-server >/dev/null 2>&1; then
  die "Existing database files were found without MySQL Server. Inspect and back up /var/lib/mysql manually."
fi

# --allowerasing safely resolves the known MariaDB client/config utility RPM
# conflict. The MariaDB server itself was explicitly rejected above.
dnf -y --setopt=max_parallel_downloads=1 install --allowerasing mysql-server firewalld

mysql_version=$(mysqld --version)
grep -Eq 'Ver 8\.0\.' <<<"$mysql_version" || die "Expected MySQL 8.0 but found: $mysql_version"

echo "[mysql] Configuring the private listener"
cat >/etc/my.cnf.d/devops-dashboard.cnf <<EOF
[mysqld]
bind-address=${DB_IP}
port=3306
skip-name-resolve=ON
max_connections=80
innodb_buffer_pool_size=128M
performance_schema=OFF
EOF

systemctl enable --now mysqld
systemctl restart mysqld

for attempt in {1..30}; do
  mysqladmin --protocol=socket ping >/dev/null 2>&1 && break
  (( attempt == 30 )) && die "MySQL did not become ready"
  sleep 2
done

echo "[mysql] Initializing the database and restricted application users"
mysql_client=()
first_run=false

if [[ -f /root/.my.cnf ]] && mysql --defaults-extra-file=/root/.my.cnf -e 'SELECT 1' >/dev/null 2>&1; then
  mysql_client=(mysql --defaults-extra-file=/root/.my.cnf)
elif mysql --no-defaults --protocol=socket -u root -e 'SELECT 1' >/dev/null 2>&1; then
  first_run=true
  mysql_client=(mysql --no-defaults --protocol=socket -u root)
  umask 077
  cat >/root/.my.cnf <<EOF
[client]
user=root
password='${MYSQL_ROOT_PASSWORD}'
protocol=socket
EOF
else
  die "Cannot authenticate as MySQL root. Restore the matching /root/.my.cnf credentials manually."
fi

if [[ "$first_run" == true ]]; then
  "${mysql_client[@]}" <<SQL
SOURCE /tmp/devops-init.sql;
CREATE USER IF NOT EXISTS '${DB_USER}'@'${APP01_IP}' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'${APP02_IP}' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO '${DB_USER}'@'${APP01_IP}';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO '${DB_USER}'@'${APP02_IP}';
ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';
FLUSH PRIVILEGES;
SQL
else
  "${mysql_client[@]}" <<SQL
SOURCE /tmp/devops-init.sql;
CREATE USER IF NOT EXISTS '${DB_USER}'@'${APP01_IP}' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'${APP02_IP}' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO '${DB_USER}'@'${APP01_IP}';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO '${DB_USER}'@'${APP02_IP}';
FLUSH PRIVILEGES;
SQL
fi

echo "[mysql] Restricting port 3306 to the two Tomcat VMs"
systemctl enable --now firewalld
for source_ip in "$APP01_IP" "$APP02_IP"; do
  rule="rule family=ipv4 source address=${source_ip}/32 port port=3306 protocol=tcp accept"
  firewall-cmd --permanent --query-rich-rule="$rule" >/dev/null 2>&1 || \
    firewall-cmd --permanent --add-rich-rule="$rule" >/dev/null
done
firewall-cmd --reload >/dev/null

mysql --defaults-extra-file=/root/.my.cnf -NBe \
  "SELECT COUNT(*) FROM devops_demo.demo_records" >/dev/null
ss -lnt | grep -Fq "${DB_IP}:3306" || die "MySQL is not listening on ${DB_IP}:3306"

echo "[mysql] MySQL provisioning completed"
