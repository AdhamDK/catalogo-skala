/* ============================================================
   Skala CRM v2 — Backend en Google Apps Script (Google Sheets)
   Roles: master · admin (administración) · vendedor · despachador
   Instalación: ver crm/INSTALAR.md
   - En la hoja: Extensiones -> Apps Script -> BORRAR todo y pegar este archivo.
   - Implementar -> Nueva implementación -> App web
       Ejecutar como: Yo · Acceso: Cualquier persona
   - Copiar la URL /exec en catalogo-skala/js/crm.js (CRM_API_URL).
   Spec: docs/specs/modo-vendedor-crm.md
   ============================================================ */

var TZ = 'America/Caracas';
var SESION_HORAS = 12;
var MAX_INTENTOS = 5;
var BLOQUEO_SEG = 600;

var ROLES = ['master', 'admin', 'vendedor', 'despachador'];
var NOMBRE_ROL = { master: 'Master', admin: 'Administración', vendedor: 'Vendedor', despachador: 'Despachador' };
var ESTADOS = ['pendiente', 'confirmado', 'en_ruta', 'entregado', 'cancelado'];
var DOCUMENTOS = ['Nota de entrega', 'Factura'];
var MAX_DIAS_CREDITO = 180;
var MONEDAS = ['USD', 'Bs'];
/* Monto cobrado: número > 0 con hasta 2 decimales (acepta coma decimal) */
function montoValido_(v) {
  var n = Number(String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : 0;
}
var esCredito_ = function (pago) { return /cr[eé]dito/i.test(String(pago || '')); };
var GESTION = ['master', 'admin'];          // ven y corrigen todo
var TOMAN_PEDIDOS = ['master', 'admin', 'vendedor'];

var HOJAS = {
  Usuarios: ['id', 'usuario', 'nombre', 'rol', 'pin_hash', 'activo', 'created_at'],
  // 10 primeras = GPS_CLIENTES (backend/Code.gs). No cambiar el orden.
  Clientes: ['id', 'nombre', 'rif_cedula', 'direccion', 'latitud', 'longitud', 'telefono',
             'updated_at', 'sync_status', 'deleted',
             'contacto', 'telefono2', 'vendedor_id', 'created_at'],
  Pedidos: ['id', 'fecha', 'vendedor_id', 'vendedor', 'cliente_id', 'cliente', 'negocio',
            'total_cajas', 'detalle_unidades', 'pago', 'nota', 'estado', 'estado_at',
            'estado_por', 'motivo', 'client_ref', 'created_at', 'updated_at',
            'despachador_id', 'despachador', 'confirmado_por', 'confirmado_at',
            'entregado_por', 'entregado_at', 'documento',
            'dias_credito', 'cobro', 'cobrado_at', 'cobrado_por', 'conciliado_at', 'conciliado_por',
            'monto', 'moneda'],
  PedidoItems: ['pedido_id', 'code', 'producto', 'cajas', 'unidades_caja', 'unidad', 'total_unidades'],
  Historial: ['fecha', 'pedido_id', 'usuario', 'accion', 'detalle']
};

/* -------------------- Entradas HTTP -------------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return json_({ ok: true, app: 'skala-crm', version: 2, claves: true });
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

/* acción -> [función, roles permitidos (null = pública)] */
var ACCIONES = {
  login: [accionLogin_, null],
  yo: [accionYo_, ROLES],
  clientes: [accionClientes_, TOMAN_PEDIDOS],
  guardarCliente: [accionGuardarCliente_, TOMAN_PEDIDOS],
  guardarPedido: [accionGuardarPedido_, TOMAN_PEDIDOS],
  pedidos: [accionPedidos_, ROLES],
  pedido: [accionPedido_, ROLES],
  estado: [accionEstado_, ROLES],
  cobro: [accionCobro_, TOMAN_PEDIDOS],
  despachadores: [accionDespachadores_, GESTION],
  resumen: [accionResumen_, TOMAN_PEDIDOS],
  usuarios: [accionUsuarios_, ['master']],
  guardarUsuario: [accionGuardarUsuario_, ['master']]
};

function manejar_(p) {
  var def = ACCIONES[p.action];
  if (!def) return { ok: false, error: 'Acción desconocida', code: 'unknown_action' };
  try {
    var ses = null;
    if (def[1]) {
      ses = verificarToken_(p.token);
      if (!ses) return { ok: false, error: 'Sesión vencida. Ingresá de nuevo.', code: 'auth' };
      if (def[1].indexOf(ses.rol) === -1) return { ok: false, error: 'Tu usuario no tiene permiso para esto.', code: 'forbidden' };
    }
    return def[0](p, ses);
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), code: 'internal' };
  }
}

