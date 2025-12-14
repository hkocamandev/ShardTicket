// backend/scripts/seed.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Ticket from '../src/models/Ticket.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketing';
const MODE = process.env.SEED_MODE || 'multi'; // multi | hot

async function seed() {
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  console.log('Connected');

  const Tenant = (await import('../src/models/Tenant.js')).default;
  const Event = (await import('../src/models/Event.js')).default;

  await Tenant.deleteMany({});
  await Event.deleteMany({});
  await Ticket.deleteMany({});

  if (MODE === 'hot') {
    console.log('🔥 Seeding HOT EVENT scenario');

    await Tenant.create({
      tenantId: 'tenant_1',
      name: 'Hot Tenant'
    });

await Event.create({
  eventId: 'tenant_1_evt_1',
  tenantId: 'tenant_1',
  title: 'Hot Event',
  date: new Date(),
  totalTickets: 10000,
  remainingTickets: 10000,
  price: 50
});

  } else {
    console.log('🌍 Seeding MULTI EVENT scenario');

    const tenants = [
      { tenantId: 'tenant_1', name: 'Tenant One' },
      { tenantId: 'tenant_2', name: 'Tenant Two' },
      { tenantId: 'tenant_3', name: 'Tenant Three' }
    ];

    for (const t of tenants) {
      await Tenant.create(t);
      for (let i = 1; i <= 10; i++) {
        await Event.create({
          eventId: `${t.tenantId}_evt_${i}`,
          tenantId: t.tenantId,
          title: `${t.name} - Event ${i}`,
          date: new Date(Date.now() + i * 86400000),
          totalTickets: 5000,
          remainingTickets: 5000,
          price: 50
        });
      }
    }
  }

  console.log('Seeding completed');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
