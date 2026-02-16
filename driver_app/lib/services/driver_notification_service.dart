import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Plays siren/alert when driver receives a new bid. Loops until stopped.
class DriverNotificationService {
  final AudioPlayer _player = AudioPlayer();

  static const String _sirenUrl = 'https://www.soundjay.com/buttons/beep-01a.mp3';

  /// Starts siren sound (looped). Call when a new incoming bid is received.
  Future<void> startSiren() async {
    try {
      await _player.stop();
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setVolume(1.0);
      await _player.play(UrlSource(_sirenUrl));
      HapticFeedback.heavyImpact();
    } catch (e) {
      HapticFeedback.heavyImpact();
    }
  }

  /// Stops the siren. Call when driver accepts, rejects, or sends counter bid.
  void stopSiren() {
    _player.stop();
  }

  void dispose() {
    _player.dispose();
  }
}
