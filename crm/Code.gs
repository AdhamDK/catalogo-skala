/* ============================================================
   Skala CRM v3 — Backend en Google Apps Script (Google Sheets)
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
var SESION_DIAS_APP = 30;   // la app Android recuerda la sesión 30 días (para actualizarse sola 8 am, 1 pm y 4 pm)
var MAX_INTENTOS = 5;
var BLOQUEO_SEG = 600;

var ROLES = ['master', 'admin', 'vendedor', 'despachador'];
/* Un usuario puede tener varios roles: en la hoja, separados por coma ("vendedor, despachador").
   Puede hacer todo lo de cada uno de sus roles. El "rol" principal es el de más rango. */
function rolesDe_(v) {
  var lista = Array.isArray(v) ? v : String(v === undefined || v === null ? '' : v).split(/[,;\/+]| y /);
  var set = {};
  lista.forEach(function (r) {
    var k = String(r).trim().toLowerCase().replace('administración', 'admin').replace('administracion', 'admin');
    if (ROLES.indexOf(k) !== -1) set[k] = 1;
  });
  return ROLES.filter(function (r) { return set[r]; });
}
function tiene_(ses, rol) { return !!ses && (ses.roles || rolesDe_(ses.rol)).indexOf(rol) !== -1; }
function tieneAlguno_(ses, lista) { return lista.some(function (r) { return tiene_(ses, r); }); }
function nombreRoles_(roles) { return roles.map(function (r) { return NOMBRE_ROL[r] || r; }).join(' · '); }
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

/* -------------------- Precios --------------------
   Hoja Precios: por producto, precio Menor y Mayor ($ por caja) + 3 descuentos en $ por caja.
   Nivel: Mayor desde CAJAS_MAYOR cajas (o excepción del vendedor). El descuento depende de cómo paga. */
var CAJAS_MAYOR = 15;
var PAGOS = [
  { id: 'credito', nombre: 'Crédito', credito: true, desc: '' },
  { id: 'pronto', nombre: 'Pronto pago', credito: false, desc: 'desc_pronto' },
  { id: 'efectivo_credito', nombre: 'Efectivo a crédito', credito: true, desc: 'desc_efectivo_credito' },
  { id: 'efectivo_pronto', nombre: 'Efectivo pronto pago', credito: false, desc: 'desc_efectivo_pronto' }
];
function pagoPorId_(id) { return PAGOS.filter(function (x) { return x.id === id; })[0] || null; }
/* Pedidos viejos (texto libre como "Divisas · Contado") -> tipo de pago */
function tipoPagoDe_(pago) {
  var t = String(pago || '').toLowerCase();
  var ef = /efectivo/.test(t), cred = /cr[eé]dito/.test(t);
  if (ef) return cred ? 'efectivo_credito' : 'efectivo_pronto';
  return cred ? 'credito' : 'pronto';
}
var r2_ = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
function numPrecio_(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? r2_(n) : 0; }
/* Productos que se precargan en Precios (mismos códigos que js/datos.js) */
var PRODUCTOS_BASE = [
  ['BC-01', 'Babosa'], ['BC-02', 'Banana e Macuri'], ['BC-03', 'Divino Potao'], ['BC-04', 'Divino Potinho Kids'],
  ['BC-05', 'Dona Skala'], ['BC-06', 'Mais Cachos'], ['BC-07', 'Mais Crespinhos'], ['BC-08', 'Mais Crespos'],
  ['BC-09', 'Mais Lisos'], ['BC-10', 'Potao de Amor'], ['BC-11', 'Potao Despaiado'],
  ['KT-01', 'Kit 12 em 1'], ['KT-02', 'Kit Aguacate'], ['KT-03', 'Kit Babosa'], ['KT-04', 'Kit Bomba de Vitaminas S.O.S'],
  ['KT-05', 'Kit Ceramidas'], ['KT-06', 'Kit Crespo Divino'], ['KT-07', 'Kit Mais Crespinhos'], ['KT-08', 'Kit Mais Cachos']
];
var ESTADOS_CON_STOCK = ['confirmado', 'en_ruta', 'entregado']; // aprobados: ya apartan mercancía
var GESTION = ['master', 'admin'];          // ven y corrigen todo
var TOMAN_PEDIDOS = ['master', 'admin', 'vendedor'];

var HOJAS = {
  Usuarios: ['id', 'usuario', 'nombre', 'rol', 'pin_hash', 'activo', 'created_at',
             'telefono'],   // WhatsApp del vendedor: los clientes le mandan su pedido desde el catálogo
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
            'monto', 'moneda',
            'nivel_precio', 'excepcion_precio', 'tipo_pago', 'total', 'tipo_pago_real', 'total_final',
            'web_id', 'borrado', 'borrado_motivo', 'borrado_por', 'borrado_at'],
  PedidoItems: ['pedido_id', 'code', 'producto', 'cajas', 'unidades_caja', 'unidad', 'total_unidades',
                'precio', 'desc_pronto', 'desc_efectivo_credito', 'desc_efectivo_pronto'],
  Historial: ['fecha', 'pedido_id', 'usuario', 'accion', 'detalle'],
  // Precios FINALES en $ por caja de cada forma de pago, al por menor y al mayor (15+ cajas):
  //   menor · pronto · efectivo_credito · efectivo_pronto   |   mayor · mayor_pronto · mayor_efectivo_credito · mayor_efectivo_pronto
  // Si falta un precio al mayor, se le aplica la misma rebaja que al por menor.
  // Productos nuevos: datos para el catálogo (tipo banos/kits, línea, beneficio, cabello, unidades, imagen).
  Precios: ['code', 'producto', 'menor', 'mayor', 'pronto', 'efectivo_credito', 'efectivo_pronto', 'updated_at', 'updated_por',
            'tipo', 'linea', 'beneficio', 'cabello', 'unidades_caja', 'imagen',
            'mayor_pronto', 'mayor_efectivo_credito', 'mayor_efectivo_pronto'],
  // Entradas de mercancía y ajustes (positivo o negativo). Lo aprobado se descuenta solo.
  Inventario: ['fecha', 'code', 'producto', 'cajas', 'tipo', 'nota', 'usuario'],
  // Pedidos que arma el cliente en el catálogo: esperan a que su vendedor los tome
  PedidosWeb: ['id', 'fecha', 'created_at', 'vendedor_id', 'vendedor', 'negocio', 'contacto', 'rif_cedula', 'telefono', 'direccion',
               'items', 'tipo_pago', 'total_cajas', 'total', 'nota', 'estado', 'pedido_id', 'atendido_por', 'atendido_at', 'motivo',
               'cliente_id', 'latitud', 'longitud'],
  // Ajustes de la app Android (versión y enlaces de actualización)
  Config: ['clave', 'valor', 'nota']
};

