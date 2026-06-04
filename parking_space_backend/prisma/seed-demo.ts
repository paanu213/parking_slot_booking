/**
 * Demo data seeder — populates the DB with realistic dummy content so the
 * customer Explore page, vendor dashboard, and admin tables all show data
 * instead of empty states.
 *
 * Idempotent for users/vendors/locations/slots (upserts). Re-creates demo
 * bookings, payments, and audit logs each run so the dashboards stay fresh.
 *
 * Run:  npm run prisma:seed-demo -w @ps/api
 */
import {
  PrismaClient,
  VendorStatus,
  SlotStatus,
  BookingStatus,
  PaymentStatus,
  Role,
} from '@prisma/client';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Demo!2345';
const DEMO_EMAIL_SUFFIX = '@autosahay.local';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type VendorSeed = {
  email: string;
  fullName: string;
  phone: string;
  businessName: string;
  contactPhone: string;
  address: string;
  status?: VendorStatus;
  rejectionNote?: string;
  locations?: LocationSeed[];
};

type LocationSeed = {
  name: string;
  description: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  images: string[];
  slots: SlotSeed[];
};

type SlotSeed = {
  code: string;
  hourlyPrice: number;
  dailyPrice: number;
  monthlyPrice?: number;
  status?: SlotStatus;
};

type CustomerSeed = { email: string; fullName: string; phone: string };
type AdminSeed = { email: string; fullName: string; role: Role };

// ────────────────────────────────────────────────────────────────────────────
// APPROVED vendors (with locations, slots, images)
// ────────────────────────────────────────────────────────────────────────────

