# Networking

The lab uses static private addresses on `192.168.56.0/24`. This network joins
the seven guests and the host-side VMware interface; it is not a reason to
expose backend services beyond the lab.

## Address plan

| Address | Host | Role |
|---|---|---|
| `192.168.56.20` | `web01` | Nginx entry point |
| `192.168.56.21` | `app02` | Tomcat application server |
| `192.168.56.22` | `app01` | Tomcat application server |
| `192.168.56.23` | `rmq01` | RabbitMQ broker and Management API |
| `192.168.56.24` | `mc01` | Memcached cache |
| `192.168.56.25` | `db01` | MySQL database |
| `192.168.56.26` | `nfs01` | NFSv4 server |

Check for subnet collisions with VPN clients or another local hypervisor:

```bash
route -n get 192.168.56.20        # macOS
ip route get 192.168.56.20        # Linux guest
```

## Required flows

| Source | Destination | Port | Protocol/purpose |
|---|---|---:|---|
| Mac/client | `web01` | 80 | HTTP dashboard and API |
| `web01` | `app01`, `app02` | 8080 | Nginx upstream HTTP |
| `app01`, `app02` | `web01` | 80 | Direct `/nginx-health` probe |
| `app01` | `app01`, `app02` | 8080 | Direct self/peer instance checks |
| `app02` | `app01`, `app02` | 8080 | Direct self/peer instance checks |
| `app01`, `app02` | `db01` | 3306 | MySQL/JDBC |
| `app01`, `app02` | `mc01` | 11211 | Memcached TCP protocol |
| `app01`, `app02` | `rmq01` | 15672 | RabbitMQ Management HTTP API |
| `app01`, `app02` | `rmq01` | 5672 | AMQP port TCP fallback check |
| `app01`, `app02` | `nfs01` | 2049 | NFSv4 |
| Administrative host | VMs | 22 | SSH administration, if configured |

Tomcat peer checks go directly to the private `:8080` URLs. Routing those
checks through Nginx would prevent exact peer verification and could create a
recursive monitoring design.

## Exposure model

Only `web01:80` is the intended application entry point. Administrative SSH
may be reachable from the Mac host. Backend ports should accept traffic only
from the smallest necessary source set:

- Tomcat `8080`: `web01`, `app01`, and `app02`; optionally the Mac for direct
  diagnostics.
- MySQL `3306`: `app01` and `app02` only, plus a deliberately chosen
  administrative source if required.
- Memcached `11211`: `app01` and `app02` only. Disable UDP unless explicitly
  required; the application uses TCP.
- RabbitMQ `15672` and `5672`: the two Tomcats, plus a deliberately permitted
  administration source for the Management UI.
- NFSv4 `2049`: the two Tomcats only.

The Vagrant private network is still a network boundary. Other local guests,
VPN routes, or host processes may reach it depending on VMware configuration.

## Firewall approach

Inspect effective state before changing it:

```bash
sudo firewall-cmd --state
sudo firewall-cmd --list-all
sudo nft list ruleset
sudo ufw status verbose
```

CentOS Stream guests commonly use firewalld, while the Ubuntu guest may use
UFW. Use the firewall already managed by the guest rather than creating two
competing rule systems. Add narrowly scoped source rules and test them before
making them permanent.

Example firewalld rich rules for MySQL on `db01`:

```bash
sudo firewall-cmd --add-rich-rule='rule family="ipv4" source address="192.168.56.21/32" port protocol="tcp" port="3306" accept'
sudo firewall-cmd --add-rich-rule='rule family="ipv4" source address="192.168.56.22/32" port protocol="tcp" port="3306" accept'
sudo firewall-cmd --runtime-to-permanent
```

Do not use `systemctl disable firewalld`, `ufw disable`, or a blanket trusted
zone as a troubleshooting shortcut. If a test works only after disabling the
firewall, restore it and add the specific missing flow.

## Nginx-to-Tomcat traffic

Nginx uses the two private IPs as equal upstreams. Requests reach Tomcat with
the original `/devops-dashboard/...` path. Forwarded headers describe the
client/proxy path, but their presence is not proof of Nginx health. The backend
uses the dedicated direct-return `http://192.168.56.20/nginx-health` endpoint
for that purpose.

Test each path independently:

```bash
curl -fsS http://192.168.56.22:8080/devops-dashboard/api/instance
curl -fsS http://192.168.56.21:8080/devops-dashboard/api/instance
curl -fsS http://192.168.56.20/devops-dashboard/api/instance
```

## MySQL restrictions

MySQL must listen on an address reachable through the private interface, but
both the firewall and MySQL account host component should restrict access.
Prefer distinct host entries such as `'admin'@'192.168.56.21'` and
`'admin'@'192.168.56.22'` over `'admin'@'%'`.

Inspect without exposing a password on the command line:

```bash
sudo ss -lntp | grep ':3306'
mysql -h 192.168.56.25 -P 3306 -u admin -p -D devops_demo -e 'SELECT 1;'
```

Do not open `3306` to the entire LAN or Internet.

## Memcached connectivity

Memcached does not provide the authentication model expected of an
Internet-facing datastore. Bind it to loopback and/or the lab private address,
restrict source addresses with the firewall, and disable UDP when unused.

```bash
sudo ss -lntp | grep ':11211'
nc -vz 192.168.56.24 11211
```

A successful TCP connection does not validate the read/write path; use the
application cache health endpoint for that check.

## RabbitMQ access

AMQP listens on `5672`; the Management HTTP API normally listens on `15672`.
The application monitoring identity must remain server-side and least
privileged. Avoid exposing the Management UI beyond the lab or placing its
credentials in frontend variables.

```bash
sudo rabbitmq-diagnostics listeners
curl -u devops_monitor http://192.168.56.23:15672/api/health/checks/alarms
```

The `curl` command prompts for the password when `-u` contains only the
username, avoiding a secret in command history.

## NFSv4 traffic

Pure NFSv4 uses TCP `2049`. Restrict the server export and firewall to the two
Tomcat addresses. Confirm the negotiated filesystem and source on each client:

```bash
findmnt -T /mnt/nfs-shared -o TARGET,SOURCE,FSTYPE,OPTIONS
ss -tn | grep '192.168.56.26:2049'
```

NFS mount options influence failure behavior. A hard mount can leave a process
blocked in kernel I/O beyond an application timeout, so firewall and server
availability failures should be tested carefully rather than during active
writes.

## Risk summary

| Exposure | Risk |
|---|---|
| Public Tomcat `8080` | Bypasses the intended Nginx entry point and expands attack surface |
| Public MySQL `3306` | Password attacks and direct data access attempts |
| Public Memcached | Unauthenticated data access and amplification risk if UDP is enabled |
| Public RabbitMQ Management API | Broker metadata and administrative attack surface |
| Public NFS | Remote filesystem exposure |
| Overly broad VM-to-VM rules | Compromise of one guest enables lateral movement |
| Overlapping private subnet | Unpredictable routing and apparent connection failures |

## Related documentation

- [Architecture](architecture.md)
- [Infrastructure](infrastructure.md)
- [Manual deployment](manual-deployment.md)
- [Validation](validation.md)
- [Project README](../README.md)
