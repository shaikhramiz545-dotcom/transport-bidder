/**
 * Tours API – Attractions / Tours module (worldwide).
 * List, detail, search by city/country. Booking + dLocal Go payment.
 * Flags: Booked X yesterday, Most selling, Top rated, New Arrival (1-3 per tour).
 * Sort: Revenue-based (highest first, zero revenue last).
 */
const express = require('express');
const { Op } = require('sequelize');
const { Tour, TravelAgency, TourPaxOption, TourSlot, FeatureFlag } = require('../models');
const { computeTourFlags } = require('../services/tour-flags');
const tourBookingsRouter = require('./tour-bookings');

const router = express.Router();

router.use('/bookings', tourBookingsRouter);

/** Ensure feature flag exists. attractions_enabled default ON. */
async function ensureFeatureFlag() {
  const row = await FeatureFlag.findByPk('attractions_enabled');
  if (!row) {
    await FeatureFlag.create({ key: 'attractions_enabled', value: true });
    return true;
  }
  return !!row.value;
}

/** GET /api/tours/ticker-messages – Messages for bottom scrolling banner (main screen). Random order. */
const TICKER_MESSAGES = [
  "Free cancellation – You'll receive a full refund if you cancel at least 24 hours in advance of most experiences.",
  "Book now, pay later – Reserve your spot and pay when you're ready.",
  "Skip the line – Save time with priority access on selected tours.",
  "Best price guarantee – Found a lower price? We'll match it.",
  "Local experts – Curated tours by trusted travel partners.",
  "Flexible booking – Change your plans up to 24 hours before.",
];
router.get('/ticker-messages', async (_req, res) => {
  try {
    const enabled = await ensureFeatureFlag();
    if (!enabled) return res.json({ messages: [] });
    const shuffled = [...TICKER_MESSAGES].sort(() => Math.random() - 0.5);
    return res.json({ messages: shuffled });
  } catch (err) {
    console.error('[tours] ticker', err.message);
    return res.json({ messages: TICKER_MESSAGES });
  }
});

/** GET /api/tours/feature-flag – Is Attractions module enabled? */
router.get('/feature-flag', async (_req, res) => {
  try {
    const enabled = await ensureFeatureFlag();
    return res.json({ attractionsEnabled: enabled });
  } catch (err) {
    console.error('[tours] feature-flag', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/tours – List approved tours. Query: country, city, category, q (search) */
router.get('/', async (req, res) => {
  try {
    const enabled = await ensureFeatureFlag();
    if (!enabled) {
      return res.json({ tours: [], message: 'Attractions module is disabled' });
    }

    const { country, city, category, q } = req.query;
    const where = { status: 'approved' };

    if (country) where.country = { [Op.iLike]: `%${country}%` };
    if (city) where.city = { [Op.iLike]: `%${city}%` };
    if (category) where.category = category;
    if (q && q.trim()) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q.trim()}%` } },
        { location: { [Op.iLike]: `%${q.trim()}%` } },
        { city: { [Op.iLike]: `%${q.trim()}%` } },
      ];
    }

    const tours = await Tour.findAll({
      where,
      include: [
        { model: TravelAgency, as: 'TravelAgency', attributes: ['id', 'name', 'country'] },
        { model: TourPaxOption, as: 'TourPaxOptions', attributes: ['id', 'label', 'pricePerPax', 'currency'] },
      ],
      limit: 100,
    });

    const { flagsMap, revenueMap } = await computeTourFlags(tours);

    const sorted = [...tours].sort((a, b) => {
      const revA = revenueMap[a.id] || 0;
      const revB = revenueMap[b.id] || 0;
      if (revA > 0 && revB > 0) return revB - revA;
      if (revA > 0) return -1;
      if (revB > 0) return 1;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const list = sorted.slice(0, 50).map((t) => {
      const prices = (t.TourPaxOptions || []).map((p) => p.pricePerPax);
      const startingPrice = prices.length ? Math.min(...prices) : null;
      return {
        id: String(t.id),
        title: t.title,
        country: t.country,
        city: t.city,
        location: t.location,
        category: t.category,
        images: t.images || [],
        thumbnailUrl: (t.images && t.images[0]) || null,
        durationMins: t.durationMins,
        agencyName: t.TravelAgency?.name,
        startingPrice,
        currency: t.TravelAgency?.currency || 'USD',
        flags: flagsMap[t.id] || [],
        freeCancellation: !!t.freeCancellation,
        freeCancellationHours: t.freeCancellationHours || 24,
        createdAt: t.createdAt,
      };
    });

    return res.json({ tours: list });
  } catch (err) {
    console.error('[tours] list', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/tours/:id – Tour detail (approved only) */
router.get('/:id', async (req, res) => {
  try {
    const enabled = await ensureFeatureFlag();
    if (!enabled) {
      return res.status(403).json({ error: 'Attractions module is disabled' });
    }

    const tour = await Tour.findByPk(req.params.id, {
      include: [
        { model: TravelAgency, as: 'TravelAgency', attributes: ['id', 'name', 'country', 'currency'] },
        { model: TourPaxOption, as: 'TourPaxOptions' },
        { model: TourSlot, as: 'TourSlots', where: { slotDate: { [Op.gte]: new Date().toISOString().slice(0, 10) } }, required: false },
      ],
    });

    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    if (tour.status !== 'approved') return res.status(404).json({ error: 'Tour not found' });

    const slots = (tour.TourSlots || []).filter((s) => s.bookedPax < s.maxPax);

    return res.json({
      id: String(tour.id),
      title: tour.title,
      country: tour.country,
      city: tour.city,
      location: tour.location,
      category: tour.category,
      description: tour.description,
      includedServices: tour.includedServices,
      images: tour.images || [],
      videoUrl: tour.videoUrl || null,
      durationMins: tour.durationMins,
      meetingPoint: tour.meetingPoint,
      cancellationPolicy: tour.cancellationPolicy,
      freeCancellation: !!tour.freeCancellation,
      freeCancellationHours: tour.freeCancellationHours || 24,
      languages: tour.languages || [],
      agency: tour.TravelAgency ? {
        id: String(tour.TravelAgency.id),
        name: tour.TravelAgency.name,
        country: tour.TravelAgency.country,
        currency: tour.TravelAgency.currency,
      } : null,
      paxOptions: (tour.TourPaxOptions || []).map((p) => ({
        id: String(p.id),
        label: p.label,
        pricePerPax: p.pricePerPax,
        currency: p.currency,
        minCount: p.minCount,
        maxCount: p.maxCount,
      })),
      slots: slots.map((s) => ({
        id: String(s.id),
        slotDate: s.slotDate,
        startTime: s.startTime,
        endTime: s.endTime,
        maxPax: s.maxPax,
        bookedPax: s.bookedPax,
        availablePax: s.maxPax - s.bookedPax,
      })),
    });
  } catch (err) {
    console.error('[tours] detail', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
