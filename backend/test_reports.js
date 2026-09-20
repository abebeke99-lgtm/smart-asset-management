const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBiZWtlbGVpLmNvbSIsInNlc3Npb25WZXJzaW9uIjowLCJjb2xsZWdlSWQiOm51bGwsImRlcGFydG1lbnRJZCI6bnVsbCwiaWF0IjoxNzg5OTI0OTEzLCJleHAiOjE3ODk5Mjg1MTN9.G2N6FVZcHYMkz1CxthGyP8F_LGWs_1cNzRYj_Bcb14c';

function makeRequest(path, method, body, token) {
  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  };
  
  const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      console.log(`STATUS=${res.statusCode} PATH=${path}`);
      console.log(`BODY=${responseBody}`);
    });
  });
  
  req.on('error', (e) => { console.error(`ERROR=${e.message} PATH=${path}`); });
  
  if (body) {
    req.write(JSON.stringify(body));
  }
  
  req.end();
}

// Test Reports and Analytics endpoints
console.log("=== Reports / Analytics ===");

// Test 1: Get all assets (includes summary data)
makeRequest('/api/assets', 'GET', null, token);

// Test 2: Admin reports endpoint
makeRequest('/api/reports', 'GET', null, token);

// Test 3: Analytics system endpoint
makeRequest('/api/analytics/system', 'GET', null, token);

// Test 4: Asset analytics
makeRequest('/api/assets/analytics', 'GET', null, token);

// Test 5: College dashboard endpoint
makeRequest('/api/college/dashboard', 'GET', null, token);