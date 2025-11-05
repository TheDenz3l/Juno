#!/usr/bin/env node

/**
 * Environment validation script
 * Checks if all required environment variables are set correctly
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Load .env.local
let envContent = ''
try {
  envContent = readFileSync(join(projectRoot, '.env.local'), 'utf-8')
} catch (error) {
  console.error('❌ .env.local file not found!')
  console.log('\n💡 Create one by copying .env.example:')
  console.log('   cp .env.example .env.local')
  process.exit(1)
}

// Parse environment variables
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) {
    envVars[match[1]] = match[2].trim()
  }
})

// Required variables
const required = [
  { key: 'VITE_SUPABASE_URL', desc: 'Supabase project URL', pattern: /^https:\/\/.+\.supabase\.co$/ },
  { key: 'VITE_SUPABASE_ANON_KEY', desc: 'Supabase anon key', pattern: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/ },
  { key: 'VITE_OPENROUTER_API_KEY', desc: 'OpenRouter API key', pattern: /^sk-or-v1-.+/ },
]

// Optional variables
const optional = [
  { key: 'VITE_STRIPE_PUBLISHABLE_KEY', desc: 'Stripe publishable key', pattern: /^pk_(test|live)_.+/ },
]

console.log('🔍 Checking environment variables...\n')

let hasErrors = false

// Check required
required.forEach(({ key, desc, pattern }) => {
  const value = envVars[key]

  if (!value || value.includes('your-') || value.includes('xxx')) {
    console.error(`❌ ${key}`)
    console.error(`   Missing or placeholder value`)
    console.error(`   Description: ${desc}\n`)
    hasErrors = true
  } else if (!pattern.test(value)) {
    console.error(`❌ ${key}`)
    console.error(`   Invalid format`)
    console.error(`   Description: ${desc}`)
    console.error(`   Expected pattern: ${pattern}\n`)
    hasErrors = true
  } else {
    const preview = value.length > 20 ? value.slice(0, 20) + '...' : value
    console.log(`✅ ${key}`)
    console.log(`   ${preview}\n`)
  }
})

// Check optional
console.log('\n📋 Optional variables:\n')
optional.forEach(({ key, desc, pattern }) => {
  const value = envVars[key]

  if (!value || value.includes('your-') || value.includes('xxx')) {
    console.log(`⚠️  ${key} (optional)`)
    console.log(`   Not set - required for Stripe payments\n`)
  } else if (!pattern.test(value)) {
    console.warn(`⚠️  ${key}`)
    console.warn(`   Invalid format`)
    console.warn(`   Expected pattern: ${pattern}\n`)
  } else {
    const preview = value.length > 20 ? value.slice(0, 20) + '...' : value
    console.log(`✅ ${key}`)
    console.log(`   ${preview}\n`)
  }
})

if (hasErrors) {
  console.error('\n❌ Environment validation failed!')
  console.error('\n📝 To fix:')
  console.error('1. Open .env.local in your editor')
  console.error('2. Replace placeholder values with real credentials from:')
  console.error('   - Supabase: https://supabase.com/dashboard/project/_/settings/api')
  console.error('   - OpenRouter: https://openrouter.ai/keys')
  console.error('   - Stripe: https://dashboard.stripe.com/apikeys')
  console.error('3. Run this script again: npm run check-env\n')
  process.exit(1)
} else {
  console.log('\n✅ All required environment variables are set correctly!')
  console.log('🚀 You can now run: npm run dev\n')
}
