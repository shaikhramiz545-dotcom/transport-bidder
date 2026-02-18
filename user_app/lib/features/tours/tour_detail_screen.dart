import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/core/country_codes.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/tours_service.dart';
import 'package:tbidder_user_app/widgets/country_code_phone_input.dart';
import 'package:url_launcher/url_launcher.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

class TourDetailScreen extends StatefulWidget {
  const TourDetailScreen({super.key, required this.tourId});

  final String tourId;

  @override
  State<TourDetailScreen> createState() => _TourDetailScreenState();
}

class _TourDetailScreenState extends State<TourDetailScreen> {
  final ToursService _toursService = ToursService();
  Map<String, dynamic>? _tour;
  bool _loading = true;
  String? _error;
  String? _selectedSlotId;
  String? _selectedPaxOptionId;
  int _paxCount = 1;
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  CountryCode _tourGuestCountryCode = countryCodes.firstWhere((c) => c.dialCode == '+51', orElse: () => countryCodes.first);
  bool _bookingInProgress = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await _toursService.getDetail(widget.tourId);
      if (mounted) {
        setState(() {
          _tour = data;
          _loading = false;
          final slots = data['slots'] as List<dynamic>? ?? [];
          final paxOptions = data['paxOptions'] as List<dynamic>? ?? [];
          if (slots.isNotEmpty && _selectedSlotId == null) _selectedSlotId = slots[0]['id']?.toString();
          if (paxOptions.isNotEmpty && _selectedPaxOptionId == null) _selectedPaxOptionId = paxOptions[0]['id']?.toString();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  String _t(String key) => AppLocaleScope.of(context)?.t(key) ?? key;

  Future<void> _book() async {
    if (_tour == null || _selectedSlotId == null || _selectedPaxOptionId == null) return;
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    if (name.isEmpty || email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('tours_guest_required')), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _bookingInProgress = true);
    try {
      final data = await _toursService.createBooking(
        tourId: widget.tourId,
        tourSlotId: _selectedSlotId!,
        paxOptionId: _selectedPaxOptionId!,
        paxCount: _paxCount,
        guestName: name,
        guestEmail: email,
        guestPhone: () {
        final digits = _phoneController.text.trim().replaceAll(RegExp(r'[^\d]'), '');
        if (digits.isEmpty) return null;
        return '${_tourGuestCountryCode.dialCode}$digits';
      }(),
      );
      if (!mounted) return;
      final redirectUrl = data['redirectUrl'] as String?;
      if (redirectUrl != null && redirectUrl.isNotEmpty) {
        final uri = Uri.tryParse(redirectUrl);
        if (uri != null && await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_t('tours_redirect_payment')), backgroundColor: Colors.green),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Voucher: ${data['voucherCode'] ?? ''}. Total: ${data['totalAmount']} ${data['currency']}'), backgroundColor: Colors.green),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${_t('tours_booking_created')} ${data['voucherCode'] ?? ''}'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _bookingInProgress = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppTheme.cream,
        appBar: AppBar(title: Text(_t('drawer_tours'), style: GoogleFonts.poppins(color: _kNeonOrange)), backgroundColor: Colors.white, leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context))),
        body: const Center(child: CircularProgressIndicator(color: _kNeonOrange)),
      );
    }
    if (_error != null || _tour == null) {
      return Scaffold(
        backgroundColor: AppTheme.cream,
        appBar: AppBar(title: Text(_t('drawer_tours'), style: GoogleFonts.poppins(color: _kNeonOrange)), backgroundColor: Colors.white, leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context))),
        body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Text(_error ?? 'Not found', style: GoogleFonts.poppins(color: Colors.grey.shade700)), const SizedBox(height: 16), TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(_t('tours_retry')))]))),
      );
    }

    final tour = _tour!;
    final title = tour['title'] as String? ?? '—';
    final description = tour['description'] as String? ?? '';
    final images = tour['images'] as List<dynamic>? ?? [];
    final paxOptions = tour['paxOptions'] as List<dynamic>? ?? [];
    final slots = tour['slots'] as List<dynamic>? ?? [];
    final currency = (tour['agency'] as Map<String, dynamic>?)?['currency'] ?? 'USD';
    final meetingPoint = tour['meetingPoint'] as String? ?? '';
    final durationMins = tour['durationMins'];
    final freeCancellation = tour['freeCancellation'] == true;

    double? totalPrice;
    if (_selectedPaxOptionId != null && paxOptions.isNotEmpty) {
      for (final p in paxOptions) {
        if (p['id']?.toString() == _selectedPaxOptionId) {
          totalPrice = (p['pricePerPax'] as num?)?.toDouble() ?? 0;
          totalPrice = totalPrice * _paxCount;
          break;
        }
      }
    }

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: Text(title, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: _kNeonOrange)),
        backgroundColor: Colors.white,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (images.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(images[0].toString(), height: 200, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(height: 200, color: Colors.grey.shade300)),
              )
            else
              Container(height: 200, decoration: BoxDecoration(color: _kNeonOrange.withOpacity(0.2), borderRadius: BorderRadius.circular(12)), child: const Center(child: Icon(Icons.landscape, size: 64, color: _kNeonOrange))),
            const SizedBox(height: 16),
            if (description.isNotEmpty) ...[
              Text(description, style: GoogleFonts.poppins(fontSize: 14, color: Colors.black87)),
              const SizedBox(height: 16),
            ],
            if (durationMins != null) Text('${_t('tours_duration')}: $durationMins min', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
            if (meetingPoint.isNotEmpty) Text('${_t('tours_meeting_point')}: $meetingPoint', style: GoogleFonts.poppins(fontSize: 14)),
            if (freeCancellation) Text(_t('tours_free_cancel'), style: GoogleFonts.poppins(fontSize: 13, color: Colors.green.shade700)),
            const SizedBox(height: 20),
            Text(_t('tours_select_date'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (slots.isEmpty)
              Text(_t('tours_no_slots'), style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade600))
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in slots)
                    ChoiceChip(
                      label: Text('${s['slotDate']} ${s['startTime'] ?? ''}'),
                      selected: _selectedSlotId == s['id']?.toString(),
                      onSelected: (_) => setState(() => _selectedSlotId = s['id']?.toString()),
                      selectedColor: _kNeonOrange.withOpacity(0.3),
                    ),
                ],
              ),
            const SizedBox(height: 20),
            Text(_t('tours_select_option'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (paxOptions.isEmpty)
              Text(_t('tours_no_options'), style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade600))
            else
              ...paxOptions.map<Widget>((p) {
                final id = p['id']?.toString();
                final label = p['label'] as String? ?? '—';
                final price = (p['pricePerPax'] as num?)?.toDouble() ?? 0;
                return RadioListTile<String>(
                  value: id!,
                  groupValue: _selectedPaxOptionId,
                  onChanged: (v) => setState(() => _selectedPaxOptionId = v),
                  title: Text(label, style: GoogleFonts.poppins(fontWeight: FontWeight.w500)),
                  subtitle: Text('$currency ${price.toStringAsFixed(2)} / ${_t('tours_pax')}'),
                  activeColor: _kNeonOrange,
                );
              }),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(_t('tours_guests'), style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
                const SizedBox(width: 16),
                IconButton.filled(icon: const Icon(Icons.remove, size: 20), onPressed: _paxCount > 1 ? () => setState(() => _paxCount--) : null, style: IconButton.styleFrom(backgroundColor: _kNeonOrange.withOpacity(0.3))),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text('$_paxCount', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600))),
                IconButton.filled(icon: const Icon(Icons.add, size: 20), onPressed: () => setState(() => _paxCount++), style: IconButton.styleFrom(backgroundColor: _kNeonOrange.withOpacity(0.3))),
              ],
            ),
            const SizedBox(height: 20),
            Text(_t('tours_guest_details'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            TextField(controller: _nameController, decoration: InputDecoration(labelText: _t('tours_guest_name'), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kNeonOrange, width: 2))), keyboardType: TextInputType.name),
            const SizedBox(height: 12),
            TextField(controller: _emailController, decoration: InputDecoration(labelText: _t('tours_guest_email'), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kNeonOrange, width: 2))), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            CountryCodePhoneInput(phoneController: _phoneController, selectedCountryCode: _tourGuestCountryCode, onCountryCodeChanged: (c) => setState(() => _tourGuestCountryCode = c), labelText: _t('tours_guest_phone'), hintText: _t('tours_guest_phone')),
            const SizedBox(height: 24),
            if (totalPrice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('${_t('tours_total')}: $currency ${totalPrice.toStringAsFixed(2)}', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: _kNeonOrange)),
              ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _bookingInProgress || slots.isEmpty ? null : _book,
                style: ElevatedButton.styleFrom(backgroundColor: _kNeonOrange, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: _bookingInProgress ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(_t('tours_book_now'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
