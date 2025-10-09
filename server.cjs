const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

const PORT = process.env.PORT || 3000;
const serve = serveStatic('dist', { index: ['index.html'] });

const server = http.createServer((req, res) => {
  serve(req, res, finalhandler(req, res));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
