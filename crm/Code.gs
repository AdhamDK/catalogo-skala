/* ============================================================
   Skala CRM — Backend en Google Apps Script (Google Sheets)
   Instalación: ver crm/INSTALAR.md
   - Crear una hoja de Google -> Extensiones -> Apps Script -> pegar este archivo.
   - Implementar -> Nueva implementación -> App web
       Ejecutar como: Yo · Acceso: Cualquier persona
   - Copiar la URL /exec en catalogo-skala/js/vendedor.js (CRM_API_URL).
   Hojas: Vendedores, Clientes, Pedidos, PedidoItems (se crean solas).
   Las 10 primeras columnas de Clientes son las mismas de GPS_CLIENTES.
   ============================================================ */

var TZ = 'America/Caracas';
var SESION_HORAS = 12;
var MAX_INTENTOS = 5;
var BLOQUEO_SEG = 600;
var ESTADOS = ['pendiente', 'entregado', 'cancelado'];

var HOJAS = {
  Vendedores: ['id', 'nombre', 'pin_hash', 'activo'],
  // 10 primeras = GPS_CLIENTES (backend/Code.gs). No cambiar el orden.
  Clientes: ['id', 'nombre', 'rif_cedula', 'direccion', 'latitud', 'longitud', 'telefono',
             'updated_at', 'sync_status', 'deleted',
             'contacto', 'telefono2', 'vendedor_id', 'created_at'],
  Pedidos: ['id', 'fecha', 'vendedor_id', 'vendedor', 'cliente_id', 'cliente', 'negocio',
            'total_cajas', 'detalle_unidades', 'pago', 'nota', 'estado', 'estado_at',
            'estado_por', 'motivo', 'client_ref', 'created_at', 'updated_at'],
  PedidoItems: ['pedido_id', 'code', 'producto', 'cajas', 'unidades_caja', 'unidad', 'total_unidades']
};

/* -------------------- Entradas HTTP -------------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return json_({ ok: true, app: 'skala-crm' });
  return json_(manejar_(p));
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'JSON inválido', code: 'bad_json' }); }
  return json_(manejar_(body));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function manejar_(p) {
  var acciones = {
    vendedores: accionVendedores_,
    login: accionLogin_,
    clientes: accionClientes_,
    guardarPedido: accionGuardarPedido_,
    pedidos: accionPedidos_,
    estado: accionEstado_
  };
  var fn = acciones[p.action];
  if (!fn) return { ok: false, error: 'Acción desconocida', code: 'unknown_action' };
  try {
    var publica = p.action === 'vendedores' || p.action === 'login';
    var ses = publica ? null : verificarToken_(p.token);
    if (!publica && !ses) return { ok: false, error: 'Sesión vencida. Ingresá de nuevo.', code: 'auth' };
    return fn(p, ses);
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), code: 'internal' };
  }
}

/* -------------------- Hojas (helpers) -------------------- */
function libro_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function hoja_(nombre) {
  var ss = libro_();
  var h = ss.getSheetByName(nombre);
  var cols = HOJAS[nombre];
  if (!h) {
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, cols.length).setValues([cols]);
    h.setFrozenRows(1);
    return h;
  }
  var actual = h.getLastColumn() ? h.getRange(1, 1, 1, Math.max(h.getLastColumn(), cols.length)).getValues()[0] : [];
  var ok = cols.every(function (c, i) { return actual[i] === c; });
  if (!ok) h.getRange(1, 1, 1, cols.length).setValues([cols]);
  return h;
}

/* Lee la hoja como lista de objetos { _fila, col: valor } */
function leer_(nombre) {
  var h = hoja_(nombre);
  var cols = HOJAS[nombre];
  var n = h.getLastRow();
  if (n < 2) return [];
  var vals = h.getRange(2, 1, n - 1, cols.length).getValues();
  return vals.map(function (fila, i) {
    var o = { _fila: i + 2 };
    cols.forEach(function (c, j) { o[c] = valor_(fila[j]); });
    return o;
  });
}

