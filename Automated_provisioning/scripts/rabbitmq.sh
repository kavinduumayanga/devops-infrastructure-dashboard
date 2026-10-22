#!/bin/bash
set -euo pipefail

RABBITMQ_IP="192.168.56.35"
APP01_IP="192.168.56.31"
APP02_IP="192.168.56.32"
ERLANG_VERSION="27.3.4.18"
RABBITMQ_VERSION="4.2.9"

ERLANG_RPM="erlang-${ERLANG_VERSION}-1.el9.aarch64.rpm"
ERLANG_URL="https://github.com/rabbitmq/erlang-rpm/releases/download/v${ERLANG_VERSION}/${ERLANG_RPM}"
RABBITMQ_RPM="rabbitmq-server-${RABBITMQ_VERSION}-1.el8.noarch.rpm"
RABBITMQ_URL="https://github.com/rabbitmq/rabbitmq-server/releases/download/v${RABBITMQ_VERSION}/${RABBITMQ_RPM}"
SIGNING_KEY="https://github.com/rabbitmq/signing-keys/releases/download/3.0/rabbitmq-release-signing-key.asc"

die() {
  echo "[rabbitmq] ERROR: $*" >&2
  exit 1
}

[[ -n "${RABBITMQ_APP_PASSWORD:-}" ]] || die "RABBITMQ_APP_PASSWORD was not provided"
[[ -n "${RABBITMQ_MONITOR_PASSWORD:-}" ]] || die "RABBITMQ_MONITOR_PASSWORD was not provided"
[[ ${#RABBITMQ_APP_PASSWORD} -ge 16 && "$RABBITMQ_APP_PASSWORD" =~ ^[A-Za-z0-9._@%+=:-]+$ ]] || \
  die "RABBITMQ_APP_PASSWORD has an invalid format"
[[ ${#RABBITMQ_MONITOR_PASSWORD} -ge 16 && "$RABBITMQ_MONITOR_PASSWORD" =~ ^[A-Za-z0-9._@%+=:-]+$ ]] || \
  die "RABBITMQ_MONITOR_PASSWORD has an invalid format"
[[ $(uname -m) == "aarch64" ]] || die "This provisioner expects the ARM64 Vagrant box"

echo "[rabbitmq] Installing official Erlang 27 and RabbitMQ 4.2 packages"
dnf -y --setopt=max_parallel_downloads=1 install curl ca-certificates logrotate socat firewalld
rpm --import "$SIGNING_KEY"

if rpm -q erlang >/dev/null 2>&1; then
  installed_erlang=$(rpm -q --qf '%{VERSION}' erlang)
  [[ "$installed_erlang" == "$ERLANG_VERSION" ]] || \
    die "Erlang ${installed_erlang} is installed; expected ${ERLANG_VERSION}. Resolve the version manually."
else
  curl --fail --location --retry 3 --output "/tmp/${ERLANG_RPM}" "$ERLANG_URL"
  rpm --checksig "/tmp/${ERLANG_RPM}" | grep -q 'signatures OK' || die "Erlang RPM signature verification failed"
  dnf -y --setopt=max_parallel_downloads=1 install "/tmp/${ERLANG_RPM}"
fi

if rpm -q rabbitmq-server >/dev/null 2>&1; then
  installed_rabbitmq=$(rpm -q --qf '%{VERSION}' rabbitmq-server)
  [[ "$installed_rabbitmq" == "$RABBITMQ_VERSION" ]] || \
    die "RabbitMQ ${installed_rabbitmq} is installed; expected ${RABBITMQ_VERSION}. Resolve the version manually."
else
  curl --fail --location --retry 3 --output "/tmp/${RABBITMQ_RPM}" "$RABBITMQ_URL"
  rpm --checksig "/tmp/${RABBITMQ_RPM}" | grep -q 'signatures OK' || die "RabbitMQ RPM signature verification failed"
  dnf -y --setopt=max_parallel_downloads=1 install "/tmp/${RABBITMQ_RPM}"
fi

erl -noshell -eval 'io:format("~s", [erlang:system_info(otp_release)]), halt().' | grep -qx '27' || \
  die "RabbitMQ requires Erlang 27"

echo "[rabbitmq] Configuring AMQP and Management listeners"
cat >/etc/rabbitmq/rabbitmq.conf <<EOF
listeners.tcp.1 = ${RABBITMQ_IP}:5672
management.tcp.ip = ${RABBITMQ_IP}
management.tcp.port = 15672
loopback_users.guest = true
vm_memory_high_watermark.relative = 0.5
disk_free_limit.absolute = 500MB
EOF

rabbitmq-plugins enable --offline rabbitmq_management
systemctl enable rabbitmq-server
systemctl restart rabbitmq-server

for attempt in {1..45}; do
  rabbitmq-diagnostics -q ping >/dev/null 2>&1 && break
  (( attempt == 45 )) && die "RabbitMQ did not become ready"
  sleep 2
done

echo "[rabbitmq] Creating the application and monitoring identities"
rabbitmqctl -q list_vhosts | grep -Fxq devops || rabbitmqctl add_vhost devops

if rabbitmqctl -q list_users | awk '{print $1}' | grep -Fxq devops_app; then
  rabbitmqctl change_password devops_app "$RABBITMQ_APP_PASSWORD"
else
  rabbitmqctl add_user devops_app "$RABBITMQ_APP_PASSWORD"
fi
rabbitmqctl set_user_tags devops_app
rabbitmqctl set_permissions -p devops devops_app '.*' '.*' '.*'

if rabbitmqctl -q list_users | awk '{print $1}' | grep -Fxq devops_monitor; then
  rabbitmqctl change_password devops_monitor "$RABBITMQ_MONITOR_PASSWORD"
else
  rabbitmqctl add_user devops_monitor "$RABBITMQ_MONITOR_PASSWORD"
fi
rabbitmqctl set_user_tags devops_monitor monitoring
rabbitmqctl set_permissions -p devops devops_monitor '^$' '^$' '^$'

echo "[rabbitmq] Restricting AMQP and Management access to the Tomcat VMs"
systemctl enable --now firewalld
for source_ip in "$APP01_IP" "$APP02_IP"; do
  for port in 5672 15672; do
    rule="rule family=ipv4 source address=${source_ip}/32 port port=${port} protocol=tcp accept"
    firewall-cmd --permanent --query-rich-rule="$rule" >/dev/null 2>&1 || \
      firewall-cmd --permanent --add-rich-rule="$rule" >/dev/null
  done
done
firewall-cmd --reload >/dev/null

curl --fail --silent --show-error --max-time 5 \
  --user "devops_monitor:${RABBITMQ_MONITOR_PASSWORD}" \
  "http://${RABBITMQ_IP}:15672/api/overview" >/dev/null || \
  die "RabbitMQ Management API verification failed"

echo "[rabbitmq] RabbitMQ provisioning completed"
