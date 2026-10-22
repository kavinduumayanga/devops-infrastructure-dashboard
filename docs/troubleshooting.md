# Troubleshooting

Use a layered approach: confirm the symptom, inspect service and kernel logs,
test the direct network path, and only then change configuration. Preserve logs
and backups before restarting services or modifying data.

The scenarios below reflect issues encountered in this lab. Where the
repository cannot prove one unique cause, the guide labels the cause as
something to confirm rather than as fact.

## DNF is terminated by the OOM killer

**Symptoms**

- `dnf` exits abruptly with `Killed`.
- An SSH session may become slow or disconnect.
- Package state can be left incomplete.

**Confirm**

```bash
free -h
swapon --show
sudo journalctl -k -b | grep -Ei 'out of memory|oom|killed process'
sudo dnf check
sudo rpm --verifydb
```

An OOM-killer kernel entry naming `dnf`, Python, RPM, Java, or another process
confirms memory pressure. The Vagrantfile assigns only 512–1,024 MiB per guest,
and all seven guests together allocate 6,144 MiB on an 8 GB host.

**Resolution**

- Stop unrelated VMs and host applications during package installation.
- Complete package repair with `sudo dnf check` and, when appropriate,
  `sudo dnf distro-sync` after memory is available.
- Add a modest, persistent guest swap file only after checking free disk space
  and existing swap policy.
- Increase a VM’s allocation only if the host has enough headroom; changing all
  guests upward can make host pressure worse.
- Prefer building the WAR on the Mac rather than on a small application VM.

Do not repeatedly rerun interrupted package transactions without checking RPM
and DNF state.

## MariaDB packages conflict with MySQL installation

**Symptoms**

- DNF reports file, provide, or obsoletes conflicts involving MariaDB and
  MySQL community packages.
- `mysqld` installation cannot complete.

**Diagnose**

```bash
rpm -qa | grep -Ei 'mariadb|mysql'
sudo dnf repoquery --installed | grep -Ei 'mariadb|mysql'
sudo dnf history
```

CentOS-family base images can include MariaDB libraries or packages. Confirm
exactly which packages own the conflicting files before removing anything.

**Resolution**

1. Back up any existing database and configuration if the VM contains data.
2. Choose one server implementation for the lab.
3. Review the proposed transaction with `dnf remove --assumeno ...`.
4. Remove only confirmed conflicting server packages, then install the selected
   MySQL packages from the intended repository.
5. Recheck `rpm -qa` and service logs.

Do not use broad wildcard removals on a VM containing data or applications that
depend on MariaDB client libraries.

## MySQL fails because of incompatible InnoDB data files

**Symptoms**

- `mysqld` repeatedly exits during startup.
- The journal or MySQL error log reports unsupported redo logs, data dictionary
  versions, page formats, or files created by another server/version.

**Diagnose**

```bash
sudo systemctl status mysqld --no-pager
sudo journalctl -u mysqld -b --no-pager
sudo ls -lah /var/lib/mysql
rpm -qa | grep -Ei 'mariadb|mysql'
```

The error log—not the mere presence of `ibdata1`—must establish incompatibility.
This can occur after switching between MariaDB and Oracle MySQL packages or
reusing a data directory from an incompatible release.

**Resolution**

- If data matters, stop and take a filesystem-level copy or snapshot before
  attempting recovery. Follow the source server’s supported logical
  dump/upgrade path.
- For a disposable, confirmed-empty lab database, stop MySQL, move the entire
  old data directory to a dated backup location, initialize a fresh directory
  with the installed MySQL version, start MySQL, and rerun `db/init.sql`.
- Confirm ownership and SELinux labels after creating a new data directory.

Never delete `ibdata1`, redo logs, or the complete data directory merely because
MySQL will not start. Partial deletion can make recoverable data unrecoverable.

## MySQL authentication errors

**Symptoms**

- `Access denied for user 'admin'@'192.168.56.21'` or `.22`.
- The application reports database `DOWN` even though port 3306 is reachable.

**Diagnose on `db01`**

```sql
SELECT user, host, plugin FROM mysql.user WHERE user = 'admin';
SHOW GRANTS FOR 'admin'@'192.168.56.21';
SHOW GRANTS FOR 'admin'@'192.168.56.22';
```

