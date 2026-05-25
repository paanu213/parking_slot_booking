/**
 * One-time migration: update existing amenity icon values from emojis to
 * Lucide icon name strings.
 *
 * Run once:  npx tsx migrate-amenity-icons.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ICON_MAP: Record<string, string> = {
  'CCTV Surveillance':    'Cctv',
  '24/7 Security Guard':  'ShieldCheck',
  'Covered Parking':      'SquareParking',
  'EV Charging':          'Zap',
  'Wheelchair Accessible':'Accessibility',
  'Restroom':             'ShowerHead',
  'Well Lit':             'Lightbulb',
  'Valet Parking':        'ConciergeBell',
  'Car Wash':             'WashingMachine',
  'ATM Nearby':           'Banknote',
};

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const [name, newIcon] of Object.entries(ICON_MAP)) {
    const amenity = await prisma.amenity.findUnique({ where: { name } });
    if (!amenity) { console.log(`  ⚠  Not found: ${name}`); skipped++; continue; }
    if (amenity.icon === newIcon) { console.log(`  –  Already set: ${name}`); skipped++; continue; }

    await prisma.amenity.update({ where: { id: amenity.id }, data: { icon: newIcon } });
    console.log(`  ✓  ${name}: "${amenity.icon}" → "${newIcon}"`);
    updated++;
  }

  console.log(`\nDone — ${updated} updated, ${skipped} skipped.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
