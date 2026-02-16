import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tbidder Driver App — Dark, high-contrast theme.
/// Background #1A1A1A, Neon Orange #FF5F00 for text/buttons.
class AppTheme {
  AppTheme._();

  static const Color darkBg = Color(0xFF1A1A1A);
  static const Color neonOrange = Color(0xFFFF5F00);
  static const Color neonOrangeAlt = Color(0xFFFF4500);
  static const Color surfaceDark = Color(0xFF242424);
  static const Color onDark = Color(0xFFE8E8E8);

  static ThemeData get dark {
    final base = ThemeData.dark();
    return base.copyWith(
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: neonOrange,
        onPrimary: Colors.black87,
        surface: darkBg,
        onSurface: onDark,
        error: Colors.red.shade400,
        onError: Colors.white,
      ),
      scaffoldBackgroundColor: darkBg,
      appBarTheme: AppBarTheme(
        backgroundColor: darkBg,
        foregroundColor: neonOrange,
        elevation: 0,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: neonOrange,
        ),
        iconTheme: const IconThemeData(color: neonOrange),
      ),
      textTheme: GoogleFonts.poppinsTextTheme(base.textTheme).apply(
        bodyColor: onDark,
        displayColor: onDark,
      ),
      primaryTextTheme: GoogleFonts.poppinsTextTheme(base.primaryTextTheme)
          .apply(bodyColor: neonOrange, displayColor: neonOrange),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: neonOrange,
          foregroundColor: Colors.black87,
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
        foregroundColor: Colors.black87,
      ),
      inputDecorationTheme: InputDecorationTheme(
        focusedBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: neonOrange, width: 2),
        ),
        focusColor: neonOrange,
        labelStyle: GoogleFonts.poppins(color: onDark),
        hintStyle: GoogleFonts.poppins(color: Colors.grey),
      ),
      cardTheme: CardThemeData(
        color: surfaceDark,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
