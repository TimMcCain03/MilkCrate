const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const { URLSearchParams } = require('url');
const https = require('https');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const serve = serveStatic('dist', { index: ['index.html'] });

function exchangeToken(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({ grant_type: 'client_credentials' }).toString();

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const options = {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject({ status: res.statusCode, body: json });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // Debug endpoint to check whether server env vars are present (does NOT return secrets)
  if (req.method === 'GET' && req.url === '/api/token-config') {
    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_CLIENT_SECRET;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        clientIdPresent: !!clientId,
        clientSecretPresent: !!clientSecret,
        clientIdLength: clientId ? clientId.length : 0,
        clientSecretLength: clientSecret ? clientSecret.length : 0,
      })
    );
    return;
  }

  if (req.method === 'GET' && req.url === '/api/token') {
    // prefer SPOTIFY_* env vars so secrets aren't accidentally exposed via Vite's VITE_* vars
    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_config_missing', message: 'Spotify client id/secret not set on server' }));
      return;
    }

    try {
      const tokenResp = await exchangeToken(clientId, clientSecret);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tokenResp));
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(err.body || { error: 'token_exchange_failed' }));
    }

    return;
  }

  // default: serve static files
  serve(req, res, finalhandler(req, res));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
