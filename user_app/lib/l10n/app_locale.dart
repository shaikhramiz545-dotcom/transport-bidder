import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Supported locales: User app = en, es, ru, fr. Default = es (Spanish).
const String _kLocaleKey = 'tbidder_user_locale';

const List<Locale> supportedLocales = [
  Locale('es'),
  Locale('en'),
  Locale('ru'),
  Locale('fr'),
];

const Locale defaultLocale = Locale('es'); // Spanish default for Peru

/// Language display names for selector.
String languageName(Locale locale) {
  switch (locale.languageCode) {
    case 'en':
      return 'English';
    case 'es':
      return 'Español';
    case 'ru':
      return 'Русский';
    case 'fr':
      return 'Français';
    default:
      return locale.languageCode;
  }
}

/// Translation map: key -> { 'en': '...', 'es': '...', 'ru': '...', 'fr': '...' }
/// Use {{param}} in strings and pass params to t().
final Map<String, Map<String, String>> _translations = {
  'thank_you_title_taxi': {
    'en': 'Thank you for using TransportBidder',
    'es': 'Gracias por usar TransportBidder',
    'ru': 'Спасибо, что пользуетесь TransportBidder',
    'fr': 'Merci d\'utiliser TransportBidder',
  },
  'thank_you_body_taxi': {
    'en': 'My name is {{driverName}} and today I will drop you at your location. ETA ~{{etaMins}} mins.',
    'es': 'Mi nombre es {{driverName}} y hoy te llevaré a tu destino. ETA ~{{etaMins}} min.',
    'ru': 'Меня зовут {{driverName}}, сегодня я довезу вас до места. Примерное время ~{{etaMins}} мин.',
    'fr': 'Je m\'appelle {{driverName}}, aujourd\'hui je vous déposerai à destination. ETA ~{{etaMins}} min.',
  },
  'driver_on_the_way_title': {
    'en': 'Driver on the way',
    'es': 'Conductor en camino',
    'ru': 'Водитель в пути',
    'fr': 'Chauffeur en route',
  },
  'thank_you_body_other': {
    'en': 'My name is {{driverName}}. I am on the way, coming in ETA ~{{etaMins}} mins.',
    'es': 'Mi nombre es {{driverName}}. Estoy en camino, llego en ETA ~{{etaMins}} min.',
    'ru': 'Меня зовут {{driverName}}. Я в пути, примерное время прибытия ~{{etaMins}} мин.',
    'fr': 'Je m\'appelle {{driverName}}. Je suis en route, ETA ~{{etaMins}} min.',
  },
  'ok': {'en': 'OK', 'es': 'OK', 'ru': 'ОК', 'fr': 'OK'},
  'driver_arrived': {
    'en': 'Your driver has arrived at your location!',
    'es': '¡Tu conductor ha llegado a tu ubicación!',
    'ru': 'Ваш водитель прибыл!',
    'fr': 'Votre chauffeur est arrivé!',
  },
  'ride_started_enjoy': {
    'en': 'Ride started! Enjoy your trip.',
    'es': '¡Viaje iniciado! Disfruta tu viaje.',
    'ru': 'Поездка началась! Приятного пути.',
    'fr': 'Trajet commencé! Bon voyage.',
  },
  'thanks_ride_complete_title': {
    'en': 'Thanks for using TransportBidder!',
    'es': '¡Gracias por usar TransportBidder!',
    'ru': 'Спасибо за поездку!',
    'fr': 'Merci d\'avoir utilisé TransportBidder!',
  },
  'thanks_ride_complete_body': {
    'en': 'We hope you had a great ride.',
    'es': 'Esperamos que hayas tenido un buen viaje.',
    'ru': 'Надеемся, поездка была приятной.',
    'fr': 'Nous espérons que le trajet s\'est bien passé.',
  },
  'how_was_trip': {
    'en': 'How was your trip?',
    'es': '¿Cómo fue tu viaje?',
    'ru': 'Как прошла поездка?',
    'fr': 'Comment s\'est passé le trajet?',
  },
  'send': {'en': 'Send', 'es': 'Enviar', 'ru': 'Отправить', 'fr': 'Envoyer'},
  'ride_complete_title': {
    'en': 'Ride Complete!',
    'es': '¡Viaje Completado!',
    'ru': 'Поездка завершена!',
    'fr': 'Trajet terminé!',
  },
  'ride_complete_subtitle': {
    'en': 'Please pay the driver in cash.',
    'es': 'Por favor paga al conductor en efectivo.',
    'ru': 'Пожалуйста, оплатите водителю наличными.',
    'fr': 'Veuillez payer le chauffeur en espèces.',
  },
  'payment_amount': {
    'en': 'Amount to pay',
    'es': 'Monto a pagar',
    'ru': 'Сумма к оплате',
    'fr': 'Montant à payer',
  },
  'payment_method': {
    'en': 'Payment method',
    'es': 'Método de pago',
    'ru': 'Способ оплаты',
    'fr': 'Mode de paiement',
  },
  'cash': {
    'en': 'Cash',
    'es': 'Efectivo',
    'ru': 'Наличные',
    'fr': 'Espèces',
  },
  'vehicle': {
    'en': 'Vehicle',
    'es': 'Vehículo',
    'ru': 'Транспорт',
    'fr': 'Véhicule',
  },
  'cash_payment_note': {
    'en': 'Hand the cash directly to your driver. No in-app payment required.',
    'es': 'Entrega el efectivo directamente al conductor. No se requiere pago en la app.',
    'ru': 'Передайте наличные водителю. Оплата в приложении не требуется.',
    'fr': 'Remettez l\'argent directement au chauffeur. Aucun paiement in-app requis.',
  },
  'paid_in_cash': {
    'en': 'Paid in Cash ✓',
    'es': 'Pagado en Efectivo ✓',
    'ru': 'Оплачено наличными ✓',
    'fr': 'Payé en espèces ✓',
  },
  'rating_submitted': {
    'en': 'Thanks for your rating!',
    'es': '¡Gracias por tu valoración!',
    'ru': 'Спасибо за оценку!',
    'fr': 'Merci pour votre note!',
  },
  'request_create_failed': {
    'en': 'Could not create request. Check that the server is running.',
    'es': 'No se pudo crear la solicitud. Revisa que el servidor esté encendido.',
    'ru': 'Не удалось создать заказ. Проверьте сервер.',
    'fr': 'Impossible de créer la demande. Vérifiez le serveur.',
  },
  'tu_otp': {'en': 'Your OTP', 'es': 'Tu OTP', 'ru': 'Ваш OTP', 'fr': 'Votre OTP'},
  'tell_driver_otp': {
    'en': 'Tell the driver to start the trip',
    'es': 'Dile al conductor para iniciar el viaje',
    'ru': 'Сообщите код водителю для начала поездки',
    'fr': 'Donnez le code au chauffeur pour démarrer',
  },
  'origen': {'en': 'Pickup', 'es': 'Origen', 'ru': 'Откуда', 'fr': 'Départ'},
  'destino': {'en': 'Where to? (Destination)', 'es': '¿A dónde vas? (Destino)', 'ru': 'Куда? (Назначение)', 'fr': 'Où allez-vous? (Destination)'},
  'enter_destination': {'en': 'Enter a destination.', 'es': 'Ingresa un destino.', 'ru': 'Укажите пункт назначения.', 'fr': 'Entrez une destination.'},
  'no_accept_connection': {
    'en': 'Could not accept. Check connection.',
    'es': 'No se pudo aceptar. Revisa la conexión.',
    'ru': 'Не удалось принять. Проверьте соединение.',
    'fr': 'Impossible d\'accepter. Vérifiez la connexion.',
  },
  'accept': {'en': 'ACCEPT', 'es': 'ACEPTAR', 'ru': 'ПРИНЯТЬ', 'fr': 'ACCEPTER'},
  'offer': {'en': 'OFFER', 'es': 'OFERTAR', 'ru': 'ПРЕДЛОЖИТЬ', 'fr': 'OFFRIR'},
  'reject': {'en': 'REJECT', 'es': 'RECHAZAR', 'ru': 'ОТКЛОНИТЬ', 'fr': 'REFUSER'},
  'cancel': {'en': 'Cancel', 'es': 'Cancelar', 'ru': 'Отмена', 'fr': 'Annuler'},
  'your_counter_offer': {'en': 'Your counter offer', 'es': 'Tu contraoferta', 'ru': 'Ваша встречная цена', 'fr': 'Votre contre-offre'},
  'price_soles': {'en': 'Price (S/ )', 'es': 'Precio (S/ )', 'ru': 'Цена (S/ )', 'fr': 'Prix (S/ )'},
  'confirm_offer': {'en': 'Confirm offer', 'es': 'Confirmar oferta', 'ru': 'Подтвердить', 'fr': 'Confirmer l\'offre'},
  'searching_drivers': {'en': 'Searching for drivers...', 'es': 'Buscando conductores...', 'ru': 'Ищем водителей...', 'fr': 'Recherche de chauffeurs...'},
  'reservar': {'en': 'Book', 'es': 'Reservar', 'ru': 'Забронировать', 'fr': 'Réserver'},
  'tu_vehiculo': {'en': 'Your vehicle', 'es': 'Tu vehículo', 'ru': 'Ваш транспорт', 'fr': 'Votre véhicule'},
  'language': {'en': 'Language', 'es': 'Idioma', 'ru': 'Язык', 'fr': 'Langue'},
  'select_language': {'en': 'Select language', 'es': 'Seleccionar idioma', 'ru': 'Выберите язык', 'fr': 'Choisir la langue'},
  'allow_location_title': {
    'en': 'Allow location',
    'es': 'Permitir ubicación',
    'ru': 'Разрешить геолокацию',
    'fr': 'Autoriser la localisation',
  },
  'allow_location_message': {
    'en': 'Set your pickup and see nearby drivers.',
    'es': 'Establece tu punto de recogida y ve conductores cercanos.',
    'ru': 'Укажите место посадки и смотрите ближайших водителей.',
    'fr': 'Définissez votre point de prise en charge et voyez les chauffeurs à proximité.',
  },
  'allow_location_button': {'en': 'Allow', 'es': 'Permitir', 'ru': 'Разрешить', 'fr': 'Autoriser'},
  'your_current_location': {
    'en': 'Your current location',
    'es': 'Tu ubicación actual',
    'ru': 'Текущее местоположение',
    'fr': 'Votre position actuelle',
  },
  'current_location': {
    'en': 'Current location',
    'es': 'Ubicación actual',
    'ru': 'Текущее местоположение',
    'fr': 'Position actuelle',
  },
  'location_denied_pickup': {
    'en': 'Location denied. Allow location to set pickup.',
    'es': 'Ubicación denegada. Permite la ubicación para el origen.',
    'ru': 'Доступ к геолокации запрещён. Разрешите для точки А.',
    'fr': 'Localisation refusée. Autorisez pour le point de départ.',
  },
  'pickup_set_current': {
    'en': 'Pickup set to your current location',
    'es': 'Origen establecido en tu ubicación actual',
    'ru': 'Точка А — ваше текущее местоположение',
    'fr': 'Point de départ défini sur votre position',
  },
  'location_fetch_failed': {
    'en': 'Could not get location. Try again or allow location.',
    'es': 'No se pudo obtener la ubicación. Intenta de nuevo o permite la ubicación.',
    'ru': 'Не удалось получить местоположение. Повторите или разрешите доступ.',
    'fr': 'Impossible d\'obtenir la position. Réessayez ou autorisez la localisation.',
  },
  'gps_disabled_title': {
    'en': 'Location services off',
    'es': 'Ubicación desactivada',
    'ru': 'Службы геолокации выключены',
    'fr': 'Localisation désactivée',
  },
  'gps_disabled_message': {
    'en': 'Turn on GPS / location to set pickup and see nearby drivers.',
    'es': 'Activa la ubicación para establecer el origen y ver conductores cercanos.',
    'ru': 'Включите GPS / геолокацию для точки А и ближайших водителей.',
    'fr': 'Activez la localisation pour définir le point de départ et voir les chauffeurs.',
  },
  'location_denied_forever_title': {
    'en': 'Location access denied',
    'es': 'Acceso a ubicación denegado',
    'ru': 'Доступ к геолокации запрещён',
    'fr': 'Accès à la localisation refusé',
  },
  'location_denied_forever_message': {
    'en': 'You previously denied location. Open app settings to allow it.',
    'es': 'Antes denegaste la ubicación. Abre la configuración de la app para permitirla.',
    'ru': 'Вы ранее запретили доступ. Откройте настройки приложения, чтобы разрешить.',
    'fr': 'Vous avez refusé la localisation. Ouvrez les paramètres de l\'app pour l\'autoriser.',
  },
  'open_settings': {'en': 'Open settings', 'es': 'Abrir configuración', 'ru': 'Настройки', 'fr': 'Ouvrir les paramètres'},
  'drawer_profile': {'en': 'Profile', 'es': 'Perfil', 'ru': 'Профиль', 'fr': 'Profil'},
  'drawer_wallet': {'en': 'Wallet', 'es': 'Billetera', 'ru': 'Кошелёк', 'fr': 'Portefeuille'},
  'drawer_history': {'en': 'History', 'es': 'Historial', 'ru': 'История', 'fr': 'Historique'},
  'ride_history_title': {'en': 'Ride & Service History', 'es': 'Historial de viajes y servicios', 'ru': 'История поездок', 'fr': 'Historique des trajets'},
  'ride_history_subtitle': {'en': 'Past rides and services. Filter and download as PDF or Excel.', 'es': 'Viajes y servicios anteriores. Filtra y descarga en PDF o Excel.', 'ru': 'Прошлые поездки. Фильтр и скачать PDF или Excel.', 'fr': 'Trajets passés. Filtrer et télécharger en PDF ou Excel.'},
  'filter_all': {'en': 'All', 'es': 'Todos', 'ru': 'Все', 'fr': 'Tous'},
  'filter_completed': {'en': 'Completed', 'es': 'Completados', 'ru': 'Завершено', 'fr': 'Terminés'},
  'filter_pending': {'en': 'Pending', 'es': 'Pendientes', 'ru': 'В ожидании', 'fr': 'En attente'},
  'filter_date_range': {'en': 'Date range', 'es': 'Rango de fechas', 'ru': 'Период', 'fr': 'Période'},
  'clear_filter': {'en': 'Clear filter', 'es': 'Limpiar filtro', 'ru': 'Сбросить', 'fr': 'Effacer'},
  'download_pdf': {'en': 'Download PDF', 'es': 'Descargar PDF', 'ru': 'Скачать PDF', 'fr': 'Télécharger PDF'},
  'download_excel': {'en': 'Download Excel', 'es': 'Descargar Excel', 'ru': 'Скачать Excel', 'fr': 'Télécharger Excel'},
  'no_rides_yet': {'en': 'No rides yet', 'es': 'Aún no hay viajes', 'ru': 'Поездок пока нет', 'fr': 'Aucun trajet'},
  'no_rides_to_export': {'en': 'No rides to export', 'es': 'No hay viajes para exportar', 'ru': 'Нет данных для экспорта', 'fr': 'Aucun trajet à exporter'},
  'drawer_support': {'en': 'Support', 'es': 'Soporte', 'ru': 'Поддержка', 'fr': 'Support'},
  'drawer_tours': {'en': 'Tours', 'es': 'Tours', 'ru': 'Туры', 'fr': 'Tours'},
  'drawer_logout': {'en': 'Logout', 'es': 'Cerrar sesión', 'ru': 'Выйти', 'fr': 'Déconnexion'},
  'tours_search_hint': {'en': 'Search tours, city...', 'es': 'Buscar tours, ciudad...', 'ru': 'Поиск туров...', 'fr': 'Rechercher des tours...'},
  'tours_retry': {'en': 'Retry', 'es': 'Reintentar', 'ru': 'Повторить', 'fr': 'Réessayer'},
  'tours_server_error': {
    'en': 'Cannot connect to server. Run START_BACKEND.bat (or: cd backend && npm start) then tap Retry.',
    'es': 'No se puede conectar. Ejecuta START_BACKEND.bat (o: cd backend && npm start) y toca Reintentar.',
    'ru': 'Нет связи с сервером. Запустите START_BACKEND.bat (или: cd backend && npm start), затем Повторить.',
    'fr': 'Impossible de se connecter. Lancez START_BACKEND.bat (ou: cd backend && npm start) puis Réessayer.',
  },
  'tours_empty': {'en': 'No tours found', 'es': 'No se encontraron tours', 'ru': 'Туры не найдены', 'fr': 'Aucun tour trouvé'},
  'tours_select_date': {'en': 'Select date & time', 'es': 'Selecciona fecha y hora', 'ru': 'Выберите дату и время', 'fr': 'Choisir date et heure'},
  'tours_no_slots': {'en': 'No available slots', 'es': 'No hay horarios disponibles', 'ru': 'Нет доступных слотов', 'fr': 'Aucun créneau disponible'},
  'tours_select_option': {'en': 'Select option', 'es': 'Selecciona opción', 'ru': 'Выберите опцию', 'fr': 'Choisir une option'},
  'tours_no_options': {'en': 'No options', 'es': 'Sin opciones', 'ru': 'Нет опций', 'fr': 'Aucune option'},
  'tours_pax': {'en': 'person', 'es': 'persona', 'ru': 'чел.', 'fr': 'personne'},
  'tours_guests': {'en': 'Guests', 'es': 'Huéspedes', 'ru': 'Гости', 'fr': 'Invités'},
  'tours_guest_details': {'en': 'Guest details', 'es': 'Datos del huésped', 'ru': 'Данные гостя', 'fr': 'Détails du client'},
  'tours_guest_name': {'en': 'Full name', 'es': 'Nombre completo', 'ru': 'Имя', 'fr': 'Nom complet'},
  'tours_guest_email': {'en': 'Email', 'es': 'Correo', 'ru': 'Email', 'fr': 'Email'},
  'tours_guest_phone': {'en': 'Phone (optional)', 'es': 'Teléfono (opcional)', 'ru': 'Телефон (опц.)', 'fr': 'Téléphone (optionnel)'},
  'tours_guest_required': {'en': 'Name and email required', 'es': 'Nombre y correo obligatorios', 'ru': 'Укажите имя и email', 'fr': 'Nom et email requis'},
  'tours_total': {'en': 'Total', 'es': 'Total', 'ru': 'Итого', 'fr': 'Total'},
  'tours_book_now': {'en': 'Book now', 'es': 'Reservar ahora', 'ru': 'Забронировать', 'fr': 'Réserver'},
  'tours_booking_created': {'en': 'Booking created.', 'es': 'Reserva creada.', 'ru': 'Бронирование создано.', 'fr': 'Réservation créée.'},
  'tours_redirect_payment': {'en': 'Redirecting to payment...', 'es': 'Redirigiendo al pago...', 'ru': 'Переход к оплате...', 'fr': 'Redirection vers le paiement...'},
  'tours_duration': {'en': 'Duration', 'es': 'Duración', 'ru': 'Длительность', 'fr': 'Durée'},
  'tours_meeting_point': {'en': 'Meeting point', 'es': 'Punto de encuentro', 'ru': 'Место встречи', 'fr': 'Point de rendez-vous'},
  'tours_free_cancel': {'en': 'Free cancellation available', 'es': 'Cancelación gratuita disponible', 'ru': 'Бесплатная отмена', 'fr': 'Annulation gratuite disponible'},
  'profile_name': {'en': 'Name', 'es': 'Nombre', 'ru': 'Имя', 'fr': 'Nom'},
  'profile_passenger': {'en': 'Passenger', 'es': 'Pasajero', 'ru': 'Пассажир', 'fr': 'Passager'},
  'profile_personal_info': {'en': 'Personal info', 'es': 'Datos personales', 'ru': 'Личные данные', 'fr': 'Infos personnelles'},
  'profile_phone': {'en': 'Phone', 'es': 'Teléfono', 'ru': 'Телефон', 'fr': 'Téléphone'},
  'profile_email': {'en': 'Email', 'es': 'Correo', 'ru': 'Email', 'fr': 'Email'},
  'tap_photo_to_change': {'en': 'Tap photo to change', 'es': 'Toca la foto para cambiar', 'ru': 'Нажмите, чтобы изменить фото', 'fr': 'Appuyez pour changer la photo'},
  'save': {'en': 'Save', 'es': 'Guardar', 'ru': 'Сохранить', 'fr': 'Enregistrer'},
  'profile_preferences': {'en': 'Preferences', 'es': 'Preferencias', 'ru': 'Настройки', 'fr': 'Préférences'},
  'profile_language': {'en': 'Language', 'es': 'Idioma', 'ru': 'Язык', 'fr': 'Langue'},
  'profile_notifications': {'en': 'Notifications', 'es': 'Notificaciones', 'ru': 'Уведомления', 'fr': 'Notifications'},
  'profile_enabled': {'en': 'Enabled', 'es': 'Activado', 'ru': 'Вкл.', 'fr': 'Activé'},
  'profile_disabled': {'en': 'Disabled', 'es': 'Desactivado', 'ru': 'Выкл.', 'fr': 'Désactivé'},
  'profile_copied': {'en': 'Copied to clipboard', 'es': 'Copiado al portapapeles', 'ru': 'Скопировано', 'fr': 'Copié'},
  'coming_soon': {'en': 'Coming soon', 'es': 'Próximamente', 'ru': 'Скоро', 'fr': 'Bientôt'},
  'select_destination_on_map': {
    'en': 'Select your destination on map',
    'es': 'Elige tu destino en el mapa',
    'ru': 'Выберите место назначения на карте',
    'fr': 'Choisir la destination sur la carte',
  },
  'tap_on_map_to_set_destination': {
    'en': 'Tap on the map to set destination',
    'es': 'Toca el mapa para establecer el destino',
    'ru': 'Нажмите на карту, чтобы указать место назначения',
    'fr': 'Appuyez sur la carte pour définir la destination',
  },
  'back_to_search': {
    'en': 'Type location instead',
    'es': 'Escribir dirección',
    'ru': 'Ввести адрес',
    'fr': 'Saisir l\'adresse',
  },
  'selected_on_map': {
    'en': 'Selected on map',
    'es': 'Seleccionado en el mapa',
    'ru': 'Выбрано на карте',
    'fr': 'Sélectionné sur la carte',
  },
  'select_destination_first': {
    'en': 'Please select destination first',
    'es': 'Selecciona primero el destino',
    'ru': 'Сначала укажите пункт назначения',
    'fr': 'Veuillez d\'abord choisir la destination',
  },
  'destination_set_on_map': {
    'en': 'Destination set from map',
    'es': 'Destino establecido desde el mapa',
    'ru': 'Место назначения выбрано на карте',
    'fr': 'Destination définie sur la carte',
  },
  'could_not_load_selection': {
    'en': 'Could not load selection.',
    'es': 'No se pudo cargar la selección.',
    'ru': 'Не удалось загрузить.',
    'fr': 'Impossible de charger.',
  },
  'route_calc_failed': {
    'en': 'Could not calculate route. Using approximate route.',
    'es': 'No se pudo calcular la ruta. Usando ruta aproximada.',
    'ru': 'Не удалось построить маршрут.',
    'fr': 'Impossible de calculer l\'itinéraire.',
  },
  'route_error': {
    'en': 'Error finding route. Try again.',
    'es': 'Error al buscar ruta. Intenta de nuevo.',
    'ru': 'Ошибка маршрута. Попробуйте снова.',
    'fr': 'Erreur de recherche d\'itinéraire.',
  },
  'reserve': {
    'en': 'Reserve',
    'es': 'Reservar',
    'ru': 'Забронировать',
    'fr': 'Réserver',
  },
  'buscar_vehiculo': {
    'en': 'Find Vehicle',
    'es': 'Buscar Vehículo',
    'ru': 'Найти транспорт',
    'fr': 'Trouver un véhicule',
  },
  'message_instruction': {
    'en': 'Message / Instruction (optional)',
    'es': 'Mensaje / Instrucción (opcional)',
    'ru': 'Сообщение / инструкция (необязательно)',
    'fr': 'Message / instruction (optionnel)',
  },
  'upload_photo': {
    'en': 'Upload Photo',
    'es': 'Subir Foto',
    'ru': 'Загрузить фото',
    'fr': 'Télécharger photo',
  },
  'photo_added': {'en': 'Photo added', 'es': 'Foto agregada', 'ru': 'Фото добавлено', 'fr': 'Photo ajoutée'},
  'photo_pick_failed': {'en': 'Could not pick photo', 'es': 'No se pudo seleccionar foto', 'ru': 'Не удалось выбрать фото', 'fr': 'Impossible de sélectionner la photo'},
  'select_service': {
    'en': 'Select service',
    'es': 'Selecciona servicio',
    'ru': 'Выберите услугу',
    'fr': 'Sélectionnez le service',
  },
  'select_vehicle': {
    'en': 'Select your ride',
    'es': 'Elige tu viaje',
    'ru': 'Выберите поездку',
    'fr': 'Choisissez votre trajet',
  },
  'finding_driver': {
    'en': 'Finding a driver for you...',
    'es': 'Buscando un conductor para ti...',
    'ru': 'Ищем водителя для вас...',
    'fr': 'Recherche d\'un conducteur...',
  },
  'please_wait_driver': {
    'en': 'Please wait while we connect you with nearby drivers. You will see offers shortly.',
    'es': 'Por favor espera mientras te conectamos con conductores cercanos. Verás ofertas pronto.',
    'ru': 'Пожалуйста, подождите, мы связываем вас с ближайшими водителями.',
    'fr': 'Veuillez patienter pendant que nous vous connectons avec les chauffeurs à proximité.',
  },
  'attraction': {
    'en': 'Attraction',
    'es': 'Atracción',
    'ru': 'Достопримечательности',
    'fr': 'Attraction',
  },
  'driver_offers': {
    'en': 'Driver offers',
    'es': 'Ofertas de conductores',
    'ru': 'Предложения водителей',
    'fr': 'Offres des conducteurs',
  },
  'driver_proposes': {
    'en': 'Driver proposes: S/ {{price}}',
    'es': 'El conductor propone: S/ {{price}}',
    'ru': 'Водитель предлагает: S/ {{price}}',
    'fr': 'Le chauffeur propose: S/ {{price}}',
  },
  'searching_nearby': {
    'en': 'Searching for nearby drivers...',
    'es': 'Buscando conductores cercanos...',
    'ru': 'Ищем водителей рядом...',
    'fr': 'Recherche de chauffeurs à proximité...',
  },
  'waiting_response': {
    'en': 'Waiting for response...',
    'es': 'Esperando respuesta...',
    'ru': 'Ожидание ответа...',
    'fr': 'En attente de réponse...',
  },
  'counter_sent': {
    'en': 'Counter sent',
    'es': 'Contraoferta enviada',
    'ru': 'Контрпредложение отправлено',
    'fr': 'Contre-offre envoyée',
  },
  'driver_accepted_msg': {
    'en': 'Driver {{driverName}} has accepted your offer!',
    'es': '¡El conductor {{driverName}} ha aceptado tu oferta!',
    'ru': 'Водитель {{driverName}} принял вашу заявку!',
    'fr': 'Le chauffeur {{driverName}} a accepté votre offre!',
  },
  'chat': {'en': 'Chat', 'es': 'Chat', 'ru': 'Чат', 'fr': 'Chat'},
  'call': {'en': 'Call', 'es': 'Llamar', 'ru': 'Позвонить', 'fr': 'Appeler'},
  'could_not_send': {
    'en': 'Could not send. Check connection.',
    'es': 'No se pudo enviar. Revisa la conexión.',
    'ru': 'Не удалось отправить.',
    'fr': 'Impossible d\'envoyer.',
  },
  'phone_not_available': {
    'en': 'Phone number not available',
    'es': 'Número no disponible',
    'ru': 'Номер недоступен',
    'fr': 'Numéro non disponible',
  },
  'counter_accepted_msg': {
    'en': 'You accepted the counter offer: S/ {{price}}',
    'es': 'Aceptaste la contraoferta: S/ {{price}}',
    'ru': 'Вы приняли встречное предложение: S/ {{price}}',
    'fr': 'Vous avez accepté la contre-offre: S/ {{price}}',
  },
  'biometric_add_title': {
    'en': 'Add {{type}} for quick login?',
    'es': '¿Añadir {{type}} para iniciar sesión rápido?',
    'ru': 'Добавить {{type}} для быстрого входа?',
    'fr': 'Ajouter {{type}} pour une connexion rapide?',
  },
  'biometric_add_message': {
    'en': 'Sign in securely and quickly with your fingerprint or face. You can skip and add later from Settings.',
    'es': 'Inicia sesión de forma segura y rápida con tu huella o rostro. Puedes omitir y añadir después en Ajustes.',
    'ru': 'Войдите безопасно и быстро с помощью отпечатка или лица. Можно пропустить и добавить позже в Настройках.',
    'fr': 'Connectez-vous de manière sécurisée avec votre empreinte ou visage. Vous pouvez ignorer et ajouter plus tard dans Paramètres.',
  },
  'biometric_add': {'en': 'Add', 'es': 'Añadir', 'ru': 'Добавить', 'fr': 'Ajouter'},
  'biometric_skip': {'en': 'Skip', 'es': 'Omitir', 'ru': 'Пропустить', 'fr': 'Ignorer'},
  'biometric_login_with': {
    'en': 'Login with {{type}}',
    'es': 'Iniciar con {{type}}',
    'ru': 'Войти с {{type}}',
    'fr': 'Connexion avec {{type}}',
  },
  'biometric_settings_title': {'en': 'Biometric login', 'es': 'Inicio con biometría', 'ru': 'Вход по биометрии', 'fr': 'Connexion biométrique'},
  'biometric_settings_message': {
    'en': 'Add biometric for secure and quick login. If you skipped earlier, you can add from your phone Settings (add fingerprint/face) then enable here.',
    'es': 'Añade biometría para un inicio de sesión seguro y rápido. Si lo omitiste antes, puedes añadir desde Ajustes del teléfono y luego activar aquí.',
    'ru': 'Добавьте биометрию для безопасного и быстрого входа. Если вы пропустили ранее, добавьте в Настройках телефона (отпечаток/лицо), затем включите здесь.',
    'fr': 'Ajoutez la biométrie pour une connexion sécurisée et rapide. Si vous avez ignoré avant, ajoutez dans les Paramètres du téléphone puis activez ici.',
  },
  'biometric_email_password_required': {
    'en': 'Biometric login works with email/password. Sign in with email and password to enable.',
    'es': 'El inicio biométrico funciona con email/contraseña. Inicia sesión con email y contraseña para activar.',
    'ru': 'Биометрический вход работает с email/паролем. Войдите с email и паролем, чтобы включить.',
    'fr': 'La connexion biométrique fonctionne avec email/mot de passe. Connectez-vous avec email et mot de passe pour activer.',
  },
  'already_registered': {'en': 'Already registered', 'es': 'Ya registrado', 'ru': 'Уже зарегистрирован', 'fr': 'Déjà inscrit'},
  'already_registered_message': {
    'en': 'An account with this email already exists. Please login instead.',
    'es': 'Ya existe una cuenta con este correo. Inicia sesión.',
    'ru': 'Аккаунт с этим email уже существует. Войдите в систему.',
    'fr': 'Un compte avec cet email existe déjà. Connectez-vous.',
  },
  'go_to_login': {'en': 'Login', 'es': 'Iniciar sesión', 'ru': 'Войти', 'fr': 'Connexion'},
  'become_our': {'en': 'Join us', 'es': 'Únete a nosotros', 'ru': 'Присоединяйтесь', 'fr': 'Rejoignez-nous'},
  'become_driver': {'en': 'Driver', 'es': 'Conductor', 'ru': 'Водитель', 'fr': 'Chauffeur'},
  'become_partner': {'en': 'Partner', 'es': 'Socio', 'ru': 'Партнёр', 'fr': 'Partenaire'},
  'go': {'en': 'Go', 'es': 'Ir', 'ru': 'Перейти', 'fr': 'Aller'},
  'verify_email_phone_title': {
    'en': 'Verify your email & phone',
    'es': 'Verifica tu email y teléfono',
    'ru': 'Подтвердите email и телефон',
    'fr': 'Vérifiez votre email et téléphone',
  },
  'verify_email_sent': {
    'en': 'We sent a verification link to {{email}}. Open the link, then tap the button below.',
    'es': 'Enviamos un enlace a {{email}}. Ábrelo y luego pulsa el botón.',
    'ru': 'Мы отправили ссылку на {{email}}. Откройте её и нажмите кнопку ниже.',
    'fr': 'Nous avons envoyé un lien à {{email}}. Ouvrez-le puis appuyez sur le bouton.',
  },
  'i_verified_email': {
    'en': 'I verified my email',
    'es': 'Verifiqué mi email',
    'ru': 'Я подтвердил email',
    'fr': 'J\'ai vérifié mon email',
  },
  'email_not_verified_yet': {
    'en': 'Please open the link in your email first, then tap again.',
    'es': 'Abre el enlace del correo primero y luego pulsa de nuevo.',
    'ru': 'Сначала откройте ссылку в письме, затем нажмите снова.',
    'fr': 'Ouvrez d\'abord le lien dans l\'email, puis appuyez à nouveau.',
  },
  'verify_phone_otp_sent': {
    'en': 'We sent a 6-digit code to {{phone}}. Enter it below.',
    'es': 'Enviamos un código de 6 dígitos a {{phone}}. Introdúcelo abajo.',
    'ru': 'Мы отправили 6-значный код на {{phone}}. Введите его ниже.',
    'fr': 'Nous avons envoyé un code à 6 chiffres au {{phone}}. Entrez-le ci-dessous.',
  },
  'enter_otp': {'en': 'Enter 6-digit code', 'es': 'Código de 6 dígitos', 'ru': 'Введите 6-значный код', 'fr': 'Code à 6 chiffres'},
  'verify_and_continue': {
    'en': 'Verify & continue',
    'es': 'Verificar y continuar',
    'ru': 'Подтвердить и продолжить',
    'fr': 'Vérifier et continuer',
  },
  'both_verifications_required': {
    'en': 'Please verify both email and phone to continue.',
    'es': 'Verifica email y teléfono para continuar.',
    'ru': 'Подтвердите email и телефон для продолжения.',
    'fr': 'Vérifiez l\'email et le téléphone pour continuer.',
  },
  'reset_password_title': {'en': 'Reset password', 'es': 'Restablecer contraseña', 'ru': 'Сброс пароля', 'fr': 'Réinitialiser le mot de passe'},
  'reset_via_email': {'en': 'Via email', 'es': 'Por email', 'ru': 'По email', 'fr': 'Par email'},
  'reset_via_phone': {'en': 'Via phone', 'es': 'Por teléfono', 'ru': 'По телефону', 'fr': 'Par téléphone'},
  'send_otp': {'en': 'Send OTP', 'es': 'Enviar OTP', 'ru': 'Отправить код', 'fr': 'Envoyer le code'},
  'enter_email': {'en': 'Enter your email', 'es': 'Ingresa tu email', 'ru': 'Введите email', 'fr': 'Entrez votre email'},
  'enter_phone': {'en': 'Enter your phone number', 'es': 'Ingresa tu teléfono', 'ru': 'Введите номер телефона', 'fr': 'Entrez votre numéro'},
  'phone': {'en': 'Phone', 'es': 'Teléfono', 'ru': 'Телефон', 'fr': 'Téléphone'},
  'new_password': {'en': 'New password', 'es': 'Nueva contraseña', 'ru': 'Новый пароль', 'fr': 'Nouveau mot de passe'},
  'new_password_hint': {'en': 'Min 6 characters', 'es': 'Mín 6 caracteres', 'ru': 'Мин. 6 символов', 'fr': 'Min 6 caractères'},
  'confirm_password': {'en': 'Confirm password', 'es': 'Confirmar contraseña', 'ru': 'Подтвердите пароль', 'fr': 'Confirmer le mot de passe'},
  'passwords_do_not_match': {'en': 'Passwords do not match', 'es': 'Las contraseñas no coinciden', 'ru': 'Пароли не совпадают', 'fr': 'Les mots de passe ne correspondent pas'},
  'password_reset_success': {'en': 'Password reset successful. You can now login.', 'es': 'Contraseña restablecida. Ya puedes iniciar sesión.', 'ru': 'Пароль сброшен. Можете войти.', 'fr': 'Mot de passe réinitialisé. Vous pouvez vous connecter.'},
  'reset_password_btn': {'en': 'Set new password', 'es': 'Establecer nueva contraseña', 'ru': 'Установить пароль', 'fr': 'Définir le mot de passe'},
  'profile_incomplete_title': {
    'en': 'Complete your profile',
    'es': 'Completa tu perfil',
    'ru': 'Заполните профиль',
    'fr': 'Complétez votre profil',
  },
  'profile_incomplete_msg': {
    'en': 'Name, Email, and Phone are required to book a ride.',
    'es': 'Nombre, Email y Teléfono son obligatorios para reservar.',
    'ru': 'Имя, Email и Телефон обязательны для бронирования.',
    'fr': 'Nom, Email et Téléphone sont requis pour réserver.',
  },
  'go_to_profile': {
    'en': 'Go to Profile',
    'es': 'Ir al Perfil',
    'ru': 'Перейти в Профиль',
    'fr': 'Aller au Profil',
  },
};

String _replaceParams(String s, Map<String, dynamic>? params) {
  if (params == null || params.isEmpty) return s;
  String r = s;
  for (final e in params.entries) {
    r = r.replaceAll('{{${e.key}}}', e.value?.toString() ?? '');
  }
  return r;
}

/// Returns translated string for [key] in [locale]. Uses [params] to replace {{key}} in the string.
String translate(String key, Locale locale, [Map<String, dynamic>? params]) {
  final byLang = _translations[key];
  if (byLang == null) return key;
  final lang = locale.languageCode;
  final s = byLang[lang] ?? byLang['es'] ?? byLang['en'] ?? key;
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

/// Inherited widget to provide current locale and t() to the tree.
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
  bool updateShouldNotify(AppLocaleScope oldWidget) {
    return oldWidget.locale != locale;
  }
}
