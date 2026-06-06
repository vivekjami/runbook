# RunBook Dashboard — Developer Setup Guide

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, TypeScript) |
| Auth + DB | Supabase (Postgres + RLS + SSR Auth) |
| Payments | Razorpay (USD subscriptions) |
| Agent Core | Google ADK + Gemini 2.5 Pro (Cloud Run) |
| Vector Search | Elastic Cloud (ES|QL + ESRE) |
| Hosting | Vercel |

---

## 1. Supabase Setup

### Create the project
1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `runbook`, choose your region, set a DB password

### Run the schema
1. In your Supabase dashboard → **SQL Editor** → **New Query**
2. Open `supabase/schema.sql` from this repo and paste the entire contents
3. Click **Run** — this creates all 5 tables, RLS policies, and the auto-provisioning trigger

### Get your API keys
- **Project Settings → API**
  - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - Copy **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Enable Google OAuth (optional)
- **Authentication → Providers → Google**
- Add your Google OAuth Client ID + Secret
- Add `http://localhost:3000/auth/callback` as an allowed redirect URL

---

## 2. Environment Variables

Create `dashboard/.env.local` (already done if you ran the initial setup):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Razorpay (add when ready for billing)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_PLAN_ID=
RAZORPAY_WEBHOOK_SECRET=
```

---

## 3. Run Locally

```bash
cd ~/runbook/dashboard
npm install
npm run dev
# → http://localhost:3000
```

---

## 4. Route Map

| URL | Description |
|-----|-------------|
| `/` | Marketing landing page |
| `/login` | Supabase email + Google login |
| `/signup` | New account creation (14-day trial) |
| `/auth/callback` | OAuth redirect handler |
| `/dashboard` | Incident feed (real-time, Supabase SSR) |
| `/dashboard/incidents/[id]` | Full Chronicle narrative + confidence breakdown |
| `/dashboard/shadow` | Shadow Mode comparison dashboard |
| `/dashboard/dna` | Incident DNA fingerprint index |
| `/dashboard/runbooks` | Runbook library |
| `/dashboard/settings` | Elastic config + agent config + billing |

---

## 5. Database Table Reference

| Table | Written By | Purpose |
|-------|-----------|---------|
| `incidents` | RunBook Agent (MCP) | One row per investigation |
| `shadow_actions` | RunBook Agent (MCP) | Agent predictions in shadow mode |
| `dna_index` | RunBook Agent (MCP) | Resolved incident fingerprints |
| `runbooks` | Dashboard (upload) | Runbook metadata |
| `workspace_settings` | Dashboard (settings page) | Per-user config |

---

## 6. Deploy to Vercel

```bash
# From ~/runbook/dashboard
npx vercel --prod
```

Add all env vars from `.env.local` in the Vercel project settings.

Set the **Supabase redirect URL** to your Vercel domain:
- Supabase → Authentication → URL Configuration
- Add `https://your-app.vercel.app/auth/callback`

---

## 7. Razorpay Billing (when ready)

1. Create a subscription plan in your Razorpay dashboard ($299/mo)
2. Copy the Plan ID → `RAZORPAY_PLAN_ID`
3. Add webhook endpoint: `https://your-app.vercel.app/api/billing/webhook`
4. Copy Webhook Secret → `RAZORPAY_WEBHOOK_SECRET`
