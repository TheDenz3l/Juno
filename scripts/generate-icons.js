// Simple script to create placeholder PNG icons
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('Creating placeholder icon PNGs...\n')

// Create a simple base64-encoded 1px transparent PNG
const createMinimalPNG = () => {
  // Minimal PNG data - a 1x1 transparent pixel
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  return Buffer.from(base64, 'base64')
}

const iconsDir = join(__dirname, '../public/icons')
const sizes = [16, 48, 128]

sizes.forEach(size => {
  const filename = `icon-${size}.png`
  const filepath = join(iconsDir, filename)

  // Create a minimal transparent PNG
  const pngData = createMinimalPNG()
  writeFileSync(filepath, pngData)

  console.log(`✓ Created ${filename}`)
})

console.log('\n✅ Placeholder icons created!')
console.log('⚠️  Note: These are minimal placeholder PNGs.')
console.log('   Replace them with proper icons before production deployment.\n')