/* -------------------- Hojas (helpers) -------------------- */
function libro_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No hay hoja vinculada. Creá el script desde la hoja (Extensiones > Apps Script) o poné SPREADSHEET_ID en Propiedades.');
  return ss;
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

function historial_(pedidoId, ses, accion, detalle) {
  agregar_('Historial', { fecha: ahora_(), pedido_id: pedidoId, usuario: ses ? ses.nombre + ' (' + NOMBRE_ROL[ses.rol] + ')' : '', accion: accion, detalle: detalle || '' });
}

function ahora_() { return new Date().toISOString(); }
function txt_(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200); }
function uuid_() { return Utilities.getUuid(); }
function esGestion_(ses) { return GESTION.indexOf(ses.rol) !== -1; }

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

function hashPin_(userId, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    secreto_() + '|' + userId + '|' + String(pin), Utilities.Charset.UTF_8);
  return hex_(bytes);
}

function firmar_(texto) {
  return hex_(Utilities.computeHmacSha256Signature(texto, secreto_()));
}

function crearToken_(userId) {
  var exp = Date.now() + SESION_HORAS * 3600 * 1000;
  var base = userId + '.' + exp;
  return base + '.' + firmar_(base);
}

function activo_(u) {
  var a = String(u.activo).toLowerCase();
  return u.activo === true || a === 'true' || a === '1' || a === 'si' || a === 'sí';
}

function usuarioPublico_(u) {
  return { id: String(u.id), usuario: String(u.usuario), nombre: String(u.nombre), rol: String(u.rol), rol_nombre: NOMBRE_ROL[u.rol] || String(u.rol) };
}

/* El rol se lee de la hoja en cada llamada: cambios aplican al instante. */
function verificarToken_(token) {
  var partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  var base = partes[0] + '.' + partes[1];
  if (firmar_(base) !== partes[2]) return null;
  if (Number(partes[1]) < Date.now()) return null;
  var u = leer_('Usuarios').filter(function (x) { return String(x.id) === partes[0] && activo_(x); })[0];
  if (!u || ROLES.indexOf(String(u.rol)) === -1) return null;
  return usuarioPublico_(u);
}

function normUsuario_(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9._-]/g, '').slice(0, 30);
}

/* Clave: letras + números (símbolos opcionales). Mínimo 6; Master mínimo 8.
   Se guarda cifrada (SHA-256 con un secreto que NO está en la hoja). */
var CLAVE_MIN = 6, CLAVE_MIN_MASTER = 8, CLAVE_MAX = 64;
function validarPin_(clave, rol) {
  clave = String(clave || '');
  var min = rol === 'master' ? CLAVE_MIN_MASTER : CLAVE_MIN;
  if (clave.length < min || clave.length > CLAVE_MAX || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clave) || !/\d/.test(clave) || /^\s|\s$/.test(clave)) {
    throw new Error('La clave' + (rol === 'master' ? ' del Master' : '') + ' debe tener al menos ' + min +
      ' caracteres, con letras y números (puede llevar símbolos como * # @ !).');
  }
  return clave;
}

/* -------------------- Acciones: sesión -------------------- */
function accionLogin_(p) {
  var usuario = normUsuario_(p.usuario);
  var pin = String(p.clave !== undefined ? p.clave : (p.pin || '')).slice(0, CLAVE_MAX);
  var cache = CacheService.getScriptCache();
  var clave = 'intentos_' + usuario;
  var intentos = Number(cache.get(clave) || 0);
  if (intentos >= MAX_INTENTOS) {
    return { ok: false, error: 'Demasiados intentos. Esperá 10 minutos.', code: 'locked' };
  }
  var u = leer_('Usuarios').filter(function (x) { return normUsuario_(x.usuario) === usuario && activo_(x); })[0];
  if (!u || !pin || !u.pin_hash || hashPin_(String(u.id), pin) !== String(u.pin_hash)) {
    cache.put(clave, String(intentos + 1), BLOQUEO_SEG);
    return { ok: false, error: 'Usuario o clave incorrecta.', code: 'bad_pin' };
  }
  cache.remove(clave);
  return { ok: true, token: crearToken_(String(u.id)), usuario: usuarioPublico_(u) };
}

function accionYo_(p, ses) { return { ok: true, usuario: ses }; }

/* -------------------- Acciones: clientes -------------------- */
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
  var limite = Math.min(Math.max(Number(p.limite) || 20, 1), 200);
  return { ok: true, clientes: lista.slice(0, limite).map(clientePublico_) };
}

