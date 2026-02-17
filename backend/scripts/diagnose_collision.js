const crypto = require('crypto');

// OLD vulnerable function (kept for comparison only)
function _oldStableDriverIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const last5 = digits.slice(-5).padStart(5, '0');
  return `DRV-${last5}`;
}

// NEW secure function (SHA-256 based, matches hotfix in firestore.js)
function _newStableDriverIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return `DRV-${crypto.randomBytes(6).toString('hex')}`;
  }
  const hash = crypto.createHash('sha256').update(digits).digest('hex');
  return `DRV-${hash.slice(0, 12)}`;
}

function testCollision() {
  const phone1 = "+51 987 654 321";
  const phone2 = "+1 234 554 321"; // Different phone, same last 5 digits (54321)

  console.log('=== OLD (VULNERABLE) FUNCTION ===');
  const oldId1 = _oldStableDriverIdFromPhone(phone1);
  const oldId2 = _oldStableDriverIdFromPhone(phone2);
  console.log(`Phone 1: ${phone1} -> ID: ${oldId1}`);
  console.log(`Phone 2: ${phone2} -> ID: ${oldId2}`);
  console.log(oldId1 === oldId2 ? 'CRITICAL: ID Collision detected!' : 'No collision.');

  console.log('\n=== NEW (SECURE) FUNCTION ===');
  const newId1 = _newStableDriverIdFromPhone(phone1);
  const newId2 = _newStableDriverIdFromPhone(phone2);
  console.log(`Phone 1: ${phone1} -> ID: ${newId1}`);
  console.log(`Phone 2: ${phone2} -> ID: ${newId2}`);
  console.log(newId1 === newId2 ? 'CRITICAL: ID Collision detected!' : 'No collision (FIXED).');

  // Test determinism: same phone always produces same ID
  console.log('\n=== DETERMINISM CHECK ===');
  const check1 = _newStableDriverIdFromPhone(phone1);
  const check2 = _newStableDriverIdFromPhone(phone1);
  console.log(`Same phone twice: ${check1} === ${check2} ? ${check1 === check2 ? 'YES (deterministic)' : 'NO (broken!)'}`);

  // Test collision space
  console.log('\n=== COLLISION SPACE ===');
  console.log(`Old: 10^5 = 100,000 possible IDs (5 decimal digits)`);
  console.log(`New: 16^12 = ${Math.pow(16, 12).toLocaleString()} possible IDs (12 hex chars)`);
}

testCollision();
