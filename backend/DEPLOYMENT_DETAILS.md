# Deployment Details

## Live Service URL (Google Cloud Run)

- https://tbidder-backend-738469456510.us-central1.run.app

## Key Endpoints

- `/` 
- `/health`
- `/api/health`
- `/api/auth/*`
- `/api/rides/*`
- `/api/drivers/*`
- `/api/admin/*`

## Notes

- Cloud Run sets the listening port via the `PORT` environment variable.
- Socket.io is served on the same origin with the default path `/socket.io`.
