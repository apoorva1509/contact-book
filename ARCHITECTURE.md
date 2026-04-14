# Architecture: Web-Scale Contact Book

This document describes the architectural changes needed to deploy the Contact Book as a production web application serving thousands of concurrent users.

## Current Architecture (Local)

```
+----------+    +----------+    +------------+
| Next.js  |--->| FastAPI   |--->| PostgreSQL |
| :3000    |    | :8000     |    | :5432      |
+----------+    +----------+    +------------+
     Docker Compose (single host)
```

## Production Architecture

```
                    +-------------+
                    |   CDN       |
                    | CloudFront  |
                    +------+------+
                           |
                    +------v------+
                    | Load        |
                    | Balancer    |
                    | (ALB/NLB)   |
                    +------+------+
                           |
              +------------+------------+
              |            |            |
       +------v--+  +------v--+  +------v--+
       | API Pod |  | API Pod |  | API Pod |
       | FastAPI |  | FastAPI |  | FastAPI |
       +----+----+  +----+----+  +----+----+
            |             |            |
            +---------+---+------------+
                      |
              +-------v-------+
              |  PgBouncer    |
              |  Connection   |
              |  Pool         |
              +-------+-------+
                      |
         +------------+------------+
         |                         |
  +------v------+          +------v------+
  | PostgreSQL  |          | PostgreSQL  |
  | Primary     |--------->| Read        |
  | (writes)    | streaming| Replica     |
  +------+------+ replica  +-------------+
         |
  +------v------+          +-------------+
  | Redis       |          | Elasticsearch|
  | Cache       |          | Search      |
  +-------------+          +-------------+
```

## 1. Authentication & Authorization

### Current State
No authentication - single-user local application.

### Production Design

**JWT + OAuth2 flow:**
- Users authenticate via OAuth2 providers (Google, GitHub) or email/password
- Server issues short-lived JWT access tokens (15 min) and long-lived refresh tokens (7 days)
- Refresh tokens stored in HttpOnly cookies; access tokens in memory
- Each API request includes `Authorization: Bearer <token>` header

**Implementation:**
- FastAPI middleware validates JWT on every request
- User model with `id`, `email`, `password_hash`, `oauth_provider`, `oauth_id`
- Role-based access: `admin` (manage all users), `user` (manage own contacts)
- Rate limiting per user identity, not just IP

**Libraries:** `python-jose` for JWT, `passlib` for password hashing, `authlib` for OAuth2

## 2. Multi-Tenancy

### Data Isolation

**Row-Level Security (RLS):**
- Add `user_id` foreign key to `contacts` table
- PostgreSQL RLS policies ensure users can only query their own contacts
- API middleware sets `current_user_id` session variable for RLS enforcement

```sql
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_isolation ON contacts
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

**Benefits:** Single database, no schema duplication, transparent to application code.

### Scaling Path
For enterprise (10k+ users per tenant), consider schema-per-tenant or database-per-tenant for stronger isolation and independent scaling.

## 3. Rate Limiting

### API Gateway Level
- **Token bucket algorithm** at the load balancer (e.g., AWS WAF, Kong, nginx)
- Limits: 100 requests/minute per authenticated user, 20 requests/minute for unauthenticated
- Separate limits for write operations (20/min) vs read operations (100/min)

### Application Level
- FastAPI middleware with Redis-backed rate limiter (`slowapi`)
- Endpoint-specific limits: search (30/min), merge (10/min), bulk operations (5/min)

### Response
- Return `429 Too Many Requests` with `Retry-After` header
- Include rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 4. Caching Layer

### Redis Cache Strategy

**Cached data:**
- Individual contact lookups: `contact:{id}` - TTL 5 min
- Contact list for user: `user:{id}:contacts:page:{n}` - TTL 2 min
- Stats: `user:{id}:stats` - TTL 1 min
- Search results: `search:{user_id}:{hash(query)}` - TTL 1 min

**Invalidation:**
- Write-through: invalidate relevant cache keys on create/update/delete
- Pattern-based invalidation: `SCAN` for `user:{id}:*` on contact changes
- Stats cache invalidated on any write operation

**Cache aside pattern:**
1. Check Redis for cached result
2. On miss, query PostgreSQL
3. Store result in Redis with TTL
4. Return result

## 5. Search at Scale

### Current: pg_trgm
Works well up to ~100k contacts. Trigram indexes handle fuzzy name matching with acceptable latency.

### Production: Elasticsearch

**When to migrate:** When search latency exceeds 200ms or contact count exceeds 500k per tenant.

**Architecture:**
- Elasticsearch cluster (3 nodes minimum) with dedicated search indices per tenant
- Async indexing via message queue (RabbitMQ/SQS): contact changes publish events, a worker consumes and updates ES
- API search endpoint queries ES instead of PostgreSQL
- Fallback to PostgreSQL if ES is unavailable

**Features unlocked:**
- Full-text search across all fields simultaneously
- Phonetic matching (Soundex/Metaphone) for name search
- Autocomplete suggestions
- Search result highlighting
- Relevance scoring tuning

## 6. Database Scaling

### Connection Pooling
- **PgBouncer** in front of PostgreSQL in transaction mode
- Pool size: 20 connections per API pod, max 100 total connections
- Eliminates connection overhead for short-lived async requests

### Read Replicas
- Streaming replication to 1-2 read replicas
- Route read-heavy queries (search, list, stats, duplicates) to replicas
- Write queries (create, update, delete, merge) to primary
- SQLAlchemy `bind` configuration for read/write splitting

### Partitioning
- Range partition `contacts` table by `created_at` (monthly partitions)
- Or hash partition by `user_id` for even distribution across partitions
- Enables efficient data archival and per-partition maintenance

### Backup
- Continuous WAL archiving to S3
- Daily base backups with point-in-time recovery
- Cross-region replication for disaster recovery

## 7. Frontend Deployment

### Static Export
- Next.js static export (`next build && next export`) to S3/CloudFront
- CDN edge caching for global low-latency access
- Cache-busting via content hashing in filenames

### Alternatively: Vercel
- Deploy to Vercel for automatic edge network, preview deployments, and zero-config
- Environment variables for API URL per environment (staging/production)

### Performance
- Code splitting per route (automatic with Next.js App Router)
- Image optimization (if contact avatars are added later)
- Service worker for offline access to cached contact list

## 8. Container Orchestration (Kubernetes)

### Deployment
```yaml
# API Deployment
replicas: 3
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits: { cpu: 500m, memory: 512Mi }
strategy:
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Horizontal Pod Autoscaler
- Scale API pods on CPU utilization (target: 70%) and request latency (target: 200ms p95)
- Min replicas: 2, Max replicas: 10

