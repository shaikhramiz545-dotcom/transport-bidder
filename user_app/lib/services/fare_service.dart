/// Vehicle type keys for fare calculation. Two-tier UI uses these ids.
enum VehicleType {
  moto('Moto', '🏍️'),
  taxi_std('Taxi Std (4)', '🚘'),
  taxi_suv('Taxi SUV (6)', '🚙'),
  taxi_xl('Taxi XL (8)', '🚐'),
  truck_s('Truck S (1T)', '🛻'),
  truck_m('Truck M (3T)', '🚚'),
  truck_l('Truck L (10T)', '🚛'),
  truck_hauler('Tráiler', '🚛'),
  amb_basic('Basic', '🚑'),
  amb_icu('ICU', '🏥'),
  taxi_outstation('Outstation', '🛣️'),
  delivery('Delivery', '📦');

  const VehicleType(this.label, this.emoji);
  final String label;
  final String emoji;

  /// Fare multiplier (base rate × this × distance + traffic). Taxi SUV = 1.4× Standard.
  double get multiplier {
    switch (this) {
      case VehicleType.moto:
        return 1.0;
      case VehicleType.taxi_std:
        return 1.2;
      case VehicleType.taxi_suv:
        return 1.68; // 1.4 × taxi_std
      case VehicleType.taxi_xl:
        return 2.0;
      case VehicleType.truck_s:
        return 2.0;
      case VehicleType.truck_m:
        return 2.5;
      case VehicleType.truck_l:
        return 3.0;
      case VehicleType.truck_hauler:
        return 3.5;
      case VehicleType.amb_basic:
        return 4.0;
      case VehicleType.amb_icu:
        return 5.0;
      case VehicleType.taxi_outstation:
        return 1.5;
      case VehicleType.delivery:
        return 1.1;
    }
  }

  /// Look up VehicleType by string id (e.g. from UI).
  static VehicleType? fromId(String id) {
    for (final v in VehicleType.values) {
      if (v.name == id) return v;
    }
    return null;
  }
}

/// Base rate per km (S/ per km for multiplier 1.0). Admin can set custom rates per driver.
const double baseRatePerKm = 2.0;
/// Extra S/ per minute of traffic delay.
const double _trafficFactorPerMin = 0.5;

/// Extra S/ when user needs a helper for loading/unloading (Freight/Delivery).
const double helperFeeSoles = 15.0;

/// True for truck and delivery (freight) types – show Helper toggle.
bool isFreightVehicle(VehicleType v) {
  return v == VehicleType.truck_s ||
      v == VehicleType.truck_m ||
      v == VehicleType.truck_l ||
      v == VehicleType.truck_hauler ||
      v == VehicleType.delivery;
}

/// Calculates estimated fare (S/) from distance, traffic delay, and vehicle type id.
double calculateFare({
  required double distanceKm,
  required int trafficDelayMins,
  required VehicleType vehicle,
}) {
  final baseFare = distanceKm * baseRatePerKm * vehicle.multiplier;
  final trafficFare = trafficDelayMins * _trafficFactorPerMin;
  return baseFare + trafficFare;
}