/* Todo texto se guarda como TEXTO (apóstrofo inicial, Sheets no lo muestra):
   - evita inyección de fórmulas (=, +, -, @),
   - teléfonos como 04121234567 no pierden el 0,
   - fechas como "2026-10-25 14:30" no se convierten en fecha. */
function celda_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && v !== '') return "'" + v;
  return v;
}

/* Por si alguien edita la hoja a mano: fechas -> texto ISO */
function valor_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' ? v.toISOString() : v;
}

function filaDe_(nombre, obj) {
  return HOJAS[nombre].map(function (c) { return celda_(obj[c]); });
}

function agregar_(nombre, obj) {
  hoja_(nombre).appendRow(filaDe_(nombre, obj));
}

function actualizar_(nombre, fila, obj) {
  var cols = HOJAS[nombre];
  hoja_(nombre).getRange(fila, 1, 1, cols.length).setValues([filaDe_(nombre, obj)]);
}

function ahora_() { return new Date().toISOString(); }
function txt_(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200); }
function uuid_() { return Utilities.getUuid(); }

/* -------------------- Seguridad -------------------- */
function hex_(bytes) {
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function secreto_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('CRM_SECRET');
  if (!s) { s = uuid_() + uuid_(); props.setProperty('CRM_SECRET', s); }
  return s;
}

function hashPin_(vendedorId, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    secreto_() + '|' + vendedorId + '|' + String(pin), Utilities.Charset.UTF_8);
  return hex_(bytes);
}

function firmar_(texto) {
  return hex_(Utilities.computeHmacSha256Signature(texto, secreto_()));
}

function crearToken_(vendedorId) {
  var exp = Date.now() + SESION_HORAS * 3600 * 1000;
  var base = vendedorId + '.' + exp;
  return base + '.' + firmar_(base);
}

function verificarToken_(token) {
  var partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  var base = partes[0] + '.' + partes[1];
  if (firmar_(base) !== partes[2]) return null;
  if (Number(partes[1]) < Date.now()) return null;
  var v = leer_('Vendedores').filter(function (x) { return String(x.id) === partes[0] && activo_(x); })[0];
  return v ? { vendedor_id: String(v.id), vendedor: String(v.nombre) } : null;
}

function activo_(v) {
  return v.activo === true || String(v.activo).toUpperCase() === 'TRUE' || String(v.activo) === '1' || String(v.activo).toLowerCase() === 'si';
}

/* -------------------- Acciones -------------------- */
function accionVendedores_() {
  var lista = leer_('Vendedores').filter(activo_).map(function (v) {
    return { id: String(v.id), nombre: String(v.nombre) };
  });
  return { ok: true, vendedores: lista };
}

function accionLogin_(p) {
  var id = txt_(p.vendedor_id, 40);
  var pin = txt_(p.pin, 12);
  var cache = CacheService.getScriptCache();
  var clave = 'intentos_' + id;
  var intentos = Number(cache.get(clave) || 0);
  if (intentos >= MAX_INTENTOS) {
    return { ok: false, error: 'Demasiados intentos. Esperá 10 minutos.', code: 'locked' };
  }
  var v = leer_('Vendedores').filter(function (x) { return String(x.id) === id && activo_(x); })[0];
  if (!v || !/^\d{4,6}$/.test(pin) || !v.pin_hash || hashPin_(id, pin) !== String(v.pin_hash)) {
    cache.put(clave, String(intentos + 1), BLOQUEO_SEG);
    return { ok: false, error: 'Vendedor o PIN incorrecto.', code: 'bad_pin' };
  }
  cache.remove(clave);
  return { ok: true, token: crearToken_(id), vendedor: { id: id, nombre: String(v.nombre) } };
}

function clientePublico_(c) {
  return {
    id: String(c.id), nombre: String(c.nombre), contacto: String(c.contacto),
    rif_cedula: String(c.rif_cedula), direccion: String(c.direccion),
    telefono: String(c.telefono), telefono2: String(c.telefono2),
    latitud: c.latitud === '' ? '' : Number(c.latitud),
    longitud: c.longitud === '' ? '' : Number(c.longitud)
  };
}

