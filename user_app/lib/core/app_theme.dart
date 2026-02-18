import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// TBidder User App — Ride Hailing theme.
/// Primary background: Cream (#F5F5DC). Accent: Neon Orange (#FF5F00). Text: Dark Grey (#1A1A1A).
class AppTheme {
  AppTheme._();

  static const Color cream = Color(0xFFF5F5DC);
  static const Color neonOrange = Color(0xFFFF5F00);
  static const Color textDark = Color(0xFF1A1A1A);

  static ThemeData get light {
    final base = ThemeData.light();
    return base.copyWith(
      colorScheme: ColorScheme.light(
        primary: neonOrange,
        onPrimary: Colors.white,
        surface: cream,
        onSurface: textDark,
        error: Colors.red.shade700,
        onError: Colors.white,
      ),
      scaffoldBackgroundColor: cream,
      appBarTheme: AppBarTheme(
        backgroundColor: cream,
        foregroundColor: textDark,
        elevation: 0,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textDark,
        ),
      ),
      textTheme: GoogleFonts.poppinsTextTheme(base.textTheme).apply(
        bodyColor: textDark,
        displayColor: textDark,
      ),
      primaryTextTheme: GoogleFonts.poppinsTextTheme(base.primaryTextTheme).apply(
        bodyColor: textDark,
        displayColor: textDark,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: neonOrange,
          foregroundColor: Colors.white,
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: neonOrange,
          side: const BorderSide(color: neonOrange),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: neonOrange,
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: neonOrange,
        foregroundColor: Colors.white,
      ),
      inputDecorationTheme: InputDecorationTheme(
        focusedBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: neonOrange, width: 2),
        ),
        focusColor: neonOrange,
        labelStyle: GoogleFonts.poppins(color: textDark),
        hintStyle: GoogleFonts.poppins(color: Colors.grey),
      ),
    );
  }
}
