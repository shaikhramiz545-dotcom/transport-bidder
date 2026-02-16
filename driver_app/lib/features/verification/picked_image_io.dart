import 'dart:io';

import 'package:flutter/material.dart';

Widget buildPickedImageThumbnail(String path) {
  // Bug fix: support backend URLs for already uploaded docs.
  if (path.startsWith('http')) {
    return Image.network(
      path,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Icon(Icons.image, color: Colors.grey.shade500),
    );
  }
  return Image.file(
    File(path),
    fit: BoxFit.cover,
    errorBuilder: (_, __, ___) => Icon(Icons.image, color: Colors.grey.shade500),
  );
}
