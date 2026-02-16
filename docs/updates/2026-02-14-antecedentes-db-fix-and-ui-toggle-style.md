# Antecedentes DB fix + Admin toggle styles

- **Date:** 2026-02-14
- **Scope:** backend | admin_panel
- **Type:** bugfix

## Summary

- Applied migration `020_driver_antecedentes_fields.sql` to add missing antecedentes columns to `DriverVerifications`.
- Updated Admin Panel driver detail antecedentes Yes/No buttons to use dedicated CSS classes for easier customization.

## Why

- Driver approval failed because PostgreSQL schema did not include `hasAntecedentesPoliciales` / `hasAntecedentesPenales` columns.
- Antecedentes buttons were using generic button classes, making it hard to style independently.

## Files Changed

- `backend/migrations/020_driver_antecedentes_fields.sql`
- `admin_panel/src/pages/DriverDetail.jsx`
- `admin_panel/src/App.css`

## Version Bumps

- **Web panel:** `admin_panel/package.json` version: 0.0.2 → 0.0.3

## Notes / Verification

- Run `node backend/scripts/run-migrations.js` (or `npm run migrate` inside `backend/`) against the correct database.
- Verify in Admin Panel Driver Detail page that antecedentes toggles show active state and can be styled via `.antecedentes-toggle` CSS.
