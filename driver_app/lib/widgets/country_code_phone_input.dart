import 'package:flutter/material.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/country_codes.dart';

/// Phone input with country code dropdown. Full E.164 = selectedCountryCode.dialCode + phoneController.text
class CountryCodePhoneInput extends StatelessWidget {
  const CountryCodePhoneInput({
    super.key,
    required this.phoneController,
    required this.selectedCountryCode,
    required this.onCountryCodeChanged,
    this.decoration,
    this.validator,
    this.labelText = 'Phone',
    this.hintText = 'Enter phone number',
    this.enabled = true,
  });

  final TextEditingController phoneController;
  final CountryCode selectedCountryCode;
  final ValueChanged<CountryCode> onCountryCodeChanged;
  final InputDecoration? decoration;
  final String? Function(String?)? validator;
  final String labelText;
  final String hintText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: DropdownButtonFormField<CountryCode>(
            initialValue: selectedCountryCode,
            isExpanded: true,
            onChanged: enabled ? (c) { if (c != null) onCountryCodeChanged(c); } : null,
            dropdownColor: AppTheme.surfaceDark,
            decoration: InputDecoration(
              labelText: 'Code',
              labelStyle: const TextStyle(color: AppTheme.neonOrange),
              fillColor: AppTheme.surfaceDark,
              filled: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
              ),
            ),
            items: countryCodes.map((c) {
              return DropdownMenuItem<CountryCode>(
                value: c,
                child: Text('${c.dialCode} ${c.iso2}', style: const TextStyle(fontSize: 14, color: AppTheme.onDark)),
              );
            }).toList(),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TextFormField(
            controller: phoneController,
            enabled: enabled,
            keyboardType: TextInputType.phone,
            style: const TextStyle(color: AppTheme.onDark),
            decoration: (decoration ?? InputDecoration(
              labelText: labelText,
              hintText: hintText,
              labelStyle: const TextStyle(color: AppTheme.neonOrange),
              hintStyle: TextStyle(color: Colors.grey.shade600),
              fillColor: AppTheme.surfaceDark,
              filled: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
              ),
            )).copyWith(
              prefixIcon: const Icon(Icons.phone_outlined, color: AppTheme.neonOrange, size: 22),
            ),
            validator: validator,
          ),
        ),
      ],
    );
  }
}
