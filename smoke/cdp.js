/* Ejecuta una línea de JavaScript dentro de la app abierta (solo para la prueba automática).
   Uso: node smoke/cdp.js <puerto> "<código>" */
const WebSocket = require('ws');
const http = require('http');
const [port, expr] = [process.argv[2], process.argv[3]];
const fin = setTimeout(() => { console.error('tiempo agotado'); process.exit(3); }, 25000);
http.get('http://127.0.0.1:' + port + '/json', res => {
  let b = '';
  res.on('data', d => (b += d));
  res.on('end', () => {
    const t = JSON.parse(b).find(x => x.type === 'page');
    if (!t) { console.error('no encontré la página de la app'); process.exit(2); }
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })));
    ws.on('message', m => {
      const r = JSON.parse(m);
      if (r.id !== 1) return;
      clearTimeout(fin);
      console.log(JSON.stringify(r.result));
      ws.close();
      process.exit(r.result && r.result.exceptionDetails ? 1 : 0);
    });
  });
}).on('error', e => { console.error(String(e)); process.exit(2); });
