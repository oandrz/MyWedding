# MyWedding Platform — Source Code Sale Proposal

## Executive Summary

MyWedding is a full-stack wedding e-invitation platform built with Go (backend) and React/TypeScript (frontend). This proposal outlines the plan to sell the source code as a non-exclusive template/white-label product targeting Indonesian developers and wedding agencies.

**Feasibility verdict: High.** The codebase is production-ready, feature-differentiated for the Indonesian market, and the business model is clean with minimal ongoing obligation.

---

## Product Overview

A complete wedding e-invitation platform deployable on any cloud provider (currently running on AWS). Key capabilities:

- RSVP management with groom/bride side filtering
- WhatsApp blast integration (automated invite delivery)
- Admin panel with feature flags, app settings, and logging
- Media gallery management
- Guest messaging system
- Scheduled message delivery
- QR code generation
- Google Drive integration
- Image optimization
- Google OAuth admin authentication

**Tech stack**: Go 1.25 + Chi router + PostgreSQL + React 18 + TypeScript + Vite + TanStack Query + Tailwind CSS + Shadcn/Radix UI

**Minimum infrastructure to run**: PostgreSQL + Google OAuth credentials. Redis and Supabase storage are optional — both have automatic fallbacks built in.

---

## Target Market

**Primary**: Indonesian wedding agencies and developers building wedding tech products.

**Why Indonesian market specifically**:
- WhatsApp is the dominant communication channel for wedding invites in Indonesia
- Bank transfer gifting (BCA etc.) is standard — the platform supports this natively
- High volume of weddings, growing digital adoption among vendors

---

## Business Model

| Parameter | Decision |
|---|---|
| **License type** | Non-exclusive source code license |
| **Price** | $300 USD one-time per buyer |
| **Exclusivity** | None — sold to as many buyers as want it |
| **Updates** | Not included. Future updates sold separately or as optional $50/year tier |
| **Customization** | Available as paid consulting at $50–$80/hour — stated upfront in sale terms |
| **Support** | Setup support only, time-boxed to 2 hours per buyer |

**Revenue potential**: 10 sales = $3,000 with zero additional work after the prep weekend. All fixed cost is front-loaded.

---

## Distribution Strategy

### Channels
1. **GitHub private repository** — buyers get access upon payment. Provides credibility; developers can see the repo structure before buying.
2. **Direct sales** — personal network and targeted outreach to Indonesian wedding agency communities (WhatsApp groups, Facebook groups for wedding vendors).

### Sales approach
- Lead every pitch with a **30-second screen recording of the WhatsApp blast feature** — this is the strongest differentiator and closes deals faster than any README.
- First sales will come from personal network or warm referrals. Start there before cold outreach.
- Once 2–3 sales are complete and feedback is gathered, consider listing on Gumroad or Lemon Squeezy for passive inbound.

---

## IP and Legal Considerations

### Honest assessment
The codebase was initially scaffolded by Replit's AI and subsequently developed with AI coding assistants. The author's contribution is primarily product direction, architecture decisions, and prompt engineering. This means:

- Traditional copyright ownership is legally ambiguous under current law (AI-generated content lacks clear copyright standing)
- **This does not prevent selling** — hundreds of AI-assisted templates are sold daily without legal issues
- Risk surfaces only if a buyer attempts to assert exclusive rights or initiates litigation, which is unlikely at this price point and market

### What this means for the sale
Position it as selling a **working, assembled product** rather than proprietary IP. The value is in the assembled system, domain expertise, and deployment-readiness — not in a copyright monopoly.

### WhatsApp integration disclosure
The WhatsApp integration uses `go.mau.fi/whatsmeow`, a reverse-engineered WhatsApp Web library. This **violates WhatsApp's Terms of Service**. Buyers must be clearly informed:
- WhatsApp numbers used for blasting risk being banned at scale
- This is a known and accepted risk in the Indonesian market
- Buyers assume full responsibility for their WhatsApp account status

Include this disclosure in the sale terms and `DEPLOYMENT.md`.

---

## Pre-Sale Cleanup Checklist

The following must be completed before the first sale. Estimated total effort: one focused weekend.

### Blocking — must do
- [ ] Remove `@replit/vite-plugin-shadcn-theme-json` and `@replit/vite-plugin-runtime-error-modal` from `vite.config.ts` and `package.json`
- [ ] Replace personal seed data in `migrations/001_init.sql` — change "The Wedding of Andreas & Christine", "Andreas", "Christine", and Bank BCA placeholder values to generic examples
- [ ] Write `DEPLOYMENT.md` covering: PostgreSQL setup, all environment variables, Google OAuth credentials setup, WhatsApp number linking, Supabase storage setup (optional), and the WhatsApp ToS risk disclosure
- [ ] Write a sale license document stating: what buyers can do (deploy, modify, use commercially), what they cannot do (resell the source code to others), and the customization consulting terms

### Recommended — do before scaling
- [ ] Rename Go module from `github.com/andreasronaldo/wedding-server` to a generic product name (e.g. `github.com/mywedding/platform`) — prevents buyers from seeing a personal namespace
- [ ] Clean up `vite.config.local.ts` and any personal `.env.example` files
- [ ] Record a 30-second demo video of WhatsApp blast working end-to-end
- [ ] Write a short `README.md` with screenshots, feature list, and a "Buy" link

---

## Pricing Rationale

Comparable full-stack Go + React templates with admin panels sell for $150–$400. This platform justifies the upper range because:

- WhatsApp integration is rare in wedding template products
- Go backend is unusual (most competitors use Node.js) — appeals to performance-focused buyers
- Complete admin panel with feature flags, logging, and settings management
- Production-proven on AWS with Docker Compose setup included
- Indonesian market context built-in (bank transfer gifting, WhatsApp-first UX)

**Suggested price for exclusivity** (if a buyer requests it): $2,000+. Raise significantly to reflect the ceiling on future sales.

---

## Risk Summary

| Risk | Likelihood | Mitigation |
|---|---|---|
| Buyer disputes ownership of code | Low | Clear "sold as-is" license document, no copyright warranty |
| WhatsApp bans buyer's number | Medium | Explicit disclosure in sale terms and docs |
| Buyer demands refund after seeing code | Low | Provide GitHub preview access before payment |
| Replit claims on initial scaffold | Very low | Code has been substantially transformed; risk is theoretical |
| Buyers compete with each other | Low | Non-exclusive is disclosed upfront; different agencies serve different cities |
