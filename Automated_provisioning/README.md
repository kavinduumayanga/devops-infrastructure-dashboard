# Automated provisioning

This directory contains a simple Vagrant and Bash deployment for the complete
seven-VM DevOps Infrastructure Dashboard. It is independent from
`manual_provisioning` and does not provision, halt, destroy, or modify the
manual VMs.

## Topology and memory profiles

| VM | Address | Service | Provisioning RAM | Runtime RAM | CPU |
|---|---:|---|---:|---:|---:|
| `auto-web01` | `192.168.56.30` | Nginx | 768 MiB | 512 MiB | 1 |
| `auto-app01` | `192.168.56.31` | Tomcat 1 | 2,048 MiB | 1,024 MiB | 1 |
| `auto-app02` | `192.168.56.32` | Tomcat 2 | 2,048 MiB | 1,024 MiB | 1 |
| `auto-db01` | `192.168.56.33` | MySQL 8.0 | 1,536 MiB | 1,024 MiB | 1 |
| `auto-mc01` | `192.168.56.34` | Memcached | 1,024 MiB | 512 MiB | 1 |
| `auto-rmq01` | `192.168.56.35` | RabbitMQ 4.2.9 | 1,536 MiB | 768 MiB | 1 |
| `auto-nfs01` | `192.168.56.36` | NFSv4 | 1,024 MiB | 512 MiB | 1 |
| **Total** | | | **9,984 MiB** | **5,376 MiB** | **7** |

Select a profile explicitly when changing or provisioning a VM:

```bash
VM_MEMORY_PROFILE=provisioning vagrant up auto-mc01 --provider=vmware_desktop
VM_MEMORY_PROFILE=runtime vagrant up --provider=vmware_desktop
```

If `VM_MEMORY_PROFILE` is omitted, the Vagrantfile uses `runtime`. The selected
profile remains fixed for that command and never switches automatically.

The provisioning profile must never be used to start all seven VMs: its 9,984
MiB allocation already exceeds the MacBook's 8 GB physical RAM before macOS,
VMware, and the IDE are counted. The 5,376 MiB runtime profile is still tight;
do not run the manual and automated environments simultaneously.

Nginx uses `spox/ubuntu-arm`. The other six VMs use
`bandit145/centos_stream9_arm`. Every machine uses the
`vmware_desktop` provider.

## Prerequisites

- Apple Silicon Mac with VMware Fusion.
- Vagrant 2.3 or newer.
- Vagrant VMware Desktop provider.
- `vagrant-hostmanager` plugin.
- Internet access from the guests.

Install Hostmanager if necessary:

```bash
vagrant plugin install vagrant-hostmanager
```

Hostmanager updates only the automated guests. `manage_host` is disabled, so
the project does not overwrite the Mac's `/etc/hosts` or the manual lab's
hostname mappings.

## Configure secrets

Create the ignored local environment file:

```bash
cd Automated_provisioning
cp .env.example .env
```

Replace all four example passwords in `.env`. Values must be at least 16
characters and use only letters, numbers, or `._@%+=:-`. The file is loaded by
the Vagrantfile, is excluded from Git, and is not synced into the guests.

`APP_GIT_REF` may be a branch, tag, or commit. It defaults to `main`.

Keep the same secret values for reruns. MySQL intentionally does not reset an
existing root or application password. If credentials must be rotated, rotate
them in the service first and then update `.env`.

## Why provisioning ran out of memory

The original Memcached VM had only 384 MiB. DNF dependency resolution and RPM
installation can briefly require substantially more memory than the final
service. Linux therefore selected DNF as an out-of-memory victim and printed
`Killed`. The provisioning profile gives package installation temporary
headroom, while the runtime profile avoids permanently reserving that memory.

Provisioners also limit DNF to one parallel download. Maven is forced to Java
21 and remains bounded to a 384 MiB heap; Node is bounded to 384 MiB. The two
application builds are performed sequentially. Each Tomcat still builds from
the configured GitHub ref, preserving the current deployment configuration.

## Safe first-time provisioning on an 8 GB MacBook

There is no reliable single-command first-time provisioning path using the
9,984 MiB provisioning profile. Do not run
`VM_MEMORY_PROFILE=provisioning vagrant up` without a machine name.

The VMs remain defined in dependency order:

1. MySQL
2. Memcached
3. RabbitMQ
4. NFS
5. Tomcat app01
6. Tomcat app02
7. Nginx

Use the following one-at-a-time process. `--no-provision` first applies the
selected VM memory; the following command runs only that VM's provisioner.

Provision the four independent backend services, halting each after it
finishes:

```bash
VM_MEMORY_PROFILE=provisioning vagrant up auto-db01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-db01
vagrant halt auto-db01

VM_MEMORY_PROFILE=provisioning vagrant up auto-mc01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-mc01
vagrant halt auto-mc01

VM_MEMORY_PROFILE=provisioning vagrant up auto-rmq01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-rmq01
vagrant halt auto-rmq01

VM_MEMORY_PROFILE=provisioning vagrant up auto-nfs01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-nfs01
vagrant halt auto-nfs01
```

