import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Driver app: Spanish (default) and English only.
const String _kLocaleKey = 'tbidder_driver_locale';

const List<Locale> supportedLocales = [
  Locale('es'),
  Locale('en'),
];

const Locale defaultLocale = Locale('es');

String languageName(Locale locale) {
  switch (locale.languageCode) {
    case 'en':
      return 'English';
    case 'es':
      return 'Español';
    default:
      return locale.languageCode;
  }
}

final Map<String, Map<String, String>> _translations = {
  'language': {'en': 'Language', 'es': 'Idioma'},
  'select_language': {'en': 'Select language', 'es': 'Seleccionar idioma'},
  'location_always_title': {'en': 'Location always on', 'es': 'Ubicación siempre activada'},
  'location_always_body': {
    'en': 'So the user can see your location live during the trip, keep location always on.',
    'es': 'Para que el usuario pueda ver tu ubicación en vivo durante el viaje, mantén la ubicación siempre activada.',
  },
  'not_now': {'en': 'Not now', 'es': 'Ahora no'},
  'allow_always': {'en': 'Allow always', 'es': 'Permitir siempre'},
  'location_denied_bar': {
    'en': 'Location access denied. Turn it on in settings to go online.',
    'es': 'Acceso a ubicación denegado. Actívalo en configuración para estar en línea.',
  },
  'activate_location': {'en': 'Turn on location', 'es': 'Activa la ubicación'},
  'activate_location_body': {
    'en': 'To go online and receive rides, turn on location in device settings.',
    'es': 'Para estar en línea y recibir viajes, activa la ubicación en la configuración del dispositivo.',
  },
  'open_settings': {'en': 'Open settings', 'es': 'Abrir configuración'},
  'open': {'en': 'Open', 'es': 'Abrir'},
  'close': {'en': 'Close', 'es': 'Cerrar'},
  'retry': {'en': 'Retry', 'es': 'Reintentar'},
  'refresh_status': {'en': 'Refresh status', 'es': 'Actualizar estado'},
  'server_unavailable_title': {'en': 'Server unavailable', 'es': 'Servidor no disponible'},
  'server_unavailable_body': {
    'en': 'We could not reach the server right now. Please try again in a moment.',
    'es': 'No pudimos conectar con el servidor ahora. Inténtalo de nuevo en un momento.',
  },
  'you_are_online': {'en': 'You are online', 'es': 'Estás en línea'},
  'you_are_offline': {'en': 'You are offline', 'es': 'Estás desconectado'},
  'driver_on_duty': {'en': 'Driver on duty', 'es': 'Conductor en servicio'},
  'new_request': {'en': 'NEW REQUEST!', 'es': '¡NUEVA SOLICITUD!'},
  'origin': {'en': 'Origin', 'es': 'Origen'},
  'destination': {'en': 'Destination', 'es': 'Destino'},
  'traffic_delay': {'en': 'Traffic delay: {{mins}} mins', 'es': 'Retraso por tráfico: {{mins}} mins'},
  'km': {'en': '{{km}} km', 'es': '{{km}} km'},
  'user_offer': {'en': 'USER OFFER: S/ {{price}}', 'es': 'OFERTA DEL USUARIO: S/ {{price}}'},
  'accept': {'en': 'ACCEPT', 'es': 'ACEPTAR'},
  'counter_offer': {'en': 'COUNTER OFFER', 'es': 'CONTRAOFERTAR'},
  'decline': {'en': 'DECLINE', 'es': 'RECHAZAR'},
  'go_to_pickup': {'en': 'Go to pickup', 'es': 'Ir a punto de recogida'},
  'go_to_drop': {'en': 'Go to destination', 'es': 'Ir al destino'},
  'ask_otp': {'en': 'Ask user for OTP', 'es': 'Pide OTP al usuario'},
  'pickup': {'en': 'Pickup', 'es': 'Recogida'},
  'destino': {'en': 'Destination', 'es': 'Destino'},
  'arrived': {'en': 'I\'ve arrived', 'es': 'Llegué'},
  'user_otp': {'en': 'User OTP', 'es': 'OTP del usuario'},
  'ask_user_otp': {'en': 'Ask the user for the 4-digit code shown in their app.', 'es': 'Pide al usuario el código de 4 dígitos que aparece en su app.'},
  'otp_4_digits': {'en': 'OTP (4 digits)', 'es': 'OTP (4 dígitos)'},
  'cancel': {'en': 'Cancel', 'es': 'Cancelar'},
  'start_ride': {'en': 'Start ride', 'es': 'Iniciar viaje'},
  'slide_to_complete': {'en': 'Slide to complete ride →', 'es': 'Desliza para completar viaje →'},
  'ride_completed': {'en': 'Ride completed', 'es': 'Viaje completado'},
  'could_not_send': {'en': 'Could not send. Check connection.', 'es': 'No se pudo enviar. Revisa la conexión.'},
  'wrong_otp': {'en': 'Wrong OTP. Ask the user for the code.', 'es': 'OTP incorrecto. Pide el código al usuario.'},
  'ride_started_go_dest': {'en': 'Ride started. Go to destination.', 'es': 'Viaje iniciado. Ve al destino.'},
  'ride_completed_thanks': {'en': 'Ride completed. Thanks.', 'es': 'Viaje completado. Gracias.'},
  'go_pickup_tap_arrived': {'en': 'Go to pickup. Tap "I\'ve arrived" when there.', 'es': 'Ir a punto de recogida. Toca "Llegué" al llegar.'},
  'counter_offer_sent': {'en': 'Counter offer S/ {{price}} sent.', 'es': 'Contraoferta S/ {{price}} enviada.'},
  'counter_offer_sheet_title': {'en': 'Counter offer (S/)', 'es': 'Contraoferta (S/)'},
  'send_counter': {'en': 'Send counter offer', 'es': 'Enviar contraoferta'},
  'send': {'en': 'Send Bid', 'es': 'Enviar oferta'},
  'waiting_response': {'en': 'Waiting for user response...', 'es': 'Esperando respuesta del usuario...'},
  'could_not_complete': {'en': 'Could not complete. Check connection.', 'es': 'No se pudo completar. Revisa la conexión.'},
  'offer_accepted': {'en': 'You accepted the offer.', 'es': 'Aceptaste la oferta.'},
  'chat': {'en': 'Chat', 'es': 'Chat'},
  'call': {'en': 'Call', 'es': 'Llamar'},
  'phone_not_available': {'en': 'Phone number not available', 'es': 'Número no disponible'},
  'total_earning': {'en': 'Total Earning', 'es': 'Ganancia total'},
  'today_earning': {'en': "Today's Earning", 'es': 'Ganancia de hoy'},
  'credit': {'en': 'Credit', 'es': 'Crédito'},
  'download_statement': {'en': 'Download statement', 'es': 'Descargar estado'},
  'download_pdf': {'en': 'Download PDF', 'es': 'Descargar PDF'},
  'download_excel': {'en': 'Download Excel', 'es': 'Descargar Excel'},
  'today': {'en': 'Today', 'es': 'Hoy'},
  'this_week': {'en': 'This week', 'es': 'Esta semana'},
  'month': {'en': 'Month', 'es': 'Mes'},
  'custom': {'en': 'Custom', 'es': 'Personalizado'},
  'from_date': {'en': 'From', 'es': 'Desde'},
  'to_date': {'en': 'To', 'es': 'Hasta'},
  'max_3_months': {'en': 'Max 3 months', 'es': 'Máx. 3 meses'},
  'drawer_earnings': {'en': 'Earnings', 'es': 'Ganancias'},
  'drawer_documents': {'en': 'Documents', 'es': 'Documentos'},
  'drawer_go_home': {'en': 'Go Home', 'es': 'Ir a inicio'},
  'drawer_settings': {'en': 'Settings', 'es': 'Ajustes'},
  'drawer_logout': {'en': 'Logout', 'es': 'Cerrar sesión'},
  'drawer_profile': {'en': 'Profile', 'es': 'Perfil'},
  'drawer_verification': {'en': 'Verification', 'es': 'Verificación'},
  'drawer_wallet': {'en': 'Wallet', 'es': 'Billetera'},
  'profile_name': {'en': 'Name', 'es': 'Nombre'},
  'profile_driver_name': {'en': 'Driver', 'es': 'Conductor'},
  'profile_partner': {'en': 'Partner', 'es': 'Socio'},
  'profile_rating': {'en': 'rating', 'es': 'calificación'},
  'profile_personal_info': {'en': 'Personal info', 'es': 'Datos personales'},
  'profile_phone': {'en': 'Phone', 'es': 'Teléfono'},
  'profile_email': {'en': 'Email', 'es': 'Correo'},
  'profile_driver_info': {'en': 'Driver info', 'es': 'Info conductor'},
  'profile_vehicle': {'en': 'Vehicle', 'es': 'Vehículo'},
  'profile_license': {'en': 'License', 'es': 'Licencia'},
  'wallet_balance': {'en': 'Current Balance (Credits)', 'es': 'Saldo actual (Créditos)'},
  'wallet_payment_info': {'en': 'Payment Info', 'es': 'Info de pago'},
  'wallet_bank_details': {'en': 'Bank Details', 'es': 'Datos bancarios'},
  'wallet_copy': {'en': 'Copy', 'es': 'Copiar'},
  'wallet_upload_screenshot': {'en': 'Upload Screenshot', 'es': 'Subir captura'},
  'wallet_amount': {'en': 'Amount (S/)', 'es': 'Monto (S/)'},
  'wallet_transaction_id': {'en': 'Transaction ID', 'es': 'ID de transacción'},
  'wallet_submit': {'en': 'SUBMIT', 'es': 'ENVIAR'},
  'wallet_submit_success': {'en': 'Request sent. Waiting for approval.', 'es': 'Solicitud enviada. Esperando aprobación.'},
  'wallet_fill_all': {'en': 'Please fill all fields and upload screenshot.', 'es': 'Completa todos los campos y sube la captura.'},
  'wallet_copied': {'en': 'Copied to clipboard', 'es': 'Copiado al portapapeles'},
  'wallet_go_online_first': {'en': 'Go online first to get your driver ID, then you can recharge.', 'es': 'Ponte en línea primero para obtener tu ID de conductor, luego podrás recargar.'},
  'wallet_out_of_credit': {'en': 'You are out of credit. Please recharge your account as soon as possible.', 'es': 'No tienes créditos. Recarga tu cuenta lo antes posible.'},
  'wallet_low_credit_accept': {'en': 'You are trying to accept a higher amount bid with low balance. Please recharge to accept that bid.', 'es': 'Estás intentando aceptar una oferta mayor con saldo bajo. Recarga para aceptar esa oferta.'},
  'wallet_recharge_btn': {'en': 'Recharge', 'es': 'Recargar'},
  'ride_error_no_credit_title': {'en': 'No credits', 'es': 'Sin créditos'},
  'ride_error_low_credit_title': {'en': 'Insufficient credits', 'es': 'Créditos insuficientes'},
  'ride_error_expired_title': {'en': 'Credits expired', 'es': 'Créditos vencidos'},
  'ride_error_recharge_cta': {'en': 'Recharge now', 'es': 'Recargar ahora'},
  'home_fix_verification': {'en': 'Documents', 'es': 'Documentos'},
  'home_fix_wallet': {'en': 'Wallet', 'es': 'Billetera'},
  'home_offline_hint': {'en': 'Can\'t go online? Check documents or wallet.', 'es': '¿No puedes conectarte? Revisa documentos o billetera.'},
  'wallet_credits_validity': {'en': 'Credits valid for 1 year from last recharge.', 'es': 'Créditos válidos por 1 año desde la última recarga.'},
  'wallet_verify_payment': {'en': 'Verify Payment', 'es': 'Verificar pago'},
  'wallet_recent_requests': {'en': 'Recent Recharge Requests', 'es': 'Solicitudes recientes'},
  'wallet_low_credit_warning': {'en': 'Low credits. Recharge below to accept more rides.', 'es': 'Créditos bajos. Recarga abajo para aceptar más viajes.'},
  'wallet_zero_credit_warning': {'en': 'No credits. You cannot accept rides until you recharge.', 'es': 'Sin créditos. No puedes aceptar viajes hasta recargar.'},
  'wallet_status_pending': {'en': 'Pending', 'es': 'Pendiente'},
  'wallet_status_approved': {'en': 'Approved', 'es': 'Aprobado'},
  'wallet_status_declined': {'en': 'Declined', 'es': 'Rechazado'},
  'wallet_status_needs_pdf': {'en': 'Needs PDF', 'es': 'Necesita PDF'},
  'wallet_recharge_now': {'en': 'Recharge Now', 'es': 'Recargar ahora'},
  'wallet_expires_in_days': {'en': 'Expires in {{count}} days', 'es': 'Vence en {{count}} días'},
  'wallet_expires_soon': {'en': 'Expires soon', 'es': 'Vence pronto'},
  'wallet_expired_on': {'en': 'Expired on {{date}}', 'es': 'Venció el {{date}}'},
  'wallet_recharge_approved_banner': {'en': 'Your recharge was approved! {{credits}} credits added. You can now accept rides.', 'es': '¡Tu recarga fue aprobada! {{credits}} créditos agregados. Ya puedes aceptar viajes.'},
  'scratch_card_title': {'en': 'Daily Scratch Card', 'es': 'Tarjeta diaria'},
  'scratch_banner_subtitle': {
    'en': 'You have a card available today. Tap to claim 1–10 credits.',
    'es': 'Tienes una tarjeta disponible hoy. Toca para ganar 1–10 créditos.',
  },
  'scratch_card_tap': {'en': 'Tap to scratch!', 'es': '¡Toca para rascar!'},
  'scratch_popup_body': {
    'en': 'Your daily reward is ready. Open the scratch card to claim your credits.',
    'es': 'Tu recompensa diaria está lista. Abre la tarjeta para reclamar tus créditos.',
  },
  'scratch_card_won': {'en': 'You won {{credits}} credits!', 'es': '¡Ganaste {{credits}} créditos!'},
  'scratch_card_tomorrow': {'en': 'Come back tomorrow for another card.', 'es': 'Vuelve mañana por otra tarjeta.'},
  'scratch_card_used': {'en': 'Already used today', 'es': 'Ya usaste hoy'},
  'quick_wallet': {'en': 'Wallet', 'es': 'Billetera'},
  'quick_scratch': {'en': 'Scratch', 'es': 'Rascar'},
  'quick_go_home': {'en': 'Go Home', 'es': 'Ir a inicio'},
  'coming_soon': {'en': 'Coming soon', 'es': 'Próximamente'},
  'profile_copied': {'en': 'Copied to clipboard', 'es': 'Copiado al portapapeles'},
  'verification_title': {'en': 'Verification', 'es': 'Verificación'},
  'verification_status': {'en': 'Status', 'es': 'Estado'},
  'verification_status_draft': {'en': 'Not submitted', 'es': 'No enviado'},
  'verification_status_draft_subtitle': {
    'en': 'Upload documents and tap "Submit for review".',
    'es': 'Sube tus documentos y toca "Enviar para revisión".',
  },
  'verification_status_submitted': {'en': 'Submitted', 'es': 'Enviado'},
  'verification_status_submitted_subtitle': {
    'en': 'Submitted successfully. Please wait up to 24 hours for review.',
    'es': 'Enviado correctamente. Espera hasta 24 horas para la revisión.',
  },
  'verification_pending_panel_title': {'en': 'Documents under review', 'es': 'Documentos en revisión'},
  'verification_pending_panel_body': {
    'en': 'We received your documents. Uploads are disabled until review is finished (up to 24 hours).',
    'es': 'Recibimos tus documentos. La subida está deshabilitada hasta terminar la revisión (hasta 24 horas).',
  },
  'verification_under_review_locked': {'en': 'Your documents are under review', 'es': 'Tus documentos están en revisión'},
  'verification_status_pending': {'en': 'Pending review', 'es': 'En revisión'},
  'verification_status_pending_subtitle': {'en': 'We\'re reviewing your documents.', 'es': 'Estamos revisando tus documentos.'},
  'verification_status_reupload_subtitle': {'en': 'Please re-upload the documents below.', 'es': 'Por favor vuelve a subir los documentos indicados.'},
  'verification_status_rejected_subtitle': {'en': 'Fix the issue and resubmit.', 'es': 'Corrige el problema y envía de nuevo.'},
  'verification_status_approved': {'en': 'Approved', 'es': 'Aprobado'},
  'verification_approved_recharge_title': {'en': 'Approved', 'es': 'Aprobado'},
  'verification_approved_recharge_body': {
    'en': 'Your documents are verified. To start earning, please recharge your credits.',
    'es': 'Tus documentos fueron verificados. Para empezar a ganar, recarga tus créditos.',
  },
  'verification_approved_recharge_cta': {'en': 'OK', 'es': 'OK'},
  'verification_status_rejected': {'en': 'Rejected', 'es': 'Rechazado'},
  'verification_documents': {'en': 'Documents', 'es': 'Documentos'},
  'verification_license': {'en': 'Driver license', 'es': 'Licencia de conducir'},
  'verification_vehicle_papers': {'en': 'Vehicle papers', 'es': 'Papeles del vehículo'},
  'verification_vehicle_info': {'en': 'Vehicle info', 'es': 'Datos del vehículo'},
  'verification_plate': {'en': 'Plate', 'es': 'Placa'},
  'verification_model': {'en': 'Model', 'es': 'Modelo'},
  'verification_360_video': {'en': '360° vehicle video', 'es': 'Video 360° del vehículo'},
  'verification_360_placeholder': {'en': 'Tap to upload 360° video (Firma requirement)', 'es': 'Toca para subir video 360° (requisito Firma)'},
  'verification_upload': {'en': 'Upload', 'es': 'Subir'},
  'verification_features_driver': {'en': 'Driver app features', 'es': 'Funciones app conductor'},
  'verification_features_user': {'en': 'User app features', 'es': 'Funciones app usuario'},
  'verification_status_temp_blocked': {'en': 'Temporarily blocked', 'es': 'Bloqueado temporalmente'},
  'verification_status_suspended': {'en': 'Suspended', 'es': 'Suspendido'},
  'verification_block_reason': {'en': 'Reason', 'es': 'Motivo'},
  'verification_title_conductor': {'en': 'Driver Verification', 'es': 'Verificación de Conductor'},
  'verification_step_personal': {'en': 'Personal docs', 'es': 'Docs personales'},
  'verification_step_vehicle': {'en': 'Vehicle docs', 'es': 'Docs del vehículo'},
  'verification_step_review': {'en': 'Review', 'es': 'Revisión'},
  'verification_personal_info': {'en': 'Upload your personal documents required to drive in Peru.', 'es': 'Sube tus documentos personales requeridos para conducir en Perú.'},
  'verification_vehicle_docs_info': {'en': 'Documents of the vehicle you will work with.', 'es': 'Documentos del vehículo en el que trabajarás.'},
  'verification_brevete_frente': {'en': 'License - Front', 'es': 'Brevete - Frente'},
  'verification_brevete_frente_helper': {'en': 'Clear photo, no glare', 'es': 'Foto legible, sin reflejos'},
  'verification_brevete_dorso': {'en': 'License - Back', 'es': 'Brevete - Dorso'},
  'verification_dni': {'en': 'DNI', 'es': 'DNI'},
  'verification_antecedentes_policiales': {'en': 'Do you have police records?', 'es': '¿Tienes -Antecedentes policiales?'},
  'verification_antecedentes_penales': {'en': 'Do you have criminal records?', 'es': '¿Tienes -Antecedentes penales?'},
  'verification_yes': {'en': 'Yes', 'es': 'Sí'},
  'verification_no': {'en': 'No', 'es': 'No'},
  'verification_selfie': {'en': 'Selfie', 'es': 'Selfie'},
  'verification_selfie_helper': {'en': 'Full face, no dark glasses', 'es': 'Rostro completo, sin lentes oscuros'},
  'verification_upload_btn': {'en': 'Upload', 'es': 'Subir'},
  'verification_save_exit': {'en': 'Save and exit', 'es': 'Guardar y salir'},
  'verification_next_vehicle': {'en': 'Next: Vehicle', 'es': 'Siguiente: Vehículo'},
  'verification_next_review': {'en': 'Next: Review', 'es': 'Siguiente: Revisión'},
  'verification_back': {'en': 'Back', 'es': 'Atrás'},
  'verification_soat': {'en': 'SOAT', 'es': 'SOAT'},
  'verification_tarjeta_propiedad': {'en': 'Vehicle ownership card', 'es': 'Tarjeta de Propiedad'},
  'verification_foto_vehiculo': {'en': 'Vehicle photo', 'es': 'Foto del vehículo'},
  'verification_foto_vehiculo_helper': {'en': 'Side photo showing plate', 'es': 'Foto lateral donde se vea placa.'},
  'verification_docs_personal_summary': {'en': 'Personal documents', 'es': 'Documentos personales'},
  'verification_docs_vehicle_summary': {'en': 'Vehicle documents', 'es': 'Documentos del vehículo'},
  'verification_view': {'en': 'View', 'es': 'Ver'},
  'verification_incomplete_banner': {'en': 'Some documents are missing.', 'es': 'Falta completar algunos documentos.'},
  'verification_submit_review': {'en': 'Submit for review', 'es': 'Enviar para revisión'},
  'verification_photo_required': {'en': 'Please upload your profile photo on the Profile page before submitting documents.', 'es': 'Por favor sube tu foto de perfil en la página de Perfil antes de enviar los documentos.'},
  'verification_need_online': {'en': 'Go online first (toggle On duty on Home) to submit.', 'es': 'Conéctate primero (activa "En servicio" en Inicio) para enviar.'},
  'verification_submitted': {'en': 'Submitted for review.', 'es': 'Enviado para revisión.'},
  'verification_submit_note': {'en': "You won't be able to go online until your documents are approved.", 'es': 'No podrás conectarte hasta que tus documentos sean aprobados.'},
  'verification_reupload': {'en': 'Re-upload', 'es': 'Volver a subir'},
  'verification_open_docs': {'en': 'Open document verification', 'es': 'Abrir verificación de documentos'},
  'verification_blocked_banner': {'en': "You cannot go online. Check and correct your documents.", 'es': 'No puedes conectarte. Revisa y corrige tus documentos.'},
  'verification_view_docs': {'en': 'View documents', 'es': 'Ver documentos'},
  'verification_fix_documents': {'en': 'Fix documents', 'es': 'Corregir documentos'},
  'driver_cannot_go_online': {'en': 'You cannot go online', 'es': 'No puedes estar en línea'},
  'driver_status_pending': {'en': 'Your profile is under review. You can go online once approved.', 'es': 'Tu perfil está en revisión. Podrás estar en línea cuando sea aprobado.'},
  'driver_status_approved_notice': {'en': 'Your account is approved. You can start working now.', 'es': 'Tu cuenta está aprobada. Ya puedes empezar a trabajar.'},
  'driver_status_blocked': {'en': 'Your account is blocked. Please contact customer service.', 'es': 'Tu cuenta está bloqueada. Contacta a atención al cliente.'},
  'driver_status_blocked_reason': {'en': '{{reason}}', 'es': '{{reason}}'},
  'ok': {'en': 'OK', 'es': 'OK'},
  'save': {'en': 'Save', 'es': 'Guardar'},
};

