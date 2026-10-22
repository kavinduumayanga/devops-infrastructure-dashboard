# Validation

Run these procedures against the real lab after deployment. Commands describe
expected outcomes; this document does not contain fabricated output or assert
that a particular runtime validation was performed while the documentation was
written.

## Before testing

Confirm that the VMs are running and that the application URL resolves from the
test client:

```bash
cd manual_provisioning
vagrant status
curl -v http://192.168.56.20/nginx-health
```

Expected outcome: Vagrant reports the required guests as running and the Nginx
endpoint returns HTTP 200 with a small `healthy` body. This check says nothing
about Tomcat upstream health.

## Build and artifact

From a clean checkout on the build host:

```bash
java -version
mvn -version
mvn clean verify
test -f target/devops-dashboard.war
shasum -a 256 target/devops-dashboard.war
```

Expected outcome: Java and Maven report Java 21, Maven completes the `verify`
lifecycle without failures, and the WAR exists. Record the digest and compare
it with both deployed copies.

## Direct Tomcat identity

Query each Tomcat without Nginx:

```bash
curl -fsS http://192.168.56.22:8080/devops-dashboard/api/instance
curl -fsS http://192.168.56.21:8080/devops-dashboard/api/instance
```

Expected outcome:

- The first response reports `instanceId` as `app01`.
- The second response reports `instanceId` as `app02`.
- Both report application status `UP`.

If an ID is wrong, correct `APP_INSTANCE_ID` and restart that Tomcat before
testing load balancing. A successful response with the wrong identity is a
failed peer-monitoring result by design.

## Nginx round-robin distribution

Make multiple independent requests and inspect `X-App-Instance`:

```bash
for request_number in 1 2 3 4 5 6; do
  curl -sS -D - -o /dev/null \
    -H 'Cache-Control: no-cache' \
    "http://192.168.56.20/devops-dashboard/api/instance?sample=${request_number}" \
    | awk 'BEGIN{IGNORECASE=1} /^X-App-Instance:/ {gsub("\r", ""); print}'
done
```

Expected outcome: both `app01` and `app02` appear while both upstreams are
healthy. Round robin describes selection order, but retries, failed upstreams,
connection reuse, or configuration changes can prevent a perfectly alternating
display. Confirm the Nginx upstream configuration if only one ID appears.

## Controlled Tomcat failover and recovery

Perform this only during a lab maintenance window.

1. Establish that both direct Tomcat URLs and the Nginx URL work.
2. Stop one application server, for example on `app01`:

   ```bash
   sudo systemctl stop tomcat
   ```

3. From the client, make repeated Nginx requests:

   ```bash
   for request_number in 1 2 3 4 5; do
     curl -sS --max-time 5 \
       "http://192.168.56.20/devops-dashboard/api/instance?failover=${request_number}"
     printf '\n'
   done
   ```

4. Restore `app01`:

   ```bash
   sudo systemctl start tomcat
   curl -fsS http://127.0.0.1:8080/devops-dashboard/api/instance
   ```

5. Repeat the round-robin test after Nginx’s failure interval has elapsed.

Expected outcome: after failure detection, traffic continues through `app02`.
A transient failed request can occur during detection. After recovery, `app01`
eventually reappears. This validates Tomcat-tier failover only; stopping Nginx
still removes the public entry point.

## MySQL health and sample records

From each Tomcat host, test the network path and host-scoped account. Let `-p`
prompt for the password:

```bash
mysql -h 192.168.56.25 -P 3306 -u admin -p -D devops_demo \
  -e 'SELECT 1; SELECT id,name,created_at FROM demo_records ORDER BY id;'
```

Through the application:

```bash
curl -fsS http://192.168.56.20/devops-dashboard/api/database/health
curl -fsS http://192.168.56.20/devops-dashboard/api/records
```

Expected outcome: database health is `UP`, the response includes a measured
latency and version when available, and `/api/records` returns the current rows.
Rows from `db/init.sql` are demonstration data, not discovered infrastructure.

## Memcached and cache-aside behavior

Check basic connectivity from a Tomcat host:

