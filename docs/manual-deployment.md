# Manual deployment

This guide documents the repository’s manual path:

```text
GitHub checkout -> Maven verification -> WAR artifact -> two Tomcats -> Nginx
```

A push to GitHub does **not** deploy the application. There is no deployment
workflow in this repository; an operator must build, transfer, replace, restart,
and verify the WAR.

## 1. Prepare the build host

Required tools:

- Git.
- JDK 21.
- Maven 3.9 or newer.
- Network access to download Maven and npm dependencies.

Verify that Maven is using Java 21, not merely that Java 21 is installed:

```bash
java -version
javac -version
mvn -version
```

The `pom.xml` configures Node.js 20.15 through `frontend-maven-plugin`; a
separate global Node installation is not required for the Maven build.

## 2. Check out and build the exact revision

For a new checkout:

```bash
git clone https://github.com/kavinduumayanga/devops-infrastructure-dashboard.git
cd devops-infrastructure-dashboard
```

For an existing checkout, first preserve or resolve local work, then use a
fast-forward-only update:

```bash
git status --short
git pull --ff-only
```

Record and build the revision:

```bash
git rev-parse HEAD
mvn clean verify
shasum -a 256 target/devops-dashboard.war
```

Successful packaging creates `target/devops-dashboard.war`. Build the artifact
once and deploy that identical file to both Tomcat instances.

## 3. Initialize MySQL

[`db/init.sql`](../db/init.sql) creates the `devops_demo` database and
`demo_records` table and seeds rows only if the table is empty. It does not
create users or grants.

Copy and run it on `db01` with an administrative MySQL identity:

```bash
scp db/init.sql db01:/tmp/devops-dashboard-init.sql
ssh db01
mysql -u root -p < /tmp/devops-dashboard-init.sql
mysql -u root -p -D devops_demo -e 'SHOW TABLES; SELECT COUNT(*) FROM demo_records;'
```

Manage application identities separately. Restrict accounts to the two Tomcat
source IPs and avoid a broad `'user'@'%'` identity. The following illustrates
the intended host scoping; substitute a securely generated secret without
putting it in shell history or Git:

```sql
CREATE USER IF NOT EXISTS 'admin'@'192.168.56.22' IDENTIFIED BY 'SET_SECURELY';
CREATE USER IF NOT EXISTS 'admin'@'192.168.56.21' IDENTIFIED BY 'SET_SECURELY';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO 'admin'@'192.168.56.22';
GRANT SELECT, INSERT, UPDATE, DELETE ON devops_demo.* TO 'admin'@'192.168.56.21';
```

Use an interactive administrative process or protected SQL input for the real
password. Do not copy the placeholder literally.

## 4. Configure Memcached

On `mc01`, configure Memcached to listen on the private interface used by the
Tomcat VMs, not on a public interface. Distribution-specific configuration
locations vary; inspect the effective service command:

```bash
sudo systemctl cat memcached
sudo ss -lntp | grep ':11211'
sudo systemctl enable --now memcached
```

The firewall should permit `11211/tcp` only from `192.168.56.21` and
`192.168.56.22`. Memcached has no application authentication in this lab and
must remain private.

## 5. Configure RabbitMQ monitoring

Enable the Management plugin on `rmq01` if it is not already enabled:

```bash
sudo rabbitmq-plugins enable rabbitmq_management
```

Create the `devops` virtual host and a dedicated monitoring identity. Do not
grant the administrator tag:

```bash
sudo rabbitmqctl add_vhost devops
sudo rabbitmqctl add_user devops_monitor 'SET_A_LONG_RANDOM_SECRET'
sudo rabbitmqctl set_user_tags devops_monitor monitoring
sudo rabbitmqctl set_permissions -p devops devops_monitor '^$' '^$' '^$'
```

Store the real secret only in protected Tomcat environment configuration. If
management URL or credentials are absent, the application falls back to a TCP
connection test on `5672` and reports `DEGRADED`, not full broker health.

## 6. Prepare NFS

The server export is `/srv/nfs/shared` on `nfs01`; the Tomcat mount point is
`/mnt/nfs-shared`. Configure the export and firewall using the operating
system’s NFS administration tools. On each Tomcat host, verify the existing
mount rather than relying on a same-named local directory:

```bash
findmnt -T /mnt/nfs-shared
mountpoint /mnt/nfs-shared
stat -f -c '%T' /mnt/nfs-shared
```

The dashboard checks the mount but never mounts, unmounts, or edits
`/etc/fstab`. Keep `NFS_WRITE_PROBE_ENABLED=false` unless the Tomcat service
identity is intentionally permitted to create and delete the probe file.

## 7. Configure Tomcat and Java 21

Install Java 21 and Tomcat 10.1 on both application VMs. Confirm the Java used
by the service, not just the interactive shell:

```bash
java -version
sudo systemctl show tomcat -p Environment
sudo systemctl cat tomcat
```

If the service unit is named differently, discover it with:

```bash
systemctl list-unit-files '*tomcat*'
```

For a standalone installation at `/opt/tomcat`, create
`/opt/tomcat/bin/setenv.sh` on both application hosts and restrict it to the
Tomcat administrator/service identity. Use the appropriate `APP_INSTANCE_ID`
on each host:

