import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Incoming bid/job request shown to the driver. [requestId] set when from backend/socket.
class IncomingRequest {
  const IncomingRequest({
    required this.pickupAddress,
    required this.dropAddress,
    required this.distanceKm,
    required this.trafficDelayMins,
    required this.userBidPrice,
    required this.vehicleLabel,
    required this.pickup,
    required this.drop,
    this.userEvidenceUrl,
    this.requestId,
    this.userRating,
    this.userPhotoUrl,
    this.userPhone,
    this.outstationPassengers,
    this.outstationComments,
    this.outstationIsParcel,
    this.deliveryComments,
    this.deliveryWeight,
    this.deliveryPhotoUrl,
  });

  /// Backend ride request id; used for accept/counter/decline API calls.
  final String? requestId;
  final String pickupAddress;
  final String dropAddress;
  final double distanceKm;
  final int trafficDelayMins;
  final double userBidPrice;
  final String vehicleLabel;
  final LatLng pickup;
  final LatLng drop;
  final String? userEvidenceUrl;
  /// User rating (e.g. 4.5). Shown in card.
  final double? userRating;
  /// User profile photo URL. Shown in small round circle only; driver cannot enlarge.
  final String? userPhotoUrl;
  /// User phone number for contact
  final String? userPhone;
  /// Outstation fields (taxi_outstation rides)
  final int? outstationPassengers;
  final String? outstationComments;
  final bool? outstationIsParcel;
  /// Delivery fields
  final String? deliveryComments;
  final String? deliveryWeight;
  final String? deliveryPhotoUrl;
}