function numeroGps_(v, min, max) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  return isFinite(n) && n >= min && n <= max ? Math.round(n * 1e6) / 1e6 : '';
}

/* Crea o actualiza el cliente. Busca por id; si no, por teléfono o RIF. */
/* opciones: exigirTelefono (pedidos: sí; alta manual: no) · reemplazar (editar: también vacía campos) */
function guardarCliente_(c, ses, opciones) {
  opciones = opciones || {};
  var exigirTelefono = opciones.exigirTelefono !== false;
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
  if (exigirTelefono && !datos.telefono) throw new Error('Falta el teléfono del cliente.');
  if (datos.telefono && soloDigitos_(datos.telefono).length < 7) throw new Error('El teléfono 1 debe tener al menos 7 números.');

  var todos = leer_('Clientes');
  var tel = soloDigitos_(datos.telefono);
  var rif = soloDigitos_(datos.rif_cedula);
  var existente = null;
  if (c.id) existente = todos.filter(function (x) { return String(x.id) === String(c.id); })[0];
  if (!existente && tel.length >= 7) existente = todos.filter(function (x) { return soloDigitos_(x.telefono) === tel; })[0];
  if (!existente && rif.length >= 6) existente = todos.filter(function (x) { return soloDigitos_(x.rif_cedula) === rif; })[0];
  // Sin teléfono ni RIF: mismo nombre de negocio = mismo cliente (evita duplicar al traspasar)
  if (!existente && tel.length < 7 && rif.length < 6) {
    var n = datos.nombre.toLowerCase();
    existente = todos.filter(function (x) { return String(x.nombre).trim().toLowerCase() === n && String(x.deleted) !== '1'; })[0];
  }

  var t = ahora_();
  if (existente) {
    var actualizado = {};
    HOJAS.Clientes.forEach(function (k) { actualizado[k] = existente[k]; });
    // Al editar se guarda todo lo del formulario; si no, solo se pisan los campos con dato
    Object.keys(datos).forEach(function (k) { if (opciones.reemplazar || datos[k] !== '') actualizado[k] = datos[k]; });
    actualizado.updated_at = t;
    actualizado.sync_status = 1;
    actualizar_('Clientes', existente._fila, actualizado);
    actualizado._existia = true;
    return actualizado;
  }
  var nuevo = { id: uuid_(), updated_at: t, created_at: t, sync_status: 1, deleted: 0, vendedor_id: ses.id };
  Object.keys(datos).forEach(function (k) { nuevo[k] = datos[k]; });
  agregar_('Clientes', nuevo);
  return nuevo;
}

/* Alta o edición de un cliente sin pedido (traspaso de la base de clientes) */
function accionGuardarCliente_(p, ses) {
  var c = p.cliente || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (c.id && !leer_('Clientes').some(function (x) { return String(x.id) === String(c.id); })) {
      return { ok: false, error: 'Cliente no encontrado.', code: 'not_found' };
    }
    var r;
    try { r = guardarCliente_(c, ses, { exigirTelefono: false, reemplazar: !!c.id }); }
    catch (err) { return { ok: false, error: err.message, code: 'cliente' }; }
    return { ok: true, cliente: clientePublico_(r), existia: !!r._existia && !c.id };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------- Acciones: pedidos -------------------- */
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
    if (it.total_unidades) porUnidad[it.unidad] = (porUnidad[it.unidad] || 0) + Number(it.total_unidades);
  });
  return Object.keys(porUnidad).map(function (k) { return porUnidad[k] + ' ' + k; }).join(' + ');
}

function pedidoConItems_(ped, items) {
  var o = {};
  HOJAS.Pedidos.forEach(function (k) { o[k] = ped[k]; });
  o.total_cajas = Number(o.total_cajas);
  o.dias_credito = Number(o.dias_credito) || 0;
  o.monto = o.monto === '' || o.monto === undefined ? '' : Number(o.monto);
  o.items = items.filter(function (it) { return String(it.pedido_id) === String(ped.id); }).map(function (it) {
    return { code: it.code, producto: it.producto, cajas: Number(it.cajas), unidades_caja: it.unidades_caja === '' ? '' : Number(it.unidades_caja), unidad: it.unidad, total_unidades: it.total_unidades === '' ? '' : Number(it.total_unidades) };
  });
  return o;
}