```bash
#!/bin/bash

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export CATALINA_OPTS='-Xms128m -Xmx384m'

export APP_ENV=production
export APP_INSTANCE_ID=app01

export DB_HOST=192.168.56.25
export DB_PORT=3306
export DB_NAME=devops_demo
export DB_USER=admin
export DB_PASSWORD='SET_SECURELY_ON_THIS_HOST'
export DB_POOL_SIZE=5
export DB_CONNECTION_TIMEOUT_MS=5000

export MEMCACHED_HOST=192.168.56.24
export MEMCACHED_PORT=11211
export CACHE_TTL_SECONDS=60
export CACHE_OPERATION_TIMEOUT_MS=3000

export INFRA_MONITORING_ENABLED=true
export INFRA_MONITORING_INTERVAL_SECONDS=15
export INFRA_MONITORING_TIMEOUT_MS=3000
export NGINX_HEALTH_URL=http://192.168.56.20/nginx-health
export APP01_HEALTH_URL=http://192.168.56.22:8080/devops-dashboard/api/instance
export APP02_HEALTH_URL=http://192.168.56.21:8080/devops-dashboard/api/instance

export RABBITMQ_HOST=192.168.56.23
export RABBITMQ_PORT=5672
export RABBITMQ_MANAGEMENT_URL=http://192.168.56.23:15672
export RABBITMQ_VHOST=devops
export RABBITMQ_MONITOR_USERNAME=devops_monitor
export RABBITMQ_MONITOR_PASSWORD='SET_SECURELY_ON_THIS_HOST'

export NFS_MOUNT_PATH=/mnt/nfs-shared
export NFS_EXPECTED_SERVER=192.168.56.26
export NFS_EXPECTED_EXPORT=/srv/nfs/shared
export NFS_WRITE_PROBE_ENABLED=false
```

On `app02`, set `APP_INSTANCE_ID=app02`. Verify the actual Java 21 installation
path before setting `JAVA_HOME`; the example path is conventional for CentOS
Stream but is not guaranteed across package sources.

```bash
sudo chown tomcat:tomcat /opt/tomcat/bin/setenv.sh
sudo chmod 600 /opt/tomcat/bin/setenv.sh
```

A root-owned systemd `EnvironmentFile` is also appropriate. `.env.example` is
only a reference; Tomcat does not load it automatically.

## 8. Deploy the same WAR safely

Copy the artifact to a temporary path on both VMs:

```bash
scp target/devops-dashboard.war app01:/tmp/devops-dashboard.war.new
scp target/devops-dashboard.war app02:/tmp/devops-dashboard.war.new
```

Compare each server’s digest with the build-host digest:

```bash
ssh app01 'sha256sum /tmp/devops-dashboard.war.new'
ssh app02 'sha256sum /tmp/devops-dashboard.war.new'
```

Replace one instance at a time. The following example preserves the old WAR
and exploded directory rather than deleting them; adapt the service name and
Tomcat group if the installation differs:

```bash
sudo systemctl stop tomcat
sudo install -d -o tomcat -g tomcat -m 0750 /opt/tomcat/backups
deployment_id="$(date -u +%Y%m%dT%H%M%SZ)"
sudo test ! -f /opt/tomcat/webapps/devops-dashboard.war || \
  sudo mv /opt/tomcat/webapps/devops-dashboard.war \
  "/opt/tomcat/backups/devops-dashboard-${deployment_id}.war"
sudo test ! -d /opt/tomcat/webapps/devops-dashboard || \
  sudo mv /opt/tomcat/webapps/devops-dashboard \
  "/opt/tomcat/backups/devops-dashboard-${deployment_id}-exploded"
sudo install -o tomcat -g tomcat -m 0644 /tmp/devops-dashboard.war.new \
  /opt/tomcat/webapps/devops-dashboard.war
sudo systemctl start tomcat
```

Wait for `app01` to pass direct checks before repeating the process on `app02`:

```bash
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/instance
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/database/health
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/cache/health
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/infrastructure/health
sudo journalctl -u tomcat -n 100 --no-pager
```

### Rollback

Stop the affected Tomcat, move the failed WAR and exploded directory to a
separate diagnostic location, restore the selected backup WAR, start Tomcat,
and rerun the direct checks. Do not mix an old exploded directory with a
different WAR.

## 9. Configure Nginx round robin

The following preserves the `/devops-dashboard/...` URI when proxying:

```nginx
upstream tomcat_backend {
    server 192.168.56.22:8080 max_fails=1 fail_timeout=10s;
    server 192.168.56.21:8080 max_fails=1 fail_timeout=10s;
}

server {
    listen 80;
    server_name _;

    location = / {
        return 302 /devops-dashboard/;
    }

    location = /nginx-health {
        access_log off;
        default_type text/plain;
        return 200 "healthy\n";
    }

    location /devops-dashboard/ {
        proxy_pass http://tomcat_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
```

Validate before reloading:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fsS http://127.0.0.1/nginx-health
```

`/nginx-health` verifies Nginx HTTP responsiveness only. It deliberately does
not proxy to Tomcat and does not prove either upstream is healthy.

## 10. End-to-end verification

From the Mac host or another permitted client:

```bash
curl -fsS http://192.168.56.20/nginx-health
curl -i http://192.168.56.20/devops-dashboard/api/instance
curl -fsS http://192.168.56.20/devops-dashboard/api/infrastructure/health
```

Use repeated requests and the failover procedure in
[Validation](validation.md). Do not treat a single successful request as proof
that both Tomcats or all shared services are healthy.

## Service control reference

Confirm actual unit names before using these commands:

```bash
# web01
sudo systemctl restart nginx

# app01/app02
sudo systemctl restart tomcat

# db01
sudo systemctl restart mysqld

# mc01
sudo systemctl restart memcached

# rmq01
sudo systemctl restart rabbitmq-server

# nfs01
sudo systemctl restart nfs-server
```

Use `status` and logs before restarting a failed service; an unexplained restart
can erase useful diagnostic evidence.

## Related documentation

- [Networking](networking.md)
- [Validation](validation.md)
- [Troubleshooting](troubleshooting.md)
- [Project README](../README.md)
