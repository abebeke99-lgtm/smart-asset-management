const http = require('http');

function request(path, method='GET', body=null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3002, path, method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    console.log('GET /api/users');
    let r = await request('/api/users');
    console.log(r.status, r.body);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
})();