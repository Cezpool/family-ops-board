# Family Operations Board — Setup & Deployment Guide

## Overview

A private, multi-user family task management web app backed by Supabase and deployed to Netlify.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Netlify](https://netlify.com) account (free tier works)

---

## Step 1 — Supabase Setup

### 1.1 Create a Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `family-ops-board` (or anything you like)
3. Choose a region close to you
4. Set a strong database password — save it somewhere safe

### 1.2 Run the Schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open `supabase/schema.sql` from this project
4. Paste the entire contents into the SQL editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

You should see success messages for each statement. This creates:
- All 6 tables (`profiles`, `categories`, `tasks`, `task_participants`, `task_comments`, `task_activity`)
- Row Level Security policies
- Trigger to auto-create profiles on signup
- Pre-seeded categories: Chores, Tasks, Projects

### 1.3 Get Your API Keys

1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public** key → `VITE_SUPABASE_ANON_KEY`

### 1.4 Create Your First User (Parent Admin)

Supabase Auth doesn't expose role assignment in the UI directly, so do this:

1. Go to **SQL Editor → New Query** and run:

```sql
-- After you sign up through the app, promote yourself to parent_admin:
UPDATE profiles
SET role = 'parent_admin'
WHERE email = 'your-email@example.com';
```

Or create users programmatically:

```sql
-- To create a family member, just use the app's signup flow.
-- Their default role is 'family_member'.
-- To make someone a parent_admin, update their profile row.
```

**Note:** The app uses email/password login. Users sign up via the Supabase Auth invite flow or you can create them in Authentication → Users in the dashboard.

---

## Step 2 — Local Development

### 2.1 Install Dependencies

```bash
cd family-ops-board
npm install
```

### 2.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 2.3 Start Dev Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Step 3 — Netlify Deployment

### Option A: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Option B: Deploy via GitHub (Recommended)

1. Push this project to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
3. Connect your GitHub account and select the repo
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**

### 3.1 Set Environment Variables in Netlify

1. Go to **Site Settings → Environment variables**
2. Add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
3. Trigger a redeploy: **Deploys → Trigger deploy**

The `public/_redirects` file ensures SPA routing works correctly on Netlify.

---

## Step 4 — Inviting Family Members

Since sign-up is not exposed in the UI (by design), use one of these methods:

**Method 1: Supabase Dashboard**
1. Go to **Authentication → Users → Invite user**
2. Enter their email — they receive a magic link
3. After they set a password, update their role if needed:
   ```sql
   UPDATE profiles SET role = 'parent_admin' WHERE email = 'spouse@example.com';
   -- Leave as 'family_member' for children
   ```

**Method 2: Direct Insert (advanced)**
```sql
-- Only works if you know the auth.users UUID
UPDATE profiles
SET display_name = 'Child Name', role = 'family_member'
WHERE id = 'their-uuid-here';
```

---

## Project Structure

```
family-ops-board/
├── public/
│   └── _redirects              # Netlify SPA routing
├── src/
│   ├── components/
│   │   ├── CategoryGroup.jsx   # Collapsible category section
│   │   ├── CategoryGroup.css
│   │   ├── CreateTaskModal.jsx # Parent task creation form
│   │   ├── CreateTaskModal.css
│   │   ├── TaskModal.jsx       # Full task detail modal
│   │   ├── TaskModal.css
│   │   ├── TaskRow.jsx         # Single task list item
│   │   └── TaskRow.css
│   ├── context/
│   │   └── AuthContext.jsx     # Session + profile context
│   ├── pages/
│   │   ├── Dashboard.jsx       # /me — main board
│   │   ├── Dashboard.css
│   │   ├── Login.jsx           # /login
│   │   └── Login.css
│   ├── utils/
│   │   ├── activity.js         # Activity log helper
│   │   ├── dates.js            # Date formatting/comparison
│   │   └── status.js           # Status labels and CSS classes
│   ├── App.jsx                 # Router
│   ├── index.css               # Global design system
│   ├── main.jsx                # React entry point
│   └── supabaseClient.js       # Supabase singleton
├── supabase/
│   └── schema.sql              # Full DB schema, RLS, seeds
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

---

## User Roles Summary

| Capability                      | Parent Admin | Family Member |
|----------------------------------|:------------:|:-------------:|
| See all tasks                    | ✅           | ❌            |
| See assigned tasks               | ✅           | ✅            |
| Create tasks                     | ✅           | ❌            |
| Edit own tasks                   | ✅           | ❌            |
| Edit other parents' tasks        | ❌           | ❌            |
| Update own status                | ✅           | ✅            |
| Update others' status            | ✅           | ❌            |
| Comment on any task              | ✅           | ❌            |
| Comment on assigned tasks        | ✅           | ✅            |
| Delete tasks                     | ❌           | ❌            |

---

## Status Values

| Status              | Meaning                      |
|---------------------|------------------------------|
| Not Started         | Default state                |
| In Progress         | Actively working on it       |
| Waiting             | Blocked / waiting on someone |
| Question            | Needs clarification          |
| Completed           | Done                         |
| Incomplete          | Started but not finished     |
| Unable to Complete  | Cannot be done               |

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Check your `.env` file exists and has correct values. Restart the dev server after changes.

**Login works but dashboard is blank**
→ Your profile row may not have been created. Check `profiles` table in Supabase. If empty, the trigger may not have fired — insert manually.

**RLS blocking queries**
→ Confirm `auth.uid()` resolves correctly. In Supabase SQL Editor, test with:
```sql
select auth.uid();
```

**Netlify shows 404 on refresh**
→ Confirm `public/_redirects` contains `/*  /index.html  200` and was included in the build.
