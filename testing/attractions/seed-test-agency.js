/**
 * Seed a test travel agency for Agency Portal login.
 * Email: test@agency.com, Password: test123
 * Run from backend: npm run seed:agency
 */
const path = require('path');
const crypto = require('crypto');

const backendDir = path.resolve(__dirname, '..', '..', 'backend');
require('dotenv').config({ path: path.join(backendDir, '.env') });

const { sequelize } = require(path.join(backendDir, 'src', 'config', 'db'));
const { TravelAgency } = require(path.join(backendDir, 'src', 'models'));

const SALT = process.env.AGENCY_PASSWORD_SALT || 'tbidder-agency-salt-change-in-prod';
const hashPassword = (pwd) =>
  crypto.pbkdf2Sync(pwd, SALT, 100000, 64, 'sha512').toString('hex');

async function seed() {
  try {
    await sequelize.authenticate();
    let agency = await TravelAgency.findOne({ where: { email: 'test@agency.com' } });
    if (agency) {
      await agency.update({ passwordHash: hashPassword('test123') });
      console.log('[seed] Updated test agency password.');
    } else {
      agency = await TravelAgency.create({
        name: 'Test Travel Agency',
        email: 'test@agency.com',
        passwordHash: hashPassword('test123'),
        phone: '+51 999 000 000',
        country: 'PE',
        currency: 'PEN',
        status: 'approved',
      });
      console.log('[seed] Created test agency: test@agency.com / test123');
    }

    const existingTour = await require(path.join(backendDir, 'src', 'models')).Tour.findOne({
      where: { travelAgencyId: agency.id, title: 'Sample Cusco City Tour' },
    });
    if (!existingTour) {
      const tour = await require(path.join(backendDir, 'src', 'models')).Tour.create({
        travelAgencyId: agency.id,
        title: 'Sample Cusco City Tour',
        country: 'PE',
        city: 'Cusco',
        location: 'City Center',
        category: 'cultural',
        description: 'A sample tour for testing.',
        includedServices: '• Guide\n• Transport',
        durationMins: 240,
        meetingPoint: 'Main Square',
        languages: ['en', 'es'],
        status: 'pending',
      });
      await TourPaxOption.bulkCreate([
        { tourId: tour.id, label: 'Adult', pricePerPax: 50, currency: 'USD', minCount: 1 },
        { tourId: tour.id, label: 'Child', pricePerPax: 25, currency: 'USD', minCount: 0 },
      ]);
      const today = new Date();
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        await TourSlot.create({ tourId: tour.id, slotDate: d.toISOString().slice(0, 10), startTime: '09:00', endTime: '13:00', maxPax: 10, bookedPax: 0 });
      }
      console.log('[seed] Added sample tour (pending approval)');
    }
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  }
}

seed();