Start those dependencies at runtime memory, then build each Tomcat separately.
Do not halt a backend while either Tomcat provisioner is running:

```bash
VM_MEMORY_PROFILE=runtime vagrant up auto-db01 auto-mc01 auto-rmq01 auto-nfs01 \
  --provider=vmware_desktop --no-provision

VM_MEMORY_PROFILE=provisioning vagrant up auto-app01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-app01
vagrant halt auto-app01

VM_MEMORY_PROFILE=provisioning vagrant up auto-app02 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-app02
vagrant halt auto-app02
```

Start both Tomcats at runtime memory, then provision Nginx while every service
it verifies is available:

```bash
VM_MEMORY_PROFILE=runtime vagrant up auto-app01 auto-app02 \
  --provider=vmware_desktop --no-provision

VM_MEMORY_PROFILE=provisioning vagrant up auto-web01 --provider=vmware_desktop --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-web01
vagrant halt auto-web01
VM_MEMORY_PROFILE=runtime vagrant up auto-web01 --provider=vmware_desktop --no-provision
```

After successful installation, the complete environment can be started with:

```bash
VM_MEMORY_PROFILE=runtime vagrant up --provider=vmware_desktop --no-provision
```

A plain runtime-profile `vagrant up` remains available, but first-time package
installation and two builds at runtime memory are not guaranteed to succeed on
this host.

The dashboard is available at:

```text
http://192.168.56.30/devops-dashboard/
```

## What the scripts configure

### MySQL

`scripts/mysql.sh` installs the CentOS Stream 9 MySQL 8.0 package, safely
handles conflicting MariaDB client utilities, and refuses to remove an
existing database directory or MariaDB server. It loads the repository's existing
`db/init.sql` and creates only these application identities:

- `admin@192.168.56.31`
- `admin@192.168.56.32`

They receive `SELECT`, `INSERT`, `UPDATE`, and `DELETE` access to
`devops_demo`. There is no `admin@'%'` account.

The package choice follows the
[RHEL 9 MySQL 8.0 installation guidance](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_using_database_servers/assembly_using-mysql_configuring-and-using-database-servers).

### Memcached

`scripts/memcached.sh` binds Memcached to `192.168.56.34:11211`, allocates 64
MB, disables UDP, and waits for the private address before systemd starts the
service.

### RabbitMQ

`scripts/rabbitmq.sh` installs the signed ARM64 Erlang 27.3.4.18 RPM and the
architecture-independent RabbitMQ 4.2.9 RPM from the official RabbitMQ GitHub
releases. It creates:

- `devops_app` with normal permissions on the `devops` vhost.
- `devops_monitor` with the `monitoring` tag and no administrator tag.

AMQP listens on `5672`; the Management API listens on `15672`.

Package references:

