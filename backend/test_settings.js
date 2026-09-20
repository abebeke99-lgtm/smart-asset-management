const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBiZWtlbGVpLmNvbSIsInNlc3Npb25WZXJzaW9uIjowLCJjb2xsZWdlSWQiOm51bGwsImRlcGFydG1lbnRJZCI6bnVsbCwiaWF0IjoxNzg5OTIzNzAyLCJleHAiOjE3ODk5MjczMDJ9.npRsPybkOmtHtVkhkSIXA2RcOETf_1oX8j7kLWrnQD0';

// Test Settings endpoints - try various paths
const endpoints = [
  '/api/settings',
  '/api/settings/system',
  '/api/settings/health', 
  '/api/settings/notifications',
  '/api/notification'
];

endpoints.forEach((path) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  };
  
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.log('GET ' + path);
      console.log('Status: ' + res.statusCode);
      console.log('Body:', body.substring(0, 300));
      console.log('');
    });
  });
  
  req.on('error', (e) => { console.error('Error for ' + path + ':', e.message); });
  req.write('');
  req.end();
});