function accionGuardarPedido_(p, ses) {
  var items = limpiarItems_(p.items);
  if (!items.length) return { ok: false, error: 'El pedido no tiene productos.', code: 'empty' };
  var documento = txt_(p.documento, 30);
  if (DOCUMENTOS.indexOf(documento) === -1) return { ok: false, error: 'Indicá si el cliente quiere nota de entrega o factura.', code: 'documento' };
  // Crédito: hay que indicar los días (se cuentan desde la entrega)
  var diasCredito = 0;
  if (esCredito_(p.pago)) {
    diasCredito = Math.floor(Number(p.dias_credito));
    if (!isFinite(diasCredito) || diasCredito < 1 || diasCredito > MAX_DIAS_CREDITO) {
      return { ok: false, error: 'Indicá los días de crédito (1 a ' + MAX_DIAS_CREDITO + ').', code: 'credito' };
    }
  }
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
    // Factura: hace falta RIF o cédula (del formulario o ya guardado en el cliente)
    if (documento === 'Factura') {
      var cc = p.cliente || {};
      var rifCliente = txt_(cc.rif_cedula, 30);
      if (!rifCliente && cc.id) {
        var previo = leer_('Clientes').filter(function (x) { return String(x.id) === String(cc.id); })[0];
        rifCliente = previo ? String(previo.rif_cedula) : '';
      }
      if (soloDigitos_(rifCliente).length < 6) return { ok: false, error: 'Para factura hace falta el RIF o la cédula del cliente.', code: 'rif' };
    }
    var cliente;
    try { cliente = guardarCliente_(p.cliente || {}, ses); }
    catch (err) { return { ok: false, error: err.message, code: 'cliente' }; }

    var t = ahora_();
    var ped = {
      id: nuevoIdPedido_(pedidos),
      fecha: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      vendedor_id: ses.id, vendedor: ses.nombre,
      cliente_id: cliente.id, cliente: cliente.contacto || cliente.nombre, negocio: cliente.nombre,
      total_cajas: items.reduce(function (a, it) { return a + it.cajas; }, 0),
      detalle_unidades: detalleUnidades_(items),
      pago: txt_(p.pago, 40), nota: txt_(p.nota, 300), documento: documento,
      dias_credito: diasCredito, cobro: '',
      estado: 'pendiente', estado_at: t, estado_por: ses.nombre, motivo: '',
      client_ref: ref, created_at: t, updated_at: t
    };
    agregar_('Pedidos', ped);
    var filas = items.map(function (it) { it.pedido_id = ped.id; return filaDe_('PedidoItems', it); });
    var hItems = hoja_('PedidoItems');
    hItems.getRange(hItems.getLastRow() + 1, 1, filas.length, HOJAS.PedidoItems.length).setValues(filas);
    historial_(ped.id, ses, 'creado', ped.total_cajas + ' cajas · ' + ped.negocio);
    return { ok: true, pedido: pedidoConItems_(ped, items), cliente_id: cliente.id, cliente: clientePublico_(cliente) };
  } finally {
    lock.releaseLock();
  }
}

/* ¿Puede este usuario ver el pedido? */
function puedeVer_(ses, x) {
  if (esGestion_(ses)) return true;
  if (ses.rol === 'vendedor') return String(x.vendedor_id) === ses.id;
  if (ses.rol === 'despachador') {
    return String(x.despachador_id) === ses.id && ['confirmado', 'en_ruta', 'entregado'].indexOf(String(x.estado)) !== -1;
  }
  return false;
}

function accionPedidos_(p, ses) {
  var dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  var desde = new Date(Date.now() - dias * 86400000).toISOString();
  var estados = (Array.isArray(p.estados) ? p.estados : (p.estado ? [p.estado] : []))
    .filter(function (e) { return ESTADOS.indexOf(e) !== -1; });
  var clienteId = txt_(p.cliente_id, 60);
  var items = leer_('PedidoItems');
  var lista = leer_('Pedidos').filter(function (x) {
    if (!puedeVer_(ses, x)) return false;
    if (clienteId) return String(x.cliente_id) === clienteId; // ficha del cliente: todo su historial visible
    // Por cobrar: no anulados y sin pago; crédito en cualquier estado, contado ya entregado
    if (p.por_cobrar) {
      if (String(x.estado) === 'cancelado' || String(x.cobro)) return false;
      return Number(x.dias_credito) > 0 || String(x.estado) === 'entregado';
    }
    // Por conciliar: el vendedor lo marcó cancelado y Administración debe verificarlo
    if (p.por_conciliar) return String(x.cobro) === 'cancelado';
    // Conciliados en el período (por fecha de conciliación)
    if (p.conciliados) return String(x.cobro) === 'conciliado' && String(x.conciliado_at) >= desde;
    if (estados.length && estados.indexOf(String(x.estado)) === -1) return false;
    // Lo que sigue abierto se muestra aunque sea viejo
    var abierto = ['pendiente', 'confirmado', 'en_ruta'].indexOf(String(x.estado)) !== -1;
    return abierto || String(x.created_at) >= desde;
  });
  lista.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  var clientes = {};
  leer_('Clientes').forEach(function (c) { clientes[String(c.id)] = c; });
  return {
    ok: true,
    pedidos: lista.slice(0, 300).map(function (x) {
      var o = pedidoConItems_(x, items);
      var c = clientes[String(x.cliente_id)];
      if (c) o.cliente_datos = clientePublico_(c);
      return o;
    })
  };
}

