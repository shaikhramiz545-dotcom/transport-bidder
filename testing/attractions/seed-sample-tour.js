/**
 * Seed script – Add sample Travel Agency + Tour for testing.
 * Run from project root: node testing/attractions/seed-sample-tour.js
 * Or from backend: node ../testing/attractions/seed-sample-tour.js
 */
const path = require('path');

const backendDir = path.resolve(__dirname, '..', '..', 'backend');
require('dotenv').config({ path: path.join(backendDir, '.env') });

const { sequelize } = require(path.join(backendDir, 'src', 'config', 'db'));
const { TravelAgency, Tour, TourPaxOption, TourSlot, FeatureFlag } = require(path.join(backendDir, 'src', 'models'));

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('[seed] DB connected');

    // Ensure feature flag ON
    const [flag] = await FeatureFlag.findOrCreate({
      where: { key: 'attractions_enabled' },
      defaults: { key: 'attractions_enabled', value: true },
    });
    if (!flag.value) await flag.update({ value: true });
    console.log('[seed] Feature flag: attractions_enabled = true');

    // Create or find agency
    let agency = await TravelAgency.findOne({ where: { email: 'test-agency@tbidder.com' } });
    if (!agency) {
      agency = await TravelAgency.create({
        name: 'Peru Explorers Travel',
        email: 'test-agency@tbidder.com',
        phone: '+51 999 123 456',
        country: 'PE',
        currency: 'PEN',
        status: 'approved',
      });
      console.log('[seed] Created agency:', agency.name);
    }

    // Check if sample tour exists
    const existing = await Tour.findOne({ where: { title: 'Machu Picchu Day Tour - Sample' } });
    if (existing) {
      console.log('[seed] Sample tour already exists (id:', existing.id, '). Skipping.');
      process.exit(0);
      return;
    }

    const tour = await Tour.create({
      travelAgencyId: agency.id,
      title: 'Machu Picchu Day Tour - Sample',
      country: 'PE',
      city: 'Cusco',
      location: 'Machu Picchu Citadel',
      category: 'cultural',
      description: 'A full-day guided tour to the iconic Machu Picchu citadel. Experience the wonder of the Incan empire.',
      includedServices: '• Round-trip train ticket\n• Entry ticket\n• English/Spanish guide\n• Lunch',
      images: [],
      durationMins: 480,
      meetingPoint: 'Cusco Hotel Lobby',
      cancellationPolicy: 'Free cancellation up to 24h before.',
      languages: ['en', 'es'],
      status: 'approved',
    });
    console.log('[seed] Created tour:', tour.title);

    await TourPaxOption.bulkCreate([
      { tourId: tour.id, label: 'Adult', pricePerPax: 150, currency: 'PEN', minCount: 1 },
      { tourId: tour.id, label: 'Child (5-12)', pricePerPax: 75, currency: 'PEN', minCount: 0 },
    ]);
    console.log('[seed] Added pax options');

    const today = new Date();
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    for (const d of dates) {
      await TourSlot.create({ tourId: tour.id, slotDate: d, startTime: '06:00', endTime: '18:00', maxPax: 15, bookedPax: 0 });
      await TourSlot.create({ tourId: tour.id, slotDate: d, startTime: '09:00', endTime: '21:00', maxPax: 10, bookedPax: 0 });
    }
    console.log('[seed] Added slots for next 7 days');

    console.log('[seed] Done. Tour ID:', tour.id);
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

seed();
