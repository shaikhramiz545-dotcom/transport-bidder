require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 4000;

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
            resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function main() {
    // 1. Login
    const loginPayload = JSON.stringify({
        email: process.env.ADMIN_EMAIL || 'admin@tbidder.com',
        password: process.env.ADMIN_PASSWORD || 'admin123'
    });

    try {
        const loginRes = await request('/api/admin/login', 'POST', loginPayload);
        if (loginRes.status !== 200) {
            console.error('Login failed');
            process.exit(1);
        }
        const token = loginRes.body.token;

        // 2. Health Check
        const healthRes = await request('/api/admin/health-status', 'GET', null, token);
        console.log(JSON.stringify(healthRes.body, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