/* Cobro de un pedido entregado:
   ''  (por cobrar) --cancelar--> 'cancelado' (el vendedor reporta que el cliente pagó)
       --conciliar--> 'conciliado' (Administración verificó que recibió el dinero)
   rechazar: 'cancelado' -> '' (no se recibió; motivo obligatorio)
   desconciliar: 'conciliado' -> 'cancelado' (corrección)
   Vendedor: solo "cancelar" sus pedidos. Administración / Master: todo. */
function accionCobro_(p, ses) {
  var accion = String(p.accion || 'cancelar');
  var gestion = esGestion_(ses);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ped = leer_('Pedidos').filter(function (x) { return String(x.id) === String(p.pedido_id); })[0];
    if (!ped || !puedeVer_(ses, ped)) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
    if (String(ped.estado) !== 'entregado') return { ok: false, error: 'El cobro se registra cuando el pedido ya fue entregado.', code: 'estado' };
    var cobro = String(ped.cobro || '');
    var t = ahora_(), detalle = '';
    var monto = montoValido_(p.monto);
    var moneda = MONEDAS.indexOf(String(p.moneda)) !== -1 ? String(p.moneda) : '';
    if (accion === 'cancelar') {
      if (cobro) return { ok: false, error: 'Ese pedido ya figura como ' + (cobro === 'conciliado' ? 'conciliado' : 'cancelado') + '.', code: 'repetido' };
      if (!monto || !moneda) return { ok: false, error: 'Indicá cuánto cobraste y en qué moneda.', code: 'monto' };
      ped.cobro = 'cancelado'; ped.cobrado_at = t; ped.cobrado_por = ses.nombre;
      ped.monto = monto; ped.moneda = moneda; detalle = monto + ' ' + moneda;
    } else if (!gestion) {
      return { ok: false, error: 'Solo Administración verifica y concilia los pagos.', code: 'forbidden' };
    } else if (accion === 'conciliar') {
      if (cobro === 'conciliado') return { ok: false, error: 'Ese pago ya está conciliado.', code: 'repetido' };
      // Administración confirma (o corrige) el monto recibido
      if (monto && moneda) { ped.monto = monto; ped.moneda = moneda; }
      if (!montoValido_(ped.monto) || MONEDAS.indexOf(String(ped.moneda)) === -1) return { ok: false, error: 'Indicá el monto recibido y la moneda.', code: 'monto' };
      if (!cobro) { ped.cobrado_at = t; ped.cobrado_por = ses.nombre; } // Administración recibió el pago directo
      ped.cobro = 'conciliado'; ped.conciliado_at = t; ped.conciliado_por = ses.nombre;
      detalle = Number(ped.monto) + ' ' + ped.moneda;
    } else if (accion === 'rechazar') {
      if (cobro !== 'cancelado') return { ok: false, error: 'Solo se rechaza un pago reportado como cancelado.', code: 'estado' };
      detalle = txt_(p.motivo, 200);
      if (!detalle) return { ok: false, error: 'Indicá por qué no se recibió el pago.', code: 'motivo' };
      ped.cobro = ''; ped.cobrado_at = ''; ped.cobrado_por = ''; ped.monto = ''; ped.moneda = '';
    } else if (accion === 'desconciliar') {
      if (cobro !== 'conciliado') return { ok: false, error: 'Ese pago no está conciliado.', code: 'estado' };
      ped.cobro = 'cancelado'; ped.conciliado_at = ''; ped.conciliado_por = '';
    } else {
      return { ok: false, error: 'Acción de cobro inválida.', code: 'accion' };
    }
    ped.updated_at = t;
    actualizar_('Pedidos', ped._fila, ped);
    historial_(ped.id, ses, { cancelar: 'cobrado', conciliar: 'conciliado', rechazar: 'pago_rechazado', desconciliar: 'conciliacion_deshecha' }[accion], detalle);
    return { ok: true, pedido: pedidoConItems_(ped, leer_('PedidoItems')) };
  } finally {
    lock.releaseLock();
  }
}

