import 'package:flutter/material.dart';

Widget buildPickedImageThumbnail(String path) {
  // Web: path is blob URL
  return Image.network(
    path,
    fit: BoxFit.cover,
    errorBuilder: (_, __, ___) => Icon(Icons.image, color: Colors.grey.shade500),
  );
}
