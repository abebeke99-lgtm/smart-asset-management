const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3001;

const targets = [
  { role: 'admin', username: 'admin', email: 'bekelei906@gmail.com', password: 'bekelei123' },
  { role: 'ict_officer', username: 'ict_officer', email: 'bekeaea906@gmail.com', password: 'bekelei123' },
  { role: 'dept_head', username: 'dept_head', email: 'bekelea906@gmail.com', password: 'bekeled123' },
  { role: 'finance', username: 'finance', email: 'bekelea906@gmail.com', password: 'bekelef123' },
  { role: 'store_manager', username: 'store_manager', email: 'bekelea906@gmail.com', password: 'bekeles123' },
  { role: 'maintenance', username: 'maintenance', email: 'bekelea906@gmail.com', password: 'bekelem123' }
];

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    };
    const req = http.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { const parsed = b ? JSON.parse(b) : null; resolve({ status: res.statusCode, body: parsed }); }
        catch (e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log('Fetching existing users...');
    const usersRes = await httpRequest('GET', '/api/users');
    const existing = Array.isArray(usersRes.body) ? usersRes.body : [];

    for (const t of targets) {
      const found = existing.find(u => String(u.email || '').toLowerCase() === String(t.email || '').toLowerCase() || String(u.username || '').toLowerCase() === String(t.username || '').toLowerCase());
      if (found) {
        console.log(`Updating user by id=${found.id} username=${found.username} email=${found.email}`);
        const updateBody = {
          username: t.username,
          password: t.password,
          role: t.role,
          fullName: '',
          email: t.email || '',
          phone: '',
          phoneNumber: '',
          fingerprintId: '',
          responsibility: 'member',
          universityID: '',
          department: '',
          active: true
        };
        const putRes = await httpRequest('PUT', `/api/users/${found.id}`, updateBody);
        console.log(' ->', putRes.status, putRes.body);
      } else {
        console.log(`Creating user username=${t.username} email=${t.email}`);
        const postBody = {
          username: t.username,
          password: t.password,
          role: t.role,
          fullName: '',
          email: t.email || '',
          phone: '',
          phoneNumber: '',
          fingerprintId: '',
          responsibility: 'member',
          universityID: '',
          department: '',
          active: true
        };
        const postRes = await httpRequest('POST', '/api/users', postBody);
        console.log(' ->', postRes.status, postRes.body);
      }
    }

    console.log('Done. Fetching final users list...');
    const final = await httpRequest('GET', '/api/users');
    console.log(JSON.stringify(final.body, null, 2));
  } catch (e) {
    console.error('Script error', e);
    process.exit(1);
  }
})();
