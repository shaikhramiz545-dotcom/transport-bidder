# API Development Rules

This document contains mandatory rules for all API development in the TBidder project. All models and services must follow these rules from today.

---

## Rule 1: Always use /api/v1/

When writing new API calls, never use `/api/something`. Always use `/api/v1/something`. `/v1` is your versioned API path — this is guaranteed to work on the production server.

### Examples:
✅ **Correct:** `/api/v1/health`  
✅ **Correct:** `/api/v1/drivers`  
✅ **Correct:** `/api/v1/tours`  

❌ **Incorrect:** `/api/health`  
❌ **Incorrect:** `/api/drivers`  
❌ **Incorrect:** `/api/tours`  

### Implementation:
- All Flutter app API calls must use `/api/v1/` prefix
- All backend routes must be mounted under `/api/v1/`
- All documentation and examples must show `/api/v1/` paths

---

## Rule 2: Verify backend after deployment

Whenever you push backend code, after deployment completes, do a quick curl test:

```bash
curl -s https://api.transportbidder.com/api/v1/health
```

If this returns `{"success":true}`, the server is updated. If not, investigate the deployment issue before proceeding.

### Additional verification tests:
```bash
# Test basic API connectivity
curl -s https://api.transportbidder.com/api/v1/drivers/health

# Test authentication endpoint
curl -s -X POST https://api.transportbidder.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Rule 3: Don't depend on backward-compat mount

The `app.use('/api', apiV1)` line exists in the backend code, but this does not work on the deployed server. Therefore, apps must always use the canonical path (`/api/v1/`).

### Why this matters:
- Development environment may have backward-compat routes
- Production environment (Elastic Beanstalk) only serves `/api/v1/*` routes
- The `/api/*` backward-compat mount was never deployed to production
- Relying on backward-compat causes production failures

### Code examples:

**Flutter (Dart):**
```dart
// Correct
final response = await http.get(Uri.parse('https://api.transportbidder.com/api/v1/drivers/profile'));

// Incorrect - will fail in production
final response = await http.get(Uri.parse('https://api.transportbidder.com/api/drivers/profile'));
```

**JavaScript:**
```javascript
// Correct
const response = await fetch('https://api.transportbidder.com/api/v1/tours');

// Incorrect - will fail in production  
const response = await fetch('https://api.transportbidder.com/api/tours');
```

---

## Rule 4: Always update version before deployment

When models make changes to any app (User App, Driver App, Admin Panel, or Partner Portal), you must always update the version number before deploying anywhere.

### Version update requirements:
- **User App:** Update `pubspec.yaml` version (both build and version numbers)
- **Driver App:** Update `pubspec.yaml` version (both build and version numbers)  
- **Admin Panel:** Update `package.json` version
- **Partner Portal:** Update `package.json` version

### Version format:
- **Flutter apps:** `version: 1.0.0+1` (version + build number)
- **React apps:** `"version": "1.0.0"` (semantic versioning)

### When to update version:
✅ **Must update:** Database model changes  
✅ **Must update:** API endpoint changes  
✅ **Must update:** New features added  
✅ **Must update:** UI/UX changes  
✅ **Must update:** Bug fixes  
✅ **Must update:** Dependency updates  

### Version update process:
1. Make your code changes
2. Update version number in appropriate file
3. Test the changes locally
4. Commit with version update included
5. Deploy to environment

### Examples:

**Flutter (pubspec.yaml):**
```yaml
# Before
version: 1.2.3+5

# After  
version: 1.2.4+6
```

**React (package.json):**
```json
// Before
"version": "2.1.0"

// After
"version": "2.1.1"
```

### Why this matters:
- Tracks deployment history
- Enables rollback capabilities
- Helps with debugging issues
- Required for app store submissions
- Ensures users get latest features

---

## Rule 5: Read all rules before starting any work

Before starting any coding, changes, or development work, models must first read and understand ALL rules in this rule book. No work should begin without confirming understanding of the rules.

### Pre-work checklist:
- [ ] Read API_RULES.md completely
- [ ] Understand Rule 1: Always use /api/v1/
- [ ] Understand Rule 2: Verify backend after deployment  
- [ ] Understand Rule 3: Don't depend on backward-compat mount
- [ ] Understand Rule 4: Always update version before deployment
- [ ] Confirm which rules apply to your current task
- [ ] Plan your work according to the rules

### Mandatory process:
1. **STOP** - Do not start coding yet
2. **READ** - Review all rules in API_RULES.md
3. **UNDERSTAND** - Make sure you know what each rule requires
4. **PLAN** - Plan your work following the rules
5. **START** - Begin coding only after understanding all rules

### Why this matters:
- Prevents rule violations
- Saves time on rework
- Ensures quality and consistency
- Avoids deployment failures
- Maintains code standards

### Quick reference summary:
- **API paths:** Always use `/api/v1/`
- **Deployment:** Test with curl health check
- **Compatibility:** No backward-compat dependencies
- **Versions:** Update before deploying
- **Pre-work:** Read all rules first

---

## Enforcement

### Code review checklist:
- [ ] All API endpoints use `/api/v1/` prefix
- [ ] No hardcoded `/api/` paths without version
- [ ] Flutter apps use versioned URLs
- [ ] Backend routes mounted under `/api/v1/`
- [ ] Documentation shows correct versioned paths
- [ ] Version numbers updated in appropriate files
- [ ] Version update included in deployment commit
- [ ] Developer confirmed reading all rules before starting
- [ ] Work planned according to all applicable rules

### Testing:
- All automated tests must use `/api/v1/` paths
- Manual testing must verify production endpoints work
- Postman collections must use versioned URLs

### Deployment verification:
- Always run health check after deployment
- Verify new endpoints work with `/api/v1/` prefix
- Check that backward-compat routes are not required
- Confirm version numbers are properly updated
- Verify version changes are reflected in deployed apps

---

## Migration Guide

If you find existing code using non-versioned paths:

1. **Flutter apps:** Update all `api/` to `api/v1/` in service files
2. **Backend:** Ensure routes are mounted under `/api/v1/`
3. **Documentation:** Update all examples to use versioned paths
4. **Tests:** Update test URLs to use versioned paths
5. **Postman:** Update collections to use versioned URLs

### Files to check:
- `user_app/lib/services/*.dart`
- `driver_app/lib/services/*.dart`
- `backend/src/routes/*.js`
- `tests/postman/*.json`
- Documentation files
- `user_app/pubspec.yaml`
- `driver_app/pubspec.yaml`
- `admin_panel/package.json`
- `agency_portal/package.json`

---

## Consequences

Violating these rules will result in:
- Production API failures
- App crashes for users
- Deployment rollbacks
- Additional testing requirements
- Code review rejections
- Version conflicts and deployment issues
- Inability to track changes properly
- Work rejection if rules not read before starting

**These rules are mandatory for all development from today onward.**