/* Detalle de un pedido + su historial (respetando lo que el rol puede ver) */
function accionPedido_(p, ses) {
  var x = leer_('Pedidos').filter(function (y) { return String(y.id) === String(p.pedido_id); })[0];
  if (!x || !puedeVer_(ses, x)) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
  var o = pedidoConItems_(x, leer_('PedidoItems'));
  var c = leer_('Clientes').filter(function (y) { return String(y.id) === String(x.cliente_id); })[0];
  if (c) o.cliente_datos = clientePublico_(c);
  o.historial = leer_('Historial').filter(function (h) { return String(h.pedido_id) === String(x.id); })
    .map(function (h) { return { fecha: String(h.fecha), usuario: String(h.usuario), accion: String(h.accion), detalle: String(h.detalle) }; });
  return { ok: true, pedido: o };
}

/* Reglas de cambio de estado por rol. Devuelve '' si se permite, o el motivo del rechazo. */
function reglaEstado_(ses, ped, nuevo) {
  var actual = String(ped.estado);
  if (actual === nuevo) return 'El pedido ya está en ese estado.';
  if (esGestion_(ses)) {
    if (nuevo === 'confirmado' && actual !== 'pendiente' && actual !== 'en_ruta') return 'Solo se aprueba un pedido en proceso.';
    return '';
  }
  if (ses.rol === 'vendedor') {
    if (String(ped.vendedor_id) !== ses.id) return 'Este pedido es de otro vendedor.';
    if (nuevo === 'cancelado' && actual === 'pendiente') return '';
    return 'Como vendedor solo podés anular tus pedidos en proceso.';
  }
  if (ses.rol === 'despachador') {
    if (String(ped.despachador_id) !== ses.id) return 'Este pedido no está asignado a vos.';
    if (nuevo === 'en_ruta' && actual === 'confirmado') return '';
    if (nuevo === 'entregado' && (actual === 'confirmado' || actual === 'en_ruta')) return '';
    return 'Como despachador solo podés marcar en ruta o entregado.';
  }
  return 'Sin permiso.';
}

function accionEstado_(p, ses) {
  var nuevo = String(p.estado || '');
  if (ESTADOS.indexOf(nuevo) === -1) return { ok: false, error: 'Estado inválido.', code: 'estado' };
  var motivo = txt_(p.motivo, 200);
  if (nuevo === 'cancelado' && !motivo) return { ok: false, error: 'Indicá el motivo de la anulación.', code: 'motivo' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ped = leer_('Pedidos').filter(function (x) { return String(x.id) === String(p.pedido_id); })[0];
    if (!ped) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
    if (!puedeVer_(ses, ped)) return { ok: false, error: 'No tenés acceso a este pedido.', code: 'forbidden' };

    var reasignar = esGestion_(ses) && p.despachador_id && nuevo === String(ped.estado);
    if (!reasignar) {
      var rechazo = reglaEstado_(ses, ped, nuevo);
      if (rechazo) return { ok: false, error: rechazo, code: 'forbidden' };
    }

    var t = ahora_();
    var detalle = '';
    // Confirmar (o reasignar) exige despachador activo
    if (nuevo === 'confirmado' || reasignar) {
      var dId = txt_(p.despachador_id || ped.despachador_id, 40);
      var d = leer_('Usuarios').filter(function (u) { return String(u.id) === dId && String(u.rol) === 'despachador' && activo_(u); })[0];
      if (!d) return { ok: false, error: 'Elegí un despachador activo.', code: 'despachador' };
      ped.despachador_id = String(d.id);
      ped.despachador = String(d.nombre);
      detalle = 'Despachador: ' + d.nombre;
      if (nuevo === 'confirmado' && !reasignar) { ped.confirmado_por = ses.nombre; ped.confirmado_at = t; }
    }
    if (!reasignar) {
      ped.estado = nuevo;
      ped.estado_at = t;
      ped.estado_por = ses.nombre;
      ped.motivo = nuevo === 'cancelado' ? motivo : '';
      if (nuevo === 'entregado') { ped.entregado_por = ses.nombre; ped.entregado_at = t; }
      if (nuevo === 'pendiente') { ped.despachador_id = ''; ped.despachador = ''; ped.confirmado_por = ''; ped.confirmado_at = ''; }
      if (nuevo === 'cancelado') detalle = motivo;
    }
    ped.updated_at = t;
    actualizar_('Pedidos', ped._fila, ped);
    historial_(ped.id, ses, reasignar ? 'reasignado' : nuevo, detalle);
    return { ok: true, pedido: pedidoConItems_(ped, leer_('PedidoItems')) };
  } finally {
    lock.releaseLock();
  }
}