/* -------------------- Entradas HTTP -------------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return json_({ ok: true, app: 'skala-crm', version: 3, claves: true, precios: true });
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
  catalogo: [accionCatalogo_, null],          // precios (público); con sesión también existencias
  vendedores: [accionVendedores_, null],      // para que el cliente elija su vendedor
  pedidoWeb: [accionPedidoWeb_, null],        // el cliente envía su pedido desde el catálogo
  buscarClienteWeb: [accionBuscarClienteWeb_, null], // el cliente se busca por su teléfono o RIF
  asignarVendedorWeb: [accionAsignarVendedorWeb_, null], // elige vendedor después de enviar
  pedidosWeb: [accionPedidosWeb_, TOMAN_PEDIDOS],
  descartarWeb: [accionDescartarWeb_, TOMAN_PEDIDOS],
  borrarPedido: [accionBorrarPedido_, TOMAN_PEDIDOS],
  sincronizar: [accionSincronizar_, ROLES],   // copia de los datos para el teléfono (app y sin señal)
  config: [accionConfig_, null],
  inventario: [accionInventario_, GESTION],
  movimiento: [accionMovimiento_, GESTION],
  guardarPrecio: [accionGuardarPrecio_, GESTION],
  guardarProducto: [accionGuardarProducto_, GESTION],
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
      if (!tieneAlguno_(ses, def[1])) return { ok: false, error: 'Tu usuario no tiene permiso para esto.', code: 'forbidden' };
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
  agregar_('Historial', { fecha: ahora_(), pedido_id: pedidoId, usuario: ses ? ses.nombre + ' (' + nombreRoles_(ses.roles || [ses.rol]) + ')' : '', accion: accion, detalle: detalle || '' });
}

function ahora_() { return new Date().toISOString(); }
function txt_(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200); }
function uuid_() { return Utilities.getUuid(); }
function esGestion_(ses) { return tieneAlguno_(ses, GESTION); }
function borrado_(x) { return x.borrado === true || String(x.borrado) === 'true'; }

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

function crearToken_(userId, largo) {
  var exp = Date.now() + (largo ? SESION_DIAS_APP * 24 : SESION_HORAS) * 3600 * 1000;
  var base = userId + '.' + exp;
  return base + '.' + firmar_(base);
}

function activo_(u) {
  var a = String(u.activo).toLowerCase();
  return u.activo === true || a === 'true' || a === '1' || a === 'si' || a === 'sí';
}

function usuarioPublico_(u) {
  var roles = rolesDe_(u.rol);
  return { id: String(u.id), usuario: String(u.usuario), nombre: String(u.nombre), rol: roles[0] || String(u.rol), roles: roles, rol_nombre: nombreRoles_(roles) || String(u.rol) };
}

/* El rol se lee de la hoja en cada llamada: cambios aplican al instante. */
function verificarToken_(token) {
  var partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  var base = partes[0] + '.' + partes[1];
  if (firmar_(base) !== partes[2]) return null;
  if (Number(partes[1]) < Date.now()) return null;
  var u = leer_('Usuarios').filter(function (x) { return String(x.id) === partes[0] && activo_(x); })[0];
  if (!u || !rolesDe_(u.rol).length) return null;
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
  return { ok: true, token: crearToken_(String(u.id), p.dispositivo === true), usuario: usuarioPublico_(u) };
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
/* Mismo teléfono escrito distinto: +58 424 7387202 · +584247387202 · 04247387202 · 0424-738.72.02
   → se comparan los últimos 10 números (4247387202). */
function telClave_(s) { var d = soloDigitos_(s); return d.length >= 10 ? d.slice(-10) : d; }
function mismoTel_(a, b) { var x = telClave_(a), y = telClave_(b); return x.length >= 7 && x === y; }
/* Mismo RIF / cédula escrito distinto: V-280725421 · v28072542-1 · V-28072542-1 · 280725421
   (sin letras, guiones ni puntos). También la cédula sin el dígito final del RIF: V-28072542 = V-28072542-1. */
function mismoRif_(a, b) {
  var x = soloDigitos_(a), y = soloDigitos_(b);
  if (x.length < 6 || y.length < 6) return false;
  if (x === y) return true;
  var largo = x.length > y.length ? x : y, corto = x.length > y.length ? y : x;
  return largo.length - corto.length === 1 && corto.length >= 7 && largo.slice(0, -1) === corto;
}

function accionClientes_(p) {
  var q = txt_(p.q, 60).toLowerCase();
  var qd = soloDigitos_(q);
  var lista = leer_('Clientes').filter(function (c) {
    if (String(c.deleted) === '1' || c.deleted === true) return false;
    if (!q) return true;
    var texto = [c.nombre, c.contacto, c.rif_cedula, c.direccion].join(' ').toLowerCase();
    if (texto.indexOf(q) !== -1) return true;
    if (qd.length >= 4) {
      // teléfono con o sin +58 / 0 adelante: se busca por sus últimos números
      var qt = telClave_(qd);
      var enTel = function (t) { return soloDigitos_(t).indexOf(qd) !== -1 || telClave_(t).indexOf(qt) !== -1; };
      return enTel(c.telefono) || enTel(c.telefono2) || soloDigitos_(c.rif_cedula).indexOf(qd) !== -1;
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
  if (!existente && tel.length >= 7) existente = todos.filter(function (x) { return mismoTel_(x.telefono, tel) || mismoTel_(x.telefono2, tel); })[0];
  if (!existente && rif.length >= 6) existente = todos.filter(function (x) { return mismoRif_(x.rif_cedula, rif); })[0];
  // Sin teléfono ni RIF: mismo nombre de negocio = mismo cliente (evita duplicar al traspasar)
  if (!existente && tel.length < 7 && rif.length < 6) {
    var n = datos.nombre.toLowerCase();
    existente = todos.filter(function (x) { return String(x.nombre).trim().toLowerCase() === n && String(x.deleted) !== '1'; })[0];
  }

  var t = ahora_();
  if (existente) {
    var actualizado = {};
    HOJAS.Clientes.forEach(function (k) { actualizado[k] = existente[k]; });
    // Teléfono nuevo de un cliente que ya tenía otro (ej. se lo encontró por su RIF): el de siempre
    // se conserva y el nuevo va a Teléfono 2. Solo al editar la ficha (lápiz) se reemplaza.
    if (!opciones.reemplazar && datos.telefono && String(existente.telefono || '').trim()) {
      var nuevoTel = datos.telefono;
      datos.telefono = '';
      if (!mismoTel_(existente.telefono, nuevoTel) && !mismoTel_(existente.telefono2, nuevoTel)) datos.telefono2 = nuevoTel;
      else if (datos.telefono2 && (mismoTel_(existente.telefono, datos.telefono2) || mismoTel_(existente.telefono2, datos.telefono2))) datos.telefono2 = '';
    }
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
  o.total = o.total === '' || o.total === undefined ? '' : Number(o.total);
  o.total_final = o.total_final === '' || o.total_final === undefined ? '' : Number(o.total_final);
  o.tipo_pago = String(o.tipo_pago || '') || tipoPagoDe_(o.pago);
  o.excepcion_precio = o.excepcion_precio === true || String(o.excepcion_precio) === 'true';
  o.items = items.filter(function (it) { return String(it.pedido_id) === String(ped.id); }).map(function (it) {
    return { code: it.code, producto: it.producto, cajas: Number(it.cajas), unidades_caja: it.unidades_caja === '' ? '' : Number(it.unidades_caja), unidad: it.unidad, total_unidades: it.total_unidades === '' ? '' : Number(it.total_unidades),
      precio: Number(it.precio) || 0, desc_pronto: Number(it.desc_pronto) || 0, desc_efectivo_credito: Number(it.desc_efectivo_credito) || 0, desc_efectivo_pronto: Number(it.desc_efectivo_pronto) || 0 };
  });
  return o;
}

/* -------------------- Precios e inventario -------------------- */
function tablaPrecios_() {
  var m = {};
  leer_('Precios').forEach(function (x) {
    var code = String(x.code).trim().toUpperCase();
    if (!code) return;
    var menor = numPrecio_(x.menor), mayor = numPrecio_(x.mayor);
    var baseMay = mayor || menor;
    // rebaja de cada forma de pago = normal − precio final (0 si no se cargó)
    var rebaja = function (v, base) { var n = numPrecio_(v); return n && base && n < base ? r2_(base - n) : 0; };
    var dp = rebaja(x.pronto, menor), dc = rebaja(x.efectivo_credito, menor), de = rebaja(x.efectivo_pronto, menor);
    // al mayor: su precio propio si se cargó; si no, la misma rebaja que al por menor
    var dm = function (v, d) { return numPrecio_(v) ? rebaja(v, baseMay) : d; };
    m[code] = { code: code, producto: String(x.producto), menor: menor, mayor: mayor,
      pronto: numPrecio_(x.pronto), efectivo_credito: numPrecio_(x.efectivo_credito), efectivo_pronto: numPrecio_(x.efectivo_pronto),
      mayor_pronto: numPrecio_(x.mayor_pronto), mayor_efectivo_credito: numPrecio_(x.mayor_efectivo_credito), mayor_efectivo_pronto: numPrecio_(x.mayor_efectivo_pronto),
      desc_pronto: dp, desc_efectivo_credito: dc, desc_efectivo_pronto: de,
      mayor_desc_pronto: dm(x.mayor_pronto, dp), mayor_desc_efectivo_credito: dm(x.mayor_efectivo_credito, dc), mayor_desc_efectivo_pronto: dm(x.mayor_efectivo_pronto, de),
      tipo: String(x.tipo || ''), linea: String(x.linea || ''), beneficio: String(x.beneficio || ''), cabello: String(x.cabello || ''),
      unidades_caja: Number(x.unidades_caja) || 0, imagen: String(x.imagen || ''), _fila: x._fila, _crudo: x };
  });
  return m;
}

/* Pone precio (según nivel) y descuentos a cada item. Si falta el precio Mayor se usa el Menor. */
function ponerPrecios_(items, precios, mayor) {
  items.forEach(function (it) {
    var pr = precios[it.code] || {};
    it.precio = mayor ? (pr.mayor || pr.menor || 0) : (pr.menor || 0);
    var pre = mayor ? 'mayor_desc_' : 'desc_';
    it.desc_pronto = pr[pre + 'pronto'] || 0;
    it.desc_efectivo_credito = pr[pre + 'efectivo_credito'] || 0;
    it.desc_efectivo_pronto = pr[pre + 'efectivo_pronto'] || 0;
  });
  return items;
}

/* Total del pedido según cómo paga (el descuento nunca deja la caja por debajo de 0) */
function totalPorPago_(items, tipo) {
  var pg = pagoPorId_(tipo) || PAGOS[0];
  return r2_(items.reduce(function (a, it) {
    var unit = Number(it.precio) || 0;
    var d = pg.desc ? Number(it[pg.desc]) || 0 : 0;
    return a + (Number(it.cajas) || 0) * Math.max(0, unit - d);
  }, 0));
}

/* Existencias por producto. controlado = tiene al menos un movimiento cargado. */
function existencias_(pedidos, items) {
  var st = {};
  var de = function (code) { return st[code] || (st[code] = { code: code, cargado: 0, aprobado: 0, en_proceso: 0, controlado: false }); };
  leer_('Inventario').forEach(function (m) {
    var code = String(m.code).trim().toUpperCase();
    if (!code) return;
    var x = de(code); x.cargado += Math.round(Number(m.cajas) || 0); x.controlado = true;
  });
  var estado = {};
  (pedidos || leer_('Pedidos')).forEach(function (p) { if (!borrado_(p)) estado[String(p.id)] = String(p.estado); });
  (items || leer_('PedidoItems')).forEach(function (it) {
    var e = estado[String(it.pedido_id)];
    if (!e) return;
    var x = de(String(it.code).toUpperCase());
    if (ESTADOS_CON_STOCK.indexOf(e) !== -1) x.aprobado += Number(it.cajas) || 0;
    else if (e === 'pendiente') x.en_proceso += Number(it.cajas) || 0;
  });
  Object.keys(st).forEach(function (k) { st[k].disponible = st[k].cargado - st[k].aprobado; });
  return st;
}

/* Revisa que alcance el stock. Devuelve '' o el mensaje con lo que falta. */
function faltaStock_(items, stock) {
  var faltan = [];
  items.forEach(function (it) {
    var s = stock[String(it.code).toUpperCase()];
    if (s && s.controlado && Number(it.cajas) > s.disponible) faltan.push(it.producto + ' (' + it.code + '): pediste ' + it.cajas + ', hay ' + Math.max(0, s.disponible));
  });
  return faltan.length ? 'Sin stock suficiente: ' + faltan.join(' · ') : '';
}

function accionCatalogo_(p) {
  var ses = p.token ? verificarToken_(p.token) : null;
  var precios = tablaPrecios_();
  var stock = existencias_();
  var codes = {};
  PRODUCTOS_BASE.forEach(function (b) { codes[b[0]] = b[1]; });
  Object.keys(precios).forEach(function (k) { codes[k] = codes[k] || precios[k].producto; });
  var productos = Object.keys(codes).sort().map(function (code) {
    var pr = precios[code] || {}, s = stock[code];
    var o = { code: code, menor: pr.menor || 0, mayor: pr.mayor || pr.menor || 0, desc_pronto: pr.desc_pronto || 0,
      desc_efectivo_credito: pr.desc_efectivo_credito || 0, desc_efectivo_pronto: pr.desc_efectivo_pronto || 0,
      mayor_desc_pronto: pr.mayor_desc_pronto || 0, mayor_desc_efectivo_credito: pr.mayor_desc_efectivo_credito || 0, mayor_desc_efectivo_pronto: pr.mayor_desc_efectivo_pronto || 0,
      agotado: !!(s && s.controlado && s.disponible <= 0) };
    if (!esBase_(code) && pr.tipo) o.info = infoProducto_(pr);
    if (ses) { o.controlado = !!(s && s.controlado); o.disponible = s && s.controlado ? Math.max(0, s.disponible) : null; o.en_proceso = s ? s.en_proceso : 0; }
    return o;
  });
  return { ok: true, actualizado: ahora_(), cajas_mayor: CAJAS_MAYOR, pagos: PAGOS.map(function (x) { return { id: x.id, nombre: x.nombre, credito: x.credito, desc: x.desc }; }), productos: productos };
}

function esBase_(code) { return PRODUCTOS_BASE.some(function (b) { return b[0] === code; }); }
/* Datos de un producto nuevo para el catálogo (los de siempre están en js/datos.js) */
function infoProducto_(pr) {
  return { nombre: pr.producto, tipo: pr.tipo === 'kits' ? 'kits' : 'banos', linea: pr.linea, beneficio: pr.beneficio,
    cabello: pr.cabello || '1A–4C', unidades: pr.unidades_caja || 6, imagen: /^https:\/\//.test(pr.imagen) ? pr.imagen : '' };
}

function accionInventario_(p) {
  var precios = tablaPrecios_();
  var stock = existencias_();
  var movs = leer_('Inventario').map(function (m) { return { fecha: String(m.fecha), code: String(m.code), producto: String(m.producto), cajas: Number(m.cajas) || 0, tipo: String(m.tipo), nota: String(m.nota), usuario: String(m.usuario) }; });
  movs.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
  var codes = {};
  PRODUCTOS_BASE.forEach(function (b) { codes[b[0]] = b[1]; });
  Object.keys(precios).forEach(function (k) { codes[k] = codes[k] || precios[k].producto; });
  Object.keys(stock).forEach(function (k) { codes[k] = codes[k] || k; });
  return { ok: true, productos: Object.keys(codes).sort().map(function (code) {
    var s = stock[code] || { cargado: 0, aprobado: 0, en_proceso: 0, disponible: 0, controlado: false };
    var pr = precios[code] || {};
    return { code: code, producto: (precios[code] && precios[code].producto) || codes[code], cargado: s.cargado, aprobado: s.aprobado, en_proceso: s.en_proceso, disponible: s.disponible, controlado: s.controlado,
      menor: pr.menor || 0, mayor: pr.mayor || 0, pronto: pr.pronto || 0, efectivo_credito: pr.efectivo_credito || 0, efectivo_pronto: pr.efectivo_pronto || 0,
      mayor_pronto: pr.mayor_pronto || 0, mayor_efectivo_credito: pr.mayor_efectivo_credito || 0, mayor_efectivo_pronto: pr.mayor_efectivo_pronto || 0,
      nuevo: !esBase_(code), info: !esBase_(code) && pr.tipo ? infoProducto_(pr) : null };
  }), movimientos: movs.slice(0, Math.min(Math.max(Number(p.limite) || 50, 1), 500)) };
}

/* Entrada de mercancía (cajas > 0) o ajuste (+/-, con nota) */
function accionMovimiento_(p, ses) {
  var code = txt_(p.code, 20).toUpperCase();
  var cajas = Math.round(Number(p.cajas));
  var tipo = p.tipo === 'ajuste' ? 'ajuste' : 'entrada';
  var nota = txt_(p.nota, 200);
  if (!code) return { ok: false, error: 'Elegí el producto.', code: 'producto' };
  if (!isFinite(cajas) || cajas === 0 || Math.abs(cajas) > 100000) return { ok: false, error: 'Indicá la cantidad de cajas.', code: 'cajas' };
  if (tipo === 'entrada' && cajas < 0) return { ok: false, error: 'Una entrada debe ser mayor que 0. Para restar usá Ajuste.', code: 'cajas' };
  if (tipo === 'ajuste' && !nota) return { ok: false, error: 'Indicá el motivo del ajuste.', code: 'nota' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var base = {}; PRODUCTOS_BASE.forEach(function (b) { base[b[0]] = b[1]; });
    var pr = tablaPrecios_()[code];
    var nombre = (pr && pr.producto) || base[code] || txt_(p.producto, 120) || code;
    agregar_('Inventario', { fecha: ahora_(), code: code, producto: nombre, cajas: cajas, tipo: tipo, nota: nota, usuario: ses.nombre });
    var s = existencias_()[code];
    return { ok: true, disponible: s ? s.disponible : cajas };
  } finally {
    lock.releaseLock();
  }
}

var CAMPOS_PRECIO = ['menor', 'pronto', 'efectivo_credito', 'efectivo_pronto', 'mayor', 'mayor_pronto', 'mayor_efectivo_credito', 'mayor_efectivo_pronto'];
/* Valida los 5 precios finales. Devuelve { vals } o { error } */
function preciosValidos_(p) {
  var vals = {};
  for (var i = 0; i < CAMPOS_PRECIO.length; i++) {
    var v = p[CAMPOS_PRECIO[i]];
    var n = v === '' || v === undefined || v === null ? 0 : Number(String(v).replace(',', '.'));
    if (!isFinite(n) || n < 0 || n > 1e7) return { error: 'Revisá los montos (números de 0 en adelante).' };
    vals[CAMPOS_PRECIO[i]] = r2_(n);
  }
  if (!vals.menor) return { error: 'Falta el precio normal (al por menor).' };
  if (vals.mayor > vals.menor) return { error: 'El precio al mayor no puede ser más alto que el normal.' };
  var nombres = { pronto: 'pronto pago', efectivo_credito: 'efectivo a crédito', efectivo_pronto: 'efectivo pronto pago' };
  for (var k in nombres) if (vals[k] > vals.menor) return { error: 'El precio de ' + nombres[k] + ' no puede ser más alto que el normal.' };
  var baseMay = vals.mayor || vals.menor;
  for (var k2 in nombres) if (vals['mayor_' + k2] > baseMay) return { error: 'Al mayor, el precio de ' + nombres[k2] + ' no puede ser más alto que el normal al mayor.' };
  return { vals: vals };
}

/* Guarda los mismos precios a uno o varios productos (code o codes[]) */
function accionGuardarPrecio_(p, ses) {
  var codes = (Array.isArray(p.codes) ? p.codes : [p.code]).map(function (c) { return txt_(c, 20).toUpperCase(); }).filter(Boolean);
  if (!codes.length) return { ok: false, error: 'Elegí el producto.', code: 'producto' };
  var v = preciosValidos_(p);
  if (v.error) return { ok: false, error: v.error, code: 'precio' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tabla = tablaPrecios_();
    var base = {}; PRODUCTOS_BASE.forEach(function (b) { base[b[0]] = b[1]; });
    var guardados = codes.map(function (code) {
      var previa = tabla[code] ? tabla[code]._crudo : {};
      var fila = {};
      HOJAS.Precios.forEach(function (c) { fila[c] = previa[c] === undefined ? '' : previa[c]; });
      fila.code = code;
      fila.producto = (tabla[code] && tabla[code].producto) || base[code] || txt_(p.producto, 120) || code;
      CAMPOS_PRECIO.forEach(function (c) { fila[c] = v.vals[c]; });
      fila.updated_at = ahora_(); fila.updated_por = ses.nombre;
      if (tabla[code]) actualizar_('Precios', tabla[code]._fila, fila); else agregar_('Precios', fila);
      return fila;
    });
    return { ok: true, precio: guardados[0], guardados: guardados.length };
  } finally {
    lock.releaseLock();
  }
}

/* Producto nuevo (o editar uno nuevo): sale en el catálogo y en el panel. Empieza sin stock
   (controlado): aparece en gris hasta que se cargue una entrada de mercancía. */
function accionGuardarProducto_(p, ses) {
  var tipo = p.tipo === 'kits' ? 'kits' : 'banos';
  var nombre = txt_(p.nombre, 80);
  if (!nombre) return { ok: false, error: 'Falta el nombre del producto.', code: 'producto' };
  var unidades = Math.floor(Number(p.unidades_caja) || 6);
  if (unidades < 1 || unidades > 200) return { ok: false, error: 'Revisá las unidades por caja.', code: 'producto' };
  var imagen = txt_(p.imagen, 400);
  if (imagen && !/^https:\/\//.test(imagen)) return { ok: false, error: 'La imagen debe ser un enlace que empiece con https://', code: 'producto' };
  var v = null;
  if (p.menor !== undefined && p.menor !== '' && p.menor !== null) {
    v = preciosValidos_(p);
    if (v.error) return { ok: false, error: v.error, code: 'precio' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tabla = tablaPrecios_();
    var code = txt_(p.code, 20).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (code && esBase_(code)) return { ok: false, error: 'Ese código es de un producto de siempre: elegí otro.', code: 'producto' };
    var editar = !!(code && tabla[code] && p.editar);
    if (code && tabla[code] && !p.editar) return { ok: false, error: 'Ya existe un producto con el código ' + code + '.', code: 'producto' };
    if (!code) {
      // siguiente código libre: BC-12, BC-13… o KT-09…
      var pref = tipo === 'kits' ? 'KT-' : 'BC-';
      var max = 0;
      PRODUCTOS_BASE.map(function (b) { return b[0]; }).concat(Object.keys(tabla)).forEach(function (c) {
        if (c.indexOf(pref) === 0) max = Math.max(max, Number(c.slice(3)) || 0);
      });
      code = pref + (max + 1 < 10 ? '0' : '') + (max + 1);
    }
    var previa = editar ? tabla[code]._crudo : {};
    var fila = {};
    HOJAS.Precios.forEach(function (c) { fila[c] = previa[c] === undefined ? '' : previa[c]; });
    fila.code = code; fila.producto = nombre; fila.tipo = tipo; fila.linea = txt_(p.linea, 40); fila.beneficio = txt_(p.beneficio, 200);
    fila.cabello = txt_(p.cabello, 20) || '1A–4C'; fila.unidades_caja = unidades; fila.imagen = imagen;
    if (v) CAMPOS_PRECIO.forEach(function (c) { fila[c] = v.vals[c]; });
    fila.updated_at = ahora_(); fila.updated_por = ses.nombre;
    if (editar) actualizar_('Precios', tabla[code]._fila, fila);
    else {
      agregar_('Precios', fila);
      // alta con 0 cajas: el stock se controla desde el primer día
      agregar_('Inventario', { fecha: ahora_(), code: code, producto: nombre, cajas: 0, tipo: 'alta', nota: 'Producto nuevo', usuario: ses.nombre });
    }
    return { ok: true, producto: { code: code, info: infoProducto_(tablaPrecios_()[code]) } };
  } finally {
    lock.releaseLock();
  }
}

function accionGuardarPedido_(p, ses) {
  var items = limpiarItems_(p.items);
  if (!items.length) return { ok: false, error: 'El pedido no tiene productos.', code: 'empty' };
  var documento = txt_(p.documento, 30);
  if (DOCUMENTOS.indexOf(documento) === -1) return { ok: false, error: 'Indicá si el cliente quiere nota de entrega o factura.', code: 'documento' };
  // Tipo de pago (nuevo) o texto libre (versiones anteriores / sin señal)
  var tipoPago = pagoPorId_(String(p.tipo_pago || '')) ? String(p.tipo_pago) : tipoPagoDe_(p.pago);
  var pagoDef = pagoPorId_(tipoPago);
  var pagoTexto = p.tipo_pago ? pagoDef.nombre : (txt_(p.pago, 40) || pagoDef.nombre);
  // Crédito: hay que indicar los días (se cuentan desde la entrega)
  var diasCredito = 0;
  if (pagoDef.credito) {
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
    // Pedido web que el vendedor toma (lo pudo editar antes de enviarlo a Administración)
    var web = null;
    if (p.web_id) {
      web = leer_('PedidosWeb').filter(function (w) { return String(w.id) === String(p.web_id); })[0];
      if (!web) return { ok: false, error: 'Ese pedido web no existe.', code: 'not_found' };
      if (String(web.estado) !== 'nuevo') return { ok: false, error: 'Ese pedido web ya fue ' + (String(web.estado) === 'tomado' ? 'tomado (' + web.pedido_id + ')' : 'descartado') + '.', code: 'web' };
      if (!puedeTomarWeb_(ses, web)) return { ok: false, error: 'Este pedido web es de ' + web.vendedor + '. Solo su vendedor (o el Master) lo puede tomar.', code: 'forbidden' };
    }
    var pItems = leer_('PedidoItems');
    var sinStock = faltaStock_(items, existencias_(pedidos, pItems));
    if (sinStock) return { ok: false, error: sinStock, code: 'stock' };
    var cliente;
    try { cliente = guardarCliente_(p.cliente || {}, ses); }
    catch (err) { return { ok: false, error: err.message, code: 'cliente' }; }

    var totalCajas = items.reduce(function (a, it) { return a + it.cajas; }, 0);
    var excepcion = p.precio_mayor === true && totalCajas < CAJAS_MAYOR;
    var mayor = totalCajas >= CAJAS_MAYOR || excepcion;
    ponerPrecios_(items, tablaPrecios_(), mayor);
    var t = ahora_();
    var ped = {
      id: nuevoIdPedido_(pedidos),
      fecha: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      vendedor_id: ses.id, vendedor: ses.nombre,
      cliente_id: cliente.id, cliente: cliente.contacto || cliente.nombre, negocio: cliente.nombre,
      total_cajas: totalCajas,
      detalle_unidades: detalleUnidades_(items),
      pago: pagoTexto, tipo_pago: tipoPago, nivel_precio: mayor ? 'mayor' : 'menor', excepcion_precio: excepcion,
      total: totalPorPago_(items, tipoPago),
      nota: txt_(p.nota, 300), documento: documento,
      dias_credito: diasCredito, cobro: '',
      estado: 'pendiente', estado_at: t, estado_por: ses.nombre, motivo: '',
      client_ref: ref, created_at: t, updated_at: t, web_id: web ? String(web.id) : ''
    };
    agregar_('Pedidos', ped);
    if (web) {
      web.estado = 'tomado'; web.pedido_id = ped.id; web.atendido_por = ses.nombre; web.atendido_at = t;
      actualizar_('PedidosWeb', web._fila, web);
    }
    var filas = items.map(function (it) { it.pedido_id = ped.id; return filaDe_('PedidoItems', it); });
    var hItems = hoja_('PedidoItems');
    hItems.getRange(hItems.getLastRow() + 1, 1, filas.length, HOJAS.PedidoItems.length).setValues(filas);
    historial_(ped.id, ses, 'creado', ped.total_cajas + ' cajas · ' + ped.negocio + (ped.total ? ' · ' + ped.total + ' $ (' + pagoTexto + ')' : '') + (excepcion ? ' · precio mayor por excepción' : '') + (web ? ' · desde pedido web ' + web.id : ''));
    return { ok: true, pedido: pedidoConItems_(ped, items), cliente_id: cliente.id, cliente: clientePublico_(cliente) };
  } finally {
    lock.releaseLock();
  }
}

/* ¿Puede este usuario ver el pedido? Los borrados no los ve nadie (quedan en la hoja). */
function puedeVer_(ses, x) {
  if (borrado_(x)) return false;
  if (esGestion_(ses)) return true;
  if (tiene_(ses, 'vendedor') && String(x.vendedor_id) === ses.id) return true;
  if (tiene_(ses, 'despachador') && String(x.despachador_id) === ses.id && ['confirmado', 'en_ruta', 'entregado'].indexOf(String(x.estado)) !== -1) return true;
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
    // Cómo pagó de verdad (puede cambiar el descuento: ej. era crédito y pagó en efectivo al contado)
    var real = pagoPorId_(String(p.tipo_pago_real || ''));
    var ponerReal = function () {
      var tipo = real ? real.id : (String(ped.tipo_pago_real || '') || String(ped.tipo_pago || '') || tipoPagoDe_(ped.pago));
      var its = pedidoConItems_(ped, leer_('PedidoItems')).items;
      var antes = String(ped.tipo_pago_real || ped.tipo_pago || tipoPagoDe_(ped.pago));
      ped.tipo_pago_real = tipo;
      ped.total_final = its.some(function (it) { return it.precio; }) ? totalPorPago_(its, tipo) : '';
      return tipo !== antes ? 'Pagó como ' + pagoPorId_(tipo).nombre + (ped.total_final !== '' ? ' (total ' + ped.total_final + ' $)' : '') + ' · ' : '';
    };
    if (accion === 'cancelar') {
      if (cobro) return { ok: false, error: 'Ese pedido ya figura como ' + (cobro === 'conciliado' ? 'conciliado' : 'cancelado') + '.', code: 'repetido' };
      if (!monto || !moneda) return { ok: false, error: 'Indicá cuánto cobraste y en qué moneda.', code: 'monto' };
      ped.cobro = 'cancelado'; ped.cobrado_at = t; ped.cobrado_por = ses.nombre;
      ped.monto = monto; ped.moneda = moneda; detalle = ponerReal() + monto + ' ' + moneda;
    } else if (!gestion) {
      return { ok: false, error: 'Solo Administración verifica y concilia los pagos.', code: 'forbidden' };
    } else if (accion === 'conciliar') {
      if (cobro === 'conciliado') return { ok: false, error: 'Ese pago ya está conciliado.', code: 'repetido' };
      // Administración confirma (o corrige) el monto recibido
      if (monto && moneda) { ped.monto = monto; ped.moneda = moneda; }
      if (!montoValido_(ped.monto) || MONEDAS.indexOf(String(ped.moneda)) === -1) return { ok: false, error: 'Indicá el monto recibido y la moneda.', code: 'monto' };
      if (!cobro) { ped.cobrado_at = t; ped.cobrado_por = ses.nombre; } // Administración recibió el pago directo
      var cambio = (real || !cobro) ? ponerReal() : '';
      ped.cobro = 'conciliado'; ped.conciliado_at = t; ped.conciliado_por = ses.nombre;
      detalle = cambio + Number(ped.monto) + ' ' + ped.moneda;
    } else if (accion === 'rechazar') {
      if (cobro !== 'cancelado') return { ok: false, error: 'Solo se rechaza un pago reportado como cancelado.', code: 'estado' };
      detalle = txt_(p.motivo, 200);
      if (!detalle) return { ok: false, error: 'Indicá por qué no se recibió el pago.', code: 'motivo' };
      ped.cobro = ''; ped.cobrado_at = ''; ped.cobrado_por = ''; ped.monto = ''; ped.moneda = ''; ped.tipo_pago_real = ''; ped.total_final = '';
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

/* Reglas de cambio de estado. Con varios roles basta con que uno lo permita.
   Devuelve '' si se permite, o el motivo del rechazo. */
function reglaEstado_(ses, ped, nuevo) {
  if (String(ped.estado) === nuevo) return 'El pedido ya está en ese estado.';
  var roles = ses.roles || rolesDe_(ses.rol);
  var motivo = 'Sin permiso.';
  for (var i = 0; i < roles.length; i++) {
    var m = reglaRol_(roles[i], ses, ped, nuevo);
    if (!m) return '';
    if (i === 0) motivo = m;
  }
  return motivo;
}
function reglaRol_(rol, ses, ped, nuevo) {
  var actual = String(ped.estado);
  if (GESTION.indexOf(rol) !== -1) {
    if (nuevo === 'confirmado' && actual !== 'pendiente' && actual !== 'en_ruta') return 'Solo se aprueba un pedido en proceso.';
    return '';
  }
  if (rol === 'vendedor') {
    if (String(ped.vendedor_id) !== ses.id) return 'Este pedido es de otro vendedor.';
    if (nuevo === 'cancelado' && actual === 'pendiente') return '';
    return 'Como vendedor solo podés anular tus pedidos en proceso.';
  }
  if (rol === 'despachador') {
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
    // Aprobar aparta la mercancía: tiene que alcanzar el stock
    if (nuevo === 'confirmado' && !reasignar && String(ped.estado) === 'pendiente') {
      var todos = leer_('Pedidos'), its = leer_('PedidoItems');
      var mios = its.filter(function (it) { return String(it.pedido_id) === String(ped.id); }).map(function (it) { return { code: String(it.code), producto: String(it.producto), cajas: Number(it.cajas) }; });
      var falta = faltaStock_(mios, existencias_(todos, its));
      if (falta) return { ok: false, error: falta, code: 'stock' };
    }
    // Confirmar (o reasignar) exige despachador activo
    if (nuevo === 'confirmado' || reasignar) {
      var dId = txt_(p.despachador_id || ped.despachador_id, 40);
      var d = leer_('Usuarios').filter(function (u) { return String(u.id) === dId && rolesDe_(u.rol).indexOf('despachador') !== -1 && activo_(u); })[0];
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
  var lista = leer_('Usuarios').filter(function (u) { return rolesDe_(u.rol).indexOf('despachador') !== -1 && activo_(u); })
    .map(function (u) { return { id: String(u.id), nombre: String(u.nombre) }; });
  return { ok: true, despachadores: lista };
}

/* -------------------- Pedidos web (los arma el cliente en el catálogo) -------------------- */
var WEB_MAX_HORA = 5; // por teléfono, para frenar abusos
/* Lo toma su vendedor (o el Master). Sin vendedor elegido, cualquier vendedor lo puede tomar. */
function puedeTomarWeb_(ses, w) {
  return tiene_(ses, 'master') || (tiene_(ses, 'vendedor') && (String(w.vendedor_id) === ses.id || !String(w.vendedor_id || '')));
}
/* "0424-7387202" / "+58 424…" → "584247387202" (para wa.me). Vacío si no parece válido. */
function telWhatsapp_(t) {
  var d = soloDigitos_(t);
  if (d.indexOf('58') === 0 && d.length >= 12) d = d.slice(2);
  if (d.charAt(0) === '0') d = d.slice(1);
  return d.length === 10 ? '58' + d : '';
}

function accionVendedores_() {
  var lista = leer_('Usuarios').filter(function (u) { return rolesDe_(u.rol).indexOf('vendedor') !== -1 && activo_(u); })
    .map(function (u) { return { id: String(u.id), nombre: String(u.nombre), whatsapp: telWhatsapp_(u.telefono) }; });
  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return { ok: true, vendedores: lista };
}

/* El cliente del catálogo se busca por su teléfono o RIF (exacto, no por nombre) para no
   tener que escribir sus datos de nuevo. Solo devuelve lo necesario para el pedido. */
var BUSQ_MAX_MIN = 30;
function accionBuscarClienteWeb_(p) {
  var q = soloDigitos_(p.q);
  if (q.length < 6) return { ok: false, error: 'Escribí tu teléfono o RIF completo.', code: 'corto' };
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('busq_web') || 0);
  if (n >= BUSQ_MAX_MIN) return { ok: false, error: 'Muchas búsquedas. Probá en un minuto.', code: 'limite' };
  cache.put('busq_web', String(n + 1), 60);
  var porTel = false;
  var vivos = leer_('Clientes').filter(function (x) { return !(String(x.deleted) === '1' || x.deleted === true); });
  // primero por teléfono; si no, por RIF / cédula
  var c = vivos.filter(function (x) { return mismoTel_(x.telefono, q) || mismoTel_(x.telefono2, q); })[0];
  if (c) porTel = true;
  else c = vivos.filter(function (x) { return mismoRif_(x.rif_cedula, q); })[0];
  if (!c) return { ok: true, cliente: null };
  // el teléfono solo se devuelve si lo escribió él (búsqueda por teléfono)
  return { ok: true, cliente: { id: String(c.id), negocio: String(c.nombre), contacto: String(c.contacto), direccion: String(c.direccion),
    rif_cedula: String(c.rif_cedula), telefono: porTel ? String(c.telefono) : '', ubicacion: c.latitud !== '' && c.longitud !== '' } };
}

function accionPedidoWeb_(p) {
  var c = p.cliente || {};
  var datos = { negocio: txt_(c.negocio, 120), contacto: txt_(c.contacto, 120), rif_cedula: txt_(c.rif_cedula || c.rif, 30).toUpperCase(),
    telefono: txt_(c.telefono, 30), direccion: txt_(c.direccion, 250) };
  if (!datos.negocio && !datos.contacto) return { ok: false, error: 'Escribí tu nombre o el de tu negocio.', code: 'cliente' };
  if (soloDigitos_(datos.telefono).length < 7) return { ok: false, error: 'Escribí tu teléfono (para que el vendedor te contacte).', code: 'telefono' };
  var items = limpiarItems_(p.items);
  if (!items.length) return { ok: false, error: 'El pedido no tiene productos.', code: 'empty' };
  // el vendedor es opcional: el cliente puede elegirlo después (o lo toma cualquier vendedor)
  var v = null;
  if (p.vendedor_id) {
    v = leer_('Usuarios').filter(function (u) { return String(u.id) === String(p.vendedor_id) && rolesDe_(u.rol).indexOf('vendedor') !== -1 && activo_(u); })[0];
    if (!v) return { ok: false, error: 'Ese vendedor no está disponible.', code: 'vendedor' };
  }
  var ref = txt_(p.ref, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!/^WEB-[A-Z0-9]{4,12}$/.test(ref)) ref = 'WEB-' + uuid_().replace(/-/g, '').slice(0, 8).toUpperCase();
  var cache = CacheService.getScriptCache();
  var claveTel = 'web_' + soloDigitos_(datos.telefono);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var todos = leer_('PedidosWeb');
    var previo = todos.filter(function (w) { return String(w.id) === ref; })[0];
    if (previo) return { ok: true, duplicado: true, id: ref };
    var n = Number(cache.get(claveTel) || 0);
    if (n >= WEB_MAX_HORA) return { ok: false, error: 'Ya enviaste varios pedidos. Esperá un rato o escribinos por WhatsApp.', code: 'limite' };
    cache.put(claveTel, String(n + 1), 3600);
    var totalCajas = items.reduce(function (a, it) { return a + it.cajas; }, 0);
    ponerPrecios_(items, tablaPrecios_(), totalCajas >= CAJAS_MAYOR);
    var tipo = pagoPorId_(String(p.tipo_pago || '')) ? String(p.tipo_pago) : 'credito';
    var t = ahora_();
    agregar_('PedidosWeb', { id: ref, fecha: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), created_at: t,
      vendedor_id: v ? String(v.id) : '', vendedor: v ? String(v.nombre) : '', negocio: datos.negocio || datos.contacto, contacto: datos.contacto,
      rif_cedula: datos.rif_cedula, telefono: datos.telefono, direccion: datos.direccion,
      items: JSON.stringify(items.map(function (it) { return { code: it.code, producto: it.producto, cajas: it.cajas, unidades_caja: it.unidades_caja, unidad: it.unidad }; })),
      tipo_pago: tipo, total_cajas: totalCajas, total: totalPorPago_(items, tipo), nota: txt_(p.nota, 300), estado: 'nuevo',
      cliente_id: txt_(c.cliente_id || c.id, 60), latitud: numeroGps_(c.latitud, -90, 90), longitud: numeroGps_(c.longitud, -180, 180) });
    return { ok: true, id: ref };
  } finally {
    lock.releaseLock();
  }
}

function webPublico_(w, precios) {
  var items = [];
  try { items = JSON.parse(String(w.items || '[]')); } catch (e) { items = []; }
  items = limpiarItems_(items);
  var cajas = items.reduce(function (a, it) { return a + it.cajas; }, 0);
  ponerPrecios_(items, precios, cajas >= CAJAS_MAYOR);
  return { id: String(w.id), fecha: String(w.fecha), created_at: String(w.created_at), vendedor_id: String(w.vendedor_id), vendedor: String(w.vendedor),
    cliente: { id: String(w.cliente_id || ''), negocio: String(w.negocio), contacto: String(w.contacto), rif_cedula: String(w.rif_cedula), telefono: String(w.telefono), direccion: String(w.direccion),
      latitud: w.latitud === '' || w.latitud === undefined ? '' : Number(w.latitud), longitud: w.longitud === '' || w.longitud === undefined ? '' : Number(w.longitud) },
    items: items, tipo_pago: String(w.tipo_pago) || 'credito', total_cajas: cajas, nota: String(w.nota), estado: String(w.estado),
    pedido_id: String(w.pedido_id), atendido_por: String(w.atendido_por), motivo: String(w.motivo) };
}

/* Después de enviar, el cliente elige a qué vendedor mandárselo por WhatsApp: queda asignado
   (solo si todavía no tenía vendedor y nadie lo tomó). */
function accionAsignarVendedorWeb_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var w = leer_('PedidosWeb').filter(function (x) { return String(x.id) === String(p.id).toUpperCase(); })[0];
    if (!w) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
    var v = leer_('Usuarios').filter(function (u) { return String(u.id) === String(p.vendedor_id) && rolesDe_(u.rol).indexOf('vendedor') !== -1 && activo_(u); })[0];
    if (!v) return { ok: false, error: 'Ese vendedor no está disponible.', code: 'vendedor' };
    if (String(w.estado) !== 'nuevo' || (String(w.vendedor_id || '') && String(w.vendedor_id) !== String(v.id))) return { ok: true, sin_cambios: true };
    w.vendedor_id = String(v.id); w.vendedor = String(v.nombre);
    actualizar_('PedidosWeb', w._fila, w);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* Vendedor: los suyos y los que no tienen vendedor. Administración y Master: todos (Administración los ve, pero no los toma). */
function accionPedidosWeb_(p, ses) {
  var precios = tablaPrecios_();
  var estado = p.estado === 'todos' ? '' : 'nuevo';
  var lista = leer_('PedidosWeb').filter(function (w) {
    if (estado && String(w.estado) !== estado) return false;
    return esGestion_(ses) || String(w.vendedor_id) === ses.id || (tiene_(ses, 'vendedor') && !String(w.vendedor_id || ''));
  });
  lista.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  return { ok: true, pedidos: lista.slice(0, 200).map(function (w) { var o = webPublico_(w, precios); o.puede_tomar = puedeTomarWeb_(ses, w); return o; }) };
}

function accionDescartarWeb_(p, ses) {
  var motivo = txt_(p.motivo, 200);
  if (!motivo) return { ok: false, error: 'Indicá el motivo.', code: 'motivo' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var w = leer_('PedidosWeb').filter(function (x) { return String(x.id) === String(p.id); })[0];
    if (!w || (!esGestion_(ses) && String(w.vendedor_id) !== ses.id)) return { ok: false, error: 'Pedido web no encontrado.', code: 'not_found' };
    if (!puedeTomarWeb_(ses, w)) return { ok: false, error: 'Solo su vendedor (o el Master) lo puede descartar.', code: 'forbidden' };
    if (String(w.estado) !== 'nuevo') return { ok: false, error: 'Ese pedido web ya fue atendido.', code: 'web' };
    w.estado = 'descartado'; w.motivo = motivo; w.atendido_por = ses.nombre; w.atendido_at = ahora_();
    actualizar_('PedidosWeb', w._fila, w);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* Borrar un pedido (ej. uno de prueba). Vendedor: los suyos · Master: cualquiera.
   No se pierde: queda en la hoja marcado como borrado y en el Historial. Sale de listas, totales y stock. */
function accionBorrarPedido_(p, ses) {
  var motivo = txt_(p.motivo, 200);
  if (!motivo) return { ok: false, error: 'Indicá por qué se borra.', code: 'motivo' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ped = leer_('Pedidos').filter(function (x) { return String(x.id) === String(p.pedido_id); })[0];
    if (!ped || !puedeVer_(ses, ped)) return { ok: false, error: 'Pedido no encontrado.', code: 'not_found' };
    var propio = tiene_(ses, 'vendedor') && String(ped.vendedor_id) === ses.id;
    if (!propio && !tiene_(ses, 'master')) return { ok: false, error: 'Solo el vendedor del pedido o el Master pueden borrarlo.', code: 'forbidden' };
    var t = ahora_();
    ped.borrado = true; ped.borrado_motivo = motivo; ped.borrado_por = ses.nombre; ped.borrado_at = t; ped.updated_at = t;
    actualizar_('Pedidos', ped._fila, ped);
    historial_(ped.id, ses, 'borrado', motivo);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------- App Android: datos para el teléfono y ajustes -------------------- */
var CONFIG_BASE = [
  ['version_apk', 1, 'Número de la última versión de la app (versionCode). Subilo al publicar una APK nueva.'],
  ['url_apk', '', 'Enlace directo a la APK (ej. GitHub Releases).'],
  ['minima_apk', 1, 'Versión mínima permitida: las más viejas deben actualizar para seguir.'],
  ['version_pantallas', '', 'Versión del paquete de pantallas (ej. 2026.11.01). Vacío = las que trae la app.'],
  ['url_pantallas', '', 'Enlace directo al .zip de pantallas (ej. GitHub Releases).'],
  ['notas', '', 'Texto corto que verá el equipo en el aviso de actualización.']
];
function leerConfig_() {
  var o = {};
  CONFIG_BASE.forEach(function (c) { o[c[0]] = c[1]; });
  leer_('Config').forEach(function (x) { var k = String(x.clave).trim(); if (k) o[k] = x.valor; });
  return {
    version_apk: Number(o.version_apk) || 0, url_apk: String(o.url_apk || ''), minima_apk: Number(o.minima_apk) || 0,
    version_pantallas: String(o.version_pantallas || ''), url_pantallas: String(o.url_pantallas || ''), notas: String(o.notas || '')
  };
}
function accionConfig_() { return { ok: true, config: leerConfig_() }; }

/* Todo lo que el usuario necesita ver sin señal: precios y stock, clientes, sus pedidos y pedidos web */
function accionSincronizar_(p, ses) {
  var toma = tieneAlguno_(ses, TOMAN_PEDIDOS);
  var cat = accionCatalogo_({ token: p.token });
  var pedidos = accionPedidos_({ dias: 60 }, ses).pedidos;
  var porCobrar = toma ? accionPedidos_({ por_cobrar: true }, ses).pedidos : [];
  var vistos = {};
  var lista = [];
  pedidos.concat(porCobrar).forEach(function (x) { if (!vistos[x.id]) { vistos[x.id] = 1; lista.push(x); } });
  var clientes = [];
  if (toma) {
    clientes = leer_('Clientes').filter(function (c) { return !(String(c.deleted) === '1' || c.deleted === true); })
      .sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); })
      .slice(0, 3000).map(clientePublico_);
  }
  return { ok: true, fecha: ahora_(), usuario: ses, catalogo: { productos: cat.productos, pagos: cat.pagos, cajas_mayor: cat.cajas_mayor, actualizado: cat.actualizado },
    clientes: clientes, pedidos: lista, pedidos_web: toma ? accionPedidosWeb_({}, ses).pedidos : [],
    despachadores: esGestion_(ses) ? accionDespachadores_().despachadores : [], config: leerConfig_() };
}

/* -------------------- Resumen -------------------- */
function accionResumen_(p, ses) {
  var dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  var desde = new Date(Date.now() - dias * 86400000).toISOString();
  var pedidos = leer_('Pedidos').filter(function (x) {
    return !borrado_(x) && String(x.created_at) >= desde && (esGestion_(ses) || String(x.vendedor_id) === ses.id);
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
    o.telefono = String(u.telefono || '');
    return o;
  });
  return { ok: true, usuarios: lista };
}

function guardarUsuario_(d, ses) {
  var usuarios = leer_('Usuarios');
  var roles = rolesDe_(d.roles !== undefined ? d.roles : d.rol);
  if (!roles.length) throw new Error('Rol inválido.');
  var rol = roles[0]; // el de más rango (para la regla de la clave)
  var esMaster = roles.indexOf('master') !== -1;
  var eraMaster = function (u) { return rolesDe_(u.rol).indexOf('master') !== -1; };
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
  if (existente && eraMaster(existente) && activo_(existente) && (!esMaster || !activo)) {
    var otros = usuarios.filter(function (u) { return eraMaster(u) && activo_(u) && String(u.id) !== String(existente.id); });
    if (!otros.length) throw new Error('Debe quedar al menos un Master activo.');
  }
  var nueva = d.clave !== undefined ? d.clave : d.pin;
  var pin = nueva ? validarPin_(nueva, rol) : '';
  if (!existente && !pin) throw new Error('Asigná una clave al usuario nuevo.');
  if (existente && esMaster && !eraMaster(existente) && !pin) throw new Error('Para pasar a Master asigná una clave nueva de al menos 8 caracteres.');

  var u = existente || { id: 'U' + String(usuarios.reduce(function (m, x) { return Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0); }, 0) + 1), created_at: ahora_() };
  u.usuario = usuario; u.nombre = nombre; u.rol = roles.join(', '); u.activo = activo;
  if (d.telefono !== undefined) {
    var telU = txt_(d.telefono, 30);
    if (telU && soloDigitos_(telU).length < 7) throw new Error('Revisá el teléfono (WhatsApp) del usuario.');
    u.telefono = telU;
  }
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
  var yaConfig = {};
  leer_('Config').forEach(function (x) { yaConfig[String(x.clave)] = 1; });
  CONFIG_BASE.forEach(function (c) { if (!yaConfig[c[0]]) agregar_('Config', { clave: c[0], valor: c[1], nota: c[2] }); });
  var yaPrecios = tablaPrecios_();
  PRODUCTOS_BASE.forEach(function (b) { if (!yaPrecios[b[0]]) agregar_('Precios', { code: b[0], producto: b[1] }); });
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
  var msg = 'Listo: hojas Usuarios, Clientes, Pedidos, PedidoItems, Historial, Precios, Inventario, PedidosWeb y Config.\nCargá los precios en la hoja Precios: precio FINAL en $ por caja de cada forma de pago.' +
    (migrados ? '\n' + migrados + ' vendedor(es) pasados a Usuarios (misma clave/PIN; el usuario es su nombre en minúsculas). Podés borrar la hoja Vendedores.' : '') +
    (leer_('Usuarios').some(function (u) { return rolesDe_(u.rol).indexOf('master') !== -1; }) ? '' : '\nAhora creá el usuario Master (menú 2).');
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
  u.pin_hash = hashPin_(String(u.id), validarPin_(pin, rolesDe_(u.rol)[0]));
  actualizar_('Usuarios', u._fila, u);
  return true;
}

function menuCrearUsuario() {
  var ui = SpreadsheetApp.getUi();
  var pedir = function (t, m) { var r = ui.prompt(t, m, ui.ButtonSet.OK_CANCEL); return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null; };
  var usuario = pedir('Crear usuario (1/4)', 'Usuario para ingresar (ej. oscar):'); if (usuario === null) return;
  var nombre = pedir('Crear usuario (2/4)', 'Nombre para mostrar (ej. Óscar):'); if (nombre === null) return;
  var rol = pedir('Crear usuario (3/4)', 'Rol: master, admin, vendedor o despachador (varios separados por coma: vendedor, despachador)'); if (rol === null) return;
  var pin = pedir('Crear usuario (4/4)', 'Clave: letras y números, mínimo 6 (Master: 8). Puede llevar símbolos.'); if (pin === null) return;
  try {
    crearUsuario(usuario, nombre, rol.toLowerCase(), pin);
    ui.alert('Usuario "' + normUsuario_(usuario) + '" creado como ' + (nombreRoles_(rolesDe_(rol)) || rol) + '.');
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
