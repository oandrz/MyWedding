# CloudFront Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put CloudFront in front of the EC2 origin so the site is served over HTTPS at a `*.cloudfront.net` URL, with static assets cached at the edge and the EC2 locked down to CloudFront-only traffic.

**Architecture:** CloudFront distribution with EC2 public IP as HTTP origin. Three no-cache behaviours (`/api/*`, `/auth/*`, `/storage/*`) forward all headers/cookies to the origin unchanged. The default behaviour caches Vite static assets. EC2 security group port 80 is restricted to the AWS-managed CloudFront prefix list.

**Tech Stack:** AWS CloudFront, EC2 Security Groups, Nginx (unchanged), Docker Compose (unchanged)

---

## Before You Start

You will need:
- Access to the AWS Console (same account where the EC2 lives)
- The EC2 **public IP address** (find it: EC2 → Instances → your instance → Public IPv4 address)
- SSH access to the EC2

Keep a terminal SSH session open to EC2 throughout — you may need it to debug.

---

### Task 1: Create the CloudFront Distribution

**Files:**
- No files changed — AWS Console only

- [ ] **Step 1: Open CloudFront in AWS Console**

  Go to: https://console.aws.amazon.com/cloudfront/  
  Click **"Create distribution"**

- [ ] **Step 2: Configure the origin**

  Under **Origin**:
  | Field | Value |
  |-------|-------|
  | Origin domain | Your EC2 public IP (e.g. `13.55.xxx.xxx`) — type it manually, do NOT pick from the dropdown |
  | Protocol | HTTP only |
  | HTTP port | 80 |
  | Name | `ec2-wedding-origin` (auto-filled, leave it) |

- [ ] **Step 3: Configure the default cache behaviour (static assets)**

  Under **Default cache behaviour**:
  | Field | Value |
  |-------|-------|
  | Viewer protocol policy | **Redirect HTTP to HTTPS** |
  | Allowed HTTP methods | GET, HEAD |
  | Cache policy | **CachingOptimized** (select from dropdown) |
  | Origin request policy | **CORS-S3Origin** |

- [ ] **Step 4: Configure Web Application Firewall**

  Under **Web Application Firewall (WAF)**:  
  Select **"Do not enable security protections"** (WAF is out of scope — can be added later)

- [ ] **Step 5: Leave all other settings as default and create**

  Scroll to bottom → click **"Create distribution"**

  You will see your distribution with status **"Deploying"**. Copy the **Distribution domain name** — it looks like `d1abc23def456.cloudfront.net`. You will need this in later tasks.

  > Deployment takes 5–15 minutes. Do not wait — continue to Task 2 while it deploys.

- [ ] **Step 6: Commit a note with your CloudFront domain**

  On your local machine:
  ```bash
  # Replace with your actual domain
  echo "CLOUDFRONT_DOMAIN=https://d1abc23def456.cloudfront.net" >> go-server/.env.production.example
  git add go-server/.env.production.example
  git commit -m "chore: record CloudFront domain"
  ```

---

### Task 2: Add No-Cache Behaviours for API, Auth, and Storage Routes

**Files:**
- No files changed — AWS Console only

- [ ] **Step 1: Open the distribution you just created**

  CloudFront → Distributions → click your distribution ID → **Behaviours** tab → **Create behaviour**

- [ ] **Step 2: Create the `/api/*` no-cache behaviour**

  | Field | Value |
  |-------|-------|
  | Path pattern | `/api/*` |
  | Origin | `ec2-wedding-origin` |
  | Viewer protocol policy | Redirect HTTP to HTTPS |
  | Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
  | Cache policy | **CachingDisabled** |
  | Origin request policy | **AllViewer** (forwards all headers, cookies, query strings) |

  Click **Save changes**.

- [ ] **Step 3: Create the `/auth/*` no-cache behaviour**

  Click **Create behaviour** again:

  | Field | Value |
  |-------|-------|
  | Path pattern | `/auth/*` |
  | Origin | `ec2-wedding-origin` |
  | Viewer protocol policy | Redirect HTTP to HTTPS |
  | Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
  | Cache policy | **CachingDisabled** |
  | Origin request policy | **AllViewer** |

  Click **Save changes**.

- [ ] **Step 4: Create the `/storage/*` no-cache behaviour**

  Click **Create behaviour** again:

  | Field | Value |
  |-------|-------|
  | Path pattern | `/storage/*` |
  | Origin | `ec2-wedding-origin` |
  | Viewer protocol policy | Redirect HTTP to HTTPS |
  | Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
  | Cache policy | **CachingDisabled** |
  | Origin request policy | **AllViewer** |

  Click **Save changes**.

- [ ] **Step 5: Verify you have 4 behaviours total**

  Under the **Behaviours** tab you should now see:
  ```
  /api/*       CachingDisabled   AllViewer
  /auth/*      CachingDisabled   AllViewer
  /storage/*   CachingDisabled   AllViewer
  Default (*)  CachingOptimized  CORS-S3Origin
  ```

---

### Task 3: Verify CloudFront Works (Before Locking Down EC2)

**Files:**
- No files changed

- [ ] **Step 1: Wait for the distribution to finish deploying**

  CloudFront → Distributions — the **Status** column must show **"Enabled"** and **Last modified** must be recent. If it still says "Deploying", wait and refresh every 2 minutes.

- [ ] **Step 2: Test the site loads over HTTPS**

  Open a browser and navigate to:
  ```
  https://d1abc23def456.cloudfront.net
  ```
  Expected: the wedding invitation site loads with a valid TLS cert (padlock in browser). No mixed-content warnings.

