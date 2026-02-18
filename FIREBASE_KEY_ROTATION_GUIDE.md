# Firebase Key Rotation Guide
**Urgent**: Complete this guide immediately after security remediation

## Step 1: Generate New Firebase Service Account Key

### 1.1 Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `transport-bidder`
3. Click **Settings** (⚙️) > **Service accounts**

### 1.2 Create New Service Account Key
1. Click **Generate new private key**
2. Select **JSON** format
3. Click **Generate**
4. **Save the file securely** - This is your new key

### 1.3 Delete Old Compromised Keys
1. In the same Service accounts section
2. Find the old service account: `firebase-adminsdk-fbsvc@transport-bidder.iam.gserviceaccount.com`
3. Click **Manage service accounts**
4. Select the service account
5. Click **Keys** tab
6. **Delete** the old key with ID: `1935375dade4b30a7c646d1aa25214b1aea6a3e2`

## Step 2: Extract New Key Information

### 2.1 Open the New JSON Key File
```json
{
  "type": "service_account",
  "project_id": "transport-bidder",
  "private_key_id": "NEW_KEY_ID_HERE",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-NEW@transport-bidder.iam.gserviceaccount.com",
  "client_id": "NEW_CLIENT_ID_HERE",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### 2.2 Copy Required Values
- **private_key**: The entire key including BEGIN/END markers
- **client_email**: The service account email
- **project_id**: Your project ID

## Step 3: Update Environment Variables

### 3.1 Windows PowerShell (Recommended)
```powershell
# Set System Environment Variables (Permanent)
[System.Environment]::SetEnvironmentVariable('FIREBASE_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDC...\n-----END PRIVATE KEY-----', 'Machine')

[System.Environment]::SetEnvironmentVariable('FIREBASE_CLIENT_EMAIL', 'firebase-adminsdk-NEW@transport-bidder.iam.gserviceaccount.com', 'Machine')

[System.Environment]::SetEnvironmentVariable('FIREBASE_PROJECT_ID', 'transport-bidder', 'Machine')

# Verify variables were set
[System.Environment]::GetEnvironmentVariable('FIREBASE_PRIVATE_KEY', 'Machine')
[System.Environment]::GetEnvironmentVariable('FIREBASE_CLIENT_EMAIL', 'Machine')
[System.Environment]::GetEnvironmentVariable('FIREBASE_PROJECT_ID', 'Machine')
```

### 3.2 Windows Command Prompt
```cmd
# Set System Environment Variables
setx FIREBASE_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDC...\n-----END PRIVATE KEY-----" /M

setx FIREBASE_CLIENT_EMAIL "firebase-adminsdk-NEW@transport-bidder.iam.gserviceaccount.com" /M

setx FIREBASE_PROJECT_ID "transport-bidder" /M
```

### 3.3 Development .env File (Local Dev Only)
```bash
# Create .env file in project root
echo "FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDC...\n-----END PRIVATE KEY-----\"" > .env

echo "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-NEW@transport-bidder.iam.gserviceaccount.com" >> .env

echo "FIREBASE_PROJECT_ID=transport-bidder" >> .env
```

## Step 4: Test New Configuration

### 4.1 Restart Your Application
```bash
# Stop any running processes
# Restart your backend server
npm start
# Or
node server.js
```

### 4.2 Verify Firebase Connection
Check your application logs for:
```
[firebase-admin] Firebase Admin initialized successfully
```

### 4.3 Test Firebase Operations
```javascript
// Test script - save as test-firebase.js
const { getAdmin } = require('./backend/src/services/firebase-admin');

async function testFirebase() {
  const admin = getAdmin();
  if (admin) {
    console.log('✅ Firebase Admin initialized successfully');
    try {
      const auth = admin.auth();
      const user = await auth.getUser('test@example.com');
      console.log('✅ Firebase Auth working');
    } catch (err) {
      console.log('ℹ️ Firebase Auth connected (user not found is expected)');
    }
  } else {
    console.log('❌ Firebase Admin not initialized');
  }
}