- [RabbitMQ RPM installation guide](https://www.rabbitmq.com/docs/install-rpm)
- [RabbitMQ 4.2 and Erlang compatibility](https://www.rabbitmq.com/docs/4.2/which-erlang)
- [Official Erlang 27.3.4.18 ARM64 RPM release](https://github.com/rabbitmq/erlang-rpm/releases/tag/v27.3.4.18)
- [Official RabbitMQ 4.2.9 release](https://github.com/rabbitmq/rabbitmq-server/releases/tag/v4.2.9)

### NFS

`scripts/nfs.sh` exports `/srv/nfs/shared` only to the two Tomcat addresses with
`rw,sync,root_squash,no_subtree_check`. A shared numeric group permits normal
Tomcat writes without using world-writable permissions.

Both Tomcat VMs persist the mount at `/mnt/nfs-shared` using `_netdev`,
`nofail`, and `x-systemd.automount`.

### Tomcat

Both application VMs use the same `scripts/tomcat.sh`. Vagrant passes each VM
name and its stable application ID as script arguments. The OS/VM identities
are `auto-app01` and `auto-app02`; the existing unmodified Java peer monitor
requires the internal IDs `app01` and `app02`.

Each VM installs Java 21, Maven, Tomcat 10.1, Git, and the NFS client. It clones
the configured GitHub ref, runs `mvn clean package`, and deploys
`devops-dashboard.war` to `/opt/tomcat/webapps`.

Runtime variables are protected in `/etc/sysconfig/tomcat-dashboard`. They
point to the automated MySQL, Memcached, RabbitMQ, Nginx, peer Tomcat, and NFS
addresses.

### Nginx

`scripts/nginx.sh` waits for both Tomcats and configures round-robin upstreams:

```text
192.168.56.31:8080
192.168.56.32:8080
```

It verifies the direct health endpoint and confirms that both application
instances respond through Nginx.

## Firewall policy

- Nginx port 80 is available only from the private `192.168.56.0/24` network.
- Tomcat port 8080 accepts Nginx and the two application addresses.
- MySQL, Memcached, RabbitMQ, and NFS accept their service ports only from the
  two Tomcat addresses.
- SSH remains enabled for Vagrant access.
- SELinux and the system firewalls remain enabled.

## Safe reruns

All scripts use repeatable package installation, configuration replacement,
conditional user creation, and duplicate-safe firewall or fstab changes.
After applying the provisioning profile as described below, rerun only the
machine that needs repair. Examples:

```bash
VM_MEMORY_PROFILE=provisioning vagrant provision auto-db01
VM_MEMORY_PROFILE=provisioning vagrant provision auto-app01
VM_MEMORY_PROFILE=provisioning vagrant provision auto-web01
```

The Tomcat script refuses to overwrite local Git changes. Existing WARs and
exploded deployments are moved to `/var/backups/devops-dashboard` before a
changed artifact is installed.

## Apply a memory profile to an existing VM

Editing the Vagrantfile or changing `VM_MEMORY_PROFILE` does not resize a VM
that is already running. VMware applies `memsize` when Vagrant starts or reloads
the machine.

For a running VM, reload it without provisioning:

```bash
VM_MEMORY_PROFILE=runtime vagrant reload auto-mc01 --no-provision
```

For a halted VM, start it without provisioning:

```bash
VM_MEMORY_PROFILE=runtime vagrant up auto-mc01 --provider=vmware_desktop --no-provision
```

Verify the memory visible inside any guest:

```bash
vagrant ssh auto-mc01 -c 'free -h'
```

Use `provisioning` while DNF or Maven is running, then reload the VM with
`runtime` afterward. Reloading restarts that VM, so do not reload a dependency
while an application provisioner is using it.

## Resume the interrupted Memcached provisioner

The failed DNF transaction does not require destroying the VM. If
`auto-mc01` is currently running, apply its 1,024 MiB provisioning allocation,
rerun its idempotent script, and reduce it to 512 MiB afterward:

```bash
VM_MEMORY_PROFILE=provisioning vagrant reload auto-mc01 --no-provision
VM_MEMORY_PROFILE=provisioning vagrant provision auto-mc01
VM_MEMORY_PROFILE=runtime vagrant reload auto-mc01 --no-provision
```

If it is halted instead, replace the first `reload` with:

```bash
VM_MEMORY_PROFILE=provisioning vagrant up auto-mc01 --provider=vmware_desktop --no-provision
```

DNF safely resumes from the existing package state, and the Memcached script
replaces the desired configuration consistently on each run.

## Verification and troubleshooting

Useful commands:

```bash
vagrant status
curl -fsS http://192.168.56.30/nginx-health
curl -fsS http://192.168.56.30/devops-dashboard/api/infrastructure/health
vagrant ssh auto-web01 -c 'sudo nginx -t'
vagrant ssh auto-app01 -c 'sudo systemctl status tomcat --no-pager'
vagrant ssh auto-db01 -c 'sudo systemctl status mysqld --no-pager'
vagrant ssh auto-mc01 -c 'free -h'
vagrant ssh auto-mc01 -c "sudo journalctl -k -b --no-pager | grep -Ei 'oom|out of memory|killed process'"
vagrant ssh auto-mc01 -c "sudo journalctl -k -b -1 --no-pager | grep -Ei 'oom|out of memory|killed process'"
vagrant ssh auto-mc01 -c 'sudo journalctl -u memcached -b --no-pager'
```

`free -h` confirms the guest's current allocation. The kernel journal confirms
whether the OOM killer terminated DNF or Maven; a bare `Killed` line alone does
not identify the cause. Use `-b` for the current boot and `-b -1` after a
reload to inspect the preceding boot. If either process is killed, close
memory-heavy host applications, confirm the failed VM is using the
provisioning profile, and rerun only its provisioner. The scripts deliberately
avoid broad operating-system upgrades.

If an IP is already in use, resolve the VMware host-only network or DHCP
conflict before retrying. This simplified project intentionally relies on
normal Vagrant/provider errors instead of custom preflight triggers.

## Known limits

The runtime profile reserves 5,376 MiB for guests. macOS, VMware Fusion, the
IDE, browser, and VM graphics/device overhead still consume memory outside that
figure, so host memory pressure remains possible on an 8 GB MacBook. Do not run
the manual seven-VM environment at the same time. Provision one high-memory VM
at a time, keep only its required dependencies running, and use the runtime
profile after provisioning.

Static validation can verify the configuration and calculated allocations, but
it cannot guarantee successful provisioning under every host workload. Check
macOS memory pressure and the guest's `free -h` output if failures persist.

## Directory layout

```text
Automated_provisioning/
├── Vagrantfile
├── scripts/
│   ├── nginx.sh
│   ├── tomcat.sh
│   ├── mysql.sh
│   ├── memcached.sh
│   ├── rabbitmq.sh
│   └── nfs.sh
├── .env.example
├── .gitignore
└── README.md
```
