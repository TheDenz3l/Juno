# Juno Deployment Guide

Complete step-by-step guide to deploy Juno to production.

---

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase account
- Stripe account
- OpenRouter API key
- Chrome Web Store developer account ($5 one-time fee)

---

## 1. Supabase Setup

### 1.1 Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a project name (e.g., "juno-prod")
3. Generate a strong database password
4. Select a region close to your users
5. Wait for project provisioning (~2 minutes)

### 1.2 Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
npx supabase db push
```

### 1.3 Configure Storage

1. Go to **Storage** in Supabase dashboard
2. Create a new bucket named `resumes`
3. Set bucket to **Private**
4. Add RLS policies:
   - Users can upload to their own folder: `auth.uid() = (storage.foldername(name))[1]`
   - Users can read their own files: `auth.uid() = (storage.foldername(name))[1]`

### 1.4 Deploy Edge Functions

```bash
# Deploy AI suggestions function
npx supabase functions deploy ai-suggestions --no-verify-jwt

# Deploy Stripe webhook
npx supabase functions deploy stripe-webhook --no-verify-jwt

# Set secrets
npx supabase secrets set OPENROUTER_API_KEY=your_openrouter_key
npx supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
npx supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
npx supabase secrets set STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
npx supabase secrets set STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
npx supabase secrets set STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_xxx
npx supabase secrets set STRIPE_PREMIUM_YEARLY_PRICE_ID=price_xxx
```

### 1.5 Get Credentials

Copy these from your Supabase project settings:

- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbGc...` (public, safe to use in frontend)
- **Service Role Key**: `eyJhbGc...` (secret, only for Edge Functions)

---

## 2. Stripe Setup

### 2.1 Create Products

1. Go to Stripe Dashboard → **Products**
2. Create **Pro Plan**:
   - Name: "Juno Pro"
   - Price: $9.99/month (recurring monthly)
   - Price ID: Copy for later (e.g., `price_1ABC...`)
   - Create yearly price: $79/year
3. Create **Premium Plan**:
   - Name: "Juno Premium"
   - Price: $24.99/month
   - Yearly: $199/year

### 2.2 Configure Webhooks

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy **Signing secret** (starts with `whsec_...`)

### 2.3 Get API Keys

Copy from **Developers** → **API keys**:

- **Publishable key** (`pk_live_...` or `pk_test_...`)
- **Secret key** (`sk_live_...` or `sk_test_...`)

---

## 3. OpenRouter Setup

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up / Sign in
3. Go to **Keys**
4. Create a new API key
5. Add credits to your account ($5-10 to start)
6. Model: We're using `minimax/minimax-01`

---

## 4. Build Extension

### 4.1 Configure Environment

Create `.env` file:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_ENV=production
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_CLOUD_SYNC=true
VITE_ENABLE_ANALYTICS=false
```

### 4.2 Build for Production

```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Build
npm run build

# Output will be in dist/ folder
```

### 4.3 Test Build Locally

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist` folder
6. Test all features:
   - Upload resume
   - Navigate to Indeed job
   - Check ATS score
   - Sign up / Sign in
   - Try Pro features (if subscribed)

---

## 5. Chrome Web Store Submission

### 5.1 Prepare Assets

You need:

- **Screenshots** (1280x800 or 640x400):
  - Upload flow
  - ATS score display
  - Edit suggestions
  - Application history
  - At least 1, max 5

- **Promotional tile** (440x280): Optional but recommended

- **Icons**: Already created in `public/icons/`
  - 16x16, 48x48, 128x128 PNG

- **Store listing**:
  - Description (see below)
  - Category: Productivity
  - Language: English

### 5.2 Store Description

**Short description (132 chars max):**
```
AI-powered resume optimizer. Get instant ATS scores and tailored suggestions while applying to jobs.
```

**Full description:**
```
Juno is an AI-powered resume optimizer that helps job seekers improve their applications and get more callbacks. Optimize your resume directly while browsing job postings on Indeed, LinkedIn, and Glassdoor.

KEY FEATURES:
✓ Instant ATS Match Score (0-100)
✓ Missing keyword identification
✓ Rule-based edit suggestions
✓ Resume parsing (PDF & DOCX)
✓ Application tracking
✓ Privacy-first (local processing in Free tier)

PRO FEATURES:
✓ AI-powered rewrites
✓ Cover letter generation
✓ Cloud sync across devices
✓ Up to 5 resumes
✓ 50 AI suggestions/month

HOW IT WORKS:
1. Install Juno
2. Upload your resume
3. Browse job postings
4. Get instant match scores
5. Apply suggestions
6. Track your applications

PRIVACY:
- Free tier: 100% local processing
- Pro tier: Encrypted cloud storage
- We never share your data

PRICING:
- Free: 20 matches/month, local only
- Pro: $9.99/month, AI features + sync
- Premium: $24.99/month, unlimited features

Perfect for job seekers, career switchers, and anyone tired of ATS rejection.
```

