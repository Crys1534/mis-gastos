/* Prueba la lógica del revisor del recibo del teléfono con datos de mentira (sin internet, sin Firebase). */
const fs = require('fs'), vm = require('vm');
const code = fs.readFileSync(__dirname + '/../www/runners/runner.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fails++; };

function nuevoRunner() {
  const handlers = {}, kv = {}, avisos = [];
  const estado = { respuesta: [] };
  const ctx = {
    addEventListener: (n, f) => { handlers[n] = f; },
    CapacitorKV: { get: k => (k in kv ? { value: kv[k] } : { value: null }), set: (k, v) => { kv[k] = v; } },
    CapacitorNotifications: { schedule: a => { avisos.push(...a); } },
    fetch: () => Promise.resolve({ json: () => Promise.resolve(estado.respuesta) }),
    Date, Math, JSON, Array, Error, String, Promise
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const llamar = (n, args) => new Promise((res, rej) => handlers[n](res, rej, args)).then(() => 'ok', e => 'error:' + e.message);
  const doc = id => ({ document: { name: 'projects/p/databases/(default)/documents/gastos_mama/' + id }, readTime: 'x' });
  return { llamar, estado, avisos, kv, doc };
}

(async () => {
  let r = nuevoRunner();
  r.estado.respuesta = [{ readTime: 'x' }, r.doc('1'), r.doc('2')];
  await r.llamar('checkTel');
  ok(r.avisos.length === 0, 'primera revisión: memoriza los recibos que ya existían y NO avisa');

  r.estado.respuesta = [r.doc('1'), r.doc('2'), r.doc('3')];
  await r.llamar('checkTel');
  ok(r.avisos.length === 1 && r.avisos[0].body === 'Recibo del Teléfono fue pagado', 'recibo nuevo: avisa "' + (r.avisos[0] && r.avisos[0].body) + '"');
  ok(r.avisos[0].title === 'Mis gastos', 'título del aviso: ' + r.avisos[0].title);

  await r.llamar('checkTel');
  ok(r.avisos.length === 1, 'la siguiente revisión no repite el aviso');

  await r.llamar('markSeen', { id: '4' });
  r.estado.respuesta = [r.doc('1'), r.doc('2'), r.doc('3'), r.doc('4')];
  await r.llamar('checkTel');
  ok(r.avisos.length === 1, 'el celular que pagó el recibo no se avisa a sí mismo');

  r.estado.respuesta = [r.doc('1'), r.doc('2'), r.doc('3'), r.doc('4'), r.doc('5')];
  await r.llamar('checkTel');
  ok(r.avisos.length === 2, 'otro recibo nuevo: avisa otra vez');

  const antes = r.kv.tel_vistos;
  r.estado.respuesta = { error: { code: 403, message: 'PERMISSION_DENIED' } };
  const res = await r.llamar('checkTel');
  ok(res.startsWith('error') && r.kv.tel_vistos === antes && r.avisos.length === 2, 'si Firebase responde con error no avisa ni cambia nada');

  r = nuevoRunner();
  r.estado.respuesta = { error: { code: 403 } };
  await r.llamar('checkTel');
  ok(r.kv.tel_vistos === undefined, 'con error en la primera revisión no memoriza una lista vacía');

  r = nuevoRunner();
  await r.llamar('probarAviso');
  ok(r.avisos.length === 1 && r.avisos[0].body === 'Recibo del Teléfono fue pagado', 'gancho de prueba manda el mismo aviso');

  console.log(fails ? fails + ' FALLAS' : 'TODO BIEN');
  process.exit(fails ? 1 : 0);
})();