function soloDigitos_(s) { return String(s || '').replace(/\D/g, ''); }

function accionClientes_(p) {
  var q = txt_(p.q, 60).toLowerCase();
  var qd = soloDigitos_(q);
  var lista = leer_('Clientes').filter(function (c) {
    if (String(c.deleted) === '1' || c.deleted === true) return false;
    if (!q) return true;
    var texto = [c.nombre, c.contacto, c.rif_cedula, c.direccion].join(' ').toLowerCase();
    if (texto.indexOf(q) !== -1) return true;
    if (qd.length >= 4) {
      return soloDigitos_(c.telefono).indexOf(qd) !== -1 || soloDigitos_(c.telefono2).indexOf(qd) !== -1 ||
             soloDigitos_(c.rif_cedula).indexOf(qd) !== -1;
    }
    return false;
  });
  lista.sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); });
  return { ok: true, clientes: lista.slice(0, 20).map(clientePublico_) };
}

function numeroGps_(v, min, max) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  return isFinite(n) && n >= min && n <= max ? Math.round(n * 1e6) / 1e6 : '';
}

/* Crea o actualiza el cliente. Busca por id; si no, por teléfono o RIF. */
function guardarCliente_(c, ses) {
  var datos = {
    nombre: txt_(c.negocio || c.nombre, 120),
    contacto: txt_(c.contacto, 120),
    rif_cedula: txt_(c.rif_cedula, 30).toUpperCase(),
    direccion: txt_(c.direccion, 250),
    telefono: txt_(c.telefono, 30),
    telefono2: txt_(c.telefono2, 30),
    latitud: numeroGps_(c.latitud, -90, 90),
    longitud: numeroGps_(c.longitud, -180, 180)
  };
  if (!datos.nombre && datos.contacto) datos.nombre = datos.contacto;
  if (!datos.nombre) throw new Error('Falta el nombre del cliente o del negocio.');
  if (!datos.telefono) throw new Error('Falta el teléfono del cliente.');

  var todos = leer_('Clientes');
  var tel = soloDigitos_(datos.telefono);
  var rif = soloDigitos_(datos.rif_cedula);
  var existente = null;
  if (c.id) existente = todos.filter(function (x) { return String(x.id) === String(c.id); })[0];
  if (!existente && tel.length >= 7) existente = todos.filter(function (x) { return soloDigitos_(x.telefono) === tel; })[0];
  if (!existente && rif.length >= 6) existente = todos.filter(function (x) { return soloDigitos_(x.rif_cedula) === rif; })[0];

  var t = ahora_();
  if (existente) {
    var actualizado = {};
    HOJAS.Clientes.forEach(function (k) { actualizado[k] = existente[k]; });
    // Solo se pisan los campos que vienen con dato (no se borra lo que ya estaba)
    Object.keys(datos).forEach(function (k) { if (datos[k] !== '') actualizado[k] = datos[k]; });
    actualizado.updated_at = t;
    actualizado.sync_status = 1;
    actualizar_('Clientes', existente._fila, actualizado);
    return actualizado;
  }
  var nuevo = {
    id: uuid_(), updated_at: t, created_at: t, sync_status: 1, deleted: 0, vendedor_id: ses.vendedor_id
  };
  Object.keys(datos).forEach(function (k) { nuevo[k] = datos[k]; });
  agregar_('Clientes', nuevo);
  return nuevo;
}

function nuevoIdPedido_(pedidos) {
  var dia = Utilities.formatDate(new Date(), TZ, 'yyMMdd');
  var prefijo = 'SKL-' + dia + '-';
  var max = 0;
  pedidos.forEach(function (x) {
    var id = String(x.id);
    if (id.indexOf(prefijo) === 0) max = Math.max(max, Number(id.slice(prefijo.length)) || 0);
  });
  var n = String(max + 1);
  while (n.length < 3) n = '0' + n;
  return prefijo + n;
}

