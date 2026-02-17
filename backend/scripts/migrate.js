const { sequelize } = require('../src/config/db');
const { DataTypes } = require('sequelize');

// Safe startup migration: add missing columns to existing tables (idempotent)
async function runMigrations() {
  console.log('[Migration] Starting database migration...');
  try {
    const qi = sequelize.getQueryInterface();
    const addCol = async (table, col, type) => {
      try {
        await qi.addColumn(table, col, type);
        console.log(`[Migration] Added column ${table}.${col}`);
      } catch (e) {
        if (e.original && e.original.code === '42701') return; // column already exists
        console.warn(`[Migration] ${table}.${col} skipped:`, e.message);
      }
    };

    // DriverDocuments: metadata columns added in model but missing from DB
    await addCol('DriverDocuments', 'issueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverDocuments', 'policyNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'insuranceCompany', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'certificateNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'inspectionCenter', { type: DataTypes.STRING, allowNull: true });
    
    // NEW: Per-document verification status
    await addCol('DriverDocuments', 'status', { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' });
    await addCol('DriverDocuments', 'adminFeedback', { type: DataTypes.TEXT, allowNull: true });

    // DriverVerifications: vehicle + license + DNI fields added in model but missing from DB
    await addCol('DriverVerifications', 'email', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'city', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'dni', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'phone', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'license', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'photoUrl', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'adminNotes', { type: DataTypes.TEXT, allowNull: true });
    await addCol('DriverVerifications', 'customRatePerKm', { type: DataTypes.DOUBLE, allowNull: true });

    await addCol('DriverVerifications', 'vehicleBrand', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'vehicleModel', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'vehicleColor', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'registrationYear', { type: DataTypes.INTEGER, allowNull: true });
    await addCol('DriverVerifications', 'vehicleCapacity', { type: DataTypes.INTEGER, allowNull: true });

    await addCol('DriverVerifications', 'licenseClass', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'licenseIssueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverVerifications', 'licenseExpiryDate', { type: DataTypes.DATEONLY, allowNull: true });

    await addCol('DriverVerifications', 'dniIssueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverVerifications', 'dniExpiryDate', { type: DataTypes.DATEONLY, allowNull: true });

    await addCol('DriverVerifications', 'engineNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'chassisNumber', { type: DataTypes.STRING, allowNull: true });

    await addCol('DriverVerifications', 'registrationStartedAt', { type: DataTypes.DATE, allowNull: true });
    await addCol('DriverVerifications', 'registrationDeadline', { type: DataTypes.DATE, allowNull: true });

    await addCol('DriverVerifications', 'reuploadMessage', { type: DataTypes.TEXT, allowNull: true });

    // NEW: Add unique constraints for fraud prevention (DNI, License, Email)
    // Note: addConstraint is not idempotent by default, so we wrap in try/catch or check
    try {
      await qi.addConstraint('DriverVerifications', {
        fields: ['dni'],
        type: 'unique',
        name: 'driver_verifications_dni_key'
      });
      console.log('[Migration] Added unique constraint: driver_verifications_dni_key');
    } catch (e) {
      // Ignore if constraint already exists
    }
    try {
      await qi.addConstraint('DriverVerifications', {
        fields: ['license'],
        type: 'unique',
        name: 'driver_verifications_license_key'
      });
      console.log('[Migration] Added unique constraint: driver_verifications_license_key');
    } catch (e) {
      // Ignore if constraint already exists
    }
    try {
      await qi.addConstraint('DriverVerifications', {
        fields: ['email'],
        type: 'unique',
        name: 'driver_verifications_email_key'
      });
      console.log('[Migration] Added unique constraint: driver_verifications_email_key');
    } catch (e) {
      // Ignore if constraint already exists
    }

    console.log('[Migration] Startup migrations complete.');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Startup migration error:', err.message);
    process.exit(1);
  }
}

runMigrations();
