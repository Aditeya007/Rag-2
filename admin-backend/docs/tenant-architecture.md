# Tenant Isolation Architecture

This document explains how the platform isolates user data across the Admin Backend (Node.js), the FastAPI chatbot service, and downstream scraping/scheduling components.

## Overview

Each registered user is provisioned with a dedicated resource ID and unique endpoints. These identifiers allow every subsystem to route requests, store data, and run background jobs in a tenant-safe context.

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│ Admin Frontend│──JWT│ Admin Backend    │──┬──▶│ Scheduler/Scraper    │
└──────────────┘      │  (Express)       │  │   └─────────────────────┘
                      │                  │  │
                      │                  │  └──▶ FastAPI Chatbot
                      └──────────────────┘
```

Key goals:

- **Data Isolation:** No tenant can read or influence another tenant's documents, embeddings, or jobs.
- **Operational Independence:** Scraping and chatbot workloads scale independently per tenant.
- **Administrator Visibility:** Admins retain the ability to inspect tenant metadata and intervene when needed.

## Provisioned Resources

When a user is created, the provisioning service generates the following entries:

| Property            | Description                                               | Example                                                    |
|---------------------|-----------------------------------------------------------|------------------------------------------------------------|
| `resourceId`        | Deterministic unique slug-hash used across all services.  | `acme-inc-1a2b3c4d5e`                                      |
| `databaseUri`       | MongoDB URI or database name dedicated to the tenant.     | `mongodb://cluster/rag_acme-inc_c4d5e`                     |
| `botEndpoint`       | FastAPI route used for chatbot requests.                  | `https://bot.svc/api/bots/acme-inc-1a2b3c4d5e`            |
| `schedulerEndpoint` | Job scheduler endpoint for scraping/sync tasks.          | `https://scheduler.svc/api/schedules/acme-inc-1a2b3c4d5e` |
| `scraperEndpoint`   | Scraper orchestration endpoint.                           | `https://scraper.svc/api/scrape/acme-inc-1a2b3c4d5e`      |
| `vectorStorePath`   | Filesystem path for tenant parquets/Chroma collections.   | `/mnt/vector/acme-inc-1a2b3c4d5e`                          |

The provisioner respects environment overrides so stage/prod deployments can target dedicated clusters.

## Admin Backend Responsibilities

- **JWT Claims:** Tokens include `userId`, `username`, `email`, and `role`. Controllers fetch the rest of the tenant metadata at request time.
- **Tenant Context Cache:** `getUserTenantContext` caches database/endpoint metadata with a configurable TTL. Cache invalidation happens after profile updates or admin actions.
- **Bot Requests:** `/api/bot/run` resolves the tenant context and forwards `user_id`, `resource_id`, `database_uri`, and `vector_store_path` headers/body to the FastAPI service. The fallback to `FASTAPI_BOT_URL` is preserved for bootstrap environments.

## FastAPI Chatbot Service

- **Tenant Manager:** A new `TenantChatbotManager` lazily creates `SemanticIntelligentRAG` instances per tenant. Each instance uses the provided vector store directory and database URI.
- **Request Metadata:** `/chat`, `/contact-info`, and lead endpoints now accept query/body parameters for tenant routing. Failure to supply them returns `400`/`503` errors.
- **Resource Cleanup:** On shutdown, all active instances close their Mongo connections.

## Security Considerations

- Tenant metadata never reveals internal filesystem paths to non-admin clients.
- Admin-only views can query `vectorStorePath` for diagnostics.
- Ensure the filesystem path shared with FastAPI has correct permissions and is isolated per tenant (e.g., via prefix directories or containers).
- Future enhancements should include per-tenant API keys for inter-service calls and audit logging for admin operations.

## Future Work

1. **Scheduler Isolation:** Update job runners to accept `resourceId` and target the tenant-specific database/queue.
2. **Ingress Filtering:** Require HMAC-signed headers between services to prevent spoofed tenant metadata.
3. **Automated Cleanup:** Introduce scripts to archive or delete tenant resources when accounts are removed or suspended.
4. **Observability:** Instrument metrics by `resourceId` (latency, error rates, storage usage) for proactive scaling.