testFirebase();
```

Run the test:
```bash
node test-firebase.js
```

## Step 5: Production Deployment

### 5.1 Cloud Environment Variables
```bash
# Google Cloud Run
gcloud run deploy your-service \
  --set-env-vars "FIREBASE_PRIVATE_KEY=your-key,FIREBASE_CLIENT_EMAIL=your-email,FIREBASE_PROJECT_ID=your-project"

# AWS ECS
aws ecs update-service --cluster your-cluster --service your-service \
  --force-new-deployment

# Azure App Service
az webapp config appsettings set --resource-group your-rg --name your-app \
  --settings FIREBASE_PRIVATE_KEY="your-key" FIREBASE_CLIENT_EMAIL="your-email"
```

### 5.2 Docker Environment
```dockerfile
# Dockerfile
ENV FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
ENV FIREBASE_CLIENT_EMAIL="firebase-adminsdk-NEW@transport-bidder.iam.gserviceaccount.com"
ENV FIREBASE_PROJECT_ID="transport-bidder"
```

```bash
# Docker Compose
version: '3.8'
services:
  backend:
    environment:
      - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
      - FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
```

## Step 6: Security Verification

### 6.1 Verify Old Keys Are Inactive
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Select your service account
4. Check **Keys** tab - old key should be deleted

### 6.2 Monitor Firebase Usage
1. Go to Firebase Console > **Usage**
2. Monitor for unusual activity
3. Check authentication logs

### 6.3 Test All Firebase Features
- User authentication
- Database operations
- Cloud messaging (if used)
- File storage (if used)

## Step 7: Cleanup and Documentation

### 7.1 Securely Delete Old Key Files
```powershell
# If you still have the old key files
Remove-Item firebase-admin-key.json -Force
Remove-Item firebase-admin-key-functions.json -Force

# Clear recycle bin
Clear-RecycleBin -Force
```

### 7.2 Update Documentation
- Update any documentation that references old key files
- Update team onboarding guides
- Update deployment scripts

### 7.3 Team Notification
```markdown
Subject: 🔒 Firebase Key Rotation Complete

Team,

Firebase service account keys have been rotated for security.

Changes:
- Old service account keys deleted
- New keys configured via environment variables
- No action required for local development (environment variables set)

Production:
- New keys will be deployed with next release
- Monitor for any Firebase connection issues

Security:
- All old keys have been revoked
- New keys follow secure storage practices
- Repository is now secure with proper .gitignore

Questions? Contact DevSecOps team.
```

## Troubleshooting

### Common Issues

#### Issue: "Invalid private key"
**Solution**: Ensure newlines are properly handled
```powershell
# Fix newlines in PowerShell
$privateKey = "-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"
[System.Environment]::SetEnvironmentVariable('FIREBASE_PRIVATE_KEY', $privateKey, 'Machine')
```

#### Issue: "Service account has insufficient permissions"
**Solution**: Verify IAM roles
1. Go to Google Cloud Console > IAM & Admin
2. Ensure service account has **Firebase Admin** role
3. Add **Cloud Firestore Admin** if using database

#### Issue: "Environment variables not loading"
**Solution**: Restart your application/terminal
```bash
# PowerShell
$env:FIREBASE_PRIVATE_KEY  # Check if set

# Restart PowerShell/VS Code/IDE
```

## Verification Checklist

### ✅ Completed Tasks
- [ ] New Firebase service account key generated
- [ ] Old compromised keys deleted
- [ ] Environment variables set (Windows)
- [ ] Application restarted and tested
- [ ] Firebase operations verified
- [ ] Production deployment updated
- [ ] Old key files securely deleted
- [ ] Team notified of changes

### 🔄 Ongoing Monitoring
- [ ] Monitor Firebase usage for anomalies
- [ ] Regular key rotation (quarterly)
- [ ] Security audit logs review
- [ ] Team security training

## Emergency Contacts

If you suspect any security issues:
1. **Immediate**: Revoke all Firebase service account keys
2. **DevSecOps**: Contact security team
3. **Firebase Support**: Report unauthorized access

---

**Completion Time**: 30-60 minutes  
**Security Impact**: Critical - Complete immediately  
**Next Rotation**: 90 days