const approvedVendors: VendorSeed[] = [
  {
    email: 'vendor.hitech' + DEMO_EMAIL_SUFFIX,
    fullName: 'Ravi Kumar',
    phone: '+919000000011',
    businessName: 'HiTech City Parking Co.',
    contactPhone: '+914023456789',
    address: 'Plot 42, HITEC City, Hyderabad',
    locations: [
      {
        name: 'HITEC City Tower Basement',
        description:
          'Covered basement parking next to Cyber Towers. 24x7 security, CCTV, and easy lift access to office floors.',
        addressLine: 'Cyber Towers, HITEC City Main Rd',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        latitude: 17.448294,
        longitude: 78.391487,
        images: [
          'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200',
          'https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=1200',
        ],
        slots: [
          { code: 'A-01', hourlyPrice: 40, dailyPrice: 280, monthlyPrice: 5500 },
          { code: 'A-02', hourlyPrice: 40, dailyPrice: 280, monthlyPrice: 5500 },
          { code: 'A-03', hourlyPrice: 40, dailyPrice: 280 },
          { code: 'B-01', hourlyPrice: 50, dailyPrice: 320, monthlyPrice: 6500 },
        ],
      },
      {
        name: 'Madhapur Metro Secure Lot',
        description:
          'Open-air lot, 2 minutes walk from Madhapur metro. Attendant on duty till midnight.',
        addressLine: 'Opposite Madhapur Metro Stn, Ayyappa Society',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        latitude: 17.441558,
        longitude: 78.39156,
        images: ['https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=1200'],
        slots: [
          { code: 'L-01', hourlyPrice: 30, dailyPrice: 200 },
          { code: 'L-02', hourlyPrice: 30, dailyPrice: 200 },
          { code: 'L-03', hourlyPrice: 30, dailyPrice: 200, status: 'INACTIVE' },
        ],
      },
    ],
  },
  {
    email: 'vendor.banjara' + DEMO_EMAIL_SUFFIX,
    fullName: 'Sneha Reddy',
    phone: '+919000000012',
    businessName: 'Banjara Hills Valet',
    contactPhone: '+914023456700',
    address: 'Road No. 12, Banjara Hills, Hyderabad',
    locations: [
      {
        name: 'GVK One Mall Valet Parking',
        description:
          'Valet service at GVK One entrance. Premium covered bays, EV charging at select slots.',
        addressLine: 'GVK One, Road No. 1, Banjara Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
        latitude: 17.414722,
        longitude: 78.446945,
        images: [
          'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200',
          'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=1200',
        ],
        slots: [
          { code: 'V-01', hourlyPrice: 80, dailyPrice: 500, monthlyPrice: 11000 },
          { code: 'V-02', hourlyPrice: 80, dailyPrice: 500, monthlyPrice: 11000 },
          { code: 'EV-01', hourlyPrice: 100, dailyPrice: 600 },
        ],
      },
    ],
  },
  {
    email: 'vendor.gachibowli' + DEMO_EMAIL_SUFFIX,
    fullName: 'Arun Prakash',
    phone: '+919000000013',
    businessName: 'Gachibowli Gateway Parking',
    contactPhone: '+914023456701',
    address: 'DLF Cyber City, Gachibowli, Hyderabad',
    locations: [
      {
        name: 'DLF Gateway Multi-Level',
        description:
          'Multi-level covered parking inside DLF Gateway. Ideal for long stays and office commuters.',
        addressLine: 'DLF Cyber City, Gachibowli',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500032',
        latitude: 17.440554,
        longitude: 78.348915,
        images: ['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200'],
        slots: [
          { code: 'G-101', hourlyPrice: 35, dailyPrice: 250, monthlyPrice: 5000 },
          { code: 'G-102', hourlyPrice: 35, dailyPrice: 250, monthlyPrice: 5000 },
          { code: 'G-103', hourlyPrice: 35, dailyPrice: 250 },
          { code: 'G-104', hourlyPrice: 35, dailyPrice: 250 },
        ],
      },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// PENDING + REJECTED vendors — for admin approve/reject queue
// ────────────────────────────────────────────────────────────────────────────

const pendingVendors: VendorSeed[] = [
  {
    email: 'vendor.jubilee' + DEMO_EMAIL_SUFFIX,
    fullName: 'Priya Iyer',
    phone: '+919000000014',
    businessName: 'Jubilee Hills Premier Parking',
    contactPhone: '+914023456702',
    address: 'Road No. 36, Jubilee Hills, Hyderabad',
    status: VendorStatus.PENDING,
  },
  {
    email: 'vendor.koramangala' + DEMO_EMAIL_SUFFIX,
    fullName: 'Karthik Rao',
    phone: '+919000000015',
    businessName: 'Koramangala Car Park',
    contactPhone: '+918023456789',
    address: '5th Block, Koramangala, Bengaluru',
    status: VendorStatus.PENDING,
  },
  {
    email: 'vendor.powai' + DEMO_EMAIL_SUFFIX,
    fullName: 'Neha Shah',
    phone: '+919000000016',
    businessName: 'Powai Lakeside Parking',
    contactPhone: '+912223456789',
    address: 'Hiranandani Gardens, Powai, Mumbai',
    status: VendorStatus.PENDING,
  },
];

const rejectedVendors: VendorSeed[] = [
  {
    email: 'vendor.rejected' + DEMO_EMAIL_SUFFIX,
    fullName: 'Unverified Operator',
    phone: '+919000000017',
    businessName: 'Budget Parking Solutions',
    contactPhone: '+919900000000',
    address: 'Unverified address',
    status: VendorStatus.REJECTED,
    rejectionNote: 'Unable to verify business registration documents. Please resubmit GST + PAN.',
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Customers
// ────────────────────────────────────────────────────────────────────────────

const customers: CustomerSeed[] = [
  { email: 'demo.customer' + DEMO_EMAIL_SUFFIX, fullName: 'Demo Customer', phone: '+919000000099' },
  { email: 'anitha.r' + DEMO_EMAIL_SUFFIX, fullName: 'Anitha Ramesh', phone: '+919000000101' },
  { email: 'vikram.s' + DEMO_EMAIL_SUFFIX, fullName: 'Vikram Singh', phone: '+919000000102' },
  { email: 'meera.k' + DEMO_EMAIL_SUFFIX, fullName: 'Meera Kapoor', phone: '+919000000103' },
  { email: 'rohan.m' + DEMO_EMAIL_SUFFIX, fullName: 'Rohan Mehta', phone: '+919000000104' },
  { email: 'divya.n' + DEMO_EMAIL_SUFFIX, fullName: 'Divya Nair', phone: '+919000000105' },
  { email: 'sandeep.t' + DEMO_EMAIL_SUFFIX, fullName: 'Sandeep Tiwari', phone: '+919000000106' },
  { email: 'kavya.p' + DEMO_EMAIL_SUFFIX, fullName: 'Kavya Pillai', phone: '+919000000107' },
];

// ────────────────────────────────────────────────────────────────────────────
// Admins (in addition to SUPER_ADMIN created by main seed)
// ────────────────────────────────────────────────────────────────────────────

const admins: AdminSeed[] = [
  { email: 'admin.ops' + DEMO_EMAIL_SUFFIX, fullName: 'Ops Admin', role: Role.ADMIN },
  { email: 'admin.finance' + DEMO_EMAIL_SUFFIX, fullName: 'Finance Admin', role: Role.ADMIN },
  { email: 'subadmin.support' + DEMO_EMAIL_SUFFIX, fullName: 'Support Agent', role: Role.SUB_ADMIN },
  { email: 'subadmin.qa' + DEMO_EMAIL_SUFFIX, fullName: 'QA Reviewer', role: Role.SUB_ADMIN },
];

// ────────────────────────────────────────────────────────────────────────────
// Upsert helpers
// ────────────────────────────────────────────────────────────────────────────

async function upsertUser(params: {
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {},
    create: {
      email: params.email,
      fullName: params.fullName,
      phone: params.phone,
      role: params.role,
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: params.passwordHash,
    },
  });
}

async function upsertVendorRow(v: VendorSeed, passwordHash: string) {
  const user = await upsertUser({
    email: v.email,
    fullName: v.fullName,
    phone: v.phone,
    role: Role.VENDOR,
    passwordHash,
  });

  const status = v.status ?? VendorStatus.APPROVED;
  const approved = status === VendorStatus.APPROVED ? new Date() : null;

  const vendor = await prisma.vendor.upsert({
    where: { userId: user.id },
    update: { status, approvedAt: approved, rejectionNote: v.rejectionNote ?? null },
    create: {
      userId: user.id,
      businessName: v.businessName,
      contactPhone: v.contactPhone,
      address: v.address,
      status,
      approvedAt: approved,
      rejectionNote: v.rejectionNote ?? null,
    },
  });

  for (const loc of v.locations ?? []) {
    const existing = await prisma.parkingLocation.findFirst({
      where: { vendorId: vendor.id, name: loc.name },
    });
    const location = existing
      ? await prisma.parkingLocation.update({
          where: { id: existing.id },
          data: {
            description: loc.description,
            addressLine: loc.addressLine,
            city: loc.city,
            state: loc.state,
            pincode: loc.pincode,
            latitude: loc.latitude,
            longitude: loc.longitude,
            isActive: true,
            approvalStatus: 'APPROVED',
            approvedAt: new Date(),
          },
        })
      : await prisma.parkingLocation.create({
          data: {
            vendorId: vendor.id,
            name: loc.name,
            description: loc.description,
            addressLine: loc.addressLine,
            city: loc.city,
            state: loc.state,
            pincode: loc.pincode,
            latitude: loc.latitude,
            longitude: loc.longitude,
            isActive: true,
            approvalStatus: 'APPROVED',
            approvedAt: new Date(),
          },
        });

    await prisma.locationImage.deleteMany({ where: { locationId: location.id } });
    for (let i = 0; i < loc.images.length; i++) {
      await prisma.locationImage.create({
        data: { locationId: location.id, url: loc.images[i]!, sortOrder: i },
      });
    }

    for (const s of loc.slots) {
      await prisma.slot.upsert({
        where: { locationId_code: { locationId: location.id, code: s.code } },
        update: {
          hourlyPrice: s.hourlyPrice,
          dailyPrice: s.dailyPrice,
          monthlyPrice: s.monthlyPrice ?? null,
          status: s.status ?? 'ACTIVE',
        },
        create: {
          locationId: location.id,
          code: s.code,
          vehicleType: 'CAR',
          hourlyPrice: s.hourlyPrice,
          dailyPrice: s.dailyPrice,
          monthlyPrice: s.monthlyPrice ?? null,
          status: s.status ?? 'ACTIVE',
        },
      });
    }
  }

  return { vendor, user };
}

// ────────────────────────────────────────────────────────────────────────────
// Bookings + Payments generator
// ────────────────────────────────────────────────────────────────────────────

type BookingPlan = {
  customer: { id: string };
  slot: { id: string; hourlyPrice: number; dailyPrice: number };
  startOffsetHours: number; // relative to now — negative = past
  durationHours: number;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
};

async function createBookingPlans(customers: { id: string }[]) {
  // Pull all active slots with pricing
  const slots = await prisma.slot.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      hourlyPrice: true,
      dailyPrice: true,
      locationId: true,
    },
  });
  if (!slots.length || !customers.length) return [];

  const pick = <T>(arr: T[], i: number) => arr[i % arr.length]!;

  const plans: Omit<BookingPlan, 'customer' | 'slot'> &
    { customerIdx: number; slotIdx: number }[] = [] as any;

  // Define a scheduled mix — past/completed, upcoming/confirmed, pending, cancelled, failed
  const schedule: Array<{
    startOffset: number;
    duration: number;
    bookingStatus: BookingStatus;
    paymentStatus: PaymentStatus;
  }> = [
    // Past completed
    { startOffset: -72, duration: 4, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    { startOffset: -120, duration: 8, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    { startOffset: -168, duration: 3, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    { startOffset: -240, duration: 24, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    { startOffset: -360, duration: 2, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    { startOffset: -480, duration: 6, bookingStatus: 'COMPLETED', paymentStatus: 'PAID' },
    // Upcoming confirmed
    { startOffset: 24, duration: 3, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' },
    { startOffset: 48, duration: 5, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' },
    { startOffset: 72, duration: 2, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' },
    { startOffset: 120, duration: 8, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' },
    // Pending payment (abandoned cart-ish)
    { startOffset: 96, duration: 4, bookingStatus: 'PENDING_PAYMENT', paymentStatus: 'CREATED' },
    { startOffset: 144, duration: 2, bookingStatus: 'PENDING_PAYMENT', paymentStatus: 'CREATED' },
    // Cancelled (with refund)
    { startOffset: -48, duration: 3, bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' },
    // Failed
    { startOffset: -96, duration: 2, bookingStatus: 'FAILED', paymentStatus: 'FAILED' },
  ];

  // Fan out across customers and slots
  const result: BookingPlan[] = schedule.map((s, i) => {
    const slot = pick(slots, i);
    return {
      customer: pick(customers, i),
      slot: {
        id: slot.id,
        hourlyPrice: Number(slot.hourlyPrice),
        dailyPrice: Number(slot.dailyPrice),
      },
      startOffsetHours: s.startOffset,
      durationHours: s.duration,
      bookingStatus: s.bookingStatus,
      paymentStatus: s.paymentStatus,
    };
  });

  return result;
}

async function writeBookingsAndPayments(plans: BookingPlan[]) {
  const now = new Date();
  for (const p of plans) {
    const start = new Date(now.getTime() + p.startOffsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + p.durationHours * 60 * 60 * 1000);
    const amount =
      p.durationHours >= 24
        ? p.slot.dailyPrice * Math.ceil(p.durationHours / 24)
        : p.slot.hourlyPrice * p.durationHours;

    const booking = await prisma.booking.create({
      data: {
        reference: `PS-${nanoid(10).toUpperCase()}`,
        userId: p.customer.id,
        slotId: p.slot.id,
        startAt: start,
        endAt: end,
        totalAmount: amount,
        status: p.bookingStatus,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        status: p.paymentStatus,
        providerOrderId:
          p.paymentStatus === 'CREATED' || p.paymentStatus === 'PAID' || p.paymentStatus === 'REFUNDED'
            ? `order_demo_${nanoid(8)}`
            : null,
        providerPaymentId:
          p.paymentStatus === 'PAID' || p.paymentStatus === 'REFUNDED'
            ? `pay_demo_${nanoid(8)}`
            : null,
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Audit log helpers — so admin audit views show activity
// ────────────────────────────────────────────────────────────────────────────

async function writeAuditLogs(superAdminId: string | null, approvedVendorIds: string[]) {
  if (!superAdminId) return;
  const entries = [
    { action: 'vendor.approve', entity: 'Vendor', entityId: approvedVendorIds[0] },
    { action: 'vendor.approve', entity: 'Vendor', entityId: approvedVendorIds[1] },
    { action: 'vendor.approve', entity: 'Vendor', entityId: approvedVendorIds[2] },
    { action: 'admin.create', entity: 'User', metadata: 'Created Ops Admin' },
    { action: 'admin.create', entity: 'User', metadata: 'Created Finance Admin' },
    { action: 'pricing.update', entity: 'Slot', metadata: 'Bulk price refresh (Hyderabad)' },
    { action: 'auth.login', entity: 'User', metadata: 'Super admin login' },
  ].filter((e) => !e.entityId || typeof e.entityId === 'string');

  for (const e of entries) {
    await prisma.auditLog.create({
      data: {
        actorId: superAdminId,
        action: e.action,
        entity: e.entity,
        entityId: (e as any).entityId ?? null,
        metadata: (e as any).metadata ?? null,
        ip: '127.0.0.1',
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main run
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Seeding demo data…');
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);

  // Vendors
  const approved = [];
  for (const v of approvedVendors) {
    const { vendor } = await upsertVendorRow(v, passwordHash);
    approved.push(vendor);
    console.log(`  ✓ approved vendor: ${vendor.businessName}`);
  }
  for (const v of pendingVendors) {
    const { vendor } = await upsertVendorRow(v, passwordHash);
    console.log(`  ⋯ pending vendor:  ${vendor.businessName}`);
  }
  for (const v of rejectedVendors) {
    const { vendor } = await upsertVendorRow(v, passwordHash);
    console.log(`  ✗ rejected vendor: ${vendor.businessName}`);
  }

  // Admins
  for (const a of admins) {
    const u = await upsertUser({
      email: a.email,
      fullName: a.fullName,
      role: a.role,
      passwordHash,
    });
    console.log(`  ✓ ${a.role.toLowerCase()}: ${u.email}`);
  }

  // Customers
  const customerRows = [];
  for (const c of customers) {
    const u = await upsertUser({
      email: c.email,
      fullName: c.fullName,
      phone: c.phone,
      role: Role.CUSTOMER,
      passwordHash,
    });
    customerRows.push(u);
  }
  console.log(`  ✓ ${customerRows.length} customers`);

  // Bookings + payments — wipe existing demo ones and re-create fresh
  console.log('  ↻ refreshing bookings + payments');
  const demoCustomerIds = customerRows.map((c) => c.id);
  // Delete payments/bookings that belong to our demo customers so we get a clean slate
  await prisma.payment.deleteMany({
    where: { booking: { userId: { in: demoCustomerIds } } },
  });
  await prisma.booking.deleteMany({ where: { userId: { in: demoCustomerIds } } });

  const plans = await createBookingPlans(customerRows);
  await writeBookingsAndPayments(plans);
  console.log(`  ✓ ${plans.length} bookings + payments`);

  // Audit logs — wipe existing and re-seed
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  await prisma.auditLog.deleteMany({ where: { actorId: superAdmin?.id ?? '' } });
  await writeAuditLogs(
    superAdmin?.id ?? null,
    approved.map((v) => v.id),
  );
  console.log('  ✓ audit logs');

  // Summary
  const counts = {
    users: await prisma.user.count(),
    vendors: await prisma.vendor.count(),
    vendorsApproved: await prisma.vendor.count({ where: { status: 'APPROVED' } }),
    vendorsPending: await prisma.vendor.count({ where: { status: 'PENDING' } }),
    vendorsRejected: await prisma.vendor.count({ where: { status: 'REJECTED' } }),
    locations: await prisma.parkingLocation.count(),
    slots: await prisma.slot.count(),
    bookings: await prisma.booking.count(),
    bookingsConfirmed: await prisma.booking.count({ where: { status: 'CONFIRMED' } }),
    bookingsCompleted: await prisma.booking.count({ where: { status: 'COMPLETED' } }),
    bookingsPending: await prisma.booking.count({ where: { status: 'PENDING_PAYMENT' } }),
    bookingsCancelled: await prisma.booking.count({ where: { status: 'CANCELLED' } }),
    bookingsFailed: await prisma.booking.count({ where: { status: 'FAILED' } }),
    payments: await prisma.payment.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('\nDone.', counts);

  console.log(`\nAll demo logins use password: ${DEFAULT_PASSWORD}`);
  console.log('  super admin (existing): superadmin@autosahay.local (ChangeMe!234)');
  console.log('  admins:     admin.ops, admin.finance, subadmin.support, subadmin.qa' + DEMO_EMAIL_SUFFIX);
  console.log('  approved vendors: vendor.hitech, vendor.banjara, vendor.gachibowli' + DEMO_EMAIL_SUFFIX);
  console.log('  pending vendors:  vendor.jubilee, vendor.koramangala, vendor.powai' + DEMO_EMAIL_SUFFIX);
  console.log('  rejected vendor:  vendor.rejected' + DEMO_EMAIL_SUFFIX);
  console.log('  customers:        demo.customer, anitha.r, vikram.s, meera.k, rohan.m, divya.n, sandeep.t, kavya.p' + DEMO_EMAIL_SUFFIX);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
