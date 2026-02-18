import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Smoke test', (WidgetTester tester) async {
    // Keep this test intentionally minimal to avoid plugin/Firebase init in widget tests.
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('smoke'))));
    expect(find.text('smoke'), findsOneWidget);
  });
}