### Health Checks
- Liveness probe: `GET /health` - restarts pod on failure
- Readiness probe: `GET /health` with DB connectivity check - removes from load balancer if unhealthy
- Startup probe: 30s timeout for initial DB connection and migration

### Namespaces
- `production`, `staging`, `development` namespaces with resource quotas
- Network policies restricting cross-namespace traffic

## 9. CI/CD Pipeline

### GitHub Actions Workflow

```
Push to main
  |-- Lint (ruff, eslint)
  |-- Type Check (mypy, tsc)
  |-- Unit Tests (pytest, jest)
  |-- Integration Tests (testcontainers + PostgreSQL)
  |-- Build Docker Images
  |-- Push to ECR
  |-- Deploy to Staging
  |-- Run E2E Tests (Playwright)
  +-- Promote to Production (manual approval)
```

### Feature Branch Flow
- PR created -> lint + test + build
- Passing checks required for merge
- Preview deployments for frontend (Vercel/Netlify)
- Database migration dry-run on staging

### Release Strategy
- Semantic versioning with automated changelog
- Blue-green deployments: new version runs alongside old, traffic switched after health check
- Instant rollback: revert to previous container image tag

## 10. Observability

### Structured Logging
- JSON log format with correlation IDs
- Log levels: DEBUG (dev), INFO (staging), WARN (production)
- Log aggregation: ELK stack (Elasticsearch, Logstash, Kibana) or Datadog
- Request/response logging with PII redaction (mask phone numbers, emails in logs)

### Metrics (Prometheus + Grafana)
- **API metrics:** request count, latency (p50/p95/p99), error rate per endpoint
- **Business metrics:** contacts created/day, merges/day, duplicate detection rate
- **Infrastructure:** CPU, memory, disk, network per pod
- **Database:** query latency, connection pool usage, replication lag

### Distributed Tracing (OpenTelemetry)
- Trace requests across API -> database -> cache -> search
- Identify slow queries and bottlenecks
- Jaeger or Tempo as trace backend

### Alerting
- PagerDuty integration for critical alerts
- Alert conditions: error rate > 5%, p99 latency > 2s, replication lag > 30s
- Runbooks linked to each alert for fast incident response

## 11. Security Hardening

- **HTTPS everywhere** - TLS 1.3 termination at load balancer
- **CORS** - restrict to known frontend domains
- **Input validation** - Pydantic models with strict type checking (already in place)
- **SQL injection** - SQLAlchemy parameterized queries (already in place)
- **Dependency scanning** - Dependabot + Snyk for vulnerability detection
- **Secrets management** - AWS Secrets Manager or HashiCorp Vault, never in env vars or code
- **Audit logging** - log all data modifications with user ID, timestamp, before/after values