function limpiarItems_(items) {
  if (!Array.isArray(items)) return [];
  return items.map(function (it) {
    var cajas = Math.floor(Number(it.cajas));
    var u = Math.floor(Number(it.unidades_caja));
    return {
      code: txt_(it.code, 20).toUpperCase(),
      producto: txt_(it.producto, 120),
      cajas: cajas,
      unidades_caja: isFinite(u) && u > 0 ? u : '',
      unidad: txt_(it.unidad || 'unidades', 20),
      total_unidades: isFinite(u) && u > 0 ? cajas * u : ''
    };
  }).filter(function (it) { return it.code && isFinite(it.cajas) && it.cajas > 0 && it.cajas <= 10000; });
}

function detalleUnidades_(items) {
  var porUnidad = {};
  items.forEach(function (it) {
    if (it.total_unidades) porUnidad[it.unidad] = (porUnidad[it.unidad] || 0) + it.total_unidades;
  });
  return Object.keys(porUnidad).map(function (k) { return porUnidad[k] + ' ' + k; }).join(' + ');
}

function pedidoConItems_(ped, items) {
  var o = {};
  HOJAS.Pedidos.forEach(function (k) { o[k] = ped[k]; });
  o.total_cajas = Number(o.total_cajas);
  o.items = items.filter(function (it) { return String(it.pedido_id) === String(ped.id); }).map(function (it) {
    return { code: it.code, producto: it.producto, cajas: Number(it.cajas), unidades_caja: it.unidades_caja === '' ? '' : Number(it.unidades_caja), unidad: it.unidad, total_unidades: it.total_unidades === '' ? '' : Number(it.total_unidades) };
  });
  return o;
}

function accionGuardarPedido_(p, ses) {
  var items = limpiarItems_(p.items);
  if (!items.length) return { ok: false, error: 'El pedido no tiene productos.', code: 'empty' };
  var ref = txt_(p.client_ref, 60);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var pedidos = leer_('Pedidos');
    if (ref) {
      var repetido = pedidos.filter(function (x) { return String(x.client_ref) === ref; })[0];
      if (repetido) {
        return { ok: true, duplicado: true, pedido: pedidoConItems_(repetido, leer_('PedidoItems')), cliente_id: String(repetido.cliente_id) };
      }
    }
    var cliente;
    try { cliente = guardarCliente_(p.cliente || {}, ses); }
    catch (err) { return { ok: false, error: err.message, code: 'cliente' }; }

    var t = ahora_();
    var ped = {
      id: nuevoIdPedido_(pedidos),
      fecha: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      vendedor_id: ses.vendedor_id, vendedor: ses.vendedor,
      cliente_id: cliente.id, cliente: cliente.contacto || cliente.nombre, negocio: cliente.nombre,
      total_cajas: items.reduce(function (a, it) { return a + it.cajas; }, 0),
      detalle_unidades: detalleUnidades_(items),
      pago: txt_(p.pago, 40), nota: txt_(p.nota, 300),
      estado: 'pendiente', estado_at: t, estado_por: ses.vendedor, motivo: '',
      client_ref: ref, created_at: t, updated_at: t
    };
    agregar_('Pedidos', ped);
    var filas = items.map(function (it) { it.pedido_id = ped.id; return filaDe_('PedidoItems', it); });
    var hItems = hoja_('PedidoItems');
    hItems.getRange(hItems.getLastRow() + 1, 1, filas.length, HOJAS.PedidoItems.length).setValues(filas);
    ped.items = items;
    return { ok: true, pedido: pedidoConItems_(ped, items), cliente_id: cliente.id, cliente: clientePublico_(cliente) };
  } finally {
    lock.releaseLock();
  }
}

