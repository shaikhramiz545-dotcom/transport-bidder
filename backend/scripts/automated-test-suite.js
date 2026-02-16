const http = require('http');
const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = 'localhost';
const PORT = 4000;
const MOCK_OTP = '123456';

// Test data - generate unique timestamp once
const testTimestamp = Date.now();
const testUsers = {
  user: {
    name: 'Test User',
    email: `testuser-${testTimestamp}@example.com`,
    password: '123456',
    phone: '1234567890',
    role: 'user'
  },
  driver: {
    name: 'Test Driver',
    email: `testdriver-${testTimestamp}@example.com`, 
    password: '123456',
    phone: '0987654321',
    role: 'driver'
  }
};

// Utility functions
function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) }),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : {}
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (postData) req.write(postData);
    req.end();
  });
}

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  bugs: [],
  details: []
};

// Authentication cache to prevent duplicate signups
const authCache = {
  user: null,
  driver: null,
  admin: null
};

function assert(condition, message, test) {
  if (condition) {
    testResults.passed++;
    testResults.details.push(`✅ ${test}: ${message}`);
    console.log(`✅ ${test}: ${message}`);
  } else {
    testResults.failed++;
    const bug = `❌ ${test}: ${message}`;
    testResults.bugs.push(bug);
    testResults.details.push(bug);
    console.log(`❌ ${test}: ${message}`);
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n=== Testing Health Check ===');
  try {
    const response = await makeRequest('/health');
    assert(response.statusCode === 200, 'Health endpoint accessible', 'Health Check');
    assert(response.body.ok === true, 'Health status OK', 'Health Check');
    assert(response.body.service === 'tbidder-api', 'Correct service name', 'Health Check');
  } catch (error) {
    assert(false, `Health check failed: ${error.message}`, 'Health Check');
  }
}

async function testUserAuthentication() {
  console.log('\n=== Testing User Authentication ===');
  
  try {
    // Return cached result if available
    if (authCache.user) {
      console.log('Using cached user authentication');
      return authCache.user;
    }
    
    // Test user signup
    const signupResponse = await makeRequest('/api/auth/signup', 'POST', testUsers.user);
    assert(signupResponse.statusCode === 201, 'User signup successful', 'User Signup');
    
    const userToken = signupResponse.body.token;
    const userId = signupResponse.body.user.id;
    
    // Test email verification
    const verifyResponse = await makeRequest('/api/auth/verify-email', 'POST', {
      email: testUsers.user.email,
      otp: MOCK_OTP
    });
    assert(verifyResponse.statusCode === 200, 'Email verification successful', 'Email Verification');
    assert(verifyResponse.body.token, 'JWT token issued after verification', 'Email Verification');
    
    // Test email login
    const loginResponse = await makeRequest('/api/auth/email-login', 'POST', {
      email: testUsers.user.email,
      password: testUsers.user.password,
      role: 'user'
    });
    assert(loginResponse.statusCode === 200, 'Email login successful', 'Email Login');
    assert(loginResponse.body.token, 'JWT token issued after login', 'Email Login');
    
    const result = { userToken: loginResponse.body.token, userId: loginResponse.body.user.id };
    authCache.user = result; // Cache the result
    return result;
  } catch (error) {
    assert(false, `User authentication failed: ${error.message}`, 'User Authentication');
    return {};
  }
}

async function testDriverAuthentication() {
  console.log('\n=== Testing Driver Authentication ===');
  
  try {
    // Return cached result if available
    if (authCache.driver) {
      console.log('Using cached driver authentication');
      return authCache.driver;
    }
    
    // Test driver signup
    const signupResponse = await makeRequest('/api/auth/signup', 'POST', testUsers.driver);
    assert(signupResponse.statusCode === 201, 'Driver signup successful', 'Driver Signup');
    
    // Test email verification
    const verifyResponse = await makeRequest('/api/auth/verify-email', 'POST', {
      email: testUsers.driver.email,
      otp: MOCK_OTP,
      role: 'driver'
    });
    assert(verifyResponse.statusCode === 200, 'Driver email verification successful', 'Driver Email Verification');
    
    // Test email login
    const loginResponse = await makeRequest('/api/auth/email-login', 'POST', {
      email: testUsers.driver.email,
      password: testUsers.driver.password,
      role: 'driver'
    });
    assert(loginResponse.statusCode === 200, 'Driver email login successful', 'Driver Email Login');
    
    const result = { driverToken: loginResponse.body.token, driverId: loginResponse.body.user.id };
    authCache.driver = result; // Cache the result
    return result;
  } catch (error) {
    assert(false, `Driver authentication failed: ${error.message}`, 'Driver Authentication');
    return {};
  }
}

async function testRideFlow() {
  console.log('\n=== Testing Ride Flow ===');
  
  try {
    // Get user authentication from previous test
    const userAuth = await testUserAuthentication();
    if (!userAuth.userToken) {
      assert(false, 'Cannot test ride flow without user authentication', 'Ride Flow');
      return;
    }
    
    // Test creating a ride
    const rideData = {
      pickupLat: -12.0464,
      pickupLng: -77.0428,
      dropLat: -12.0456,
      dropLng: -77.0304,
      pickupAddress: 'Lima, Peru',
      dropAddress: 'Miraflores, Peru',
      distanceKm: 5.2,
      trafficDelayMins: 2,
      vehicleType: 'taxi_std',
      userPrice: 25.50
    };
    
    const createResponse = await makeRequest('/api/rides', 'POST', rideData, {
      'Authorization': `Bearer ${userAuth.userToken}`
    });
    
    assert(createResponse.statusCode === 201, 'Ride creation successful', 'Ride Creation');
    const rideId = createResponse.body.id;
    
    // Test getting ride details
    const getResponse = await makeRequest(`/api/rides/${rideId}`, 'GET', null, {
      'Authorization': `Bearer ${userAuth.userToken}`
    });
    assert(getResponse.statusCode === 200, 'Ride details retrieval successful', 'Ride Details');
    assert(getResponse.body.id === rideId, 'Ride ID matches', 'Ride Details');
    
    // Test driver nearby endpoint
    const nearbyResponse = await makeRequest('/api/drivers/nearby?lat=-12.0464&lng=-77.0428&vehicleType=taxi', 'GET');
    assert(nearbyResponse.statusCode === 200, 'Driver nearby endpoint accessible', 'Driver Nearby');
    
    return { rideId, userToken: userAuth.userToken };
  } catch (error) {
    assert(false, `Ride flow test failed: ${error.message}`, 'Ride Flow');
    return {};
  }
}

async function testDriverFlow() {
  console.log('\n=== Testing Driver Flow ===');
  
  try {
    // Get driver authentication from previous test
    const driverAuth = await testDriverAuthentication();
    if (!driverAuth.driverToken) {
      assert(false, 'Cannot test driver flow without driver authentication', 'Driver Flow');
      return;
    }
    
    // Test driver verification status
    const statusResponse = await makeRequest('/api/drivers/verification-status', 'GET', null, {
      'Authorization': `Bearer ${driverAuth.driverToken}`
    });
    assert(statusResponse.statusCode === 200, 'Driver verification status accessible', 'Driver Status');
    assert(statusResponse.body.status === 'pending', 'New driver has pending status', 'Driver Status');
    
    // Test driver requests endpoint
    const requestsResponse = await makeRequest('/api/drivers/requests', 'GET', null, {
      'Authorization': `Bearer ${driverAuth.driverToken}`
    });
    assert(requestsResponse.statusCode === 200, 'Driver requests endpoint accessible', 'Driver Requests');
    
    return { driverToken: driverAuth.driverToken };
  } catch (error) {
    assert(false, `Driver flow test failed: ${error.message}`, 'Driver Flow');
    return {};
  }
}

async function testAdminEndpoints() {
  console.log('\n=== Testing Admin Endpoints ===');
  
  try {
    // First login as admin to get token
    const adminLoginResponse = await makeRequest('/api/admin/login', 'POST', {
      email: 'admin@tbidder.com',
      password: 'admin123'
    });
    
    assert(adminLoginResponse.statusCode === 200, 'Admin login successful', 'Admin Login');
    const adminToken = adminLoginResponse.body.token;
    
    // Test health status endpoint with admin token
    const healthResponse = await makeRequest('/api/admin/health-status', 'GET', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(healthResponse.statusCode === 200, 'Admin health status accessible', 'Admin Health');
    
    // Test drivers list endpoint with admin token
    const driversResponse = await makeRequest('/api/admin/drivers', 'GET', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(driversResponse.statusCode === 200, 'Admin drivers list accessible', 'Admin Drivers');
    
    // Test rides list endpoint with admin token  
    const ridesResponse = await makeRequest('/api/admin/rides', 'GET', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(ridesResponse.statusCode === 200, 'Admin rides list accessible', 'Admin Rides');
    
  } catch (error) {
    assert(false, `Admin endpoints test failed: ${error.message}`, 'Admin Endpoints');
  }
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  try {
    // Test invalid login
    const invalidLogin = await makeRequest('/api/auth/email-login', 'POST', {
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
      role: 'user'
    });
    assert(invalidLogin.statusCode === 401, 'Invalid login properly rejected', 'Error Handling');
    
    // Test invalid OTP
    const invalidOtp = await makeRequest('/api/auth/verify-email', 'POST', {
      email: testUsers.user.email,
      otp: '999999'
    });
    assert(invalidOtp.statusCode === 400, 'Invalid OTP properly rejected', 'Error Handling');
    
    // Test unauthorized access
    const unauthorized = await makeRequest('/api/drivers/verification-status');
    assert(unauthorized.statusCode === 401, 'Unauthorized request properly rejected', 'Error Handling');
    
  } catch (error) {
    assert(false, `Error handling test failed: ${error.message}`, 'Error Handling');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Automated Testing');
  console.log('==========================================');
  
  const startTime = Date.now();
  
  try {
    await testHealthCheck();
    await testUserAuthentication();
    await testDriverAuthentication();
    await testRideFlow();
    await testDriverFlow();
    await testAdminEndpoints();
    await testErrorHandling();
    
    const duration = Date.now() - startTime;
    
    console.log('\n==========================================');
    console.log('🏁 Testing Complete');
    console.log('==========================================');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    
    if (testResults.bugs.length > 0) {
      console.log('\n🐛 Bugs Found:');
      testResults.bugs.forEach(bug => console.log(`  ${bug}`));
    }
    
    console.log('\n📋 Detailed Results:');
    testResults.details.forEach(detail => console.log(`  ${detail}`));
    
    // Return results for further processing
    return testResults;
    
  } catch (error) {
    console.error('💥 Test suite crashed:', error.message);
    testResults.failed++;
    testResults.bugs.push(`💥 Test suite crashed: ${error.message}`);
    return testResults;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, testResults };
