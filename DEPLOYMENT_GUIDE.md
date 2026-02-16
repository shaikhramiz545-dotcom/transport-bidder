# Deployment Guide – Admin Panel & Backend Fixes

## 1. Pre-Deployment Checklist

### 1.1 Code Validation
- [ ] All JS syntax checks pass (`node --check` on modified files)
- [ ] Git status shows only intended changes
- [ ] No console errors in admin panel build
- [ ] Backend starts without errors

### 1.2 Database Readiness
- [ ] Run database migrations: `npm run migrate`
- [ ] Verify new columns exist in DriverVerification and DriverDocument tables
- [ ] Test Firestore connectivity (if used)

### 1.3 Environment Variables
- [ ] VITE_API_URL configured in admin panel
- [ ] Firebase credentials valid (if using Firestore)
- [ ] Database connection strings correct

## 2. Deployment Steps

### 2.1 Backend Deployment
```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies
npm install

# 3. Run migrations
npm run migrate

# 4. Build (if applicable)
npm run build

# 5. Restart backend service
pm2 restart backend
# or
systemctl restart transport-bidder-backend
```

### 2.2 Admin Panel Deployment
```bash
# 1. Pull latest changes
cd admin_panel
git pull origin main

# 2. Install dependencies
npm install

# 3. Build for production
npm run build

# 4. Deploy built files
cp -r dist/* /var/www/admin-panel/
# or use your deployment method
```

## 3. Rollback Plan

### 3.1 Backend Rollback
```bash
# 1. Revert to previous commit
git checkout <previous-commit-hash>

# 2. Restore database (if schema changes)
# Note: No destructive schema changes in this deployment
# Columns are additive only, so rollback is safe

# 3. Restart backend
pm2 restart backend
```

### 3.2 Admin Panel Rollback
```bash
# 1. Revert to previous commit
git checkout <previous-commit-hash>

# 2. Rebuild
npm run build

# 3. Deploy previous build
cp -r dist/* /var/www/admin-panel/
```

## 4. Monitoring & Verification

### 4.1 Health Checks
```bash
# Backend health
curl http://localhost:3000/health

# Admin panel accessibility
curl http://localhost:3001/
```

### 4.2 Log Monitoring
```bash
# Backend logs
pm2 logs backend
# or
tail -f /var/log/transport-bidder/backend.log

# Admin panel logs (if using PM2)
pm2 logs admin-panel
```

### 4.3 Key Metrics to Monitor
- API response times (< 2s for driver list)
- Error rates (should be < 1%)
- Database query performance
- Firestore operation latency (if applicable)

## 5. Smoke Tests

### 5.1 API Endpoints
```bash
# Test driver registration
curl -X POST http://localhost:3000/api/drivers/verification-register \
  -H "Content-Type: application/json" \
  -d '{"driverId":"SMOKE_TEST_001","vehiclePlate":"TEST123","driverName":"Smoke Test"}'

# Test admin driver list
curl -X GET http://localhost:3000/api/admin/drivers \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test admin driver detail
curl -X GET http://localhost:3000/api/admin/drivers/SMOKE_TEST_001 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5.2 Admin Panel UI
- [ ] Login works
- [ ] Driver list loads
- [ ] Driver photos render correctly
- [ ] Driver detail page shows all fields
- [ ] Document gallery displays images

## 6. Performance Considerations

### 6.1 Database Indexes
Ensure these indexes exist for optimal performance:
```sql
-- DriverVerification indexes
CREATE INDEX IF NOT EXISTS idx_driver_verifications_driver_id ON DriverVerifications(driverId);
CREATE INDEX IF NOT EXISTS idx_driver_verifications_status ON DriverVerifications(status);
CREATE INDEX IF NOT EXISTS idx_driver_verifications_updated_at ON DriverVerifications(updatedAt);

-- DriverDocument indexes
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON DriverDocuments(driverId);
CREATE INDEX IF NOT EXISTS idx_driver_documents_type ON DriverDocuments(documentType);
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_type ON DriverDocuments(driverId, documentType);
```

### 6.2 Caching
- Consider Redis caching for frequently accessed driver data
- Implement CDN for document images
- Use browser caching for static admin panel assets

## 7. Security Considerations

### 7.1 Access Control
- [ ] Admin endpoints protected by authentication
- [ ] Driver endpoints require proper role validation
- [ ] File upload restrictions enforced (size, type)

### 7.2 Data Validation
- [ ] Input sanitization in place
- [ ] SQL injection protection (Sequelize ORM)
- [ ] XSS protection in admin panel

## 8. Troubleshooting

### 8.1 Common Issues

#### Driver photos not displaying
- Check VITE_API_URL configuration
- Verify file permissions in uploads directory
- Check document URLs in database

#### SOAT metadata not updating
- Verify documentType is 'soat'
- Check metadata field names in payload
- Review logs for validation errors

#### Admin panel showing empty fields
- Check API response structure in browser dev tools
- Verify field names match frontend expectations
- Check for null/undefined handling

### 8.2 Debug Commands
```bash
# Check database schema
\d DriverVerifications
\d DriverDocuments

# Verify Firestore data (if applicable)
# Use Firebase Console or CLI

# Check file uploads
ls -la uploads/driver-docs/
```

## 9. Post-Deployment Tasks

### 9.1 Data Cleanup
- Remove test drivers created during smoke tests
- Clean up temporary files
- Archive old logs

### 9.2 Documentation
- Update API documentation with new fields
- Update admin panel user guide
- Document any new procedures

### 9.3 Team Communication
- Notify team of successful deployment
- Share regression test results
- Document any issues found during testing

## 10. Success Criteria

1. ✅ All smoke tests pass
2. ✅ Admin panel loads without errors
3. ✅ Driver photos display correctly
4. ✅ All driver fields visible in admin panel
5. ✅ SOAT metadata updates work
6. ✅ API response times within acceptable limits
7. ✅ No increase in error rates
8. ✅ Database performance maintained

## 11. Emergency Contacts

- Backend Lead: [Contact Info]
- Frontend Lead: [Contact Info]
- DevOps: [Contact Info]
- Product Owner: [Contact Info]

## 12. Related Documents

- [REGRESSION_TEST_PLAN.md](./REGRESSION_TEST_PLAN.md)
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