Test from each Tomcat with a password prompt:

```bash
mysql -h 192.168.56.25 -P 3306 -u admin -p -D devops_demo -e 'SELECT 1;'
```

**Resolution**

- Create or correct the host-specific account for the actual Tomcat source IP.
- Grant only the required operations on `devops_demo.*`.
- Ensure `DB_USER`, `DB_PASSWORD`, and `DB_NAME` match the account.
- Restart Tomcat after changing its environment.

Avoid solving host mismatches with `'admin'@'%'` unless broad access is an
explicit, reviewed requirement.

## Java 17 is used instead of Java 21

**Symptoms**

- Maven reports an unsupported release or class-file version.
- Tomcat logs an `UnsupportedClassVersionError`.
- `java -version` and `mvn -version` report different Java versions.

**Diagnose**

```bash
java -version
javac -version
mvn -version
readlink -f "$(command -v java)"
sudo systemctl cat tomcat
sudo systemctl show tomcat -p Environment
```

**Resolution**

- Install a Java 21 JDK, not only a JRE.
- Select Java 21 with the distribution alternatives mechanism where applicable.
- Set the correct `JAVA_HOME` for Maven and separately in Tomcat’s service
  environment or `setenv.sh`.
- Restart Tomcat and verify its startup log after changing the service runtime.

An interactive shell showing Java 21 does not prove systemd uses the same JDK.

## Maven runs out of Java heap

**Symptoms**

- `java.lang.OutOfMemoryError: Java heap space` or GC overhead errors during
  compilation, testing, or packaging.
- The process is killed without a Java exception when the operating system is
  out of memory.

**Diagnose**

```bash
mvn -version
free -h
printf '%s\n' "${MAVEN_OPTS:-not set}"
sudo journalctl -k -b | grep -Ei 'out of memory|oom|killed process'
```

**Resolution**

- Build on the Mac host rather than a 768/1,024 MiB guest.
- Stop unnecessary VMs or applications.
- If host memory permits, set a bounded Maven heap for the build, for example:

  ```bash
  export MAVEN_OPTS='-Xms128m -Xmx768m'
  mvn clean verify
  ```

- Distinguish JVM heap exhaustion from the host/guest OOM killer; increasing
  `-Xmx` makes the latter worse when physical memory is already exhausted.

## MySQL JDBC driver is missing or not discovered

**Symptoms**

- `ClassNotFoundException: com.mysql.cj.jdbc.Driver`.
- `No suitable driver found` for the JDBC URL.
- HikariCP cannot initialize despite network reachability.

**Diagnose**

```bash
mvn dependency:tree -Dincludes=com.mysql:mysql-connector-j
jar tf target/devops-dashboard.war | grep 'WEB-INF/lib/mysql-connector'
```

The repository declares `com.mysql:mysql-connector-j:8.4.0` with normal runtime
packaging scope, so the connector JAR should appear under `WEB-INF/lib`.

**Resolution**

- Run `mvn clean verify` rather than manually assembling the WAR.
- Deploy the newly built WAR and remove/move the old exploded application while
  Tomcat is stopped.
- Compare the deployed WAR checksum with the build artifact.
- Inspect for a stale Tomcat shared library only if packaging is correct.

Do not download an arbitrary driver JAR into Tomcat as the first fix; that can
create version conflicts and makes the artifact non-reproducible.

## MySQL connectivity fails when `db01` is powered off

**Symptoms**

- Database health reports `DOWN` or connection failure.
- Record operations fail.
- Cache demo requests may work only while the needed value remains cached.

**Diagnose**

```bash
vagrant status db01
ping -c 2 192.168.56.25
nc -vz -w 3 192.168.56.25 3306
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/database/health
```

**Resolution**

- Start `db01`, confirm `mysqld` is active, then retest port 3306 and the
  application endpoint.
- If the VM is running, inspect routing, firewall, MySQL listener, and logs.
- Allow HikariCP to recover; restart Tomcat only if logs show it did not recover
  after database service returned.

This is expected failure behavior for a single MySQL VM, not proof that the
load balancer is broken.

## Memcached binds before its private IP is available

**Symptoms**

