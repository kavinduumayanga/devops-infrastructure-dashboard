# DevOps Infrastructure Dashboard

A production-quality Java web application demonstrating multi-tier infrastructure deployment with Nginx load balancing, Apache Tomcat application servers, MySQL database, and Memcached caching.

![Java 21](https://img.shields.io/badge/Java-21-blue)
![Jakarta Servlet](https://img.shields.io/badge/Jakarta_Servlet-6.0-green)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6)

## Architecture

```
                  USERS
                    |
              NGINX SERVER
           Reverse Proxy + LB
                Port 80
                    |
           Round Robin Routing
                    |
          +---------+---------+
          |                   |
       TOMCAT 1            TOMCAT 2
        app01                app02
       Port 8080            Port 8080
          |                   |
          +---------+---------+
                    |
             SHARED SERVICES
                    |
        +-----------+-----------+
        |                       |
      MySQL                 Memcached
     Database                 Cache
```

## Features

- **Real-time Instance Identification** — Displays which Tomcat instance served each request
- **Load Balancing Demonstration** — Send test requests to visualize Nginx round-robin distribution
- **MySQL Integration** — Full CRUD operations with HikariCP connection pooling
- **Memcached Cache-Aside Pattern** — Demonstrates cache hit/miss with real timing
- **Professional Dashboard UI** — Dark-themed, Grafana-inspired monitoring interface
- **Infrastructure Topology** — Interactive SVG visualization of the deployment architecture
- **Request Activity Tracking** — Client-observed metrics with charts and history

## Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Java | 21 | Runtime |
| Jakarta Servlet API | 6.0 | Web framework |
| Maven | 3.9+ | Build tool |
| HikariCP | 5.1.0 | JDBC connection pooling |
| MySQL Connector/J | 8.4.0 | Database driver |
| spymemcached | 2.12.3 | Memcached client |
| Jackson | 2.17.2 | JSON serialization |
| SLF4J + Logback | 2.0.13 / 1.5.6 | Logging |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.5 | Type safety |
| Vite | 6.4 | Build tool |
| Tailwind CSS | 3.4 | Styling |
| Recharts | 2.12 | Charts |
| Lucide React | 0.441 | Icons |
| Vitest + Testing Library | 4.1 / 16 | Frontend component tests |

## Quick Start

### Prerequisites

- Java 21 JDK
- Maven 3.9+
- Node.js 20+ (for frontend build only)
- MySQL 8.0+
- Memcached 1.6+

### 1. Start Services (Native / Bare-Metal)

This project runs directly on bare-metal systems, VMs, or local development machines without Docker.

**On macOS (Homebrew):**
```bash
brew install mysql memcached
brew services start mysql
brew services start memcached
```

**On Ubuntu / Debian Linux:**
```bash
sudo apt update
sudo apt install -y mysql-server memcached
sudo systemctl start mysql memcached
```

*(Note: The dashboard operates gracefully even if MySQL or Memcached are not yet running, cleanly reporting their DOWN status.)*

### 2. Initialize Database

```bash
mysql -u root -p < db/init.sql
```

### 3. Build the Application

The Maven build installs the configured Node.js toolchain, builds the React
frontend, and packages the frontend assets with the WAR:

```bash
mvn clean verify
```

The WAR file will be at: `target/devops-dashboard.war`

### 4. Run / Deploy the Application

**Option A: One-Command Run via Maven (No manual Tomcat installation needed)**
```bash
mvn package cargo:run
```
This automatically boots Apache Tomcat 10 on port 8080 and mounts the application at `http://localhost:8080/`.

**Option B: Deploy to Standalone Apache Tomcat**
Copy the WAR to your Tomcat's `webapps` directory:
```bash
cp target/devops-dashboard.war $CATALINA_HOME/webapps/
```

### 5. Configure Environment

Set environment variables for Tomcat. Create `$CATALINA_HOME/bin/setenv.sh`:

```bash
#!/bin/bash

# Application
export APP_ENV=production
export APP_INSTANCE_ID=$(hostname)

# MySQL
export DB_HOST=your-mysql-host
export DB_PORT=3306
export DB_NAME=devops_demo
export DB_USER=devops_user
export DB_PASSWORD=your_secure_password

# Memcached
export MEMCACHED_HOST=your-memcached-host
export MEMCACHED_PORT=11211
export CACHE_TTL_SECONDS=60
```

Tomcat does not load `.env` files automatically. Use `.env.example` as a
reference, but configure environment variables through `setenv.sh`, the
service manager, or your deployment platform. Leave `APP_INSTANCE_ID`
unset to use the dynamically detected hostname, or assign a unique value
per Tomcat instance.

### 6. Access the Dashboard

```
http://localhost:8080/devops-dashboard/
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `development` | Environment label |
| `APP_INSTANCE_ID` | hostname | Instance identifier |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `devops_demo` | Database name |
| `DB_USER` | `devops_user` | Database username |
| `DB_PASSWORD` | *(empty)* | Database password |
| `DB_POOL_SIZE` | `5` | HikariCP pool size |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Connection timeout |
| `MEMCACHED_HOST` | `localhost` | Memcached host |
| `MEMCACHED_PORT` | `11211` | Memcached port |
| `CACHE_TTL_SECONDS` | `60` | Cache TTL |
| `CACHE_OPERATION_TIMEOUT_MS` | `3000` | Cache operation timeout |

## Deploying to Two Tomcat Servers

### Deployment Steps

1. Build the WAR once:
   ```bash
   mvn clean package
   ```

2. Copy the **same WAR** to both servers:
   ```bash
   scp target/devops-dashboard.war app01:/opt/tomcat/webapps/
   scp target/devops-dashboard.war app02:/opt/tomcat/webapps/
   ```

3. Configure each server's `setenv.sh` with appropriate `APP_INSTANCE_ID`:

   **app01:**
   ```bash
   export APP_INSTANCE_ID=app01
   ```

   **app02:**
   ```bash
   export APP_INSTANCE_ID=app02
   ```

4. Both servers must point to the **same MySQL** and **same Memcached** instance.

5. Configure Nginx for round-robin load balancing:

   ```nginx
   upstream tomcat_backend {
       server app01:8080;
       server app02:8080;
   }

   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://tomcat_backend/devops-dashboard/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/instance` | Instance identification |
| `GET` | `/api/system` | System information |
| `GET` | `/api/database/health` | Database health check |
| `GET` | `/api/records` | List demo records |
| `POST` | `/api/records` | Create a record |
| `DELETE` | `/api/records/{id}` | Delete a record |
| `GET` | `/api/cache/health` | Cache health check |
| `GET` | `/api/cache/demo` | Cache-aside demo |
| `DELETE` | `/api/cache/demo` | Clear demo cache |
| `GET` | `/api/cache/stats` | Cache statistics |

`GET /api/cache/demo` reports `HIT`, `MISS`, or `UNAVAILABLE` based on the
actual cache lookup. If Memcached is unavailable, the data is served from
MySQL and the response does not mislabel that fallback as a cache miss. If
MySQL is also unavailable, the endpoint returns an error instead of empty
success-shaped data. Cache-demo hit/miss charts are observed by the current
browser session; Memcached server statistics are labeled separately.

All API responses include:
- `X-App-Instance` header identifying the serving instance
- `X-Request-Id` header for request tracking
- `Cache-Control: no-store` to avoid stale load-balancer samples

## Dashboard Pages

1. **Overview** — Service status cards + infrastructure topology
2. **Application Servers** — Instance info + load balancing test
3. **Database** — MySQL health + CRUD records table
4. **Cache** — Cache-aside demo + hit/miss charts
5. **Request Activity** — Request history + latency charts
6. **System Information** — JVM, OS, memory details

## Running Tests

```bash
mvn test
npm --prefix src/main/frontend test
```

The Maven `verify` lifecycle runs both the frontend component tests and Java
unit tests. Tests include:
- Instance service (identity, system info, security redaction)
- Validation utility (sanitization, field validation, ID parsing)
- JSON serialization (Instant handling, null exclusion, API responses)
- Cache demo service (hit, miss, fallback, invalidation)
- Frontend loading and service status, API failures, cache actions, database CRUD, and request activity

## Development

### Frontend Development (hot-reload)

```bash
cd src/main/frontend
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8080/devops-dashboard`.

### Project Structure

```
devops-infrastructure-dashboard/
├── pom.xml
├── db/init.sql
├── .env.example
├── src/main/
│   ├── java/com/devops/dashboard/
│   │   ├── api/            # Servlet endpoints
│   │   ├── cache/          # Memcached service
│   │   ├── config/         # Configuration & lifecycle
│   │   ├── dto/            # API response DTOs
│   │   ├── filter/         # Request filters (CORS, logging)
│   │   ├── model/          # Data models
│   │   ├── repository/     # JDBC repositories
│   │   ├── service/        # Business logic
│   │   └── util/           # JSON, validation utilities
│   ├── frontend/           # React + TypeScript + Vite
│   │   └── src/
│   │       ├── components/ # UI components
│   │       ├── pages/      # Page views
│   │       ├── api.ts      # API client
│   │       └── types.ts    # TypeScript types
│   ├── resources/
│   │   └── logback.xml     # Logging configuration
│   └── webapp/
│       └── WEB-INF/web.xml
└── src/test/java/          # Unit tests
```

## Security Notes

> **⚠️ Lab Environment Only**
>
> This application exposes database write/delete and cache-clear operations
> without authentication. Deploy only on trusted lab networks until
> authentication and access controls are added.

- SQL injection prevented via prepared statements
- HTML input sanitized before storage
- No credentials exposed in API responses or logs
- Java home path redacted in system info
- CORS restricted in production mode
- Connection pool and cache timeouts configured
- `npm audit` reports remaining Tailwind 3 build-tool advisories; its available fix requires a Tailwind 4 migration. The WAR serves compiled assets and does not bundle Node.js dependencies.

## Troubleshooting

| Issue | Solution |
|---|---|
| Database connection refused | Check MySQL is running and `DB_HOST`/`DB_PORT` are correct |
| Memcached unavailable | Cache operations gracefully fall back to MySQL |
| Frontend 404 | Run `mvn clean verify` to build and package the frontend assets |
| Same instance on every request | Nginx may not be configured; direct Tomcat access always shows one instance |
| Environment variables not loaded | Create `setenv.sh` in Tomcat's `bin/` directory |

## License

This project is intended for DevOps learning and portfolio demonstration.
