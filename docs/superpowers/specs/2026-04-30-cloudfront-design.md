# CloudFront in Front of EC2 — Design Spec

**Date:** 2026-04-30  
**Status:** Approved

## Goal

Replace direct EC2 IP access with a CloudFront distribution that provides free HTTPS (`*.cloudfront.net`), CDN caching for static assets, and DDoS protection — without changing any application code.

## Current State

```
Internet → EC2:80 (0.0.0.0/0) → Nginx → 127.0.0.1:5000 (Go server in Docker)
```

- No HTTPS
- EC2 public IP exposed directly to the internet
- Security group: port 80 open to `0.0.0.0/0`

## Target Architecture

```
Users (HTTPS)
     │
     ▼
CloudFront (https://dxxxxx.cloudfront.net)
  - AWS-managed TLS cert (free)
  - CDN edge caching for static assets
  - HTTP → HTTPS redirect
     │ HTTP port 80
     ▼
EC2 Security Group
  - Port 80: CloudFront prefix list only (com.amazonaws.global.cloudfront.origin-facing)
  - Port 22: 0.0.0.0/0 (SSH, unchanged)
     │
     ▼
Nginx (port 80) → Go server (127.0.0.1:5000)
```

CloudFront terminates TLS. EC2 receives plain HTTP from CloudFront IPs only. No cert needed on the origin.

## Cache Behaviours

| Path Pattern | Cache Policy     | Notes                                      |
|--------------|------------------|--------------------------------------------|
| `/api/*`     | No cache         | Dynamic API responses (RSVP, messages)     |
| `/auth/*`    | No cache         | Session-sensitive auth routes              |
| `/storage/*` | No cache         | Pass-through to Supabase/GCS object storage|
| `/*`         | Cache (default)  | Vite-built static assets (JS, CSS, images) |

CloudFront evaluates path patterns in order; the default `/*` is the catch-all fallback.

Static asset caching is safe because Vite produces content-hashed filenames — the hash changes when file content changes, so stale cache is never served.

For no-cache behaviours, all headers and cookies are forwarded to preserve session/CSRF behaviour.

## Origin Lock-Down

Security group port 80 rule is changed from `0.0.0.0/0` to the AWS-managed prefix list `com.amazonaws.global.cloudfront.origin-facing`. AWS maintains this list automatically; no manual IP updates are needed when CloudFront rotates IPs.

After this change:
- `https://dxxxxx.cloudfront.net` → works
- `http://<ec2-ip>` → connection refused

## Config Changes on EC2

**`.env.production`** — update `CORS_ORIGINS`:
```bash
CORS_ORIGINS=https://dxxxxx.cloudfront.net
```

Cookie settings (`Secure=true`, `SameSite=None`) are already correct for CloudFront → EC2 traffic and require no changes.

## Implementation Sequence

Order is designed so the site stays live throughout — verify CloudFront works **before** locking down the security group.

1. **Create CloudFront distribution**
   - Origin domain: EC2 public IP, protocol HTTP, port 80
   - Add cache behaviours for `/api/*`, `/auth/*`, `/storage/*` (no cache, forward all headers + cookies)
   - Default behaviour: cache static assets, viewer protocol = redirect HTTP → HTTPS

2. **Verify CloudFront before locking EC2**
   - Load `https://dxxxxx.cloudfront.net` — confirm site renders
   - Submit a test RSVP (API route)
   - Log in to admin (auth route)

3. **Lock EC2 security group**
   - Edit port 80 inbound rule: `0.0.0.0/0` → `com.amazonaws.global.cloudfront.origin-facing`
   - Confirm site works via CloudFront URL
   - Confirm `http://<ec2-ip>` is now blocked

4. **Update CORS_ORIGINS on EC2**
   - SSH in, edit `.env.production`, set `CORS_ORIGINS` to CloudFront domain
   - `docker compose --env-file .env.production -f docker-compose.prod.yml restart app`

5. **Smoke test end-to-end**
   - RSVP submission, admin login, image loading, invite sending

## Out of Scope

- Custom domain (requires Route 53 or external DNS + ACM cert — separate concern)
- WAF rules (can be added to CloudFront later)
- HTTPS between CloudFront and EC2 origin (not needed; traffic is internal to AWS network)