- [ ] **Step 3: Test an API route**

  Open browser DevTools → Network tab. Navigate to the RSVP page and submit a test RSVP.  
  Expected: the POST to `/api/rsvp` returns 200 and the response appears correctly.

- [ ] **Step 4: Test the auth route**

  Navigate to the admin login page (e.g. `https://d1abc23def456.cloudfront.net/admin`).  
  Log in with your admin password.  
  Expected: login succeeds, admin dashboard loads.

- [ ] **Step 5: Test that the direct EC2 IP still works (baseline)**

  In a browser, open `http://<your-ec2-ip>` (plain HTTP, port 80).  
  Expected: site loads. (This confirms EC2 is healthy before we lock it down.)

  > **If any of Steps 2–4 fail**, do NOT proceed to Task 4. Debug first while the EC2 is still directly accessible. Check CloudFront logs or temporarily `curl http://<ec2-ip>/api/health` from your machine.

---

### Task 4: Lock EC2 Security Group to CloudFront Only

**Files:**
- No files changed — AWS Console only

- [ ] **Step 1: Navigate to the EC2 security group**

  EC2 → Instances → your instance → **Security** tab → click the Security Group link (e.g. `sg-0abc...`)

- [ ] **Step 2: Edit the port 80 inbound rule**

  Click **Edit inbound rules** → find the HTTP / TCP / port 80 row → click the **Source** dropdown for that row.

  Type `cloudfront` in the search box. You should see:
  ```
  pl-b8a742d1  com.amazonaws.global.cloudfront.origin-facing
  ```
  Select it. The CIDR field will be replaced by the prefix list ID.

  Click **Save rules**.

- [ ] **Step 3: Verify CloudFront traffic still works**

  In your browser, reload `https://d1abc23def456.cloudfront.net`.  
  Expected: site still loads correctly.

- [ ] **Step 4: Verify direct EC2 IP is now blocked**

  In your browser (or terminal), try `http://<your-ec2-ip>`.
  ```bash
  curl -v --connect-timeout 5 http://<your-ec2-ip>
  ```
  Expected: connection times out (no response). This confirms only CloudFront can reach port 80.

  > SSH (port 22) remains open to `0.0.0.0/0` — you can still SSH in at any time.

---

### Task 5: Update CORS_ORIGINS on EC2

**Files:**
- Modify: `~/weddingAws/go-server/.env.production` on the EC2

- [ ] **Step 1: SSH into EC2**

  ```bash
  ssh -i <your-key.pem> ubuntu@<your-ec2-ip>
  ```

- [ ] **Step 2: Edit .env.production**

  ```bash
  cd ~/weddingAws/go-server
  nano .env.production
  ```

  Find the `CORS_ORIGINS` line and update it:
  ```bash
  # Before (your EC2 IP or old value)
  CORS_ORIGINS=http://<your-ec2-ip>

  # After
  CORS_ORIGINS=https://d1abc23def456.cloudfront.net
  ```

  Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

- [ ] **Step 3: Restart the app container**

  ```bash
  cd ~/weddingAws/go-server
  docker compose --env-file .env.production -f docker-compose.prod.yml restart app
  ```

  Expected output:
  ```
  [+] Restarting 1/1
   ✔ Container go-server-app-1  Started
  ```

- [ ] **Step 4: Confirm health check passes**

  ```bash
  curl -sf http://127.0.0.1:5000/api/health && echo "OK"
  ```

  Expected: `OK`

---

### Task 6: Final Smoke Test

**Files:**
- No files changed

- [ ] **Step 1: Test RSVP submission end-to-end**

  Navigate to `https://d1abc23def456.cloudfront.net` in a browser.  
  Submit a test RSVP with a unique name.  
  Expected: success message shown, RSVP appears in the admin dashboard.

- [ ] **Step 2: Test admin login and dashboard**

  Navigate to `https://d1abc23def456.cloudfront.net/admin`.  
  Log in. Browse the dashboard — invites, RSVPs, media should all load.  
  Expected: all data loads, no CORS errors in DevTools console.

- [ ] **Step 3: Test image/media loading**

  Navigate to the gallery or any page with uploaded images.  
  Expected: images load without errors. Check DevTools Network tab — `/storage/*` requests should return 200 with no CORS headers missing.

- [ ] **Step 4: Test WhatsApp invite sending (if applicable)**

  Send a test invite from the admin dashboard.  
  Expected: invite sends successfully.

- [ ] **Step 5: Check browser DevTools for CORS errors**

  Open DevTools → Console tab. Reload the page and submit a form.  
  Expected: zero CORS errors. If you see `Access-Control-Allow-Origin` errors, the `CORS_ORIGINS` env var may need to be double-checked (Task 5, Step 2).

- [ ] **Step 6: Commit the final .env.production.example update (local)**

  On your local machine, update the example env file so future deploys know about the CloudFront domain:
  ```bash
  # In go-server/.env.production.example (or equivalent docs)
  # Add or update:
  # CORS_ORIGINS=https://<your-cloudfront-domain>.cloudfront.net
  git add go-server/.env.production.example
  git commit -m "chore: update CORS_ORIGINS example to CloudFront domain"
  ```

---

## Rollback

If anything goes wrong after locking the security group:

1. **To restore direct EC2 access:** EC2 → Security Group → Edit inbound rules → change port 80 source back to `0.0.0.0/0`
2. **To restore old CORS_ORIGINS:** SSH in, edit `.env.production`, set `CORS_ORIGINS` back to the old value, restart app

CloudFront distributions can be disabled (not deleted) from the console if needed — the origin remains accessible directly after the security group rollback.
