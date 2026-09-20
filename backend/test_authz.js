const http = require('http');

function makeRequest(optionsOrPath, method, body, token) {
  const options = typeof optionsOrPath === 'string' 
    ? { hostname: '127.0.0.1', port: 5000, path: optionsOrPath, method, headers: {} }
    : { ...optionsOrPath, headers: { ...optionsOrPath.headers } };
  
  if (body && !token) {
    const jsonBody = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
    options.path = options.path || '/';
  }
  
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  
  if (body && token) {
    const jsonBody = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
  } else if (body && !token) {
    const jsonBody = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
  }
  
  const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      console.log(`STATUS=${res.statusCode} PATH=${options.path}`);
      console.log(`BODY=${responseBody}`);
    });
  });
  
  req.on('error', (e) => { console.error(`ERROR=${e.message} PATH=${options.path}`); });
  
  if (body && (!options.headers || !options.headers['Content-Type'])) {
    const jsonBody = JSON.stringify(body);
    options.headers = options.headers || {};
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
  }
  
  if (body) {
    req.write(JSON.stringify(body));
  }
  
  req.end();
}

// Test 1: Protected endpoint WITHOUT token
makeRequest('/api/users', 'GET', null);

// Test 2: Protected endpoint WITH valid token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBiZWtlbGVpLmNvbSIsInNlc3Npb25WZXJzaW9uIjowLCJjb2xsZWdlSWQiOm51bGwsImRlcGFydG1lbnRJZCI6bnVsbCwiaWF0IjoxNzg5OTI0OTEzLCJleHAiOjE3ODk5Mjg1MTN9.G2N6FVZcHYMkz1CxthGyP8F_LGWs_1cNzRYj_Bcb14c';
makeRequest('/api/users', 'GET', null, token);

// Test 3: Admin-only endpoint WITH admin token
makeRequest('/api/admin/users', 'GET', null, token);

// Test 4: Test password change requirements - 7 chars (should fail)
makeRequest('/api/users/:id/reset-password', 'POST', { password: '1234567' }, token);

// Test 5: Test password change requirements - 8 chars (should pass)
makeRequest('/api/users/:id/reset-password', 'POST', { password: '12345678' }, token);