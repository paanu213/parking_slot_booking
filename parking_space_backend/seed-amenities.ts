import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Icons are Lucide icon name strings — rendered as SVG components in all frontends
const AMENITIES = [
  { name: 'CCTV Surveillance',    icon: 'Cctv',           description: 'Monitored by CCTV cameras around the clock' },
  { name: '24/7 Security Guard',  icon: 'ShieldCheck',    description: 'Manned security personnel on duty round the clock' },
  { name: 'Covered Parking',      icon: 'SquareParking',  description: 'Sheltered from rain, sun, and weather' },
  { name: 'EV Charging',          icon: 'Zap',            description: 'Electric vehicle charging points available on-site' },
  { name: 'Wheelchair Accessible',icon: 'Accessibility',  description: 'Accessible ramps and extra-wide slots for easy entry' },
  { name: 'Restroom',             icon: 'ShowerHead',     description: 'Clean restroom facilities available within the premises' },
  { name: 'Well Lit',             icon: 'Lightbulb',      description: 'Adequately illuminated for safety after dark' },
  { name: 'Valet Parking',        icon: 'ConciergeBell',  description: 'Valet service available on request' },
  { name: 'Car Wash',             icon: 'WashingMachine', description: 'Car washing and cleaning service available' },
  { name: 'ATM Nearby',           icon: 'Banknote',       description: 'ATM machine within or adjacent to the premises' },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const a of AMENITIES) {
    const existing = await prisma.amenity.findUnique({ where: { name: a.name } });
    if (existing) { skipped++; continue; }
    await prisma.amenity.create({ data: a });
    created++;
    console.log(`  ✓ ${a.name}`);
  }
  console.log(`\nDone — ${created} created, ${skipped} already existed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
