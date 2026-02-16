/**
 * Tour Booking API – Create booking, dLocal Go payment, webhook.
 */
const express = require('express');
const crypto = require('crypto');
const { Tour, TourSlot, TourPaxOption, TravelAgency, TourBooking, AgencyWallet, AdminSettings } = require('../models');
const dlocal = require('../services/dlocal');

const router = express.Router();
const TOURS_COMMISSION_PERCENT = 15;

/** Generate voucher code */
function genVoucherCode() {
  return 'TB' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/** POST / – Create booking + init payment. Returns redirect_url. */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      tourId,
      tourSlotId,
      paxOptionId,
      paxCount,
      guestName,
      guestEmail,
      guestPhone,
      guestWhatsApp,
      specialInstructions,
      preferredLanguage,
      meetingPoint,
      successUrl,
      backUrl,
    } = body;

    if (!tourId || !tourSlotId || !paxOptionId || !paxCount || !guestName || !guestEmail) {
      return res.status(400).json({ error: 'tourId, tourSlotId, paxOptionId, paxCount, guestName, guestEmail required' });
    }

    const tour = await Tour.findByPk(tourId, {
      include: [
        { model: TravelAgency, as: 'TravelAgency' },
        { model: TourPaxOption, as: 'TourPaxOptions' },
        { model: TourSlot, as: 'TourSlots' },
      ],
    });
    if (!tour || tour.status !== 'approved') return res.status(404).json({ error: 'Tour not found' });

    const slot = (tour.TourSlots || []).find((s) => String(s.id) === String(tourSlotId));
    if (!slot) return res.status(400).json({ error: 'Invalid slot' });
    if (slot.bookedPax + parseInt(paxCount, 10) > slot.maxPax) {
      return res.status(400).json({ error: 'Not enough capacity for this slot' });
    }

    const paxOpt = (tour.TourPaxOptions || []).find((p) => String(p.id) === String(paxOptionId));
    if (!paxOpt) return res.status(400).json({ error: 'Invalid pax option' });

    const count = parseInt(paxCount, 10) || 1;
    const totalAmount = paxOpt.pricePerPax * count;
    const currency = tour.TravelAgency?.currency || 'USD';
    const country = tour.country || 'PE';

    const booking = await TourBooking.create({
      tourId: tour.id,
      tourSlotId: slot.id,
      travelAgencyId: tour.travelAgencyId,
      totalAmount,
      currency,
      paxCount: count,
      guestName: (guestName || '').trim(),
      guestEmail: (guestEmail || '').trim(),
      guestPhone: (guestPhone || '').trim() || null,
      guestWhatsApp: (guestWhatsApp || '').trim() || null,
      specialInstructions: (specialInstructions || '').trim() || null,
      preferredLanguage: (preferredLanguage || 'en').trim(),
      meetingPoint: (meetingPoint || '').trim() || tour.meetingPoint,
      status: 'pending_payment',
      voucherCode: genVoucherCode(),
    });

    let redirectUrl = null;
    let paymentId = null;

    if (dlocal.isConfigured()) {
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const payment = await dlocal.createPayment({
        orderId: `TB-${booking.id}`,
        amount: totalAmount,
        currency,
        country,
        description: `Tour: ${tour.title}`,
        successUrl: successUrl || `${baseUrl}/tours/booking/${booking.id}/success`,
        backUrl: backUrl || `${baseUrl}/tours/booking/${booking.id}/cancel`,
        notificationUrl: `${baseUrl}/api/tours/bookings/webhook`,
        payer: { name: guestName, email: guestEmail, phone: guestPhone },
      });
      redirectUrl = payment.redirectUrl;
      paymentId = payment.paymentId;
      await booking.update({ dlocalPaymentId: paymentId });
    } else {
      return res.status(503).json({
        error: 'Payment gateway not configured',
        bookingId: String(booking.id),
        message: 'Set DLOCAL_API_KEY and DLOCAL_SECRET_KEY in .env for tour payments.',
      });
    }

    return res.status(201).json({
      bookingId: String(booking.id),
      voucherCode: booking.voucherCode,
      totalAmount,
      currency,
      redirectUrl,
      paymentId,
    });
  } catch (err) {
    console.error('[tour-bookings] create', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /webhook – dLocal notification (payment status) */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body || {};
    const paymentId = payload.id || payload.payment_id;
    const status = (payload.status || '').toUpperCase();
    const orderId = payload.order_id || payload.orderId;

    if (!orderId || !paymentId) {
      return res.status(400).json({ error: 'Missing order_id or payment id' });
    }

    const bookingId = orderId.replace(/^TB-/, '');
    const booking = await TourBooking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await booking.update({ dlocalPaymentId: paymentId, dlocalStatus: status });

    if (status === 'PAID' || status === 'COMPLETED') {
      if (booking.status === 'pending_payment') {
        await booking.update({ status: 'paid' });

        const slot = await TourSlot.findByPk(booking.tourSlotId);
        if (slot) await slot.increment('bookedPax', { by: booking.paxCount });

        const settingsRow = await AdminSettings.findByPk('global');
        const commissionPercent = settingsRow?.commissionPercent ?? TOURS_COMMISSION_PERCENT;
        const commission = (booking.totalAmount * commissionPercent) / 100;
        const agencyShare = booking.totalAmount - commission;

        const [wallet] = await AgencyWallet.findOrCreate({
          where: { travelAgencyId: booking.travelAgencyId },
          defaults: { travelAgencyId: booking.travelAgencyId, balance: 0, currency: booking.currency },
        });
        await wallet.increment('balance', { by: agencyShare });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[tour-bookings] webhook', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /:id – Booking detail (for success/cancel page) */
router.get('/:id', async (req, res) => {
  try {
    const booking = await TourBooking.findByPk(req.params.id, {
      include: [
        { model: Tour, as: 'Tour', include: [{ model: TravelAgency, as: 'TravelAgency' }] },
        { model: TourSlot, as: 'TourSlot' },
      ],
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    return res.json({
      id: String(booking.id),
      voucherCode: booking.voucherCode,
      status: booking.status,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      paxCount: booking.paxCount,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      tour: booking.Tour ? {
        title: booking.Tour.title,
        city: booking.Tour.city,
        country: booking.Tour.country,
        meetingPoint: booking.meetingPoint || booking.Tour.meetingPoint,
        agencyName: booking.Tour.TravelAgency?.name,
        agencyPhone: booking.Tour.TravelAgency?.phone,
      } : null,
      slot: booking.TourSlot ? {
        slotDate: booking.TourSlot.slotDate,
        startTime: booking.TourSlot.startTime,
        endTime: booking.TourSlot.endTime,
      } : null,
      createdAt: booking.createdAt,
    });
  } catch (err) {
    console.error('[tour-bookings] get', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
