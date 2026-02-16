import 'dart:async';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Interpolates from [from] to [to] over [duration], calling [onUpdate] each step for smooth marker movement.
Future<void> interpolateLatLng({
  required LatLng from,
  required LatLng to,
  required Duration duration,
  required void Function(LatLng) onUpdate,
  int steps = 20,
}) async {
  if (steps < 2) {
    onUpdate(to);
    return;
  }
  final stepDuration = duration.inMilliseconds / steps;
  for (int i = 1; i <= steps; i++) {
    final t = i / steps;
    final lat = from.latitude + (to.latitude - from.latitude) * t;
    final lng = from.longitude + (to.longitude - from.longitude) * t;
    onUpdate(LatLng(lat, lng));
    await Future<void>.delayed(Duration(milliseconds: stepDuration.round()));
  }
}
