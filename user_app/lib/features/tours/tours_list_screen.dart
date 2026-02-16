import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/tours_service.dart';
import 'package:tbidder_user_app/features/tours/tour_detail_screen.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

class ToursListScreen extends StatefulWidget {
  const ToursListScreen({super.key});

  @override
  State<ToursListScreen> createState() => _ToursListScreenState();
}

class _ToursListScreenState extends State<ToursListScreen> {
  final ToursService _toursService = ToursService();
  List<dynamic> _tours = [];
  bool _loading = true;
  String? _error;
  bool _connectionFailed = false;
  String _query = '';
  String? _category;

  static const List<Map<String, String>> categories = [
    {'value': '', 'label_en': 'All', 'label_es': 'Todos'},
    {'value': 'full_day', 'label_en': 'Full Day', 'label_es': 'Día completo'},
    {'value': 'night_tour', 'label_en': 'Night Tour', 'label_es': 'Tour nocturno'},
    {'value': 'adventure', 'label_en': 'Adventure', 'label_es': 'Aventura'},
    {'value': 'cultural', 'label_en': 'Cultural', 'label_es': 'Cultural'},
    {'value': 'family', 'label_en': 'Family', 'label_es': 'Familia'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; _connectionFailed = false; });
    try {
      final data = await _toursService.list(
        category: _category?.isEmpty ?? true ? null : _category,
        q: _query.trim().isEmpty ? null : _query.trim(),
      );
      if (mounted) {
        setState(() {
          _tours = (data['tours'] as List<dynamic>?) ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().replaceFirst('Exception: ', '');
        final isConnectionError = msg.toLowerCase().contains('failed to fetch') ||
            msg.toLowerCase().contains('connection') ||
            msg.toLowerCase().contains('socketexception') ||
            msg.toLowerCase().contains('network');
        setState(() {
          _error = isConnectionError ? null : msg;
          _tours = [];
          _loading = false;
          _connectionFailed = isConnectionError;
        });
      }
    }
  }

  String _t(String key) => AppLocaleScope.of(context)?.t(key) ?? key;

  @override
  Widget build(BuildContext context) {
    final isEs = Localizations.localeOf(context).languageCode == 'es';
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: Text(_t('drawer_tours'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: _kNeonOrange)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                decoration: InputDecoration(
                  hintText: _t('tours_search_hint'),
                  prefixIcon: const Icon(Icons.search, color: _kNeonOrange),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onChanged: (v) => setState(() => _query = v),
                onSubmitted: (_) => _load(),
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final c in categories)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(isEs ? c['label_es']! : c['label_en']!),
                        selected: _category == c['value'],
                        onSelected: (_) {
                          setState(() {
                            _category = c['value']!.isEmpty ? null : c['value'];
                            _load();
                          });
                        },
                        selectedColor: _kNeonOrange.withOpacity(0.3),
                        checkmarkColor: _kNeonOrange,
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: _kNeonOrange))
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(_connectionFailed ? Icons.wifi_off : Icons.error_outline, size: 48, color: Colors.grey.shade600),
                                const SizedBox(height: 16),
                                Text(
                                  _connectionFailed ? _t('tours_server_error') : (_error ?? ''),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade700),
                                ),
                                const SizedBox(height: 16),
                                TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(_t('tours_retry'))),
                              ],
                            ),
                          ),
                        )
                      : _tours.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.explore_off, size: 64, color: Colors.grey.shade400),
                                  const SizedBox(height: 16),
                                  Text(_t('tours_empty'), style: GoogleFonts.poppins(fontSize: 16, color: Colors.grey.shade600)),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              color: _kNeonOrange,
                              child: ListView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                                itemCount: _tours.length,
                                itemBuilder: (context, i) {
                                  final t = _tours[i] as Map<String, dynamic>;
                                  return _TourCard(
                                    tour: t,
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute(builder: (_) => TourDetailScreen(tourId: t['id'] as String)),
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TourCard extends StatelessWidget {
  const _TourCard({required this.tour, required this.onTap});

  final Map<String, dynamic> tour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = tour['title'] as String? ?? '—';
    final city = tour['city'] as String? ?? '';
    final country = tour['country'] as String? ?? '';
    final thumbnailUrl = tour['thumbnailUrl'] as String?;
    final startingPrice = tour['startingPrice'];
    final currency = tour['currency'] as String? ?? 'USD';
    final flags = tour['flags'] as List<dynamic>? ?? [];
    final durationMins = tour['durationMins'];
    final freeCancellation = tour['freeCancellation'] == true;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (thumbnailUrl != null && thumbnailUrl.toString().isNotEmpty)
              Image.network(
                thumbnailUrl.toString(),
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(height: 160, color: Colors.grey.shade300, child: const Icon(Icons.image_not_supported, size: 48)),
              )
            else
              Container(height: 160, color: _kNeonOrange.withOpacity(0.2), child: const Center(child: Icon(Icons.landscape, size: 48, color: _kNeonOrange))),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (flags.isNotEmpty)
                    Wrap(
                      spacing: 6,
                      children: [
                        for (final f in flags.take(3))
                          Chip(
                            label: Text((f as Map)['text'] as String? ?? '', style: GoogleFonts.poppins(fontSize: 10)),
                            backgroundColor: _kNeonOrange.withOpacity(0.15),
                            padding: EdgeInsets.zero,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                      ],
                    ),
                  if (flags.isNotEmpty) const SizedBox(height: 6),
                  Text(title, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('$city, $country', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (startingPrice != null)
                        Text('$currency ${(startingPrice as num).toStringAsFixed(0)}', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: _kNeonOrange)),
                      if (durationMins != null) ...[
                        const SizedBox(width: 12),
                        Icon(Icons.schedule, size: 14, color: Colors.grey.shade600),
                        const SizedBox(width: 4),
                        Text('$durationMins min', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600)),
                      ],
                      if (freeCancellation) ...[
                        const SizedBox(width: 12),
                        Icon(Icons.cancel_outlined, size: 14, color: Colors.green.shade700),
                        const SizedBox(width: 4),
                        Text('Free cancel', style: GoogleFonts.poppins(fontSize: 11, color: Colors.green.shade700)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
