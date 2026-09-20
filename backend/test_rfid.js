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

// Test 1: Check RFID tag existence
makeRequest('/api/assets/check-rfid/TEST123', 'GET', null, token);

// Test 2: Check asset field (assetCode)
makeRequest('/api/assets/check-id/ABC-123', 'GET', null, token);

// Test 3: Link RFID tag to asset
makeRequest('/api/assets/1/rfid', 'POST', { rfid_tag: 'NEW-RFID-TAG-001' }, token);

// Test 4: Get asset with assignments and history
makeRequest('/api/assets/1', 'GET', null, token);

// Test 5: Get asset history
makeRequest('/api/assets/1/history', 'GET', null, token);