function accionPedidos_(p, ses) {
  var dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  var desde = new Date(Date.now() - dias * 86400000).toISOString();
  var estado = ESTADOS.indexOf(p.estado) !== -1 ? p.estado : '';
  var items = leer_('PedidoItems');
  var lista = leer_('Pedidos').filter(function (x) {
    return String(x.vendedor_id) === ses.vendedor_id && String(x.created_at) >= desde && (!estado || x.estado === estado);
  });
  lista.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  var clientes = {};
  leer_('Clientes').forEach(function (c) { clientes[String(c.id)] = c; });
  return {
    ok: true,
    pedidos: lista.slice(0, 200).map(function (x) {
      var o = pedidoConItems_(x, items);
      var c = clientes[String(x.cliente_id)];
      if (c) o.cliente_datos = clientePublico_(c);
      return o;
    })
  };
}

function accionEstado_(p, ses) {
  if (ESTADOS.indexOf(p.estado) === -1) return { ok: false, error: 'Estado inválido.', code: 'estado' };
  if (p.estado === 'cancelado' && !txt_(p.motivo)) return { ok: false, error: 'Indicá el motivo de la cancelación.', code: 'motivo' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ped = leer_('Pedidos').filter(function (x) { return String(x.id) === String(p.pedido_id); })[0];
    if (!ped) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
    if (String(ped.vendedor_id) !== ses.vendedor_id) return { ok: false, error: 'Este pedido es de otro vendedor.', code: 'forbidden' };
    var t = ahora_();
    ped.estado = p.estado;
    ped.estado_at = t;
    ped.estado_por = ses.vendedor;
    ped.motivo = p.estado === 'cancelado' ? txt_(p.motivo, 200) : '';
    ped.updated_at = t;
    actualizar_('Pedidos', ped._fila, ped);
    return { ok: true, pedido: pedidoConItems_(ped, leer_('PedidoItems')) };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------- Menú dentro de la hoja (administración) -------------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Skala CRM')
    .addItem('1. Preparar hojas', 'prepararHojas')
    .addItem('2. Agregar vendedor', 'menuAgregarVendedor')
    .addItem('3. Asignar / cambiar PIN', 'menuAsignarPin')
    .addToUi();
}

function prepararHojas() {
  Object.keys(HOJAS).forEach(hoja_);
  secreto_();
  try { SpreadsheetApp.getUi().alert('Listo: hojas Vendedores, Clientes, Pedidos y PedidoItems.'); } catch (e) {}
}

function agregarVendedor(nombre, pin) {
  nombre = txt_(nombre, 60);
  if (!nombre) throw new Error('Falta el nombre.');
  var vendedores = leer_('Vendedores');
  var id = 'V' + String(vendedores.length + 1);
  while (vendedores.some(function (v) { return String(v.id) === id; })) id = 'V' + String(Number(id.slice(1)) + 1);
  agregar_('Vendedores', { id: id, nombre: nombre, pin_hash: '', activo: true });
  if (pin) asignarPin(id, pin);
  return id;
}

function asignarPin(vendedorId, pin) {
  pin = String(pin || '').trim();
  if (!/^\d{4,6}$/.test(pin)) throw new Error('El PIN debe tener de 4 a 6 números.');
  var v = leer_('Vendedores').filter(function (x) { return String(x.id) === String(vendedorId); })[0];
  if (!v) throw new Error('No existe el vendedor ' + vendedorId);
  v.pin_hash = hashPin_(String(v.id), pin);
  actualizar_('Vendedores', v._fila, v);
  return true;
}

function menuAgregarVendedor() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Nuevo vendedor', 'Nombre del vendedor:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var id = agregarVendedor(r.getResponseText());
  ui.alert('Vendedor creado con id ' + id + '. Ahora asignale un PIN (menú 3).');
}

function menuAsignarPin() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Asignar PIN', 'Id del vendedor (ej. V1):', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Asignar PIN', 'PIN nuevo (4 a 6 números):', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  asignarPin(a.getResponseText().trim(), b.getResponseText());
  ui.alert('PIN guardado (cifrado). El PIN no se puede ver; si se olvida, asigná uno nuevo.');
}
