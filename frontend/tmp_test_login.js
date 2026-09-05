const http = require('http');
const data = JSON.stringify({ username: 'admin', password: 'admin123' });
const opts = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(opts, (res) => {
  let response = '';
  res.on('data', (chunk) => response += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(response);
  });
});
req.on('error', (err) => console.error(err));
req.write(data);
req.end();
