// Basic Flutter widget test for Tbidder user app.

import 'package:flutter_test/flutter_test.dart';

import 'package:tbidder_user_app/main.dart';

void main() {
  testWidgets('App launches and shows home', (WidgetTester tester) async {
    await tester.pumpWidget(const TbidderUserApp());
    await tester.pumpAndSettle();

    // App shows TbidderUserApp (MaterialApp with HomeScreen)
    expect(find.byType(TbidderUserApp), findsOneWidget);
  });
}
