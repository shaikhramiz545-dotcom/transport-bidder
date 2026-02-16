import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';

/// Peru vehicle brands (most common)
const List<String> kPeruVehicleBrands = [
  'Toyota',
  'Nissan',
  'Hyundai',
  'Kia',
  'Chevrolet',
  'Suzuki',
  'Mazda',
  'Honda',
  'Volkswagen',
  'JAC',
  'Chery',
  'Great Wall',
  'Ford',
  'Mitsubishi',
  'Otro', // Other
];

/// Peru vehicle colors (Spanish)
const List<String> kPeruVehicleColors = [
  'Blanco',
  'Negro',
  'Plata',
  'Gris',
  'Azul',
  'Rojo',
  'Verde',
  'Amarillo',
  'Beige',
  'Marrón',
  'Naranja',
  'Otro', // Other
];

/// Peru license classes
const List<String> kPeruLicenseClasses = [
  'A-I',      // Motorcycle
  'A-IIa',    // Taxi (up to 6 passengers)
  'A-IIb',    // Taxi (6-16 passengers)
  'A-IIIa',   // Truck (up to 3.5 tons)
  'A-IIIb',   // Truck (3.5-24 tons)
  'A-IIIc',   // Truck (over 24 tons, trailers)
];

/// Vehicle capacity options (1-25)
List<int> get kVehicleCapacities => List.generate(25, (i) => i + 1);

/// Registration year range (2010-2050)
List<String> get kRegistrationYears => List.generate(41, (i) => (2010 + i).toString());

/// Reusable dropdown widget
class VehicleDropdown extends StatelessWidget {
  final String label;
  final String? value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  final String? hint;

  const VehicleDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: value,
          items: items.map((item) {
            return DropdownMenuItem(
              value: item,
              child: Text(item, style: GoogleFonts.poppins(fontSize: 14)),
            );
          }).toList(),
          onChanged: onChanged,
          dropdownColor: AppTheme.surfaceDark,
          decoration: InputDecoration(
            hintText: hint ?? 'Seleccionar',
            hintStyle: GoogleFonts.poppins(color: Colors.grey.shade600),
            filled: true,
            fillColor: AppTheme.surfaceDark,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade700),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade700),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

/// Reusable date picker widget
class VehicleDatePicker extends StatelessWidget {
  final String label;
  final DateTime? selectedDate;
  final ValueChanged<DateTime?> onDateSelected;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final bool required;

  const VehicleDatePicker({
    super.key,
    required this.label,
    required this.selectedDate,
    required this.onDateSelected,
    this.firstDate,
    this.lastDate,
    this.required = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
            ),
            if (required)
              Text(
                ' *',
                style: GoogleFonts.poppins(fontSize: 14, color: Colors.red),
              ),
          ],
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: selectedDate ?? DateTime.now(),
              firstDate: firstDate ?? DateTime(1950),
              lastDate: lastDate ?? DateTime(2050),
              builder: (context, child) {
                return Theme(
                  data: ThemeData.dark().copyWith(
                    colorScheme: const ColorScheme.dark(
                      primary: AppTheme.neonOrange,
                      onPrimary: Colors.white,
                      surface: AppTheme.surfaceDark,
                      onSurface: Colors.white,
                    ),
                  ),
                  child: child!,
                );
              },
            );
            if (picked != null) {
              onDateSelected(picked);
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppTheme.surfaceDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade700),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  selectedDate != null
                      ? '${selectedDate!.day}/${selectedDate!.month}/${selectedDate!.year}'
                      : 'Seleccionar fecha',
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    color: selectedDate != null ? Colors.white : Colors.grey.shade600,
                  ),
                ),
                Icon(Icons.calendar_today, color: Colors.grey.shade600, size: 20),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Reusable text input widget
class VehicleTextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final int? maxLength;

  const VehicleTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.required = false,
    this.keyboardType,
    this.maxLength,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
            ),
            if (required)
              Text(
                ' *',
                style: GoogleFonts.poppins(fontSize: 14, color: Colors.red),
              ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          maxLength: maxLength,
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.poppins(color: Colors.grey.shade600),
            filled: true,
            fillColor: AppTheme.surfaceDark,
            counterText: '',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade700),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade700),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
