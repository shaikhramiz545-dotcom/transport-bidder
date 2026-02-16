/**
 * Tour flags – shared between public tours API and agency portal.
 * Same flags user sees are shown to travel agents on their tour.
 */
const { Op, fn, col } = require('sequelize');
const { Tour, TourBooking, TourReview } = require('../models');

/** New arrival: 1 month only. After that, flags auto-update by revenue/ratings. */
const NEW_ARRIVAL_DAYS = 30;

/** Compute flags for tours. Uses platform-wide ranking for "most_selling".
 * Returns { flagsMap: { tourId -> [flags] }, revenueMap }.
 */
async function computeTourFlags(tours) {
  const tourIds = tours.map((t) => t.id);
  if (!tourIds.length) return { flagsMap: {}, revenueMap: {} };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const cutoffNew = new Date();
  cutoffNew.setDate(cutoffNew.getDate() - NEW_ARRIVAL_DAYS);

  const allApprovedIds = await Tour.findAll({
    where: { status: 'approved' },
    attributes: ['id'],
    raw: true,
  }).then((rows) => rows.map((r) => r.id));

  const [revenueRows, yesterdayRows, ratingRows, globalRevenueRows] = await Promise.all([
    TourBooking.findAll({
      where: { tourId: tourIds, status: 'paid' },
      attributes: ['tourId', [fn('SUM', col('totalAmount')), 'revenue'], [fn('COUNT', col('id')), 'count']],
      group: ['tourId'],
      raw: true,
    }),
    TourBooking.findAll({
      where: {
        tourId: tourIds,
        status: 'paid',
        createdAt: { [Op.gte]: yesterdayStart, [Op.lte]: yesterdayEnd },
      },
      attributes: ['tourId', [fn('COUNT', col('id')), 'count']],
      group: ['tourId'],
      raw: true,
    }),
    TourReview.findAll({
      where: { tourId: tourIds },
      attributes: ['tourId', [fn('AVG', col('rating')), 'avgRating'], [fn('COUNT', col('id')), 'reviewCount']],
      group: ['tourId'],
      raw: true,
    }),
    allApprovedIds.length
      ? TourBooking.findAll({
          where: { tourId: allApprovedIds, status: 'paid' },
          attributes: ['tourId', [fn('SUM', col('totalAmount')), 'revenue']],
          group: ['tourId'],
          raw: true,
        })
      : [],
  ]);

  const revenueMap = {};
  revenueRows.forEach((r) => {
    revenueMap[r.tourId] = parseFloat(r.revenue) || 0;
  });

  const yesterdayCountMap = {};
  yesterdayRows.forEach((r) => {
    yesterdayCountMap[r.tourId] = parseInt(r.count, 10) || 0;
  });

  const ratingMap = {};
  ratingRows.forEach((r) => {
    ratingMap[r.tourId] = { avg: parseFloat(r.avgRating) || 0, count: parseInt(r.reviewCount, 10) || 0 };
  });

  const globalRevenueMap = {};
  globalRevenueRows.forEach((r) => {
    globalRevenueMap[r.tourId] = parseFloat(r.revenue) || 0;
  });
  const revenueSorted = allApprovedIds
    .filter((id) => (globalRevenueMap[id] || 0) > 0)
    .sort((a, b) => (globalRevenueMap[b] || 0) - (globalRevenueMap[a] || 0));
  const topByRevenue = new Set(revenueSorted.slice(0, 5));

  const flagsMap = {};
  for (const t of tours) {
    const tourId = t.id;
    const flags = [];
    const yesterdayCount = yesterdayCountMap[tourId] || 0;
    const rating = ratingMap[tourId] || { avg: 0, count: 0 };
    const createdAt = t.createdAt ? new Date(t.createdAt) : null;
    const isNewArrival = createdAt && createdAt >= cutoffNew;

    if (yesterdayCount >= 1) {
      flags.push({ type: 'booked_yesterday', text: `Booked ${yesterdayCount} time${yesterdayCount > 1 ? 's' : ''} yesterday` });
    }
    if (topByRevenue.has(tourId)) {
      const rank = revenueSorted.indexOf(tourId) + 1;
      flags.push({ type: 'most_selling', text: rank === 1 ? '#1 selling' : `#${rank} selling` });
    }
    if (rating.count >= 5 && rating.avg >= 4.5) {
      flags.push({ type: 'top_rated', text: 'Top rated' });
    }
    if (isNewArrival) {
      flags.push({ type: 'new_arrival', text: 'New arrival' });
    }

    flagsMap[tourId] = flags.slice(0, 3);
  }

  return { flagsMap, revenueMap };
}

module.exports = { computeTourFlags };
