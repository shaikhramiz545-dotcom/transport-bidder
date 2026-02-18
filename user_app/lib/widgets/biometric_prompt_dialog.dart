import 'package:flutter/material.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

/// One-time dialog after login: Add biometric or Skip.
/// Message won't show again after Add or Skip.
Future<void> showBiometricAddPrompt({
  required BuildContext context,
  required String biometricType,
  required VoidCallback onAdd,
  required VoidCallback onSkip,
}) async {
  final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        t('biometric_add_title', {'type': biometricType}),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      content: Text(
        t('biometric_add_message'),
        style: const TextStyle(fontSize: 15),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            onSkip();
          },
          child: Text(t('biometric_skip'), style: TextStyle(color: Colors.grey.shade700)),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            onAdd();
          },
          style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
          child: Text(t('biometric_add')),
        ),
      ],
    ),
  );
}
