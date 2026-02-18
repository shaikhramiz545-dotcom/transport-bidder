import 'package:flutter_test/flutter_test.dart';
import 'package:tbidder_user_app/services/fare_service.dart';

void main() {
  group('Fare calculation (Peru)', () {
    test('Moto fare: 10 km + 5 min delay', () {
      final motoFare = calculateFare(
        distanceKm: 10.0,
        trafficDelayMins: 5,
        vehicle: VehicleType.moto,
      );
      expect(motoFare, 22.5); // 10*2.0*1.0 + 5*0.5 = 20 + 2.5
      expect(motoFare.toStringAsFixed(2), '22.50');
    });

    test('Moto formula: baseRatePerKm=2, trafficFactor=0.5', () {
      expect(
        calculateFare(
          distanceKm: 10.0,
          trafficDelayMins: 5,
          vehicle: VehicleType.moto,
        ),
        22.5,
      );
    });
  });
}
