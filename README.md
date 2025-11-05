# Juno - AI-Powered Resume Optimizer

Juno is a Chrome extension that helps job seekers optimize their resumes for ATS (Applicant Tracking Systems) and improve their chances of getting callbacks. Get instant match scores, keyword suggestions, and AI-powered improvements directly while browsing job postings.

## Features

### P0 (MVP) - Available
- **Job Post Detection** - Automatically detects Indeed job postings
- **Local Resume Upload & Parsing** - Import PDF/DOCX resumes without leaving the page
- **ATS Keyword Match & Score** - Get instant 0-100 scores with missing keywords (local processing)
- **Rule-Based Edit Suggestions** - Improve wording and clarity without cloud AI
- **Local Application History** - Track applications automatically, offline-first
- **Pro Authentication** - Sign in and manage subscriptions
- **AI Suggestions** - Advanced rewrites and cover letter generation (Pro)
- **Cloud Storage & Sync** - Multi-device resume syncing (Pro)
- **Usage Metering** - Fair quotas by plan tier

### P1 - Coming Soon
- LinkedIn & Glassdoor support
- Backup/Restore functionality
- Cover letter templates with AI
- Guided onboarding
- Email callback tracking (opt-in)

### P2 - Roadmap
- Team/Recruiter workspace
- Insights & analytics dashboard

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Chrome API**: Manifest V3
- **Local ML**: ONNX Runtime + DistilBERT-base-uncased
- **Parsing**: PDF.js + mammoth.js
- **Storage**: IndexedDB + Chrome Storage API
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **AI**: OpenRouter (MiniMax M2)
- **Payments**: Stripe

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome or Edge browser (latest version)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd juno
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Fill in your Supabase and OpenRouter credentials in `.env`

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Development

Run the development server with hot reload:

```bash
npm run dev
```

After making changes, reload the extension in Chrome:
- Go to `chrome://extensions/`
- Click the refresh icon on the Juno extension card

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - TypeScript type checking
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI

## Project Structure

```
juno/
├── public/
│   ├── icons/           # Extension icons (16, 48, 128)
│   └── models/          # ONNX model files (downloaded at runtime)
├── src/
│   ├── background/      # Service worker
│   ├── content/         # Content scripts (job board detection)
│   ├── sidepanel/       # Side panel React app
│   ├── components/      # Shared React components
│   ├── lib/             # Utilities, parsers, ML
│   ├── hooks/           # React hooks
│   ├── types/           # TypeScript definitions
│   └── stores/          # State management (Zustand)
├── supabase/
│   ├── migrations/      # Database schema
│   ├── functions/       # Edge Functions
│   └── config/          # RLS policies
├── sidepanel.html       # Side panel entry point
├── vite.config.ts       # Vite configuration
└── package.json
```

## Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Run migrations**
   ```bash
   npx supabase db push
   ```

3. **Deploy Edge Functions**
   ```bash
   npx supabase functions deploy
   ```

4. **Configure Storage buckets**
   - Create `resumes` bucket with RLS enabled
   - Set up appropriate policies (see `supabase/config/`)

## Stripe Setup

1. **Create a Stripe account** at [stripe.com](https://stripe.com)

2. **Create products and prices**
   - Pro: $9.99/month or $79/year
   - Premium: $24.99/month or $199/year

3. **Set up webhooks**
   - Point to your Supabase Edge Function endpoint
   - Subscribe to events: `customer.subscription.*`, `invoice.*`

4. **Add Stripe keys to .env**

## Privacy & Security

- **Free tier**: All processing happens locally on-device. No data leaves your browser.
- **Pro tier**: Data is encrypted in transit and at rest. Only you can access your data via RLS.
- **PII handling**: Personal information is scrubbed before AI calls.
- **Compliance**: GDPR-ready, 7-day refund policy, data export available.

## Pricing

- **Free**: $0/month
  - 20 matches/month
  - 5 AI suggestions/month
  - 1 resume
  - Local processing only

- **Pro**: $9.99/month or $79/year
  - 100 matches/month
  - 50 AI suggestions/month
  - 5 resumes
  - 50 AI calls/month
  - Cloud sync
  - Priority support

- **Premium**: $24.99/month or $199/year
  - 300 matches/month
  - 200 AI suggestions/month
  - 50 resumes
  - 200 AI calls/month
  - All Pro features
  - Advanced analytics

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/juno/issues)
- **Email**: support@juno.app
- **Docs**: [Documentation](https://docs.juno.app)

## License

MIT License - see LICENSE file for details

## Roadmap

See the [product-manager-output.md](./product-manager-output.md) for detailed feature planning and prioritization.