### 5.3 Privacy Policy

Host a privacy policy page (required by Chrome Web Store). Key points:

- What data you collect (resumes, applications, usage metrics)
- How you use it (optimization, sync, billing)
- How you protect it (encryption, RLS, no third-party sharing)
- User rights (export, delete, refund)
- GDPR compliance

Example URL: `https://yourdomain.com/privacy`

### 5.4 Submit

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay $5 one-time developer fee (if first time)
3. Click **New Item**
4. Upload `dist.zip` (zip your dist folder)
5. Fill in store listing
6. Add screenshots
7. Add privacy policy URL
8. Select "This extension collects user data"
9. Disclose data usage
10. Submit for review

**Review time**: Usually 1-3 days, can take up to 1 week

---

## 6. Post-Deployment

### 6.1 Monitoring

- **Supabase Logs**: Check Edge Function logs for errors
- **Stripe Dashboard**: Monitor subscriptions and payments
- **Chrome Web Store**: Monitor reviews and ratings
- **OpenRouter**: Monitor API usage and costs

### 6.2 Analytics (Optional)

Add privacy-first analytics:
- Plausible.io
- Simple Analytics
- Fathom Analytics

### 6.3 Support

Set up:
- Support email (e.g., support@juno.app)
- GitHub Issues for bug reports
- Discord/Slack community (optional)

---

## 7. Maintenance

### 7.1 Updates

When you make changes:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Update manifest version (auto-done by vite-plugin-web-extension)

# 3. Build
npm run build

# 4. Test locally

# 5. Create release notes

# 6. Upload to Chrome Web Store
# Zip dist folder and upload as new version

# 7. Tag release in Git
git tag v0.1.1
git push --tags
```

### 7.2 Database Migrations

```bash
# Create new migration
npx supabase migration new add_new_feature

# Edit migration file in supabase/migrations/

# Test locally
npx supabase db reset

# Deploy to production
npx supabase db push
```

### 7.3 Costs Estimation

**Monthly costs for 1000 users:**

- Supabase: Free tier (up to 500MB database, 2GB bandwidth)
- Edge Functions: Free tier (500K invocations)
- Storage: Free tier (1GB)
- OpenRouter: ~$20-50 (depends on usage)
- Stripe: ~$30 (assuming 20% conversion)

**Total: $50-80/month for 1000 users**

---

## 8. Troubleshooting

### Extension won't load
- Check manifest.json for errors
- Ensure all paths are correct
- Check Chrome console for errors

### Supabase connection fails
- Verify VITE_SUPABASE_URL is correct
- Check CORS settings in Supabase
- Ensure RLS policies are correct

### Stripe webhooks not working
- Verify webhook URL is correct
- Check webhook signing secret
- View webhook logs in Stripe Dashboard

### AI suggestions fail
- Check OpenRouter API key
- Verify you have credits
- Check Edge Function logs

---

## 9. Security Checklist

- [ ] All environment variables are set correctly
- [ ] Stripe webhook secret is configured
- [ ] RLS policies are enabled on all tables
- [ ] Service role key is only in Edge Functions
- [ ] HTTPS is enforced everywhere
- [ ] Input validation on all user inputs
- [ ] Rate limiting on AI endpoints
- [ ] PII scrubbing before API calls
- [ ] CSP headers are set
- [ ] Secrets are not in Git

---

## 10. Launch Checklist

- [ ] Supabase project is created and configured
- [ ] Database migrations are run
- [ ] Storage buckets are configured
- [ ] Edge Functions are deployed
- [ ] Stripe products and webhooks are set up
- [ ] OpenRouter account has credits
- [ ] Extension is built and tested
- [ ] Store listing is complete with screenshots
- [ ] Privacy policy is published
- [ ] Support email is set up
- [ ] Chrome Web Store submission is approved

---

For questions or issues, see:
- README.md for setup instructions
- GitHub Issues for bug reports
- product-manager-output.md for feature details