- Memcached fails during boot with a bind/address error.
- Manual restart works after networking is fully online.
- Nothing listens on `192.168.56.24:11211` after boot.

**Diagnose**

```bash
ip address show
ip route
sudo systemctl status memcached --no-pager
sudo journalctl -u memcached -b --no-pager
sudo systemctl cat memcached
sudo ss -lntp | grep ':11211'
```

**Resolution**

- Confirm the configured address exists on the guest.
- Add a systemd dependency/order on `network-online.target` and ensure the
  distribution’s wait-online service is functioning.
- Bind only to loopback and the correct private address; do not switch to
  `0.0.0.0` without a restrictive firewall.
- Restart Memcached and verify the listener after networking is online.

## Firewall blocks Tomcat-to-Tomcat monitoring

**Symptoms**

- User traffic through Nginx can work while one or both Tomcat peer entries are
  `DOWN`.
- Direct `:8080/api/instance` requests between application VMs time out or are
  refused.

**Diagnose from both application hosts**

```bash
curl -v --max-time 3 http://192.168.56.22:8080/devops-dashboard/api/instance
curl -v --max-time 3 http://192.168.56.21:8080/devops-dashboard/api/instance
sudo firewall-cmd --list-all
sudo ss -lntp | grep ':8080'
```

**Resolution**

- Permit `8080/tcp` between `192.168.56.21` and `192.168.56.22` while retaining
  the Nginx-to-Tomcat rule.
- Confirm Tomcat listens on the private interface, not only loopback.
- Keep `APP01_HEALTH_URL` and `APP02_HEALTH_URL` direct; do not point them at
  Nginx.

Do not disable the firewall globally.

## Browser receives connection refused on port 8080

**Symptoms**

- `http://192.168.56.22:8080/...` or `.21` is refused from the Mac.
- Nginx may still work, or it may report an upstream error.

**Diagnose**

```bash
sudo systemctl status tomcat --no-pager
sudo journalctl -u tomcat -b --no-pager
sudo ss -lntp | grep ':8080'
curl -v http://127.0.0.1:8080/devops-dashboard/api/instance
curl -v http://192.168.56.22:8080/devops-dashboard/api/instance
```

**Resolution**

- Start/fix Tomcat if no listener exists.
- Verify the connector bind address and private-interface route.
- Add a narrowly scoped firewall rule if direct host access is required.
- Use the intended Nginx URL for normal browser access:
  `http://192.168.56.20/devops-dashboard/`.
- Confirm the context path includes `/devops-dashboard`; `/` on Tomcat is not
  the deployed application in this layout.

Direct browser access to `8080` is a diagnostic option, not a reason to expose
Tomcat publicly.

## Monitoring snapshots change between round-robin instances

**Symptoms**

- Refreshes show different `checkedAt`, latency, or status values.
- The response `instanceId` alternates between `app01` and `app02`.

**Cause**

Each Tomcat runs the same monitor and owns an in-memory snapshot cache. Nginx
can route consecutive browser refreshes to different caches. Probe timing also
differs naturally.

**Diagnose**

```bash
curl -fsS http://192.168.56.22:8080/devops-dashboard/api/infrastructure/health
curl -fsS http://192.168.56.21:8080/devops-dashboard/api/infrastructure/health
```

Compare `checkedAt`, service timestamps, and the API `instanceId`.

**Resolution/interpretation**

- Treat small timing and latency differences as expected.
- Ensure both Tomcats use the same target configuration and monitoring interval.
- Investigate persistent opposing states with direct target checks from each
  VM; asymmetric firewall or routing rules can create a real difference.
- If only one Tomcat should probe, disable monitoring deliberately on the other,
  understanding that requests served by it will report `UNKNOWN` rather than
  shared results.

## First-response checklist

```bash
systemctl --failed
ip address show
ip route
sudo ss -lntp
free -h
df -h
sudo journalctl -b -p warning --no-pager
```

Limit log sharing to the relevant lines and redact credentials, authorization
headers, tokens, personal paths, and unrelated host information.

## Related documentation

- [Infrastructure](infrastructure.md)
- [Networking](networking.md)
- [Manual deployment](manual-deployment.md)
- [Validation](validation.md)
- [Project README](../README.md)
