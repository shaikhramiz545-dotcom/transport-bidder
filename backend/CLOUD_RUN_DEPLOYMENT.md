# Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Project**
   - Create a project at https://console.cloud.google.com
   - Enable Cloud Run API
   - Enable Container Registry API

2. **gcloud CLI installed**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Environment Variables Required**
   - `JWT_SECRET` - JWT signing secret (required in production)
   - `FIREBASE_SERVICE_ACCOUNT_PATH` - Path to Firebase service account JSON
   - `PG_HOST` - PostgreSQL host (if using PostgreSQL features)
   - `PG_DATABASE` - Database name
   - `PG_USER` - Database user
   - `PG_PASSWORD` - Database password
   - `PG_SSL` - Set to `true` for cloud databases
   - `MSG91_AUTH_KEY` - MSG91 API key for email OTP
   - `MSG91_FROM_EMAIL` - From email address
   - `MSG91_FROM_NAME` - From name
   - `MSG91_DOMAIN` - Email domain

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Navigate to backend directory
cd backend

# Build the Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/tbidder-backend

# Or use Docker directly
docker build -t gcr.io/YOUR_PROJECT_ID/tbidder-backend .
docker push gcr.io/YOUR_PROJECT_ID/tbidder-backend
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy tbidder-backend \
  --image gcr.io/YOUR_PROJECT_ID/tbidder-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 540 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "JWT_SECRET=YOUR_JWT_SECRET" \
  --set-env-vars "FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-key.json" \
  --set-env-vars "PG_HOST=YOUR_PG_HOST" \
  --set-env-vars "PG_DATABASE=tbidder" \
  --set-env-vars "PG_USER=YOUR_PG_USER" \
  --set-env-vars "PG_PASSWORD=YOUR_PG_PASSWORD" \
  --set-env-vars "PG_SSL=true" \
  --set-env-vars "MSG91_AUTH_KEY=YOUR_MSG91_KEY" \
  --set-env-vars "MSG91_FROM_EMAIL=noreply@transportbidder.com" \
  --set-env-vars "MSG91_FROM_NAME=TransportBidder" \
  --set-env-vars "MSG91_DOMAIN=transportbidder.com"
```

### 3. Using Secret Manager (Recommended for Sensitive Data)

```bash
# Create secrets
echo -n "YOUR_JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
echo -n "YOUR_PG_PASSWORD" | gcloud secrets create pg-password --data-file=-

# Deploy with secrets
gcloud run deploy tbidder-backend \
  --image gcr.io/YOUR_PROJECT_ID/tbidder-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 540 \
  --max-instances 10 \
  --update-secrets JWT_SECRET=jwt-secret:latest \
  --update-secrets PG_PASSWORD=pg-password:latest
```

## Post-Deployment

### 1. Get Service URL

```bash
gcloud run services describe tbidder-backend --region us-central1 --format 'value(status.url)'
```

Your backend will be available at: `https://tbidder-backend-XXXXX-uc.a.run.app`

### 2. Update Mobile Apps

Update both User App and Driver App to use the Cloud Run URL:

```bash
# User App
cd user_app
flutter run --dart-define=BACKEND_URL=https://tbidder-backend-XXXXX-uc.a.run.app

# Driver App
cd driver_app
flutter run --dart-define=BACKEND_URL=https://tbidder-backend-XXXXX-uc.a.run.app
```

Or update `lib/core/api_config_io.dart` in both apps with the production URL.

### 3. Test Health Endpoint

```bash
curl https://tbidder-backend-XXXXX-uc.a.run.app/health
```

Expected response:
```json
{
  "ok": true,
  "service": "tbidder-api",
  "db": "postgresql",
  "timestamp": "2026-02-13T..."
}
```

## WebSocket Support

Cloud Run supports WebSockets. Socket.io will work automatically with the following configuration (already set):

```javascript
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
```

## Database Connection

PostgreSQL connection pooling is configured for serverless:
- Max connections: 5 per instance
- Min connections: 0
- Idle timeout: 10 seconds
- Acquire timeout: 30 seconds

This prevents connection exhaustion when Cloud Run scales.

## Monitoring

View logs:
```bash
gcloud run services logs read tbidder-backend --region us-central1
```

View metrics in Cloud Console:
https://console.cloud.google.com/run

## Cost Optimization

- **Min instances**: Set to 0 to scale to zero when idle
- **Max instances**: Set to 10 to prevent runaway costs
- **Memory**: 1GB is sufficient for most workloads
- **CPU**: 1 vCPU is sufficient, scales automatically

## Troubleshooting

### Cold Starts
First request after idle may take 5-10 seconds. Consider:
- Setting min-instances to 1 for production
- Using Cloud Run's "always allocated CPU" option

### Database Connection Issues
- Ensure PG_SSL=true for cloud databases
- Verify database allows connections from Cloud Run IPs
- Check connection pool settings

### Environment Variables
List current env vars:
```bash
gcloud run services describe tbidder-backend --region us-central1 --format 'value(spec.template.spec.containers[0].env)'
```

## Continuous Deployment

Set up Cloud Build trigger for automatic deployments:

1. Connect GitHub repository
2. Create `cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/tbidder-backend', './backend']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/tbidder-backend']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'tbidder-backend'
      - '--image=gcr.io/$PROJECT_ID/tbidder-backend'
      - '--region=us-central1'
      - '--platform=managed'
```

## Security

- Use Secret Manager for sensitive data
- Enable Cloud Armor for DDoS protection
- Set up Cloud IAM for access control
- Enable VPC connector for private database access
