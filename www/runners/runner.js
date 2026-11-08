/* Revisa en segundo plano si alguien anoto el recibo del telefono y avisa con una notificacion del propio celular. */
var PROYECTO = 'aula-virtual-79e4d';
var API_KEY = 'AIzaSyBnX__R6A6lQw_KuzZxqHRkzZyj10S_4wU';
var KEY_SEEN = 'tel_vistos';

function leerVistos() {
  try {
    var r = CapacitorKV.get(KEY_SEEN);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}
function guardarVistos(a) {
  try { CapacitorKV.set(KEY_SEEN, JSON.stringify(a)); } catch (e) {}
}

/* La app avisa aqui cuando este mismo celular anota el recibo, para no avisarse a si mismo */
addEventListener('markSeen', function (resolve, reject, args) {
  try {
    var v = leerVistos();
    if (v === null) { return resolve(); } /* aun no hay lista: la primera revision lo memoriza */
    var id = String(args && args.id);
    if (id && v.indexOf(id) < 0) { v.push(id); guardarVistos(v); }
    resolve();
  } catch (e) { reject(e); }
});

addEventListener('checkTel', function (resolve, reject, args) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents:runQuery?key=' + API_KEY;
  var body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'gastos_mama' }],
      where: { fieldFilter: { field: { fieldPath: 'service' }, op: 'EQUAL', value: { stringValue: 'tel' } } },
      limit: 200
    }
  });
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
    .then(function (res) { return res.json(); })
    .then(function (rows) {
      if (!Array.isArray(rows)) throw new Error('respuesta inesperada de Firebase'); /* ej. sin permisos: no memorizar nada */
      var ids = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].document && rows[i].document.name) {
          var n = rows[i].document.name.split('/');
          ids.push(n[n.length - 1]);
        }
      }
      var vistos = leerVistos();
      if (vistos === null) { guardarVistos(ids); return resolve(); } /* primera vez: solo se memorizan, sin avisar */
      var nuevos = ids.filter(function (id) { return vistos.indexOf(id) < 0; });
      if (nuevos.length) {
        CapacitorNotifications.schedule([{
          id: Math.floor(Date.now() / 1000) % 2000000000,
          title: 'Mis gastos',
          body: 'Recibo del Teléfono fue pagado',
          scheduleAt: new Date(Date.now() + 1000)
        }]);
        guardarVistos(vistos.concat(nuevos));
      }
      resolve();
    })
    .catch(function (e) { reject(e); });
});

/* Solo para pruebas: manda al instante el mismo aviso que sale cuando se paga el recibo */
addEventListener('probarAviso', function (resolve, reject) {
  try {
    CapacitorNotifications.schedule([{
      id: 99,
      title: 'Mis gastos',
      body: 'Recibo del Teléfono fue pagado',
      scheduleAt: new Date(Date.now() + 1000)
    }]);
    resolve();
  } catch (e) { reject(e); }
});
