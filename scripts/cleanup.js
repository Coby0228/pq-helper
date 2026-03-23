const https = require('https');

const DB_URL = 'https://pq-helper-default-rtdb.asia-southeast1.firebasedatabase.app';
const SECRET = process.env.FIREBASE_SERVICE_ACCOUNT;
const CUTOFF = Date.now() - 2 * 60 * 60 * 1000; // 2 小時前

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${DB_URL}${path}?auth=${SECRET}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const rooms = await request('GET', '/rooms.json');
  if (!rooms) { console.log('沒有任何房間'); return; }

  const toDelete = {};
  for (const [id, room] of Object.entries(rooms)) {
    const hasPlayers = Object.keys(room.players || {}).length > 0;
    const stale = !room.lastActivity || room.lastActivity < CUTOFF;
    if (!hasPlayers || stale)
      toDelete[id] = null;
  }

  if (Object.keys(toDelete).length === 0) {
    console.log('沒有需要清理的房間');
    return;
  }

  await request('PATCH', '/rooms.json', toDelete);
  console.log(`已刪除 ${Object.keys(toDelete).length} 個廢棄房間：`, Object.keys(toDelete).join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
