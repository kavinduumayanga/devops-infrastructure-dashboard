# Infrastructure

The lab uses seven ARM Linux virtual machines declared in
[`manual_provisioning/Vagrantfile`](../manual_provisioning/Vagrantfile). Vagrant
manages VM definitions and hostnames; VMware Fusion provides the
`vmware_desktop` provider on the Apple Silicon host.

## VM specification

| VM | Vagrant box | Private IP | Allocation | Responsibility | Relevant ports |
|---|---|---|---|---|---|
| `web01` | `spox/ubuntu-arm` | `192.168.56.20` | 512 MiB, 1 vCPU | Nginx reverse proxy, round-robin load balancer, direct health endpoint | `80/tcp` |
| `app02` | `bandit145/centos_stream9_arm` | `192.168.56.21` | 1,024 MiB, 1 vCPU | Tomcat 10.1 and the Java/React WAR | `8080/tcp` |
| `app01` | `bandit145/centos_stream9_arm` | `192.168.56.22` | 1,024 MiB, 1 vCPU | Tomcat 10.1 and the Java/React WAR | `8080/tcp` |
| `rmq01` | `bandit145/centos_stream9_arm` | `192.168.56.23` | 768 MiB, 1 vCPU | RabbitMQ 4.2.9 broker and Management API | `5672`, `15672/tcp` |
| `mc01` | `bandit145/centos_stream9_arm` | `192.168.56.24` | 1,024 MiB, 1 vCPU | Memcached 1.6.9 shared cache | `11211/tcp` |
| `db01` | `bandit145/centos_stream9_arm` | `192.168.56.25` | 768 MiB, 1 vCPU | MySQL 8.0.46 and `devops_demo` | `3306/tcp` |
| `nfs01` | `bandit145/centos_stream9_arm` | `192.168.56.26` | 1,024 MiB, 1 vCPU | NFSv4 export `192.168.56.26:/srv/nfs/shared` | `2049/tcp` |

The `centos_stream9_arm` box name establishes CentOS Stream 9 ARM for six
guests. The repository identifies `web01` only through the `spox/ubuntu-arm`
box name; it does not pin or prove a specific Ubuntu release, so none is claimed
here.

## Hostname management and private networking

The Vagrantfile enables the hostmanager plugin:

```ruby
config.hostmanager.enabled = true
config.hostmanager.manage_host = true
config.hostmanager.manage_guest = true
```

Each VM receives a static address on `192.168.56.0/24`. The application
configuration and topology inventory use these IPs, while hostmanager makes the
short hostnames convenient for administration. Verify the effective routes and
addresses after provisioning; the static lab subnet must not overlap another
local VPN or network.

## Vagrant and VMware Fusion workflow

Install Vagrant, VMware Fusion, the compatible Vagrant VMware provider, and the
hostmanager plugin before bringing up the lab. Provider licensing and exact
installation commands vary by the local Vagrant/VMware versions and are not
pinned in this repository.

From the repository root:

```bash
cd manual_provisioning
vagrant validate
vagrant status
vagrant up web01
vagrant up db01
```

Bring up guests individually when host memory is constrained. Inspect a guest
with:

```bash
vagrant ssh app01
vagrant ssh-config app01
```

The Vagrantfile defines hardware, hostnames, and private addresses. It does not
contain automated service provisioning, so Nginx, Tomcat, MySQL, Memcached,
RabbitMQ, NFS, firewall rules, mounts, and environment variables must be
configured manually.

## Resource budget on an 8 GB Mac

The verified VM allocations total:

- 6,144 MiB guest RAM.
- Seven virtual CPUs, one assigned to each VM.

The 6 GiB guest total does not include macOS, VMware Fusion overhead, Vagrant,
the IDE, browsers, filesystem cache, or build processes. Running all guests and
a Maven/Node build simultaneously can place an 8 GB host under heavy memory
pressure. Guest allocations are maximum configured values, not a promise that
the host can run every workload comfortably at once.

Practical measures:

- Start and provision one or two VMs at a time.
- Stop unused GUI applications during large package transactions or Maven
  builds.
- Use modest JVM heap settings on Tomcat and Maven.
- Check host pressure and guest `free -h` output before treating an OOM event as
  a package-manager defect.
- Avoid lowering security settings merely to save resources.
- Suspend or halt unused VMs instead of overcommitting the host indefinitely.

Useful commands:

```bash
vagrant status
vagrant halt rmq01
vagrant halt nfs01
free -h
ps -eo pid,comm,%mem,rss --sort=-rss | head
```

## Service responsibilities

### `web01`

Accepts browser traffic, serves as the single lab entry point, and distributes
requests to the two Tomcat servers. `/nginx-health` must return directly from
Nginx rather than proxying to the application.

### `app01` and `app02`

Run identical copies of `devops-dashboard.war`. They use the same database,
cache, RabbitMQ monitoring identity, and NFS expectations. Only
`APP_INSTANCE_ID` differs. Each instance maintains its own bounded monitoring
snapshot cache.

### `db01`

Stores the `devops_demo` schema and sample `demo_records`. Application database
users should be restricted to the two Tomcat source IPs and the required schema
permissions.

### `mc01`

Provides the shared ephemeral cache. Data loss on restart is expected; MySQL is
the durable source for the cache demo.

### `rmq01`

Runs AMQP and the Management API. In this repository RabbitMQ is monitored, but
it is not used for application message publishing or consumption.

### `nfs01`

Exports `/srv/nfs/shared`. The Tomcat hosts mount it at `/mnt/nfs-shared` for
health verification. The application does not manage mounts or arbitrary files.

## Related documentation

- [Architecture](architecture.md)
- [Networking](networking.md)
- [Manual deployment](manual-deployment.md)
- [Troubleshooting](troubleshooting.md)
- [Project README](../README.md)
