# Android Security Setup Guide
**Purpose**: Secure Google Maps API key integration for Android builds

## Overview
The hardcoded Google Maps API key has been removed from `AndroidManifest.xml` and replaced with a secure build variable `${MAPS_API_KEY}`. This guide shows how to properly configure it for different environments.

## Security Changes Made

### ✅ Removed Hardcoded API Key
**Before** (INSECURE):
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

**After** (SECURE):
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="${MAPS_API_KEY}" />
```

**File**: `user_app/android/app/src/main/AndroidManifest.xml:19`

## Environment Configuration

### 1. Development Setup

#### Option A: gradle.properties (Local Development)
```properties
# user_app/android/gradle.properties
MAPS_API_KEY=your_development_api_key_here
```

#### Option B: Environment Variable
```bash
# Set in your shell or IDE
export MAPS_API_KEY=your_development_api_key_here
```

#### Option C: local.properties (Git Ignored)
```properties
# user_app/android/local.properties (add to .gitignore)
MAPS_API_KEY=your_development_api_key_here
```

### 2. Production Build Setup

#### Option A: CI/CD Environment Variable
```yaml
# GitHub Actions Example
- name: Build Android Release
  run: |
    cd user_app
    flutter build apk --release
  env:
    MAPS_API_KEY: ${{ secrets.MAPS_API_KEY }}
```

#### Option B: gradle.properties with Build Script
```bash
# Production build script
#!/bin/bash
export MAPS_API_KEY="$PRODUCTION_MAPS_API_KEY"
cd user_app
flutter build apk --release
```

#### Option C: Keystore Properties (Advanced)
```properties
# user_app/android/keystore.properties
MAPS_API_KEY=your_production_api_key_here
```

## Build Configuration Integration

### 1. Update build.gradle (if needed)
```groovy
// user_app/android/app/build.gradle

android {
    ...
    defaultConfig {
        ...
        // Read from gradle.properties or environment
        buildConfigField "String", "MAPS_API_KEY", "\"${project.hasProperty('MAPS_API_KEY') ? project.property('MAPS_API_KEY') : System.getenv('MAPS_API_KEY') ?: ''}\""
    }
    
    buildTypes {
        release {
            ...
            // Ensure API key is available in release builds
            buildConfigField "String", "MAPS_API_KEY", "\"${project.hasProperty('MAPS_API_KEY') ? project.property('MAPS_API_KEY') : System.getenv('MAPS_API_KEY') ?: ''}\""
        }
    }
}
```

### 2. Update gradle.properties
```properties
# user_app/android/gradle.properties

# Android-specific properties
android.useAndroidX=true
android.enableJetifier=true

# Security: Maps API Key (DO NOT commit real keys)
MAPS_API_KEY=your_api_key_here

# Build optimization
org.gradle.jvmargs=-Xmx1536M
android.enableR8=true
```

## Security Best Practices

### 1. API Key Security
- **Never commit real API keys** to version control
- **Use different keys** for development and production
- **Restrict API key** usage in Google Cloud Console
- **Monitor API usage** for unusual activity

### 2. Environment Separation
```bash
# Development API Key (restricted)
# - Only allows development domains
# - Lower quota limits
# - Can be rotated frequently

# Production API Key (restricted)
# - Only allows production domains
# - Higher quota limits
# - Strict IP restrictions
# - Monthly rotation recommended
```

### 3. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Create API keys with restrictions:
   - **Application restrictions**: Android apps with package name and SHA-1 certificate
   - **API restrictions**: Only enable Maps SDK APIs needed
   - **IP restrictions** (if applicable)

## Flutter Integration

### 1. Update Dart Code (if accessing key programmatically)
```dart
// user_app/lib/services/maps_config.dart
class MapsConfig {
  static const String? _apiKey = String.fromEnvironment(
    'MAPS_API_KEY',
    defaultValue: null,
  );
  
  static String get apiKey {
    if (_apiKey == null || _apiKey.isEmpty) {
      throw Exception('MAPS_API_KEY not configured. Set environment variable or gradle property.');
    }
    return _apiKey!;
  }
  
  static bool get isConfigured => _apiKey != null && _apiKey.isNotEmpty;
}
```

### 2. Update main.dart for development warnings
```dart
// user_app/lib/main.dart
import 'package:tbidder/services/maps_config.dart';

