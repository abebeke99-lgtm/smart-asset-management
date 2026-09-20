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

// Test with asset ID 3 (available laptop)
console.log("=== Test with asset ID 3 ===");

// Test 1: Check RFID tag existence for new tag
makeRequest('/api/assets/check-rfid/NEW-RFID-TAG', 'GET', null, token);

// Test 2: Link RFID tag to asset 3
makeRequest('/api/assets/3/rfid', 'POST', { rfid_tag: 'NEW-RFID-TAG-001' }, token);

// Test 3: Check if the tag is now linked
makeRequest('/api/assets/3', 'GET', null, token);

// Test 4: Check duplicate tag (link same tag again)
makeRequest('/api/assets/3/rfid', 'POST', { rfid_tag: 'NEW-RFID-TAG-001' }, token);

// Test 5: Unlink RFID tag
makeRequest('/api/assets/3/rfid', 'DELETE', null, token);

// Test 6: Check RFID log list
makeRequest('/api/assets/3/rfid/logs', 'GET', null, token);