function accionDespachadores_() {
  var lista = leer_('Usuarios').filter(function (u) { return String(u.rol) === 'despachador' && activo_(u); })
    .map(function (u) { return { id: String(u.id), nombre: String(u.nombre) }; });
  return { ok: true, despachadores: lista };
}

/* -------------------- Resumen -------------------- */
function accionResumen_(p, ses) {
  var dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  var desde = new Date(Date.now() - dias * 86400000).toISOString();
  var pedidos = leer_('Pedidos').filter(function (x) {
    return String(x.created_at) >= desde && (esGestion_(ses) || String(x.vendedor_id) === ses.id);
  });
  var ids = {};
  pedidos.forEach(function (x) { ids[String(x.id)] = x; });
  var porEstado = {}; ESTADOS.forEach(function (e) { porEstado[e] = 0; });
  var porVendedor = {};
  var cajas = 0;
  pedidos.forEach(function (x) {
    porEstado[x.estado] = (porEstado[x.estado] || 0) + 1;
    if (x.estado === 'cancelado') return;
    cajas += Number(x.total_cajas) || 0;
    var v = porVendedor[x.vendedor] || (porVendedor[x.vendedor] = { vendedor: String(x.vendedor), pedidos: 0, cajas: 0 });
    v.pedidos++; v.cajas += Number(x.total_cajas) || 0;
  });
  var porProducto = {};
  leer_('PedidoItems').forEach(function (it) {
    var ped = ids[String(it.pedido_id)];
    if (!ped || ped.estado === 'cancelado') return;
    var k = String(it.code);
    var pr = porProducto[k] || (porProducto[k] = { code: k, producto: String(it.producto), cajas: 0 });
    pr.cajas += Number(it.cajas) || 0;
  });
  var orden = function (a, b) { return b.cajas - a.cajas; };
  return {
    ok: true, dias: dias, total_pedidos: pedidos.length, total_cajas: cajas, por_estado: porEstado,
    por_vendedor: esGestion_(ses) ? Object.keys(porVendedor).map(function (k) { return porVendedor[k]; }).sort(orden) : [],
    por_producto: Object.keys(porProducto).map(function (k) { return porProducto[k]; }).sort(orden).slice(0, 10)
  };
}

/* -------------------- Usuarios (solo Master) -------------------- */
function accionUsuarios_() {
  var lista = leer_('Usuarios').map(function (u) {
    var o = usuarioPublico_(u);
    o.activo = activo_(u);
    o.tiene_pin = !!u.pin_hash;
    return o;
  });
  return { ok: true, usuarios: lista };
}

function guardarUsuario_(d, ses) {
  var usuarios = leer_('Usuarios');
  var rol = String(d.rol || '');
  if (ROLES.indexOf(rol) === -1) throw new Error('Rol inválido.');
  var usuario = normUsuario_(d.usuario);
  if (usuario.length < 3) throw new Error('El usuario debe tener al menos 3 letras o números (sin espacios).');
  var nombre = txt_(d.nombre, 60);
  if (!nombre) throw new Error('Falta el nombre.');
  var activo = d.activo === undefined ? true : (d.activo === true || String(d.activo) === 'true');
  var existente = d.id ? usuarios.filter(function (u) { return String(u.id) === String(d.id); })[0] : null;
  if (d.id && !existente) throw new Error('Usuario no encontrado.');
  if (usuarios.some(function (u) { return normUsuario_(u.usuario) === usuario && (!existente || String(u.id) !== String(existente.id)); })) {
    throw new Error('Ese usuario ya existe.');
  }
  // Nunca quedarse sin un Master activo
  if (existente && String(existente.rol) === 'master' && activo_(existente) && (rol !== 'master' || !activo)) {
    var otros = usuarios.filter(function (u) { return String(u.rol) === 'master' && activo_(u) && String(u.id) !== String(existente.id); });
    if (!otros.length) throw new Error('Debe quedar al menos un Master activo.');
  }
  var nueva = d.clave !== undefined ? d.clave : d.pin;
  var pin = nueva ? validarPin_(nueva, rol) : '';
  if (!existente && !pin) throw new Error('Asigná una clave al usuario nuevo.');
  if (existente && rol === 'master' && String(existente.rol) !== 'master' && !pin) throw new Error('Para pasar a Master asigná una clave nueva de al menos 8 caracteres.');

  var u = existente || { id: 'U' + String(usuarios.reduce(function (m, x) { return Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0); }, 0) + 1), created_at: ahora_() };
  u.usuario = usuario; u.nombre = nombre; u.rol = rol; u.activo = activo;
  if (pin) u.pin_hash = hashPin_(String(u.id), pin);
  if (existente) actualizar_('Usuarios', existente._fila, u); else agregar_('Usuarios', u);
  return u;
}