void main() {
  // Development warning for missing API key
  if (!MapsConfig.isConfigured) {
    debugPrint('WARNING: MAPS_API_KEY not configured. Maps functionality will be limited.');
  }
  
  runApp(MyApp());
}
```

## Build Verification

### 1. Development Build
```bash
cd user_app

# Check if API key is available
echo $MAPS_API_KEY

# Build debug APK
flutter build apk --debug

# Verify key is included (for debugging only)
apktool d build/app/outputs/flutter-apk/app-debug.apk
grep -r "MAPS_API_KEY" build/app/outputs/flutter-apk/app-debug/
```

### 2. Production Build
```bash
# Set production key
export MAPS_API_KEY="$PRODUCTION_MAPS_API_KEY"

# Build release APK
flutter build apk --release

# Verify build completed successfully
ls -la build/app/outputs/flutter-apk/app-release.apk
```

## CI/CD Integration

### 1. GitHub Actions
```yaml
# .github/workflows/android-build.yml
name: Build Android Release

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Flutter
      uses: subosito/flutter-action@v2
      with:
        flutter-version: '3.16.0'
    
    - name: Build Android Release
      run: |
        cd user_app
        flutter build apk --release
      env:
        MAPS_API_KEY: ${{ secrets.MAPS_API_KEY }}
    
    - name: Upload APK
      uses: actions/upload-artifact@v3
      with:
        name: release-apk
        path: user_app/build/app/outputs/flutter-apk/app-release.apk
```

### 2. GitLab CI
```yaml
# .gitlab-ci.yml
build_android:
  stage: build
  script:
    - cd user_app
    - flutter build apk --release
  variables:
    MAPS_API_KEY: $MAPS_API_KEY
  artifacts:
    paths:
      - user_app/build/app/outputs/flutter-apk/app-release.apk
```

## Troubleshooting

### Common Issues

#### Issue: "API key not authorized"
**Solution**: 
1. Check Google Cloud Console restrictions
2. Verify package name and SHA-1 fingerprint
3. Ensure API is enabled

#### Issue: "MAPS_API_KEY not found"
**Solution**:
1. Check environment variable is set: `echo $MAPS_API_KEY`
2. Verify gradle.properties contains the key
3. Check build configuration

#### Issue: "Build fails in CI/CD"
**Solution**:
1. Ensure secret is properly configured in CI/CD
2. Check environment variable name matches
3. Verify build script passes environment

### Debug Commands
```bash
# Check current environment
echo "MAPS_API_KEY: $MAPS_API_KEY"

# Check gradle properties
cat user_app/android/gradle.properties | grep MAPS_API_KEY

# Test Flutter environment
cd user_app
flutter run --debug | grep MAPS_API_KEY

# Verify APK contents (debug only)
apktool d build/app/outputs/flutter-apk/app-debug.apk
find build/app/outputs/flutter-apk/app-debug/ -name "AndroidManifest.xml" -exec grep -l "MAPS_API_KEY" {} \;
```

## Security Checklist

### ✅ Pre-Deployment Checklist
- [ ] Development API key replaced with placeholder
- [ ] Production API key configured in CI/CD
- [ ] Google Cloud Console restrictions set
- [ ] API key usage monitoring enabled
- [ ] Build verification completed
- [ ] No real keys committed to repository

### ✅ Post-Deployment Monitoring
- [ ] Monitor API usage for anomalies
- [ ] Check error logs for API key issues
- [ ] Verify maps functionality works
- [ ] Review Google Cloud Console for security alerts
- [ ] Schedule quarterly key rotation

## Emergency Procedures

### If API Key is Compromised
1. **Immediate**: Disable compromised key in Google Cloud Console
2. **Rotate**: Generate new API key with restrictions
3. **Update**: Change environment variables in all environments
4. **Deploy**: Rebuild and redeploy applications
5. **Monitor**: Watch for unusual API usage
6. **Review**: Audit access logs and usage patterns

### If Build Fails Due to Missing Key
1. **Check**: Verify environment variable is set
2. **Validate**: Test API key in Google Cloud Console
3. **Debug**: Use debug commands to verify configuration
4. **Fix**: Update build configuration as needed
5. **Test**: Verify build completes successfully

---

**Security Status**: ✅ HARDENED  
**Implementation Date**: February 16, 2026  
**Next Review**: March 16, 2026
