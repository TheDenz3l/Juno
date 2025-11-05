# Juno Quick Start Guide

Get Juno running locally in 5 minutes.

---

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome browser

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Environment

### 2.1 Create .env.local

If you haven't already, create `.env.local` from the example:

```bash
cp .env.example .env.local
```

### 2.2 Add Your Credentials

Open `.env.local` and replace the placeholder values:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# OpenRouter Configuration
VITE_OPENROUTER_API_KEY=sk-or-v1-...

# Stripe Configuration (optional for local testing)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Environment
VITE_ENV=development

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_CLOUD_SYNC=true
VITE_ENABLE_ANALYTICS=false
```

**Where to get credentials:**

- **Supabase**: [supabase.com/dashboard/project/_/settings/api](https://supabase.com/dashboard/project/_/settings/api)
  - Copy your **Project URL** (e.g., `https://xxxxx.supabase.co`)
  - Copy your **Anon/Public Key** (starts with `eyJ...`)

- **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys)
  - Create a new API key
  - We're using the free tier model: `minimax/minimax-m2:free`

- **Stripe** (optional): [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
  - Use test mode keys for development
  - Not required for basic testing

### 2.3 Validate Configuration

Run the validation script to ensure everything is set up correctly:

```bash
npm run check-env
```

**Expected output:**
```
🔍 Checking environment variables...

✅ VITE_SUPABASE_URL
   https://xxxxx.supabase...

✅ VITE_SUPABASE_ANON_KEY
   eyJhbGciOiJIUzI1NiIsI...

✅ VITE_OPENROUTER_API_KEY
   sk-or-v1-xxxxxxxx...

📋 Optional variables:

⚠️  VITE_STRIPE_PUBLISHABLE_KEY (optional)
   Not set - required for Stripe payments

✅ All required environment variables are set correctly!
🚀 You can now run: npm run dev
```

**If validation fails:**
- Check that you copied the full value (no truncation)
- Ensure there are no quotes around the values
- Verify the format matches the expected pattern
- Re-copy from your service dashboards

---

## Step 3: Build the Extension

### 3.1 Development Build

```bash
npm run dev
```

This starts Vite in watch mode. The extension will rebuild automatically when you make changes.

### 3.2 Production Build

For a production-ready build:

```bash
npm run build
```

Build output will be in the `dist/` folder.

---

## Step 4: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **Load unpacked**

4. Select the `dist` folder from your project

5. You should see Juno appear in your extensions list

6. Pin the extension to your toolbar (click the puzzle icon, then the pin next to Juno)

---

## Step 5: Test Core Features

### 5.1 Upload a Resume

1. Click the Juno extension icon to open the side panel

2. Go to the **Optimize** tab

3. Drag and drop a PDF or DOCX resume, or click to browse

4. Wait for parsing to complete (~2-5 seconds)

5. Your resume should appear in the dropdown

### 5.2 Test ATS Scoring

1. Navigate to a job posting on Indeed (e.g., `indeed.com/viewjob?jk=...`)

2. The Juno FAB (floating action button) should appear in the bottom-right corner

3. Open the Juno side panel (click extension icon or FAB)

4. You should see the ATS score calculated automatically

5. Review matched and missing keywords

### 5.3 Test Edit Suggestions

1. With a resume selected and job detected, scroll down to **Edit Suggestions**

2. You should see rule-based suggestions like:
   - Weak action verbs to replace
   - Passive voice to rewrite
   - Missing quantification

3. Click **Preview** to see before/after changes

4. Click **Accept** to apply a suggestion (not yet implemented in UI)

### 5.4 Test Authentication (Optional)

To test Pro features, you'll need to:

1. Set up Supabase locally:
   ```bash
   npx supabase init
   npx supabase start
   npx supabase db push
   ```

2. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy ai-suggestions
   npx supabase functions deploy stripe-webhook
   ```

3. In the Juno side panel, go to **Settings** → **Sign Up**

4. Create a test account

5. Test AI features (requires OpenRouter credits)

---

## Step 6: Common Issues

### Extension won't load

**Error:** "Manifest file is missing or unreadable"

**Fix:**
- Ensure you ran `npm run build` first
- Point Chrome to the `dist` folder, not the root project folder
- Check that `dist/manifest.json` exists

---

### Resume parsing fails

**Error:** "Failed to parse resume"

**Fix:**
- Ensure the file is a valid PDF or DOCX
- Check Chrome DevTools console for specific error
- Try a different resume file
- Verify `pdfjs-dist` and `mammoth` are installed

---

### ATS score not showing

**Possible causes:**
- Not on a supported job site (currently only Indeed `/viewjob` pages)
- Job description couldn't be extracted
- No resume selected in the dropdown

**Debug:**
1. Open Chrome DevTools
2. Check the Console tab for errors
3. Verify you're on a Indeed job page (URL contains `/viewjob?jk=`)
4. Ensure a resume is selected in the side panel

---

### AI suggestions return error

**Error:** "Quota exceeded" or "OpenRouter API error"

**Fix:**
- Verify `VITE_OPENROUTER_API_KEY` is set correctly
- Check you have credits on OpenRouter (free tier available)
- Ensure Supabase Edge Function is deployed with secrets:
  ```bash
  npx supabase secrets set OPENROUTER_API_KEY=your_key
  ```
- Check Edge Function logs: `npx supabase functions logs ai-suggestions`

---

### Environment validation fails

**Error:** "Invalid format" for API keys

**Fix:**
- **Supabase URL**: Must start with `https://` and end with `.supabase.co`
- **Supabase Anon Key**: Must be a JWT (starts with `eyJ`)
- **OpenRouter Key**: Must start with `sk-or-v1-`
- **Stripe Key**: Must start with `pk_test_` or `pk_live_`

**Still stuck?**
- Double-check you copied the entire key (no truncation)
- Ensure there are no extra spaces or quotes
- Re-generate the key from the service dashboard

---

## Step 7: Development Workflow

### Making Changes

1. Edit source files in `src/`
2. If running `npm run dev`, changes rebuild automatically
3. Click the refresh icon on the extension in `chrome://extensions/`
4. Reload any open tabs where the content script runs
5. Test your changes

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

---

## Step 8: Next Steps

Once you've verified everything works locally:

1. **Set up Supabase backend** (see `DEPLOYMENT.md`)
   - Run database migrations
   - Deploy Edge Functions
   - Configure storage buckets

2. **Set up Stripe** (see `DEPLOYMENT.md`)
   - Create products and pricing
   - Configure webhooks
   - Test payment flow

3. **Add LinkedIn/Glassdoor support** (P1 feature)
   - Create content scripts for each site
   - Test job detection on those platforms

4. **Implement onboarding flow** (P1 feature)
   - Welcome screen with feature tour
   - Sample resume for testing

5. **Deploy to Chrome Web Store** (see `DEPLOYMENT.md`)
   - Prepare store listing assets
   - Create privacy policy
   - Submit for review

---

## Resources

- **Full Documentation**: See `README.md`
- **Deployment Guide**: See `DEPLOYMENT.md`
- **Architecture Details**: See `PROJECT_SUMMARY.md`
- **Product Requirements**: See `product-manager-output.md`

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Vite Docs**: [vitejs.dev](https://vitejs.dev)
- **Chrome Extensions**: [developer.chrome.com/docs/extensions](https://developer.chrome.com/docs/extensions)
- **OpenRouter**: [openrouter.ai/docs](https://openrouter.ai/docs)

---

## Need Help?

If you encounter issues not covered here:

1. Check Chrome DevTools Console for error messages
2. Check Supabase logs: `npx supabase functions logs`
3. Verify environment variables: `npm run check-env`
4. Review file structure matches `PROJECT_SUMMARY.md`
5. Ensure all dependencies are installed: `npm install`

Happy building! 🚀
