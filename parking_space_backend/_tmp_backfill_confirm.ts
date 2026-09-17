import { prisma } from './src/lib/prisma.js';
import { confirmOnPaymentOps } from './src/modules/qrOrders/qrOrders.service.js';

async function main() {
  const drifted = await prisma.qrOrder.findMany({
    where: { paymentStatus: 'PAID', status: 'PENDING' },
  });
  console.log('backfilling', drifted.length, 'orders');

  for (const order of drifted) {
    const ops = confirmOnPaymentOps(prisma, order);
    await prisma.$transaction(ops);
    console.log('confirmed', order.id);
  }

  const remaining = await prisma.qrOrder.count({ where: { paymentStatus: 'PAID', status: 'PENDING' } });
  console.log('remaining drifted (should be 0):', remaining);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