```bash
nc -vz 192.168.56.24 11211
curl -fsS http://127.0.0.1:8080/devops-dashboard/api/cache/health
```

Clear only the application’s shared demo cache key, then perform two reads:

```bash
curl -fsS -X DELETE \
  http://192.168.56.20/devops-dashboard/api/cache/demo
curl -fsS http://192.168.56.20/devops-dashboard/api/cache/demo
curl -fsS http://192.168.56.20/devops-dashboard/api/cache/demo
```

Expected outcome when Memcached and MySQL are available:

1. The clear operation reports success.
2. The first read reports a cache `MISS`, loads data from MySQL, and reports
   whether population succeeded.
3. The next read normally reports `HIT` and source `MEMCACHED`.

If Memcached is unavailable, the endpoint must use `UNAVAILABLE`, not `MISS`,
and can still return MySQL data. Timing and concurrent requests can affect
which request first populates the key.

## RabbitMQ monitoring

On `rmq01`:

```bash
sudo rabbitmq-diagnostics status
sudo rabbitmq-diagnostics listeners
sudo rabbitmqctl list_users
sudo rabbitmqctl list_permissions -p devops
```

From a Tomcat host, prompt for the monitoring password:

```bash
curl -fsS -u devops_monitor \
  http://192.168.56.23:15672/api/health/checks/alarms
curl -fsS -u devops_monitor \
  http://192.168.56.23:15672/api/overview
```

Then inspect `rmq01` in the unified response:

```bash
curl -fsS \
  http://127.0.0.1:8080/devops-dashboard/api/infrastructure/health \
  | python3 -m json.tool
```

Expected outcome: authenticated Management API access reports broker health and
the unified service entry uses monitoring type `MANAGEMENT_HTTP`. A missing
management configuration may produce `TCP_CONNECTIVITY_ONLY` and `DEGRADED`;
that is not equivalent to verified broker health.

## NFS mount verification

Run on both Tomcat hosts:

```bash
findmnt -T /mnt/nfs-shared -o TARGET,SOURCE,FSTYPE,OPTIONS
mountpoint /mnt/nfs-shared
test -r /mnt/nfs-shared
```

Expected outcome: the source is
`192.168.56.26:/srv/nfs/shared`, filesystem type is `nfs` or `nfs4`, and the
directory is readable. A local directory with the same path is not sufficient.

After checking `/api/infrastructure/health`, find the `nfs01` entry. It should
report the detected mount, read capability, probe duration, and whether the
optional write probe is enabled. Do not enable the write probe merely to make a
read-only export appear healthy.

## Unified infrastructure monitoring API

Query both Tomcats directly to make per-instance snapshots visible:

```bash
curl -fsS http://192.168.56.22:8080/devops-dashboard/api/infrastructure/health \
  | python3 -m json.tool
curl -fsS http://192.168.56.21:8080/devops-dashboard/api/infrastructure/health \
  | python3 -m json.tool
```

Expected structure:

- Top-level API `success` is true when the monitoring API itself worked.
- `data.services` contains stable IDs for all seven VMs.
- Each result contains its monitoring method, normalized state, and check time.
- Latency, last success, error, and service-specific details appear only when
  available.
- One failed dependency does not remove results for other services.
- No password, token, or authorization header appears.

The two snapshots can differ slightly because each Tomcat caches its own
observations for the configured interval.

## Dashboard review

Open `http://192.168.56.20/devops-dashboard/` and verify:

- All seven VM nodes are present.
- The current-responder badge is entirely inside the responding Tomcat card.
- Selecting a node shows monitoring method, current health, latest success,
  latency, supported details, and relationships.
- Unknown, checking, stale, degraded, down, and up states use both text and
  color.
- Resizing the browser does not make connector lines pass through node content.
- Enabling reduced motion in the operating system suppresses nonessential
  motion.

Use the [screenshot guide](screenshots/README.md) only after these checks pass.

## Related documentation

- [Manual deployment](manual-deployment.md)
- [Networking](networking.md)
- [Troubleshooting](troubleshooting.md)
- [Project README](../README.md)