function accionGuardarUsuario_(p, ses) {
  try {
    var u = guardarUsuario_(p, ses);
    var o = usuarioPublico_(u); o.activo = activo_(u);
    return { ok: true, usuario: o };
  } catch (err) {
    return { ok: false, error: err.message, code: 'usuario' };
  }
}

/* -------------------- Menú dentro de la hoja -------------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Skala CRM')
    .addItem('1. Preparar hojas', 'prepararHojas')
    .addItem('2. Crear usuario', 'menuCrearUsuario')
    .addItem('3. Cambiar clave', 'menuCambiarPin')
    .addToUi();
}

/* Crea las hojas y migra la hoja "Vendedores" de la v1 (si existe). */
function prepararHojas() {
  Object.keys(HOJAS).forEach(hoja_);
  secreto_();
  var migrados = 0;
  var ss = libro_();
  var vieja = ss.getSheetByName('Vendedores');
  if (vieja && vieja.getLastRow() > 1 && leer_('Usuarios').length === 0) {
    var vals = vieja.getRange(2, 1, vieja.getLastRow() - 1, 4).getValues(); // id, nombre, pin_hash, activo
    vals.forEach(function (f) {
      if (!f[0]) return;
      agregar_('Usuarios', {
        id: String(f[0]), usuario: normUsuario_(f[1]) || String(f[0]).toLowerCase(), nombre: String(f[1]),
        rol: 'vendedor', pin_hash: String(f[2] || ''), activo: f[3] === '' ? true : f[3], created_at: ahora_()
      });
      migrados++;
    });
  }
  var msg = 'Listo: hojas Usuarios, Clientes, Pedidos, PedidoItems e Historial.' +
    (migrados ? '\n' + migrados + ' vendedor(es) pasados a Usuarios (misma clave/PIN; el usuario es su nombre en minúsculas). Podés borrar la hoja Vendedores.' : '') +
    (leer_('Usuarios').some(function (u) { return u.rol === 'master'; }) ? '' : '\nAhora creá el usuario Master (menú 2).');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/* También se pueden usar desde el editor: crearUsuario('jose','José','master','Skala#2026') */
function crearUsuario(usuario, nombre, rol, pin) {
  return guardarUsuario_({ usuario: usuario, nombre: nombre, rol: rol, pin: pin }).id;
}

function cambiarPin(usuario, pin) {
  var u = leer_('Usuarios').filter(function (x) { return normUsuario_(x.usuario) === normUsuario_(usuario); })[0];
  if (!u) throw new Error('No existe el usuario ' + usuario);
  u.pin_hash = hashPin_(String(u.id), validarPin_(pin, String(u.rol)));
  actualizar_('Usuarios', u._fila, u);
  return true;
}

function menuCrearUsuario() {
  var ui = SpreadsheetApp.getUi();
  var pedir = function (t, m) { var r = ui.prompt(t, m, ui.ButtonSet.OK_CANCEL); return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null; };
  var usuario = pedir('Crear usuario (1/4)', 'Usuario para ingresar (ej. oscar):'); if (usuario === null) return;
  var nombre = pedir('Crear usuario (2/4)', 'Nombre para mostrar (ej. Óscar):'); if (nombre === null) return;
  var rol = pedir('Crear usuario (3/4)', 'Rol: master, admin, vendedor o despachador'); if (rol === null) return;
  var pin = pedir('Crear usuario (4/4)', 'Clave: letras y números, mínimo 6 (Master: 8). Puede llevar símbolos.'); if (pin === null) return;
  try {
    crearUsuario(usuario, nombre, rol.toLowerCase(), pin);
    ui.alert('Usuario "' + normUsuario_(usuario) + '" creado como ' + (NOMBRE_ROL[rol.toLowerCase()] || rol) + '.');
  } catch (err) { ui.alert('No se pudo crear: ' + err.message); }
}

function menuCambiarPin() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Cambiar clave', 'Usuario (ej. oscar):', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Cambiar clave', 'Clave nueva: letras y números, mínimo 6 (Master: 8):', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  try { cambiarPin(a.getResponseText(), b.getResponseText()); ui.alert('Clave guardada (cifrada).'); }
  catch (err) { ui.alert('No se pudo: ' + err.message); }
}