String _replaceParams(String s, Map<String, dynamic>? params) {
  if (params == null || params.isEmpty) return s;
  String r = s;
  for (final e in params.entries) {
    r = r.replaceAll('{{${e.key}}}', e.value?.toString() ?? '');
  }
  return r;
}

String translate(String key, Locale locale, [Map<String, dynamic>? params]) {
  final byLang = _translations[key];
  if (byLang == null) return key;
  final lang = locale.languageCode;
  final s = byLang[lang] ?? byLang['es'] ?? key;
  return _replaceParams(s, params);
}

Future<Locale> loadSavedLocale() async {
  final prefs = await SharedPreferences.getInstance();
  final code = prefs.getString(_kLocaleKey);
  if (code == null) return defaultLocale;
  return Locale(code);
}

Future<void> saveLocale(Locale locale) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kLocaleKey, locale.languageCode);
}

class AppLocaleScope extends InheritedWidget {
  const AppLocaleScope({
    super.key,
    required this.locale,
    required this.t,
    required this.setLocale,
    required super.child,
  });

  final Locale locale;
  final String Function(String key, [Map<String, dynamic>? params]) t;
  final void Function(Locale locale) setLocale;

  static AppLocaleScope? of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<AppLocaleScope>();
  }

  @override
  bool updateShouldNotify(AppLocaleScope oldWidget) => oldWidget.locale != locale;
}
