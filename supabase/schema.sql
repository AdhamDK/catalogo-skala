-- ============================================================================
-- SKALA CRM v3 — ESQUEMA Y MOTOR COMPLETO PARA SUPABASE (PostgreSQL)
-- ============================================================================
-- Instrucciones:
-- 1. En tu proyecto de Supabase, abrí "SQL Editor" -> "New query".
-- 2. Pegá todo este archivo y tocá "Run".
-- 3. Creará las 11 tablas idénticas a Google Sheets, los índices de velocidad,
--    la seguridad RLS y las funciones RPC (skala_db y skala_importar).
-- 4. Es idempotente: se puede volver a ejecutar para actualizar funciones y permisos.
-- ============================================================================

-- En Supabase Cloud pgcrypto vive en el esquema "extensions"; en PostgreSQL/PGlite local, en "public".
-- Por eso las funciones SECURITY DEFINER usan "SET search_path = public, extensions": funciona en ambos.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== 1. TABLAS (mismas hojas y columnas) ====================

CREATE TABLE IF NOT EXISTS public.usuarios (
  id text PRIMARY KEY,
  usuario text NOT NULL DEFAULT '',
  nombre text NOT NULL DEFAULT '',
  rol text NOT NULL DEFAULT 'vendedor',
  pin_hash text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  created_at text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  comision_pct numeric NOT NULL DEFAULT 3,
  catalogo text NOT NULL DEFAULT 'ambos',
  rutas text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id text PRIMARY KEY,
  nombre text NOT NULL DEFAULT '',
  rif_cedula text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  latitud text NOT NULL DEFAULT '',
  longitud text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT '',
  sync_status integer NOT NULL DEFAULT 1,
  deleted text NOT NULL DEFAULT '0',
  contacto text NOT NULL DEFAULT '',
  telefono2 text NOT NULL DEFAULT '',
  vendedor_id text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  ruta text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id text PRIMARY KEY,
  fecha text NOT NULL DEFAULT '',
  vendedor_id text NOT NULL DEFAULT '',
  vendedor text NOT NULL DEFAULT '',
  cliente_id text NOT NULL DEFAULT '',
  cliente text NOT NULL DEFAULT '',
  negocio text NOT NULL DEFAULT '',
  total_cajas numeric NOT NULL DEFAULT 0,
  detalle_unidades text NOT NULL DEFAULT '',
  pago text NOT NULL DEFAULT '',
  nota text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'pendiente',
  estado_at text NOT NULL DEFAULT '',
  estado_por text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  client_ref text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT '',
  despachador_id text NOT NULL DEFAULT '',
  despachador text NOT NULL DEFAULT '',
  confirmado_por text NOT NULL DEFAULT '',
  confirmado_at text NOT NULL DEFAULT '',
  entregado_por text NOT NULL DEFAULT '',
  entregado_at text NOT NULL DEFAULT '',
  documento text NOT NULL DEFAULT '',
  dias_credito integer NOT NULL DEFAULT 0,
  cobro text NOT NULL DEFAULT '',
  cobrado_at text NOT NULL DEFAULT '',
  cobrado_por text NOT NULL DEFAULT '',
  conciliado_at text NOT NULL DEFAULT '',
  conciliado_por text NOT NULL DEFAULT '',
  monto text NOT NULL DEFAULT '',
  moneda text NOT NULL DEFAULT '',
  nivel_precio text NOT NULL DEFAULT 'menor',
  excepcion_precio boolean NOT NULL DEFAULT false,
  tipo_pago text NOT NULL DEFAULT 'credito',
  total text NOT NULL DEFAULT '',
  tipo_pago_real text NOT NULL DEFAULT '',
  total_final text NOT NULL DEFAULT '',
  web_id text NOT NULL DEFAULT '',
  borrado boolean NOT NULL DEFAULT false,
  borrado_motivo text NOT NULL DEFAULT '',
  borrado_por text NOT NULL DEFAULT '',
  borrado_at text NOT NULL DEFAULT '',
  factura text NOT NULL DEFAULT '',
  nota_credito text NOT NULL DEFAULT '',
  pagado_usd numeric NOT NULL DEFAULT 0,
  saldo text NOT NULL DEFAULT '',
  pagos_pend integer NOT NULL DEFAULT 0,
  ajuste_estado text NOT NULL DEFAULT '',
  ajuste_motivo text NOT NULL DEFAULT '',
  ajuste_por text NOT NULL DEFAULT '',
  ajuste_at text NOT NULL DEFAULT '',
  ajuste_previo text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.pedido_items (
  id bigserial PRIMARY KEY,
  pedido_id text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  producto text NOT NULL DEFAULT '',
  cajas numeric NOT NULL DEFAULT 0,
  unidades_caja text NOT NULL DEFAULT '',
  unidad text NOT NULL DEFAULT 'unidades',
  total_unidades text NOT NULL DEFAULT '',
  precio numeric NOT NULL DEFAULT 0,
  desc_pronto numeric NOT NULL DEFAULT 0,
  desc_efectivo_credito numeric NOT NULL DEFAULT 0,
  desc_efectivo_pronto numeric NOT NULL DEFAULT 0,
  entregadas numeric NOT NULL DEFAULT 0,
  devueltas numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.historial (
  id bigserial PRIMARY KEY,
  fecha text NOT NULL DEFAULT '',
  pedido_id text NOT NULL DEFAULT '',
  usuario text NOT NULL DEFAULT '',
  accion text NOT NULL DEFAULT '',
  detalle text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.precios (
  code text PRIMARY KEY,
  producto text NOT NULL DEFAULT '',
  menor numeric NOT NULL DEFAULT 0,
  mayor numeric NOT NULL DEFAULT 0,
  pronto numeric NOT NULL DEFAULT 0,
  efectivo_credito numeric NOT NULL DEFAULT 0,
  efectivo_pronto numeric NOT NULL DEFAULT 0,
  updated_at text NOT NULL DEFAULT '',
  updated_por text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  linea text NOT NULL DEFAULT '',
  beneficio text NOT NULL DEFAULT '',
  cabello text NOT NULL DEFAULT '',
  unidades_caja numeric NOT NULL DEFAULT 0,
  imagen text NOT NULL DEFAULT '',
  mayor_pronto numeric NOT NULL DEFAULT 0,
  mayor_efectivo_credito numeric NOT NULL DEFAULT 0,
  mayor_efectivo_pronto numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.inventario (
  id bigserial PRIMARY KEY,
  fecha text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  producto text NOT NULL DEFAULT '',
  cajas numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT '',
  nota text NOT NULL DEFAULT '',
  usuario text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.pedidos_web (
  id text PRIMARY KEY,
  fecha text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  vendedor_id text NOT NULL DEFAULT '',
  vendedor text NOT NULL DEFAULT '',
  negocio text NOT NULL DEFAULT '',
  contacto text NOT NULL DEFAULT '',
  rif_cedula text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  items text NOT NULL DEFAULT '[]',
  tipo_pago text NOT NULL DEFAULT 'credito',
  total_cajas numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  nota text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'nuevo',
  pedido_id text NOT NULL DEFAULT '',
  atendido_por text NOT NULL DEFAULT '',
  atendido_at text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  cliente_id text NOT NULL DEFAULT '',
  latitud text NOT NULL DEFAULT '',
  longitud text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.config (
  clave text PRIMARY KEY,
  valor text NOT NULL DEFAULT '',
  nota text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id text PRIMARY KEY,
  pedido_id text NOT NULL DEFAULT '',
  fecha_pago text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  registrado_por text NOT NULL DEFAULT '',
  registrado_por_id text NOT NULL DEFAULT '',
  moneda text NOT NULL DEFAULT 'USD',
  monto numeric NOT NULL DEFAULT 0,
  tasa numeric NOT NULL DEFAULT 0,
  monto_usd numeric NOT NULL DEFAULT 0,
  referencia text NOT NULL DEFAULT '',
  tipo_pago_real text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'reportado',
  conciliado_at text NOT NULL DEFAULT '',
  conciliado_por text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  comision_estado text NOT NULL DEFAULT '',
  comision_pct numeric NOT NULL DEFAULT 0,
  comision_usd numeric NOT NULL DEFAULT 0,
  comision_moneda text NOT NULL DEFAULT '',
  comision_monto numeric NOT NULL DEFAULT 0,
  comision_tasa numeric NOT NULL DEFAULT 0,
  comision_fecha text NOT NULL DEFAULT '',
  comision_ref text NOT NULL DEFAULT '',
  comision_pagada_at text NOT NULL DEFAULT '',
  comision_pagada_por text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.tasas (
  fecha text PRIMARY KEY,
  tasa numeric NOT NULL DEFAULT 0,
  fuente text NOT NULL DEFAULT 'bcv',
  updated_at text NOT NULL DEFAULT ''
);

-- Canal de atención (SOLO 2: en_persona · online_telefono) y lectura GPS del vendedor.
-- ADD COLUMN IF NOT EXISTS: retrocompatible con bases ya creadas (pedidos/pagos viejos quedan con '').
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS canal_pedido text NOT NULL DEFAULT '';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS gps_lat text NOT NULL DEFAULT '';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS gps_lng text NOT NULL DEFAULT '';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS gps_dist_m text NOT NULL DEFAULT '';
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS canal_cobro text NOT NULL DEFAULT '';
-- Catálogo que maneja el vendedor ('skala' · 'distribuidora' · 'ambos') y rutas/zonas que atiende.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS catalogo text NOT NULL DEFAULT 'ambos';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS rutas text NOT NULL DEFAULT '';
-- Ruta / zona comercial del cliente (base unificada compartida entre vendedores).
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ruta text NOT NULL DEFAULT '';

-- Control de visitas / atenciones a clientes (hoja "Visitas" de Code.gs)
-- tipo: pedido · cobro · visita_ruta · no_disponible · no_visitado · alta_cliente
-- gps_aprendido: esta visita le puso al cliente sus primeras coordenadas (se revierte si fue el cliente equivocado)
CREATE TABLE IF NOT EXISTS public.visitas (
  id text PRIMARY KEY,
  fecha text NOT NULL DEFAULT '',
  cliente_id text NOT NULL DEFAULT '',
  negocio text NOT NULL DEFAULT '',
  vendedor_id text NOT NULL DEFAULT '',
  vendedor text NOT NULL DEFAULT '',
  canal text NOT NULL CHECK (canal IN ('en_persona', 'online_telefono')),
  tipo text NOT NULL DEFAULT 'visita_ruta',
  submotivo text NOT NULL DEFAULT '',
  nota text NOT NULL DEFAULT '',
  pedido_id text NOT NULL DEFAULT '',
  pago_id text NOT NULL DEFAULT '',
  mision_id text NOT NULL DEFAULT '',
  latitud text NOT NULL DEFAULT '',
  longitud text NOT NULL DEFAULT '',
  distancia_m text NOT NULL DEFAULT '',
  en_sitio boolean NOT NULL DEFAULT false,
  gps_aprendido boolean NOT NULL DEFAULT false,
  anulada boolean NOT NULL DEFAULT false,
  anulada_motivo text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT ''
);

-- Tabla privada para secretos internos (ej. CRM_SECRET para que las claves y sesiones sigan funcionando igual)
CREATE TABLE IF NOT EXISTS public.skala_secretos (
  clave text PRIMARY KEY,
  valor text NOT NULL
);

-- Tabla privada de contadores (reemplaza a CacheService de Apps Script):
-- intentos de login fallidos (bloqueo 10 min tras 5), búsquedas públicas por minuto y pedidos web por hora.
CREATE TABLE IF NOT EXISTS public.skala_intentos (
  clave text PRIMARY KEY,
  n integer NOT NULL DEFAULT 0,
  desde timestamptz NOT NULL DEFAULT now()
);

-- ==================== 2. ÍNDICES DE VELOCIDAD ====================

CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON public.pedidos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON public.pedidos (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON public.pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cobro ON public.pedidos (cobro);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON public.pedido_items (pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON public.pagos (pedido_id);
CREATE INDEX IF NOT EXISTS idx_historial_pedido ON public.historial (pedido_id);
CREATE INDEX IF NOT EXISTS idx_inventario_code ON public.inventario (code);
CREATE INDEX IF NOT EXISTS idx_clientes_updated ON public.clientes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_cliente ON public.visitas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_visitas_pedido ON public.visitas (pedido_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON public.visitas (fecha DESC);

-- ==================== 3. SEGURIDAD (ROW LEVEL SECURITY) ====================
-- Bloquea el acceso directo desde internet a las tablas; todo pasa por las funciones RPC validadas.

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skala_secretos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skala_intentos ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: además de RLS sin políticas, se quitan los permisos directos de PostgREST.
-- Todo el acceso pasa por public.skala_db / public.skala_importar (SECURITY DEFINER).
REVOKE ALL ON public.usuarios, public.clientes, public.pedidos, public.pedido_items, public.historial,
  public.precios, public.inventario, public.pedidos_web, public.config, public.pagos, public.tasas,
  public.visitas, public.skala_secretos, public.skala_intentos
  FROM anon, authenticated;

-- Datos iniciales por defecto (no pisan si ya existen)
INSERT INTO public.config (clave, valor, nota) VALUES
  ('version_apk', '1', 'Número de la última versión de la app (versionCode).'),
  ('url_apk', '', 'Enlace directo a la APK.'),
  ('minima_apk', '1', 'Versión mínima permitida.'),
  ('version_pantallas', '', 'Versión del paquete de pantallas.'),
  ('url_pantallas', '', 'Enlace directo al .zip de pantallas.'),
  ('notas', '', 'Texto corto que verá el equipo en el aviso de actualización.'),
  ('comision_pct_default', '3', 'Porcentaje de comisión por defecto para vendedores (%)')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.precios (code, producto, menor, mayor, unidades_caja, linea, tipo) VALUES
  ('BC-01', 'Babosa', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-02', 'Banana e Macuri', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-03', 'Divino Potao', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-04', 'Divino Potinho Kids', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-05', 'Dona Skala', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-06', 'Mais Cachos', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-07', 'Mais Crespinhos', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-08', 'Mais Crespos', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-09', 'Mais Lisos', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-10', 'Potao de Amor', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-11', 'Potao Despaiado', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-12', 'Mais Cachinhos', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-13', 'Ceramidas G3', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-14', 'Amido de Milho', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-15', 'Keratina Vegetal', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('BC-16', 'Bomba de Vitaminas', 25.5, 24.0, 6, 'Cuidado Personal', 'banos'),
  ('KT-01', 'Kit 12 em 1', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-02', 'Kit Aguacate', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-03', 'Kit Babosa', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-04', 'Kit Bomba de Vitaminas S.O.S', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-05', 'Kit Ceramidas', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-06', 'Kit Crespo Divino', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-07', 'Kit Mais Crespinhos', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('KT-08', 'Kit Mais Cachos', 29.0, 27.5, 6, 'Cuidado Personal', 'kits'),
  ('ALV-DET1K-01', 'Blanco Perla Blanqueador 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-02', 'Morado Floral 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-03', 'Rosado con Suavizante 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-04', 'Verde Limón 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-05', 'Azul Todo Tipo de Ropa 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-06', 'Rosa Fragancia Bebé 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('ALV-DET1K-07', 'Azul Fragancia Bebé 1 kg', 16.8, 15.6, 12, 'Detergentes', 'banos'),
  ('AZ-DET-01', 'A-Z Azul Naranja Todo Tipo de Ropa 1 kg', 15.6, 14.4, 12, 'Detergentes', 'banos'),
  ('AZ-DET-02', 'A-Z Rosado Ultra Floral 1 kg', 15.6, 14.4, 12, 'Detergentes', 'banos'),
  ('ALV-DET500-01', 'Blanco Perla Blanqueador 500 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-02', 'Morado Floral 500 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-03', 'Rosado con Suavizante 500 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-04', 'Verde Limón 500 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-05', 'Azul Todo Tipo de Ropa 500 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-06', 'Rosa Fragancia Bebé 400 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-DET500-07', 'Rosado con Suavizante 200 g', 17.5, 16.2, 24, 'Detergentes', 'banos'),
  ('ALV-PAN-01', 'Panela Alive Lavanda 150 g', 14.4, 13.5, 36, 'Detergentes', 'banos'),
  ('ALV-PAN-02', 'Panela Alive Limón 150 g', 14.4, 13.5, 36, 'Detergentes', 'banos'),
  ('ALV-PAN-03', 'Panela Alive con Suavizante 150 g', 14.4, 13.5, 36, 'Detergentes', 'banos'),
  ('JAB-POP-01', 'Jabón Popular en Barra', 14.0, 13.0, 36, 'Detergentes', 'banos'),
  ('ALV-LAV-01', 'Aliclean Azul Limón Amarillo 350 ml', 19.2, 18.0, 24, 'Detergentes', 'banos'),
  ('ALV-LAV-02', 'Aliclean Naranja Mandarina 350 ml', 19.2, 18.0, 24, 'Detergentes', 'banos'),
  ('ALV-LAV-03', 'Aliclean Verde Limón 350 ml', 19.2, 18.0, 24, 'Detergentes', 'banos'),
  ('ALV-LAV-04', 'Aliclean Azul Limón Amarillo 750 ml', 19.2, 18.0, 24, 'Detergentes', 'banos'),
  ('ALV-LAV-05', 'Aliclean Verde Limón 750 ml', 19.2, 18.0, 24, 'Detergentes', 'banos'),
  ('ALV-SUA-01', 'Suavizante Alive Celeste Fresca Primavera', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-SUA-02', 'Suavizante Alive Verde Manzana', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-SUA-03', 'Suavizante Alive Rosado Floral', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-SUA-04', 'Suavizante Alive Celeste Bebé', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-SUA-05', 'Suavizante Alive Morado Lavanda', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-SUA-06', 'Suavizante Alive Rojo Fresa y Chocolate', 18.0, 16.8, 12, 'Suavizantes', 'banos'),
  ('ALV-CAP-01', 'Baño de Crema Alive Aceite de Oliva 400 g', 20.4, 18.9, 12, 'Cuidado Personal', 'banos'),
  ('ALV-CAP-02', 'Baño de Crema Alive Aceite de Argán 400 g', 20.4, 18.9, 12, 'Cuidado Personal', 'banos'),
  ('ALV-CAP-03', 'Baño de Crema Alive Antifrizz Keratina 400 g', 20.4, 18.9, 12, 'Cuidado Personal', 'banos'),
  ('ALV-LOC-01', 'Loción Alive Lila Beso Granada 400 ml', 22.8, 21.0, 12, 'Cuidado Personal', 'banos'),
  ('ALV-LOC-02', 'Loción Alive Rojo Flor de la Pasión 400 ml', 22.8, 21.0, 12, 'Cuidado Personal', 'banos'),
  ('ALV-LOC-03', 'Loción Alive Verde Coco Tropical 400 ml', 22.8, 21.0, 12, 'Cuidado Personal', 'banos'),
  ('ALV-LOC-04', 'Loción Alive Dorado Flor de Vainilla 400 ml', 22.8, 21.0, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA413-01', 'Shampoo Alive Coco Tropical 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA413-02', 'Shampoo Alive Flor de Manzana 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA413-03', 'Shampoo Alive Beso de Granada 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA413-04', 'Shampoo Alive Flor de la Pasión 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-ACO413-01', 'Acondicionador Alive Coco Tropical 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-ACO413-02', 'Acondicionador Alive Flor de Manzana 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-ACO413-03', 'Acondicionador Alive Beso de Granada 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-ACO413-04', 'Acondicionador Alive Flor de la Pasión 413 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA400-08', 'Shampoo Anticaspa Agua de Coco 400 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA400-09', 'Shampoo Anticaspa Dandruff Azul 400 ml', 21.6, 19.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-01', 'Shampoo 2en1 Azul Todo Tipo de Cabello 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-02', 'Shampoo 2en1 Morado Cabello Graso 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-03', 'Shampoo 2en1 Rojo Cabello Seco 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-04', 'Shampoo 2en1 Fucsia Cabello Normal 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-05', 'Shampoo Gold Verde Refrescante 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-06', 'Shampoo Gold Amarillo Brillo 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA350-07', 'Shampoo Gold Azul Anticaspa 350 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA250-01', 'Shampoo Alive Verde Flor de Manzana 250 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA250-02', 'Shampoo Alive Naranja Coco Tropical 250 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA250-03', 'Shampoo Alive Rosado Beso de Granada 250 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-SHA250-04', 'Shampoo Alive Morado Flor de la Pasión 250 ml', 19.2, 17.8, 12, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-01', 'Alident Ultra Fresh Roja 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-02', 'Alident Gel Verde Aliento Fresco 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-03', 'Alident Fresh Mint Menta Suave 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-04', 'Alident Gel Azul Ice Cool Mint 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-05', 'Alident Extra Blancura Triple Acción Verde 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-06', 'Alident Triple Action Roja 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-07', 'Alident Pro-White Blanqueador 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-08', 'Alident Sensitive Uso Diario 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-09', 'Alident Kids Niño 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-DEN-10', 'Alident Kids Niña 100 g', 28.8, 26.4, 48, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-01', 'Anita Dorado Avena (Oats) 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-02', 'Anita Rosado Extracto de Perla 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-03', 'Anita Celeste Extracto de Aguacate 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-03B', 'Anita Turquesa Aguacate Hoja 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-04', 'Anita Morado Extracto de Almendra 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('ALV-JAB-05', 'Anita Verde Extracto de Pepino 125 g', 24.0, 22.5, 72, 'Cuidado Personal', 'banos'),
  ('HAR-MIL-01', 'Harmony Milky Rosa Inglesa (English Rose)', 23.4, 21.6, 72, 'Cuidado Personal', 'banos'),
  ('HAR-MIL-02', 'Harmony Milky Lavanda (Lavender)', 23.4, 21.6, 72, 'Cuidado Personal', 'banos'),
  ('HAR-MIL-03', 'Harmony Milky Girasol (Sunflower)', 23.4, 21.6, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-01', 'Harmony Fruity Fresa (Strawberry)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-02', 'Harmony Fruity Naranja (Orange)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-03', 'Harmony Fruity Limón (Lemon)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-04', 'Harmony Fruity Uva (Grape)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-05', 'Harmony Fruity Manzana (Apple)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('HAR-FRU-06', 'Harmony Fruity Melón (Melon)', 22.8, 21.0, 72, 'Cuidado Personal', 'banos'),
  ('ALV-TOAFEM-01', 'Toallas Alive Regular Día con Alas 245 mm', 21.6, 20.0, 24, 'Cuidado Personal', 'banos'),
  ('ALV-TOAFEM-02', 'Toallas Alive Nocturna Noche 290 mm', 21.6, 20.0, 24, 'Cuidado Personal', 'banos'),
  ('ALV-TOAFEM-03', 'Toallas Alive Extra Larga 340 mm', 21.6, 20.0, 24, 'Cuidado Personal', 'banos'),
  ('ALV-TOAFEM-04', 'Protectores Diarios Alive × 20 Unidades', 21.6, 20.0, 24, 'Cuidado Personal', 'banos'),
  ('BF-PAN-P20', 'Baby Finger Talla P · 20 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-PAN-P10', 'Baby Finger Talla P · 10 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-PAN-M18', 'Baby Finger Talla M · 18 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-PAN-G18', 'Baby Finger Talla G · 18 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-PAN-XG16', 'Baby Finger Talla XG · 16 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-PAN-XXG16', 'Baby Finger Talla XXG · 16 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('ALV-PAN-ADM', 'Pañal Adulto Alive Talla M · 6 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('ALV-PAN-ADXG', 'Pañal Adulto Alive Talla XG · 6 Unidades', 26.4, 24.8, 8, 'Bebé y Pañales', 'banos'),
  ('BF-THU-01', 'Toallas Húmedas Baby Finger Rosado × 50 und', 21.6, 19.8, 24, 'Bebé y Pañales', 'banos'),
  ('BF-THU-02', 'Toallas Húmedas Baby Finger Celeste × 50 und', 21.6, 19.8, 24, 'Bebé y Pañales', 'banos'),
  ('BF-THU-03', 'Toallas Húmedas Baby Finger Verde Aloe × 50 und', 21.6, 19.8, 24, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-01', 'Shampoo para Niños Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-02', 'Colonia para Niños Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-03', 'Aceite para Bebé Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-04', 'Jabón Líquido para Bebé Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-05', 'Petroleum Jelly para Bebé Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-06', 'Loción Hidratante para Bebé Baby Finger', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-07', 'Talco para Bebé Baby Finger 200 g', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('BF-CUI-08', 'Talco para Bebé Baby Finger 100 g', 19.2, 17.8, 12, 'Bebé y Pañales', 'banos'),
  ('ALV-PAP-01', 'Alisoft Rosado 215 Hojas × 4 Rollos', 24.0, 22.5, 12, 'Hogar y Papel', 'banos'),
  ('ALV-PAP-02', 'Alisoft Dorado Comfort Plus 300 Hojas × 4 Rollos', 24.0, 22.5, 12, 'Hogar y Papel', 'banos'),
  ('ALV-PAP-03', 'Alisoft Azul Premium Max 400 Hojas × 4 Rollos', 24.0, 22.5, 12, 'Hogar y Papel', 'banos'),
  ('ALV-PAP-04', 'Alisoft Negro Premium Jumbo 600 Hojas × 4 Rollos', 24.0, 22.5, 12, 'Hogar y Papel', 'banos'),
  ('ALV-TOAABS-01', 'Toallín Alisoft Azul 80 Hojas', 18.6, 17.4, 12, 'Hogar y Papel', 'banos'),
  ('ALV-TOAABS-02', 'Toallín Alisoft Naranja Doble Hoja', 18.6, 17.4, 12, 'Hogar y Papel', 'banos'),
  ('DOR-PACE3-01', 'Afeitadora Dorco Pace 3 Blíster', 22.0, 20.4, 24, 'Hogar y Papel', 'banos'),
  ('BER-ESP-60', 'Espiral Antimosquitos Bernice × 60 Unidades', 22.0, 20.4, 24, 'Hogar y Papel', 'banos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.skala_secretos (clave, valor)
VALUES ('CRM_SECRET', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (clave) DO NOTHING;

-- ==================== 4. HELPERS INTERNOS EN PL/PGSQL ====================

CREATE OR REPLACE FUNCTION public.skala_secreto()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT valor FROM public.skala_secretos WHERE clave = 'CRM_SECRET' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.skala_hash_pin(p_user_id text, p_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(digest(public.skala_secreto() || '|' || p_user_id || '|' || COALESCE(p_pin, ''), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.skala_firmar(p_texto text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(hmac(p_texto, public.skala_secreto(), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.skala_crear_token(p_user_id text, p_largo boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_exp bigint;
  v_base text;
BEGIN
  v_exp := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint +
           CASE WHEN COALESCE(p_largo, false) THEN 30::bigint * 24 * 3600 * 1000 ELSE 12::bigint * 3600 * 1000 END;
  v_base := p_user_id || '.' || v_exp::text;
  RETURN v_base || '.' || public.skala_firmar(v_base);
END;
$$;

CREATE OR REPLACE FUNCTION public.skala_roles_de(p_rol text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw text[];
  v_item text;
  v_res text[] := ARRAY[]::text[];
  v_orden text[] := ARRAY['master', 'admin', 'vendedor', 'despachador'];
  v_r text;
BEGIN
  v_raw := regexp_split_to_array(lower(COALESCE(p_rol, '')), '[,;/+]| y ');
  FOREACH v_r IN ARRAY v_orden LOOP
    FOREACH v_item IN ARRAY v_raw LOOP
      v_item := regexp_replace(trim(v_item), 'administraci[oó]n', 'admin');
      IF v_item = v_r AND NOT (v_r = ANY(v_res)) THEN
        v_res := array_append(v_res, v_r);
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.skala_nombre_roles(p_roles text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_out text[] := ARRAY[]::text[];
  v_r text;
BEGIN
  FOREACH v_r IN ARRAY COALESCE(p_roles, ARRAY[]::text[]) LOOP
    v_out := array_append(v_out, CASE v_r
      WHEN 'master' THEN 'Master'
      WHEN 'admin' THEN 'Administración'
      WHEN 'vendedor' THEN 'Vendedor'
      WHEN 'despachador' THEN 'Despachador'
      ELSE v_r
    END);
  END LOOP;
  RETURN array_to_string(v_out, ' · ');
END;
$$;

CREATE OR REPLACE FUNCTION public.skala_ruta_cliente(p_id text, p_ruta text, p_nombre text, p_direccion text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r text := lower(translate(trim(COALESCE(p_ruta, '')), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'));
  v_txt text := lower(translate(COALESCE(p_nombre, '') || ' ' || COALESCE(p_direccion, ''), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'));
BEGIN
  IF v_r IN ('chivo') THEN RETURN 'Chivo'; END IF;
  IF v_r IN ('vigia', 'el vigia') THEN RETURN 'Vigía'; END IF;
  IF v_r IN ('merida') THEN RETURN 'Mérida'; END IF;
  IF v_r IN ('mocoties') THEN RETURN 'Mocotíes'; END IF;
  IF v_r IN ('caja seca', 'caja-seca') THEN RETURN 'Caja Seca'; END IF;
  IF v_r IN ('tachira') THEN RETURN 'Táchira'; END IF;

  IF p_id IN (
    '772da44b-3153-4bde-ab19-b48715b00cdf',
    '465b0ad1-9738-4dc3-b958-40681ba5db89',
    '2eb9404b-5622-4dc4-99f3-08684dc2c63c',
    '4f55f5fa-a0e6-47ef-89eb-311ec9ac62c6'
  ) THEN RETURN 'Chivo'; END IF;
  IF p_id IN (
    'da43b6ca-fa36-4b37-9160-f4bcd0b39048',
    '75c4e1ae-4c39-43c1-8302-a2554556ce7a',
    'd0216c35-935b-4d56-be36-f0ace7e1c9a4'
  ) THEN RETURN 'Caja Seca'; END IF;
  IF p_id IN (
    '6002e33d-09d4-40aa-bd29-02e32bdbe8e3',
    '96ef523e-d0c1-4961-8cfd-9829a7f2edb7',
    '528e785f-b85c-4859-98f0-85464485865a'
  ) THEN RETURN 'Mocotíes'; END IF;
  IF p_id IN (
    '8cc62278-c92a-4bfa-8770-34d1b15d2903',
    '4ca6e254-eb17-4d01-9b3c-77857a87dabf'
  ) THEN RETURN 'Táchira'; END IF;

  IF v_txt ~ 'tachira|san\s*cristobal|la\s*fria|coloncito|pinal|rubio|tariba' THEN RETURN 'Táchira'; END IF;
  IF v_txt ~ 'caja\s*seca|panamericana|nueva\s*bolivia|arenales|zancudo|bobures|arapuey' THEN RETURN 'Caja Seca'; END IF;
  IF v_txt ~ 'mocoties|santa\s*cruz\s*de\s*mora|tovar|bailadores|zea' THEN RETURN 'Mocotíes'; END IF;
  IF v_txt ~ 'chivo|pueblo\s*nuevo|rurale|cuatro\s*esquinas' THEN RETURN 'Chivo'; END IF;
  IF v_txt ~ 'vigia|cano\s*seco' THEN RETURN 'Vigía'; END IF;
  IF v_txt ~ 'merida|llano|milla|lora|independencia|pinto\s*salina|ejido' THEN RETURN 'Mérida'; END IF;
  RETURN 'Vigía';
END;
$$;

UPDATE public.clientes
SET ruta = public.skala_ruta_cliente(id, ruta, nombre, direccion)
WHERE COALESCE(ruta, '') = '';

CREATE OR REPLACE FUNCTION public.skala_usuario_publico(u public.usuarios)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := public.skala_roles_de(u.rol);
  RETURN jsonb_build_object(
    'id', u.id,
    'usuario', u.usuario,
    'nombre', u.nombre,
    'rol', COALESCE(v_roles[1], u.rol),
    'roles', to_jsonb(v_roles),
    'rol_nombre', COALESCE(NULLIF(public.skala_nombre_roles(v_roles), ''), u.rol),
    'catalogo', CASE WHEN lower(COALESCE(u.catalogo, '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(u.catalogo) ELSE 'ambos' END,
    'rutas', COALESCE(u.rutas, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.skala_verificar_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_partes text[];
  v_base text;
  v_u public.usuarios%ROWTYPE;
  v_now bigint;
BEGIN
  IF COALESCE(p_token, '') = '' THEN RETURN NULL; END IF;
  v_partes := string_to_array(p_token, '.');
  IF array_length(v_partes, 1) <> 3 THEN RETURN NULL; END IF;
  v_base := v_partes[1] || '.' || v_partes[2];
  IF public.skala_firmar(v_base) <> v_partes[3] THEN RETURN NULL; END IF;
  v_now := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  -- un token malformado no debe romper la llamada (el cast a bigint lanzaría excepción).
  -- IF separados: PostgreSQL no garantiza cortocircuito en OR.
  IF v_partes[2] !~ '^\d{1,18}$' THEN RETURN NULL; END IF;
  IF (v_partes[2])::bigint < v_now THEN RETURN NULL; END IF;
  SELECT * INTO v_u FROM public.usuarios WHERE id = v_partes[1] AND activo = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF array_length(public.skala_roles_de(v_u.rol), 1) IS NULL THEN RETURN NULL; END IF;
  RETURN public.skala_usuario_publico(v_u);
END;
$$;

-- ---------- Contadores con ventana deslizante (equivalente a CacheService.put con TTL) ----------
-- Devuelve cuántos intentos hay vigentes para la clave (0 si la ventana ya venció).
CREATE OR REPLACE FUNCTION public.skala_intentos_de(p_clave text, p_ventana interval)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE((SELECT n FROM public.skala_intentos WHERE clave = p_clave AND desde + p_ventana > now()), 0);
$$;

-- Suma un intento; cada intento renueva la ventana (igual que cache.put(clave, n + 1, TTL) en Code.gs).
CREATE OR REPLACE FUNCTION public.skala_sumar_intento(p_clave text, p_ventana interval)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  INSERT INTO public.skala_intentos AS si (clave, n, desde) VALUES (p_clave, 1, now())
  ON CONFLICT (clave) DO UPDATE SET
    n = CASE WHEN si.desde + p_ventana > now() THEN si.n + 1 ELSE 1 END,
    desde = now();
$$;

CREATE OR REPLACE FUNCTION public.skala_limpiar_intentos(p_clave text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.skala_intentos WHERE clave = p_clave;
$$;

-- ---------- Normalización de teléfono y RIF (idéntica a telClave_ / mismoRif_ de Code.gs) ----------
CREATE OR REPLACE FUNCTION public.skala_tel_clave(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN length(d) >= 10 THEN right(d, 10) ELSE d END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') AS d) s;
$$;

CREATE OR REPLACE FUNCTION public.skala_mismo_tel(a text, b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT length(public.skala_tel_clave(a)) >= 7 AND public.skala_tel_clave(a) = public.skala_tel_clave(b);
$$;

CREATE OR REPLACE FUNCTION public.skala_mismo_rif(a text, b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x text := regexp_replace(COALESCE(a, ''), '\D', '', 'g');
  y text := regexp_replace(COALESCE(b, ''), '\D', '', 'g');
  largo text;
  corto text;
BEGIN
  IF length(x) < 6 OR length(y) < 6 THEN RETURN false; END IF;
  IF x = y THEN RETURN true; END IF;
  IF length(x) > length(y) THEN largo := x; corto := y; ELSE largo := y; corto := x; END IF;
  -- cédula vs. RIF con dígito verificador al final (V-28072542 ≡ V-28072542-1)
  RETURN length(largo) - length(corto) = 1 AND length(corto) >= 7 AND left(largo, -1) = corto;
END;
$$;

-- ---------- ¿La sesión puede tocar este pedido? (misma regla que puedeVer_ de Code.gs) ----------
CREATE OR REPLACE FUNCTION public.skala_puede_pedido(p_ses jsonb, p_pedido_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_p public.pedidos%ROWTYPE;
BEGIN
  IF p_ses IS NULL THEN RETURN false; END IF;
  IF (p_ses->'roles') ? 'master' OR (p_ses->'roles') ? 'admin' THEN RETURN true; END IF;
  SELECT * INTO v_p FROM public.pedidos WHERE id = COALESCE(p_pedido_id, '');
  IF NOT FOUND THEN RETURN false; END IF;
  IF (p_ses->'roles') ? 'vendedor' AND v_p.vendedor_id = (p_ses->>'id') THEN RETURN true; END IF;
  IF (p_ses->'roles') ? 'despachador' AND v_p.despachador_id = (p_ses->>'id') THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- ==================== 5. IMPORTADOR SEGURO DESDE GOOGLE SHEETS ====================
-- Copia todas las filas exportadas desde Google Sheets sin duplicar ni perder nada.

CREATE OR REPLACE FUNCTION public.skala_importar(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text := COALESCE(payload->>'token', '');
  v_ses jsonb;
  v_hay_usuarios boolean;
  v_row jsonb;
  v_cont jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  -- Si ya hay usuarios en Supabase, exige que quien importe sea Master (o que envíe el mismo CRM_SECRET)
  SELECT EXISTS(SELECT 1 FROM public.usuarios) INTO v_hay_usuarios;
  IF v_hay_usuarios THEN
    v_ses := public.skala_verificar_token(v_token);
    IF (v_ses IS NULL OR NOT (v_ses->'roles' ? 'master'))
       AND COALESCE(payload->>'crm_secret', '') <> public.skala_secreto() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Solo el usuario Master puede importar datos.', 'code', 'forbidden');
    END IF;
  ELSE
    -- Primera importación (base vacía): debe traer el CRM_SECRET de Google Sheets y al menos un Master,
    -- si no las claves actuales no funcionarían y nadie podría administrar la base.
    IF COALESCE(payload->>'crm_secret', '') = '' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'Usuarios', '[]'::jsonb)) u
      WHERE 'master' = ANY(public.skala_roles_de(u->>'rol'))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'La primera importación debe venir de Google Sheets (con su clave interna y al menos un Master).', 'code', 'forbidden');
    END IF;
  END IF;

  -- 0. Conservar CRM_SECRET de Google Sheets para que las claves y sesiones actuales sigan funcionando sin cambios
  IF COALESCE(payload->>'crm_secret', '') <> '' THEN
    INSERT INTO public.skala_secretos (clave, valor)
    VALUES ('CRM_SECRET', payload->>'crm_secret')
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
  END IF;

  -- 1. Usuarios
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Usuarios', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'id', '') <> '' THEN
      INSERT INTO public.usuarios (id, usuario, nombre, rol, pin_hash, activo, created_at, telefono, comision_pct, catalogo, rutas)
      VALUES (
        v_row->>'id',
        COALESCE(v_row->>'usuario', ''),
        COALESCE(v_row->>'nombre', ''),
        COALESCE(v_row->>'rol', 'vendedor'),
        COALESCE(v_row->>'pin_hash', ''),
        LOWER(COALESCE(v_row->>'activo', 'true')) IN ('true', '1', 'si', 'sí'),
        COALESCE(v_row->>'created_at', ''),
        COALESCE(v_row->>'telefono', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'comision_pct', ''), ',', '.'), '')::numeric, 3),
        CASE WHEN lower(COALESCE(v_row->>'catalogo', '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(v_row->>'catalogo') ELSE 'ambos' END,
        COALESCE(v_row->>'rutas', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        usuario = EXCLUDED.usuario, nombre = EXCLUDED.nombre, rol = EXCLUDED.rol,
        pin_hash = EXCLUDED.pin_hash, activo = EXCLUDED.activo, telefono = EXCLUDED.telefono,
        comision_pct = EXCLUDED.comision_pct,
        catalogo = CASE WHEN COALESCE(v_row->>'catalogo', '') <> '' THEN EXCLUDED.catalogo ELSE public.usuarios.catalogo END,
        rutas = CASE WHEN v_row ? 'rutas' THEN EXCLUDED.rutas ELSE public.usuarios.rutas END;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('usuarios', v_n);

  -- 2. Clientes
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Clientes', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'id', '') <> '' THEN
      INSERT INTO public.clientes (id, nombre, rif_cedula, direccion, latitud, longitud, telefono, updated_at, sync_status, deleted, contacto, telefono2, vendedor_id, created_at, ruta)
      VALUES (
        v_row->>'id',
        COALESCE(v_row->>'nombre', ''),
        COALESCE(v_row->>'rif_cedula', ''),
        COALESCE(v_row->>'direccion', ''),
        COALESCE(v_row->>'latitud', ''),
        COALESCE(v_row->>'longitud', ''),
        COALESCE(v_row->>'telefono', ''),
        COALESCE(v_row->>'updated_at', ''),
        COALESCE(NULLIF(v_row->>'sync_status', '')::int, 1),
        COALESCE(v_row->>'deleted', '0'),
        COALESCE(v_row->>'contacto', ''),
        COALESCE(v_row->>'telefono2', ''),
        COALESCE(v_row->>'vendedor_id', ''),
        COALESCE(v_row->>'created_at', ''),
        public.skala_ruta_cliente(v_row->>'id', COALESCE(v_row->>'ruta', ''), COALESCE(v_row->>'nombre', ''), COALESCE(v_row->>'direccion', ''))
      )
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre, rif_cedula = EXCLUDED.rif_cedula, direccion = EXCLUDED.direccion,
        latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud, telefono = EXCLUDED.telefono,
        updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, contacto = EXCLUDED.contacto,
        telefono2 = EXCLUDED.telefono2, vendedor_id = EXCLUDED.vendedor_id,
        ruta = CASE WHEN COALESCE(v_row->>'ruta', '') <> '' THEN EXCLUDED.ruta ELSE COALESCE(NULLIF(public.clientes.ruta, ''), EXCLUDED.ruta) END;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('clientes', v_n);

  -- 3. Precios
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Precios', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'code', '') <> '' THEN
      INSERT INTO public.precios (code, producto, menor, mayor, pronto, efectivo_credito, efectivo_pronto, updated_at, updated_por, tipo, linea, beneficio, cabello, unidades_caja, imagen, mayor_pronto, mayor_efectivo_credito, mayor_efectivo_pronto)
      VALUES (
        UPPER(TRIM(v_row->>'code')),
        COALESCE(v_row->>'producto', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'menor', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'mayor', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'pronto', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'efectivo_credito', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'efectivo_pronto', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'updated_at', ''),
        COALESCE(v_row->>'updated_por', ''),
        COALESCE(v_row->>'tipo', ''),
        COALESCE(v_row->>'linea', ''),
        COALESCE(v_row->>'beneficio', ''),
        COALESCE(v_row->>'cabello', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'unidades_caja', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'imagen', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'mayor_pronto', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'mayor_efectivo_credito', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'mayor_efectivo_pronto', ''), ',', '.'), '')::numeric, 0)
      )
      ON CONFLICT (code) DO UPDATE SET
        producto = EXCLUDED.producto, menor = EXCLUDED.menor, mayor = EXCLUDED.mayor,
        pronto = EXCLUDED.pronto, efectivo_credito = EXCLUDED.efectivo_credito, efectivo_pronto = EXCLUDED.efectivo_pronto,
        updated_at = EXCLUDED.updated_at, updated_por = EXCLUDED.updated_por, tipo = EXCLUDED.tipo,
        linea = EXCLUDED.linea, beneficio = EXCLUDED.beneficio, cabello = EXCLUDED.cabello,
        unidades_caja = EXCLUDED.unidades_caja, imagen = EXCLUDED.imagen,
        mayor_pronto = EXCLUDED.mayor_pronto, mayor_efectivo_credito = EXCLUDED.mayor_efectivo_credito,
        mayor_efectivo_pronto = EXCLUDED.mayor_efectivo_pronto;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('precios', v_n);

  -- 4. Pedidos
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Pedidos', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'id', '') <> '' THEN
      INSERT INTO public.pedidos (
        id, fecha, vendedor_id, vendedor, cliente_id, cliente, negocio, total_cajas, detalle_unidades,
        pago, nota, estado, estado_at, estado_por, motivo, client_ref, created_at, updated_at,
        despachador_id, despachador, confirmado_por, confirmado_at, entregado_por, entregado_at,
        documento, dias_credito, cobro, cobrado_at, cobrado_por, conciliado_at, conciliado_por,
        monto, moneda, nivel_precio, excepcion_precio, tipo_pago, total, tipo_pago_real, total_final,
        web_id, borrado, borrado_motivo, borrado_por, borrado_at, factura, nota_credito,
        pagado_usd, saldo, pagos_pend, ajuste_estado, ajuste_motivo, ajuste_por, ajuste_at, ajuste_previo
      ) VALUES (
        v_row->>'id', COALESCE(v_row->>'fecha', ''), COALESCE(v_row->>'vendedor_id', ''), COALESCE(v_row->>'vendedor', ''),
        COALESCE(v_row->>'cliente_id', ''), COALESCE(v_row->>'cliente', ''), COALESCE(v_row->>'negocio', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'total_cajas', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'detalle_unidades', ''), COALESCE(v_row->>'pago', ''), COALESCE(v_row->>'nota', ''),
        COALESCE(NULLIF(v_row->>'estado', ''), 'pendiente'), COALESCE(v_row->>'estado_at', ''), COALESCE(v_row->>'estado_por', ''),
        COALESCE(v_row->>'motivo', ''), COALESCE(v_row->>'client_ref', ''), COALESCE(v_row->>'created_at', ''), COALESCE(v_row->>'updated_at', ''),
        COALESCE(v_row->>'despachador_id', ''), COALESCE(v_row->>'despachador', ''), COALESCE(v_row->>'confirmado_por', ''), COALESCE(v_row->>'confirmado_at', ''),
        COALESCE(v_row->>'entregado_por', ''), COALESCE(v_row->>'entregado_at', ''), COALESCE(v_row->>'documento', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'dias_credito', ''), '\D', '', 'g'), '')::int, 0),
        COALESCE(v_row->>'cobro', ''), COALESCE(v_row->>'cobrado_at', ''), COALESCE(v_row->>'cobrado_por', ''),
        COALESCE(v_row->>'conciliado_at', ''), COALESCE(v_row->>'conciliado_por', ''),
        COALESCE(v_row->>'monto', ''), COALESCE(v_row->>'moneda', ''), COALESCE(NULLIF(v_row->>'nivel_precio', ''), 'menor'),
        LOWER(COALESCE(v_row->>'excepcion_precio', 'false')) = 'true',
        COALESCE(v_row->>'tipo_pago', ''), COALESCE(v_row->>'total', ''), COALESCE(v_row->>'tipo_pago_real', ''), COALESCE(v_row->>'total_final', ''),
        COALESCE(v_row->>'web_id', ''), LOWER(COALESCE(v_row->>'borrado', 'false')) = 'true',
        COALESCE(v_row->>'borrado_motivo', ''), COALESCE(v_row->>'borrado_por', ''), COALESCE(v_row->>'borrado_at', ''),
        COALESCE(v_row->>'factura', ''), COALESCE(v_row->>'nota_credito', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'pagado_usd', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'saldo', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'pagos_pend', ''), '\D', '', 'g'), '')::int, 0),
        COALESCE(v_row->>'ajuste_estado', ''), COALESCE(v_row->>'ajuste_motivo', ''), COALESCE(v_row->>'ajuste_por', ''),
        COALESCE(v_row->>'ajuste_at', ''), COALESCE(v_row->>'ajuste_previo', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado, estado_at = EXCLUDED.estado_at, estado_por = EXCLUDED.estado_por,
        motivo = EXCLUDED.motivo, updated_at = EXCLUDED.updated_at, despachador_id = EXCLUDED.despachador_id,
        despachador = EXCLUDED.despachador, confirmado_por = EXCLUDED.confirmado_por, confirmado_at = EXCLUDED.confirmado_at,
        entregado_por = EXCLUDED.entregado_por, entregado_at = EXCLUDED.entregado_at, total_cajas = EXCLUDED.total_cajas,
        detalle_unidades = EXCLUDED.detalle_unidades, pago = EXCLUDED.pago, tipo_pago = EXCLUDED.tipo_pago,
        nivel_precio = EXCLUDED.nivel_precio, excepcion_precio = EXCLUDED.excepcion_precio, total = EXCLUDED.total,
        tipo_pago_real = EXCLUDED.tipo_pago_real, total_final = EXCLUDED.total_final, cobro = EXCLUDED.cobro,
        cobrado_at = EXCLUDED.cobrado_at, cobrado_por = EXCLUDED.cobrado_por, conciliado_at = EXCLUDED.conciliado_at,
        conciliado_por = EXCLUDED.conciliado_por, monto = EXCLUDED.monto, moneda = EXCLUDED.moneda,
        borrado = EXCLUDED.borrado, borrado_motivo = EXCLUDED.borrado_motivo, borrado_por = EXCLUDED.borrado_por,
        borrado_at = EXCLUDED.borrado_at, factura = EXCLUDED.factura, nota_credito = EXCLUDED.nota_credito,
        pagado_usd = EXCLUDED.pagado_usd, saldo = EXCLUDED.saldo, pagos_pend = EXCLUDED.pagos_pend,
        ajuste_estado = EXCLUDED.ajuste_estado, ajuste_motivo = EXCLUDED.ajuste_motivo, ajuste_por = EXCLUDED.ajuste_por,
        ajuste_at = EXCLUDED.ajuste_at, ajuste_previo = EXCLUDED.ajuste_previo;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('pedidos', v_n);

  -- 5. PedidoItems (reemplaza los items de los pedidos importados)
  IF jsonb_array_length(COALESCE(payload->'PedidoItems', '[]'::jsonb)) > 0 THEN
    DELETE FROM public.pedido_items WHERE true; -- WHERE true: compatible con pg_safeupdate
    v_n := 0;
    FOR v_row IN SELECT * FROM jsonb_array_elements(payload->'PedidoItems') LOOP
      IF COALESCE(v_row->>'pedido_id', '') <> '' AND COALESCE(v_row->>'code', '') <> '' THEN
        INSERT INTO public.pedido_items (
          pedido_id, code, producto, cajas, unidades_caja, unidad, total_unidades,
          precio, desc_pronto, desc_efectivo_credito, desc_efectivo_pronto, entregadas, devueltas
        ) VALUES (
          v_row->>'pedido_id', UPPER(TRIM(v_row->>'code')), COALESCE(v_row->>'producto', ''),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'cajas', ''), ',', '.'), '')::numeric, 0),
          COALESCE(v_row->>'unidades_caja', ''), COALESCE(NULLIF(v_row->>'unidad', ''), 'unidades'),
          COALESCE(v_row->>'total_unidades', ''),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'precio', ''), ',', '.'), '')::numeric, 0),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'desc_pronto', ''), ',', '.'), '')::numeric, 0),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'desc_efectivo_credito', ''), ',', '.'), '')::numeric, 0),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'desc_efectivo_pronto', ''), ',', '.'), '')::numeric, 0),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'entregadas', ''), ',', '.'), '')::numeric, 0),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'devueltas', ''), ',', '.'), '')::numeric, 0)
        );
        v_n := v_n + 1;
      END IF;
    END LOOP;
    v_cont := v_cont || jsonb_build_object('pedido_items', v_n);
  END IF;

  -- 6. Pagos
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Pagos', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'id', '') <> '' THEN
      INSERT INTO public.pagos (
        id, pedido_id, fecha_pago, created_at, registrado_por, registrado_por_id,
        moneda, monto, tasa, monto_usd, referencia, tipo_pago_real, estado,
        conciliado_at, conciliado_por, motivo, comision_estado, comision_pct,
        comision_usd, comision_moneda, comision_monto, comision_tasa,
        comision_fecha, comision_ref, comision_pagada_at, comision_pagada_por
      ) VALUES (
        v_row->>'id', COALESCE(v_row->>'pedido_id', ''), SUBSTRING(COALESCE(v_row->>'fecha_pago', '') FROM 1 FOR 10),
        COALESCE(v_row->>'created_at', ''), COALESCE(v_row->>'registrado_por', ''), COALESCE(v_row->>'registrado_por_id', ''),
        COALESCE(NULLIF(v_row->>'moneda', ''), 'USD'),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'monto', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'tasa', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'monto_usd', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'referencia', ''), COALESCE(v_row->>'tipo_pago_real', ''),
        COALESCE(NULLIF(v_row->>'estado', ''), 'reportado'),
        COALESCE(v_row->>'conciliado_at', ''), COALESCE(v_row->>'conciliado_por', ''), COALESCE(v_row->>'motivo', ''),
        COALESCE(v_row->>'comision_estado', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'comision_pct', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'comision_usd', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'comision_moneda', ''),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'comision_monto', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'comision_tasa', ''), ',', '.'), '')::numeric, 0),
        SUBSTRING(COALESCE(v_row->>'comision_fecha', '') FROM 1 FOR 10),
        COALESCE(v_row->>'comision_ref', ''), COALESCE(v_row->>'comision_pagada_at', ''), COALESCE(v_row->>'comision_pagada_por', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado, monto = EXCLUDED.monto, moneda = EXCLUDED.moneda,
        tasa = EXCLUDED.tasa, monto_usd = EXCLUDED.monto_usd, referencia = EXCLUDED.referencia,
        conciliado_at = EXCLUDED.conciliado_at, conciliado_por = EXCLUDED.conciliado_por, motivo = EXCLUDED.motivo,
        comision_estado = EXCLUDED.comision_estado, comision_pct = EXCLUDED.comision_pct,
        comision_usd = EXCLUDED.comision_usd, comision_moneda = EXCLUDED.comision_moneda,
        comision_monto = EXCLUDED.comision_monto, comision_tasa = EXCLUDED.comision_tasa,
        comision_fecha = EXCLUDED.comision_fecha, comision_ref = EXCLUDED.comision_ref,
        comision_pagada_at = EXCLUDED.comision_pagada_at, comision_pagada_por = EXCLUDED.comision_pagada_por;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('pagos', v_n);

  -- 7. Inventario
  IF jsonb_array_length(COALESCE(payload->'Inventario', '[]'::jsonb)) > 0 THEN
    DELETE FROM public.inventario WHERE true; -- WHERE true: compatible con pg_safeupdate
    v_n := 0;
    FOR v_row IN SELECT * FROM jsonb_array_elements(payload->'Inventario') LOOP
      IF COALESCE(v_row->>'code', '') <> '' THEN
        INSERT INTO public.inventario (fecha, code, producto, cajas, tipo, nota, usuario)
        VALUES (
          COALESCE(v_row->>'fecha', ''), UPPER(TRIM(v_row->>'code')), COALESCE(v_row->>'producto', ''),
          COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'cajas', ''), ',', '.'), '')::numeric, 0),
          COALESCE(v_row->>'tipo', ''), COALESCE(v_row->>'nota', ''), COALESCE(v_row->>'usuario', '')
        );
        v_n := v_n + 1;
      END IF;
    END LOOP;
    v_cont := v_cont || jsonb_build_object('inventario', v_n);
  END IF;

  -- 8. Historial
  IF jsonb_array_length(COALESCE(payload->'Historial', '[]'::jsonb)) > 0 THEN
    DELETE FROM public.historial WHERE true; -- WHERE true: compatible con pg_safeupdate
    v_n := 0;
    FOR v_row IN SELECT * FROM jsonb_array_elements(payload->'Historial') LOOP
      INSERT INTO public.historial (fecha, pedido_id, usuario, accion, detalle)
      VALUES (
        COALESCE(v_row->>'fecha', ''), COALESCE(v_row->>'pedido_id', ''),
        COALESCE(v_row->>'usuario', ''), COALESCE(v_row->>'accion', ''), COALESCE(v_row->>'detalle', '')
      );
      v_n := v_n + 1;
    END LOOP;
    v_cont := v_cont || jsonb_build_object('historial', v_n);
  END IF;

  -- 9. PedidosWeb
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'PedidosWeb', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'id', '') <> '' THEN
      INSERT INTO public.pedidos_web (
        id, fecha, created_at, vendedor_id, vendedor, negocio, contacto, rif_cedula, telefono, direccion,
        items, tipo_pago, total_cajas, total, nota, estado, pedido_id, atendido_por, atendido_at, motivo,
        cliente_id, latitud, longitud
      ) VALUES (
        v_row->>'id', COALESCE(v_row->>'fecha', ''), COALESCE(v_row->>'created_at', ''),
        COALESCE(v_row->>'vendedor_id', ''), COALESCE(v_row->>'vendedor', ''), COALESCE(v_row->>'negocio', ''),
        COALESCE(v_row->>'contacto', ''), COALESCE(v_row->>'rif_cedula', ''), COALESCE(v_row->>'telefono', ''),
        COALESCE(v_row->>'direccion', ''), COALESCE(v_row->>'items', '[]'), COALESCE(v_row->>'tipo_pago', 'credito'),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'total_cajas', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'total', ''), ',', '.'), '')::numeric, 0),
        COALESCE(v_row->>'nota', ''), COALESCE(NULLIF(v_row->>'estado', ''), 'nuevo'),
        COALESCE(v_row->>'pedido_id', ''), COALESCE(v_row->>'atendido_por', ''), COALESCE(v_row->>'atendido_at', ''),
        COALESCE(v_row->>'motivo', ''), COALESCE(v_row->>'cliente_id', ''),
        COALESCE(v_row->>'latitud', ''), COALESCE(v_row->>'longitud', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado, pedido_id = EXCLUDED.pedido_id,
        atendido_por = EXCLUDED.atendido_por, atendido_at = EXCLUDED.atendido_at, motivo = EXCLUDED.motivo;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('pedidos_web', v_n);

  -- 10. Config
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Config', '[]'::jsonb)) LOOP
    IF COALESCE(v_row->>'clave', '') <> '' THEN
      INSERT INTO public.config (clave, valor, nota)
      VALUES (TRIM(v_row->>'clave'), COALESCE(v_row->>'valor', ''), COALESCE(v_row->>'nota', ''))
      ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, nota = EXCLUDED.nota;
    END IF;
  END LOOP;

  -- 11. Tasas
  v_n := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'Tasas', '[]'::jsonb)) LOOP
    IF SUBSTRING(COALESCE(v_row->>'fecha', '') FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN
      INSERT INTO public.tasas (fecha, tasa, fuente, updated_at)
      VALUES (
        SUBSTRING(v_row->>'fecha' FROM 1 FOR 10),
        COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'tasa', ''), ',', '.'), '')::numeric, 0),
        COALESCE(NULLIF(v_row->>'fuente', ''), 'bcv'),
        COALESCE(v_row->>'updated_at', '')
      )
      ON CONFLICT (fecha) DO UPDATE SET tasa = EXCLUDED.tasa, fuente = EXCLUDED.fuente, updated_at = EXCLUDED.updated_at;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_cont := v_cont || jsonb_build_object('tasas', v_n);

  RETURN jsonb_build_object('ok', true, 'importados', v_cont);
END;
$$;

-- ==================== 6. MOTOR RPC TRANSACCIONAL (skala_db) ====================
-- Ejecuta login, verificación de sesión, lecturas y escrituras atómicas en una sola llamada.
-- Nunca expone pin_hash ni CRM_SECRET fuera de PostgreSQL.
--
-- Reglas de seguridad (Fase B):
--   * Sin sesión solo se pueden usar las operaciones públicas acotadas:
--     catalogo_publico, vendedores_publico, buscar_cliente_web, pedido_web, asignar_vendedor_web
--     y 'leer' de las tablas públicas (Precios, Config). Nunca Pedidos, Clientes, Pagos ni Usuarios.
--   * 'escribir' exige sesión y valida el rol por tabla (y por fila en Pedidos, PedidoItems, Historial,
--     PedidosWeb y Pagos). Si un cambio no está permitido se deshace TODO el lote.
--   * Las escrituras se serializan con un advisory lock (equivale a LockService de Apps Script) y el
--     correlativo SKL-AAMMDD-NNN se reasigna en el servidor si dos vendedores chocan.
--   * Login con bloqueo de 10 minutos tras 5 intentos fallidos (igual que Code.gs).

CREATE OR REPLACE FUNCTION public.skala_num(p text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(NULLIF(regexp_replace(trim(COALESCE(p, '')), ',', '.'), '')::numeric, 0);
EXCEPTION WHEN others THEN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.skala_db(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_op text := COALESCE(payload->>'op', '');
  v_token text := COALESCE(payload->>'token', '');
  v_ses jsonb := NULL;
  v_roles jsonb := '[]'::jsonb;
  v_gestion boolean := false;
  v_toma boolean := false;
  v_u public.usuarios%ROWTYPE;
  v_usuario_norm text;
  v_pin text;
  v_clave_intento text;
  v_tablas text[];
  v_t text;
  v_datos jsonb := '{}'::jsonb;
  v_cambio jsonb;
  v_tabla text;
  v_modo text;
  v_fila jsonb;
  v_filas jsonb;
  v_ped public.pedidos%ROWTYPE;
  v_existe boolean;
  v_pid text;
  v_dup text;
  v_prefijo text;
  v_n integer;
  v_nuevo_id text;
  v_remap jsonb := '{}'::jsonb;
  v_pw public.pedidos_web%ROWTYPE;
  v_pg public.pagos%ROWTYPE;
  v_cli public.clientes%ROWTYPE;
  v_vend public.usuarios%ROWTYPE;
  v_por_tel boolean := false;
  v_q text;
  v_tel text;
  v_id text;
  v_items jsonb;
  v_fuente text;
  v_pct numeric;
  v_msg text;
  v_hint text;
  c_publicas CONSTANT text[] := ARRAY['Precios', 'Config'];
  c_ok_tipos CONSTANT text[] := ARRAY['credito', 'pronto', 'efectivo_credito', 'efectivo_pronto'];
BEGIN
  -- 1) Importación masiva desde Google Sheets (tiene sus propios controles)
  IF v_op = 'importar' THEN
    RETURN public.skala_importar(payload);
  END IF;

  -- 2) Login (verifica clave con SHA-256 + CRM_SECRET dentro de PostgreSQL) con bloqueo por fuerza bruta
  IF v_op = 'login' THEN
    v_usuario_norm := lower(regexp_replace(
      translate(trim(COALESCE(payload->>'usuario', '')), 'áàäéèëíìïóòöúùüñÁÀÄÉÈËÍÌÏÓÒÖÚÙÜÑ', 'aaaeeeiiiooouuunAAAEEEIIIOOOUUUN'),
      '[^a-zA-Z0-9._-]', '', 'g'
    ));
    v_pin := left(COALESCE(payload->>'clave', payload->>'pin', ''), 200);
    v_clave_intento := 'login:' || v_usuario_norm;
    IF public.skala_intentos_de(v_clave_intento, interval '10 minutes') >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Demasiados intentos. Esperá 10 minutos.', 'code', 'locked');
    END IF;

    SELECT * INTO v_u
    FROM public.usuarios
    WHERE lower(usuario) = v_usuario_norm AND activo = true
    LIMIT 1;

    IF NOT FOUND OR v_pin = '' OR v_u.pin_hash = '' OR public.skala_hash_pin(v_u.id, v_pin) <> v_u.pin_hash THEN
      PERFORM public.skala_sumar_intento(v_clave_intento, interval '10 minutes');
      RETURN jsonb_build_object('ok', false, 'error', 'Usuario o clave incorrecta.', 'code', 'bad_pin');
    END IF;

    PERFORM public.skala_limpiar_intentos(v_clave_intento);
    RETURN jsonb_build_object(
      'ok', true,
      'token', public.skala_crear_token(v_u.id, lower(COALESCE(payload->>'dispositivo', 'false')) = 'true'),
      'usuario', public.skala_usuario_publico(v_u)
    );
  END IF;

  -- 3) Verificar token si viene incluido
  IF v_token <> '' THEN
    v_ses := public.skala_verificar_token(v_token);
  END IF;
  IF v_ses IS NOT NULL THEN
    v_roles := COALESCE(v_ses->'roles', '[]'::jsonb);
    v_gestion := (v_roles ? 'master') OR (v_roles ? 'admin');
    v_toma := v_gestion OR (v_roles ? 'vendedor');
  END IF;

  IF v_op = 'yo' THEN
    IF v_ses IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sesión vencida. Ingresá de nuevo.', 'code', 'auth');
    END IF;
    RETURN jsonb_build_object('ok', true, 'usuario', v_ses);
  END IF;

  -- ==================== OPERACIONES PÚBLICAS ACOTADAS (catálogo web) ====================

  -- Precios + lista de códigos agotados. Nunca devuelve pedidos, ítems ni cantidades de inventario.
  IF v_op = 'catalogo_publico' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'precios', COALESCE((SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.code) FROM public.precios pr), '[]'::jsonb),
      'agotados', COALESCE((
        SELECT jsonb_agg(s.code ORDER BY s.code)
        FROM (
          SELECT upper(i.code) AS code, SUM(round(i.cajas)) AS cargado
          FROM public.inventario i
          WHERE i.code <> ''
          GROUP BY upper(i.code)
        ) s
        WHERE s.cargado - COALESCE((
          SELECT SUM(pi.cajas)
          FROM public.pedido_items pi
          JOIN public.pedidos p ON p.id = pi.pedido_id
          WHERE upper(pi.code) = s.code
            AND p.borrado = false
            AND p.estado IN ('confirmado', 'en_ruta', 'entregado')
        ), 0) <= 0
      ), '[]'::jsonb)
    );
  END IF;

  -- Vendedores activos (para que el cliente elija a quién mandar el pedido por WhatsApp, filtrado opcional por catálogo)
  IF v_op = 'vendedores_publico' THEN
    RETURN jsonb_build_object('ok', true, 'vendedores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id,
        'usuario', u.usuario,
        'nombre', u.nombre,
        'telefono', u.telefono,
        'catalogo', CASE WHEN lower(COALESCE(u.catalogo, '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(u.catalogo) ELSE 'ambos' END,
        'rutas', COALESCE(u.rutas, '')
      ) ORDER BY u.nombre)
      FROM public.usuarios u
      WHERE u.activo = true
        AND 'vendedor' = ANY(public.skala_roles_de(u.rol))
        AND (
          lower(COALESCE(payload->>'catalogo', '')) NOT IN ('skala', 'distribuidora')
          OR (CASE WHEN lower(COALESCE(u.catalogo, '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(u.catalogo) ELSE 'ambos' END) IN (lower(payload->>'catalogo'), 'ambos')
        )
    ), '[]'::jsonb));
  END IF;

  -- El cliente se busca por su teléfono o RIF (máx. 30 búsquedas por minuto, igual que Code.gs)
  IF v_op = 'buscar_cliente_web' THEN
    v_q := regexp_replace(COALESCE(payload->>'q', ''), '\D', '', 'g');
    IF length(v_q) < 6 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Escribí tu teléfono o RIF completo.', 'code', 'corto');
    END IF;
    IF public.skala_intentos_de('busq_web', interval '1 minute') >= 30 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Muchas búsquedas. Probá en un minuto.', 'code', 'limite');
    END IF;
    PERFORM public.skala_sumar_intento('busq_web', interval '1 minute');

    SELECT * INTO v_cli FROM public.clientes c
    WHERE c.deleted NOT IN ('1', 'true')
      AND (public.skala_mismo_tel(c.telefono, v_q) OR public.skala_mismo_tel(c.telefono2, v_q))
    ORDER BY c.updated_at DESC
    LIMIT 1;
    IF FOUND THEN
      v_por_tel := true;
    ELSE
      SELECT * INTO v_cli FROM public.clientes c
      WHERE c.deleted NOT IN ('1', 'true') AND public.skala_mismo_rif(c.rif_cedula, v_q)
      ORDER BY c.updated_at DESC
      LIMIT 1;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', true, 'cliente', NULL);
      END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'cliente', jsonb_build_object(
      'id', v_cli.id, 'negocio', v_cli.nombre, 'contacto', v_cli.contacto, 'direccion', v_cli.direccion,
      'rif_cedula', v_cli.rif_cedula,
      'telefono', CASE WHEN v_por_tel THEN v_cli.telefono ELSE '' END,
      'ubicacion', (v_cli.latitud <> '' AND v_cli.longitud <> ''),
      'ruta', public.skala_ruta_cliente(v_cli.id, v_cli.ruta, v_cli.nombre, v_cli.direccion),
      'vendedor_id', COALESCE(v_cli.vendedor_id, '')
    ));
  END IF;

  -- Pedido armado por el cliente en el catálogo: SOLO inserta (nunca pisa uno existente)
  IF v_op = 'pedido_web' THEN
    v_fila := COALESCE(payload->'fila', '{}'::jsonb);
    v_id := upper(COALESCE(v_fila->>'id', ''));
    IF v_id !~ '^WEB-[A-Z0-9]{4,12}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Referencia de pedido inválida.', 'code', 'ref');
    END IF;
    IF COALESCE(v_fila->>'negocio', '') = '' AND COALESCE(v_fila->>'contacto', '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Escribí tu nombre o el de tu negocio.', 'code', 'cliente');
    END IF;
    v_tel := regexp_replace(COALESCE(v_fila->>'telefono', ''), '\D', '', 'g');
    IF length(v_tel) < 7 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Escribí tu teléfono (para que el vendedor te contacte).', 'code', 'telefono');
    END IF;
    BEGIN
      v_items := (COALESCE(v_fila->>'items', '[]'))::jsonb;
    EXCEPTION WHEN others THEN
      v_items := NULL;
    END;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 OR jsonb_array_length(v_items) > 100 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'El pedido no tiene productos.', 'code', 'empty');
    END IF;
    IF EXISTS (SELECT 1 FROM public.pedidos_web WHERE id = v_id) THEN
      RETURN jsonb_build_object('ok', true, 'duplicado', true, 'id', v_id);
    END IF;
    IF COALESCE(v_fila->>'vendedor_id', '') <> '' THEN
      SELECT * INTO v_vend FROM public.usuarios u
      WHERE u.id = v_fila->>'vendedor_id' AND u.activo = true AND 'vendedor' = ANY(public.skala_roles_de(u.rol));
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Ese vendedor no está disponible.', 'code', 'vendedor');
      END IF;
    END IF;
    v_clave_intento := 'web_' || v_tel;
    IF public.skala_intentos_de(v_clave_intento, interval '1 hour') >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ya enviaste varios pedidos. Esperá un rato o escribinos por WhatsApp.', 'code', 'limite');
    END IF;
    PERFORM public.skala_sumar_intento(v_clave_intento, interval '1 hour');

    INSERT INTO public.pedidos_web (
      id, fecha, created_at, vendedor_id, vendedor, negocio, contacto, rif_cedula, telefono, direccion,
      items, tipo_pago, total_cajas, total, nota, estado, pedido_id, atendido_por, atendido_at, motivo,
      cliente_id, latitud, longitud
    ) VALUES (
      v_id,
      left(COALESCE(v_fila->>'fecha', ''), 20),
      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      COALESCE(v_vend.id, ''), COALESCE(v_vend.nombre, ''),
      left(COALESCE(NULLIF(v_fila->>'negocio', ''), v_fila->>'contacto', ''), 120),
      left(COALESCE(v_fila->>'contacto', ''), 120),
      left(upper(COALESCE(v_fila->>'rif_cedula', '')), 30),
      left(COALESCE(v_fila->>'telefono', ''), 30),
      left(COALESCE(v_fila->>'direccion', ''), 250),
      v_items::text,
      CASE WHEN COALESCE(v_fila->>'tipo_pago', '') = ANY(c_ok_tipos) THEN v_fila->>'tipo_pago' ELSE 'credito' END,
      public.skala_num(v_fila->>'total_cajas'),
      public.skala_num(v_fila->>'total'),
      left(COALESCE(v_fila->>'nota', ''), 300),
      'nuevo', '', '', '', '',
      left(COALESCE(v_fila->>'cliente_id', ''), 60),
      left(COALESCE(v_fila->>'latitud', ''), 20),
      left(COALESCE(v_fila->>'longitud', ''), 20)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  -- El cliente elige vendedor después de enviar: solo si el pedido sigue 'nuevo' y sin vendedor
  IF v_op = 'asignar_vendedor_web' THEN
    v_id := upper(COALESCE(payload->>'id', ''));
    SELECT * INTO v_pw FROM public.pedidos_web WHERE id = v_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Pedido no encontrado.', 'code', 'not_found');
    END IF;
    SELECT * INTO v_vend FROM public.usuarios u
    WHERE u.id = COALESCE(payload->>'vendedor_id', '') AND u.activo = true AND 'vendedor' = ANY(public.skala_roles_de(u.rol));
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ese vendedor no está disponible.', 'code', 'vendedor');
    END IF;
    IF v_pw.estado <> 'nuevo' OR (v_pw.vendedor_id <> '' AND v_pw.vendedor_id <> v_vend.id) THEN
      RETURN jsonb_build_object('ok', true, 'sin_cambios', true);
    END IF;
    UPDATE public.pedidos_web
    SET vendedor_id = v_vend.id, vendedor = v_vend.nombre
    WHERE id = v_id AND estado = 'nuevo' AND vendedor_id IN ('', v_vend.id);
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ==================== 4) LECTURA DE TABLAS (nunca devuelve pin_hash, solo tiene_pin) ====================
  IF v_op = 'leer' THEN
    SELECT COALESCE(array_agg(x), ARRAY[]::text[])
    INTO v_tablas
    FROM jsonb_array_elements_text(COALESCE(payload->'tablas', '[]'::jsonb)) AS x;

    -- Sin sesión válida SOLO se leen tablas públicas. Se ignora cualquier 'requiere_sesion: false' del cliente.
    IF v_ses IS NULL AND (
      lower(COALESCE(payload->>'requiere_sesion', 'false')) = 'true'
      OR EXISTS (SELECT 1 FROM unnest(v_tablas) AS t WHERE NOT (t = ANY(c_publicas)))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sesión vencida. Ingresá de nuevo.', 'code', 'auth');
    END IF;

    FOREACH v_t IN ARRAY v_tablas LOOP
      IF v_t = 'Usuarios' THEN
        v_datos := v_datos || jsonb_build_object('Usuarios', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', id, 'usuario', usuario, 'nombre', nombre, 'rol', rol,
            'activo', activo, 'created_at', created_at, 'telefono', telefono,
            'comision_pct', comision_pct,
            'catalogo', CASE WHEN lower(COALESCE(catalogo, '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(catalogo) ELSE 'ambos' END,
            'rutas', COALESCE(rutas, ''),
            'tiene_pin', (pin_hash <> '')
          ) ORDER BY id) FROM public.usuarios
        ), '[]'::jsonb));
      ELSIF v_t = 'Clientes' THEN
        v_datos := v_datos || jsonb_build_object('Clientes', COALESCE((
          SELECT jsonb_agg(to_jsonb(c) ORDER BY updated_at DESC) FROM public.clientes c
        ), '[]'::jsonb));
      ELSIF v_t = 'Pedidos' THEN
        v_datos := v_datos || jsonb_build_object('Pedidos', COALESCE((
          SELECT jsonb_agg(to_jsonb(p) ORDER BY created_at DESC) FROM public.pedidos p
        ), '[]'::jsonb));
      ELSIF v_t = 'PedidoItems' THEN
        v_datos := v_datos || jsonb_build_object('PedidoItems', COALESCE((
          SELECT jsonb_agg(to_jsonb(pi) ORDER BY id) FROM public.pedido_items pi
        ), '[]'::jsonb));
      ELSIF v_t = 'Historial' THEN
        v_datos := v_datos || jsonb_build_object('Historial', COALESCE((
          SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.historial h
        ), '[]'::jsonb));
      ELSIF v_t = 'Precios' THEN
        v_datos := v_datos || jsonb_build_object('Precios', COALESCE((
          SELECT jsonb_agg(to_jsonb(pr) ORDER BY code) FROM public.precios pr
        ), '[]'::jsonb));
      ELSIF v_t = 'Inventario' THEN
        v_datos := v_datos || jsonb_build_object('Inventario', COALESCE((
          SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventario i
        ), '[]'::jsonb));
      ELSIF v_t = 'PedidosWeb' THEN
        v_datos := v_datos || jsonb_build_object('PedidosWeb', COALESCE((
          SELECT jsonb_agg(to_jsonb(pw) ORDER BY created_at DESC) FROM public.pedidos_web pw
        ), '[]'::jsonb));
      ELSIF v_t = 'Config' THEN
        v_datos := v_datos || jsonb_build_object('Config', COALESCE((
          SELECT jsonb_agg(to_jsonb(cf)) FROM public.config cf
        ), '[]'::jsonb));
      ELSIF v_t = 'Pagos' THEN
        v_datos := v_datos || jsonb_build_object('Pagos', COALESCE((
          SELECT jsonb_agg(to_jsonb(pg) ORDER BY created_at) FROM public.pagos pg
        ), '[]'::jsonb));
      ELSIF v_t = 'Tasas' THEN
        v_datos := v_datos || jsonb_build_object('Tasas', COALESCE((
          SELECT jsonb_agg(to_jsonb(ts) ORDER BY fecha) FROM public.tasas ts
        ), '[]'::jsonb));
      ELSIF v_t = 'Visitas' THEN
        -- cada vendedor lee solo sus visitas; gestión, todas
        v_datos := v_datos || jsonb_build_object('Visitas', COALESCE((
          SELECT jsonb_agg(to_jsonb(vi) ORDER BY created_at DESC) FROM public.visitas vi
          WHERE v_ses IS NOT NULL AND (v_gestion OR vi.vendedor_id = (v_ses->>'id'))
        ), '[]'::jsonb));
      END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'sesion', v_ses, 'datos', v_datos);
  END IF;

  -- ==================== 5) ESCRITURA TRANSACCIONAL CON RBAC POR TABLA ====================
  IF v_op = 'escribir' THEN
    IF v_ses IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sesión vencida. Ingresá de nuevo.', 'code', 'auth');
    END IF;

    -- Serializa las escrituras (como LockService.getScriptLock en Code.gs): evita correlativos y stock en carrera
    PERFORM pg_advisory_xact_lock(hashtext('skala_escribir'));

    -- Sub-bloque con EXCEPTION = savepoint: si un cambio no está permitido se deshace todo el lote
    BEGIN
      FOR v_cambio IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'cambios', '[]'::jsonb)) LOOP
        v_tabla := COALESCE(v_cambio->>'tabla', '');
        v_modo := COALESCE(v_cambio->>'modo', 'upsert');
        v_fila := COALESCE(v_cambio->'fila', '{}'::jsonb);

        -- ---------------- Usuarios: Master todo; Administración el % de comisión, el catálogo y las rutas asignadas ----------------
        IF v_tabla = 'Usuarios' THEN
          IF v_roles ? 'master' THEN
            INSERT INTO public.usuarios (id, usuario, nombre, rol, pin_hash, activo, created_at, telefono, comision_pct, catalogo, rutas)
            VALUES (
              v_fila->>'id',
              COALESCE(v_fila->>'usuario', ''),
              COALESCE(v_fila->>'nombre', ''),
              COALESCE(v_fila->>'rol', 'vendedor'),
              CASE
                WHEN COALESCE(v_fila->>'pin_plano', '') <> '' THEN public.skala_hash_pin(v_fila->>'id', v_fila->>'pin_plano')
                ELSE COALESCE((SELECT pin_hash FROM public.usuarios WHERE id = v_fila->>'id'), '')
              END,
              COALESCE((v_fila->>'activo')::boolean, true),
              COALESCE(v_fila->>'created_at', ''),
              COALESCE(v_fila->>'telefono', ''),
              COALESCE(NULLIF(public.skala_num(v_fila->>'comision_pct'), 0), 3),
              CASE
                WHEN lower(COALESCE(v_fila->>'catalogo', '')) IN ('skala', 'distribuidora', 'ambos') THEN lower(v_fila->>'catalogo')
                ELSE COALESCE((SELECT catalogo FROM public.usuarios WHERE id = v_fila->>'id'), 'ambos')
              END,
              CASE
                WHEN v_fila ? 'rutas' THEN COALESCE(v_fila->>'rutas', '')
                ELSE COALESCE((SELECT rutas FROM public.usuarios WHERE id = v_fila->>'id'), '')
              END
            )
            ON CONFLICT (id) DO UPDATE SET
              usuario = EXCLUDED.usuario,
              nombre = EXCLUDED.nombre,
              rol = EXCLUDED.rol,
              pin_hash = CASE WHEN COALESCE(v_fila->>'pin_plano', '') <> '' THEN EXCLUDED.pin_hash ELSE public.usuarios.pin_hash END,
              activo = EXCLUDED.activo,
              telefono = EXCLUDED.telefono,
              comision_pct = EXCLUDED.comision_pct,
              catalogo = EXCLUDED.catalogo,
              rutas = EXCLUDED.rutas;
          ELSIF v_roles ? 'admin' THEN
            v_pct := public.skala_num(v_fila->>'comision_pct');
            IF v_pct > 0 AND v_pct <= 100 THEN
              UPDATE public.usuarios SET comision_pct = v_pct WHERE id = COALESCE(v_fila->>'id', '');
            END IF;
            IF lower(COALESCE(v_fila->>'catalogo', '')) IN ('skala', 'distribuidora', 'ambos') THEN
              UPDATE public.usuarios SET catalogo = lower(v_fila->>'catalogo') WHERE id = COALESCE(v_fila->>'id', '');
            END IF;
            IF v_fila ? 'rutas' THEN
              UPDATE public.usuarios SET rutas = COALESCE(v_fila->>'rutas', '') WHERE id = COALESCE(v_fila->>'id', '');
            END IF;
          ELSIF (v_roles ? 'vendedor') AND COALESCE(v_fila->>'id', '') = (v_ses->>'id') AND (v_fila ? 'rutas') THEN
            UPDATE public.usuarios SET rutas = COALESCE(v_fila->>'rutas', '') WHERE id = (v_ses->>'id');
          ELSE
            RAISE EXCEPTION 'Sin permiso para modificar usuarios.' USING HINT = 'forbidden';
          END IF;

        -- ---------------- Clientes: base unificada compartida entre vendedores y dividida por ruta / zona ----------------
        ELSIF v_tabla = 'Clientes' THEN
          IF NOT v_toma THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          INSERT INTO public.clientes (id, nombre, rif_cedula, direccion, latitud, longitud, telefono, updated_at, sync_status, deleted, contacto, telefono2, vendedor_id, created_at, ruta)
          VALUES (
            v_fila->>'id', COALESCE(v_fila->>'nombre', ''), COALESCE(v_fila->>'rif_cedula', ''),
            COALESCE(v_fila->>'direccion', ''), COALESCE(v_fila->>'latitud', ''), COALESCE(v_fila->>'longitud', ''),
            COALESCE(v_fila->>'telefono', ''), COALESCE(v_fila->>'updated_at', ''),
            COALESCE(NULLIF(v_fila->>'sync_status', '')::int, 1), COALESCE(v_fila->>'deleted', '0'),
            COALESCE(v_fila->>'contacto', ''), COALESCE(v_fila->>'telefono2', ''),
            COALESCE(v_fila->>'vendedor_id', ''), COALESCE(v_fila->>'created_at', ''),
            public.skala_ruta_cliente(v_fila->>'id', COALESCE(v_fila->>'ruta', ''), COALESCE(v_fila->>'nombre', ''), COALESCE(v_fila->>'direccion', ''))
          )
          ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre, rif_cedula = EXCLUDED.rif_cedula, direccion = EXCLUDED.direccion,
            latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud, telefono = EXCLUDED.telefono,
            updated_at = EXCLUDED.updated_at, sync_status = EXCLUDED.sync_status, deleted = EXCLUDED.deleted,
            contacto = EXCLUDED.contacto, telefono2 = EXCLUDED.telefono2,
            vendedor_id = CASE WHEN v_gestion THEN EXCLUDED.vendedor_id ELSE public.clientes.vendedor_id END,
            ruta = CASE
              WHEN COALESCE(v_fila->>'ruta', '') <> '' THEN EXCLUDED.ruta
              ELSE COALESCE(NULLIF(public.clientes.ruta, ''), EXCLUDED.ruta)
            END;

        -- ---------------- Pedidos: altas por quien toma pedidos; cambios por gestión, su vendedor o su despachador ----------------
        ELSIF v_tabla = 'Pedidos' THEN
          v_pid := COALESCE(v_fila->>'id', '');
          IF v_pid = '' THEN
            RAISE EXCEPTION 'Pedido sin número.' USING HINT = 'pedido';
          END IF;
          v_pid := COALESCE(v_remap->>v_pid, v_pid);
          v_fila := jsonb_set(v_fila, '{id}', to_jsonb(v_pid));
          SELECT * INTO v_ped FROM public.pedidos WHERE id = v_pid;
          v_existe := FOUND;

          IF v_modo = 'nuevo' OR NOT v_existe THEN
            IF NOT v_toma OR (NOT v_gestion AND COALESCE(v_fila->>'vendedor_id', '') <> (v_ses->>'id')) THEN
              RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
            END IF;
            -- un vendedor solo crea pedidos pendientes, sin despachador ni cobro (eso lo hace Administración)
            IF NOT v_gestion THEN
              v_fila := v_fila || jsonb_build_object('estado', 'pendiente', 'despachador_id', '', 'despachador', '', 'cobro', '');
            END IF;
            -- Idempotencia: el mismo client_ref (reintento o cola sin señal) no crea un segundo pedido
            IF COALESCE(v_fila->>'client_ref', '') <> '' THEN
              SELECT id INTO v_dup FROM public.pedidos WHERE client_ref = v_fila->>'client_ref' LIMIT 1;
              IF FOUND THEN
                RETURN jsonb_build_object('ok', true, 'duplicado', true, 'id', v_dup);
              END IF;
            END IF;
            -- Choque de correlativo entre dos vendedores: se asigna el siguiente libre en el servidor
            IF v_existe THEN
              v_prefijo := substring(v_pid FROM '^(SKL-[0-9]{6}-)');
              IF v_prefijo IS NULL THEN
                RAISE EXCEPTION 'Número de pedido inválido.' USING HINT = 'pedido';
              END IF;
              SELECT COALESCE(MAX(NULLIF(regexp_replace(substr(p.id, length(v_prefijo) + 1), '\D', '', 'g'), '')::int), 0) + 1
              INTO v_n
              FROM public.pedidos p
              WHERE left(p.id, length(v_prefijo)) = v_prefijo;
              v_nuevo_id := v_prefijo || lpad(v_n::text, 3, '0');
              v_remap := v_remap || jsonb_build_object(v_pid, v_nuevo_id);
              v_fila := jsonb_set(v_fila, '{id}', to_jsonb(v_nuevo_id));
            END IF;
          ELSIF NOT v_gestion THEN
            IF NOT (
              ((v_roles ? 'vendedor') AND v_ped.vendedor_id = (v_ses->>'id'))
              OR ((v_roles ? 'despachador') AND v_ped.despachador_id = (v_ses->>'id'))
            ) THEN
              RAISE EXCEPTION 'Pedido no encontrado.' USING HINT = 'not_found';
            END IF;
            IF COALESCE(v_fila->>'despachador_id', '') <> v_ped.despachador_id THEN
              RAISE EXCEPTION 'Solo Administración asigna el despachador.' USING HINT = 'forbidden';
            END IF;
          END IF;

          INSERT INTO public.pedidos (
            id, fecha, vendedor_id, vendedor, cliente_id, cliente, negocio, total_cajas, detalle_unidades,
            pago, nota, estado, estado_at, estado_por, motivo, client_ref, created_at, updated_at,
            despachador_id, despachador, confirmado_por, confirmado_at, entregado_por, entregado_at,
            documento, dias_credito, cobro, cobrado_at, cobrado_por, conciliado_at, conciliado_por,
            monto, moneda, nivel_precio, excepcion_precio, tipo_pago, total, tipo_pago_real, total_final,
            web_id, borrado, borrado_motivo, borrado_por, borrado_at, factura, nota_credito,
            pagado_usd, saldo, pagos_pend, ajuste_estado, ajuste_motivo, ajuste_por, ajuste_at, ajuste_previo,
            canal_pedido, gps_lat, gps_lng, gps_dist_m
          ) VALUES (
            v_fila->>'id', COALESCE(v_fila->>'fecha', ''), COALESCE(v_fila->>'vendedor_id', ''), COALESCE(v_fila->>'vendedor', ''),
            COALESCE(v_fila->>'cliente_id', ''), COALESCE(v_fila->>'cliente', ''), COALESCE(v_fila->>'negocio', ''),
            COALESCE(NULLIF(v_fila->>'total_cajas', '')::numeric, 0), COALESCE(v_fila->>'detalle_unidades', ''),
            COALESCE(v_fila->>'pago', ''), COALESCE(v_fila->>'nota', ''), COALESCE(NULLIF(v_fila->>'estado', ''), 'pendiente'),
            COALESCE(v_fila->>'estado_at', ''), COALESCE(v_fila->>'estado_por', ''), COALESCE(v_fila->>'motivo', ''),
            COALESCE(v_fila->>'client_ref', ''), COALESCE(v_fila->>'created_at', ''), COALESCE(v_fila->>'updated_at', ''),
            COALESCE(v_fila->>'despachador_id', ''), COALESCE(v_fila->>'despachador', ''),
            COALESCE(v_fila->>'confirmado_por', ''), COALESCE(v_fila->>'confirmado_at', ''),
            COALESCE(v_fila->>'entregado_por', ''), COALESCE(v_fila->>'entregado_at', ''),
            COALESCE(v_fila->>'documento', ''), COALESCE(NULLIF(v_fila->>'dias_credito', '')::int, 0),
            COALESCE(v_fila->>'cobro', ''), COALESCE(v_fila->>'cobrado_at', ''), COALESCE(v_fila->>'cobrado_por', ''),
            COALESCE(v_fila->>'conciliado_at', ''), COALESCE(v_fila->>'conciliado_por', ''),
            COALESCE(v_fila->>'monto', ''), COALESCE(v_fila->>'moneda', ''),
            COALESCE(NULLIF(v_fila->>'nivel_precio', ''), 'menor'), COALESCE((v_fila->>'excepcion_precio')::boolean, false),
            COALESCE(v_fila->>'tipo_pago', ''), COALESCE(v_fila->>'total', ''), COALESCE(v_fila->>'tipo_pago_real', ''),
            COALESCE(v_fila->>'total_final', ''), COALESCE(v_fila->>'web_id', ''),
            COALESCE((v_fila->>'borrado')::boolean, false), COALESCE(v_fila->>'borrado_motivo', ''),
            COALESCE(v_fila->>'borrado_por', ''), COALESCE(v_fila->>'borrado_at', ''),
            COALESCE(v_fila->>'factura', ''), COALESCE(v_fila->>'nota_credito', ''),
            COALESCE(NULLIF(v_fila->>'pagado_usd', '')::numeric, 0), COALESCE(v_fila->>'saldo', ''),
            COALESCE(NULLIF(v_fila->>'pagos_pend', '')::int, 0),
            COALESCE(v_fila->>'ajuste_estado', ''), COALESCE(v_fila->>'ajuste_motivo', ''),
            COALESCE(v_fila->>'ajuste_por', ''), COALESCE(v_fila->>'ajuste_at', ''), COALESCE(v_fila->>'ajuste_previo', ''),
            CASE WHEN COALESCE(v_fila->>'canal_pedido', '') IN ('en_persona', 'online_telefono') THEN v_fila->>'canal_pedido' ELSE '' END,
            COALESCE(v_fila->>'gps_lat', ''), COALESCE(v_fila->>'gps_lng', ''), COALESCE(v_fila->>'gps_dist_m', '')
          )
          ON CONFLICT (id) DO UPDATE SET
            total_cajas = EXCLUDED.total_cajas, detalle_unidades = EXCLUDED.detalle_unidades,
            pago = EXCLUDED.pago, nota = EXCLUDED.nota, estado = EXCLUDED.estado,
            estado_at = EXCLUDED.estado_at, estado_por = EXCLUDED.estado_por, motivo = EXCLUDED.motivo,
            updated_at = EXCLUDED.updated_at, despachador_id = EXCLUDED.despachador_id, despachador = EXCLUDED.despachador,
            confirmado_por = EXCLUDED.confirmado_por, confirmado_at = EXCLUDED.confirmado_at,
            entregado_por = EXCLUDED.entregado_por, entregado_at = EXCLUDED.entregado_at,
            documento = EXCLUDED.documento, dias_credito = EXCLUDED.dias_credito,
            cobro = EXCLUDED.cobro, cobrado_at = EXCLUDED.cobrado_at, cobrado_por = EXCLUDED.cobrado_por,
            conciliado_at = EXCLUDED.conciliado_at, conciliado_por = EXCLUDED.conciliado_por,
            monto = EXCLUDED.monto, moneda = EXCLUDED.moneda, nivel_precio = EXCLUDED.nivel_precio,
            excepcion_precio = EXCLUDED.excepcion_precio, tipo_pago = EXCLUDED.tipo_pago,
            total = EXCLUDED.total, tipo_pago_real = EXCLUDED.tipo_pago_real, total_final = EXCLUDED.total_final,
            borrado = EXCLUDED.borrado, borrado_motivo = EXCLUDED.borrado_motivo,
            borrado_por = EXCLUDED.borrado_por, borrado_at = EXCLUDED.borrado_at,
            factura = EXCLUDED.factura, nota_credito = EXCLUDED.nota_credito,
            pagado_usd = EXCLUDED.pagado_usd, saldo = EXCLUDED.saldo, pagos_pend = EXCLUDED.pagos_pend,
            ajuste_estado = EXCLUDED.ajuste_estado, ajuste_motivo = EXCLUDED.ajuste_motivo,
            ajuste_por = EXCLUDED.ajuste_por, ajuste_at = EXCLUDED.ajuste_at, ajuste_previo = EXCLUDED.ajuste_previo,
            -- el pedido puede pasar a otro cliente (se equivocó de cliente) mientras está pendiente
            cliente_id = CASE WHEN public.pedidos.estado = 'pendiente' THEN EXCLUDED.cliente_id ELSE public.pedidos.cliente_id END,
            cliente = CASE WHEN public.pedidos.estado = 'pendiente' THEN EXCLUDED.cliente ELSE public.pedidos.cliente END,
            negocio = CASE WHEN public.pedidos.estado = 'pendiente' THEN EXCLUDED.negocio ELSE public.pedidos.negocio END,
            canal_pedido = EXCLUDED.canal_pedido, gps_lat = EXCLUDED.gps_lat, gps_lng = EXCLUDED.gps_lng, gps_dist_m = EXCLUDED.gps_dist_m;

        -- ---------------- PedidoItems: solo de pedidos que la sesión puede tocar ----------------
        ELSIF v_tabla = 'PedidoItems' THEN
          v_pid := COALESCE(v_cambio->>'pedido_id', '');
          v_pid := COALESCE(v_remap->>v_pid, v_pid);
          IF v_pid = '' OR NOT public.skala_puede_pedido(v_ses, v_pid) THEN
            RAISE EXCEPTION 'Pedido no encontrado.' USING HINT = 'not_found';
          END IF;
          IF v_modo = 'reemplazar_pedido' THEN
            DELETE FROM public.pedido_items WHERE pedido_id = v_pid;
            FOR v_filas IN SELECT * FROM jsonb_array_elements(COALESCE(v_cambio->'filas', '[]'::jsonb)) LOOP
              IF COALESCE(v_filas->>'code', '') <> '' AND COALESCE(NULLIF(v_filas->>'cajas', '')::numeric, 0) > 0 THEN
                INSERT INTO public.pedido_items (
                  pedido_id, code, producto, cajas, unidades_caja, unidad, total_unidades,
                  precio, desc_pronto, desc_efectivo_credito, desc_efectivo_pronto, entregadas, devueltas
                ) VALUES (
                  v_pid, -- siempre el pedido validado (no se acepta otro pedido_id dentro de las filas)
                  UPPER(TRIM(v_filas->>'code')), COALESCE(v_filas->>'producto', ''),
                  COALESCE(NULLIF(v_filas->>'cajas', '')::numeric, 0),
                  COALESCE(v_filas->>'unidades_caja', ''), COALESCE(NULLIF(v_filas->>'unidad', ''), 'unidades'),
                  COALESCE(v_filas->>'total_unidades', ''),
                  COALESCE(NULLIF(v_filas->>'precio', '')::numeric, 0),
                  COALESCE(NULLIF(v_filas->>'desc_pronto', '')::numeric, 0),
                  COALESCE(NULLIF(v_filas->>'desc_efectivo_credito', '')::numeric, 0),
                  COALESCE(NULLIF(v_filas->>'desc_efectivo_pronto', '')::numeric, 0),
                  COALESCE(NULLIF(v_filas->>'entregadas', '')::numeric, 0),
                  COALESCE(NULLIF(v_filas->>'devueltas', '')::numeric, 0)
                );
              END IF;
            END LOOP;
          END IF;

        -- ---------------- Historial: usuario y fecha los pone el servidor (auditoría no falsificable) ----------------
        ELSIF v_tabla = 'Historial' THEN
          v_pid := COALESCE(v_fila->>'pedido_id', '');
          v_pid := COALESCE(v_remap->>v_pid, v_pid);
          IF NOT (v_gestion OR (v_pid <> '' AND public.skala_puede_pedido(v_ses, v_pid))) THEN
            RAISE EXCEPTION 'Pedido no encontrado.' USING HINT = 'not_found';
          END IF;
          INSERT INTO public.historial (fecha, pedido_id, usuario, accion, detalle)
          VALUES (
            to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            v_pid,
            COALESCE(v_ses->>'nombre', '') || ' (' || COALESCE(v_ses->>'rol_nombre', '') || ')',
            left(COALESCE(v_fila->>'accion', ''), 60),
            left(COALESCE(v_fila->>'detalle', ''), 1000)
          );

        -- ---------------- Precios / Inventario / Config: solo Administración y Master ----------------
        ELSIF v_tabla IN ('Precios', 'Inventario', 'Config') AND NOT v_gestion THEN
          RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';

        ELSIF v_tabla = 'Precios' THEN
          INSERT INTO public.precios (
            code, producto, menor, mayor, pronto, efectivo_credito, efectivo_pronto,
            updated_at, updated_por, tipo, linea, beneficio, cabello, unidades_caja, imagen,
            mayor_pronto, mayor_efectivo_credito, mayor_efectivo_pronto
          ) VALUES (
            UPPER(TRIM(v_fila->>'code')), COALESCE(v_fila->>'producto', ''),
            COALESCE(NULLIF(v_fila->>'menor', '')::numeric, 0), COALESCE(NULLIF(v_fila->>'mayor', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'pronto', '')::numeric, 0), COALESCE(NULLIF(v_fila->>'efectivo_credito', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'efectivo_pronto', '')::numeric, 0),
            COALESCE(v_fila->>'updated_at', ''), COALESCE(v_fila->>'updated_por', ''),
            COALESCE(v_fila->>'tipo', ''), COALESCE(v_fila->>'linea', ''), COALESCE(v_fila->>'beneficio', ''),
            COALESCE(v_fila->>'cabello', ''), COALESCE(NULLIF(v_fila->>'unidades_caja', '')::numeric, 0),
            COALESCE(v_fila->>'imagen', ''),
            COALESCE(NULLIF(v_fila->>'mayor_pronto', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'mayor_efectivo_credito', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'mayor_efectivo_pronto', '')::numeric, 0)
          )
          ON CONFLICT (code) DO UPDATE SET
            producto = EXCLUDED.producto, menor = EXCLUDED.menor, mayor = EXCLUDED.mayor,
            pronto = EXCLUDED.pronto, efectivo_credito = EXCLUDED.efectivo_credito,
            efectivo_pronto = EXCLUDED.efectivo_pronto, updated_at = EXCLUDED.updated_at,
            updated_por = EXCLUDED.updated_por, tipo = EXCLUDED.tipo, linea = EXCLUDED.linea,
            beneficio = EXCLUDED.beneficio, cabello = EXCLUDED.cabello,
            unidades_caja = EXCLUDED.unidades_caja, imagen = EXCLUDED.imagen,
            mayor_pronto = EXCLUDED.mayor_pronto, mayor_efectivo_credito = EXCLUDED.mayor_efectivo_credito,
            mayor_efectivo_pronto = EXCLUDED.mayor_efectivo_pronto;

        ELSIF v_tabla = 'Inventario' THEN
          INSERT INTO public.inventario (fecha, code, producto, cajas, tipo, nota, usuario)
          VALUES (
            COALESCE(v_fila->>'fecha', ''), UPPER(TRIM(v_fila->>'code')), COALESCE(v_fila->>'producto', ''),
            COALESCE(NULLIF(v_fila->>'cajas', '')::numeric, 0),
            COALESCE(v_fila->>'tipo', ''), COALESCE(v_fila->>'nota', ''), COALESCE(v_fila->>'usuario', '')
          );

        ELSIF v_tabla = 'Config' THEN
          INSERT INTO public.config (clave, valor, nota)
          VALUES (TRIM(v_fila->>'clave'), COALESCE(v_fila->>'valor', ''), COALESCE(v_fila->>'nota', ''))
          ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, nota = EXCLUDED.nota;

        -- ---------------- PedidosWeb con sesión: tomar / descartar (las altas públicas van por pedido_web) ----------------
        ELSIF v_tabla = 'PedidosWeb' THEN
          IF NOT v_toma THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          SELECT * INTO v_pw FROM public.pedidos_web WHERE id = COALESCE(v_fila->>'id', '');
          IF NOT FOUND THEN
            IF NOT v_gestion THEN
              RAISE EXCEPTION 'Pedido web no encontrado.' USING HINT = 'not_found';
            END IF;
          ELSIF NOT v_gestion AND NOT (
            v_pw.vendedor_id IN ('', v_ses->>'id')
            AND COALESCE(v_fila->>'vendedor_id', '') IN (v_pw.vendedor_id, v_ses->>'id')
          ) THEN
            RAISE EXCEPTION 'Solo su vendedor (o el Master) lo puede tomar.' USING HINT = 'forbidden';
          END IF;
          v_fila := jsonb_set(v_fila, '{pedido_id}', to_jsonb(COALESCE(
            v_remap->>COALESCE(v_fila->>'pedido_id', ''), COALESCE(v_fila->>'pedido_id', '')
          )));
          INSERT INTO public.pedidos_web (
            id, fecha, created_at, vendedor_id, vendedor, negocio, contacto, rif_cedula, telefono, direccion,
            items, tipo_pago, total_cajas, total, nota, estado, pedido_id, atendido_por, atendido_at, motivo,
            cliente_id, latitud, longitud
          ) VALUES (
            v_fila->>'id', COALESCE(v_fila->>'fecha', ''), COALESCE(v_fila->>'created_at', ''),
            COALESCE(v_fila->>'vendedor_id', ''), COALESCE(v_fila->>'vendedor', ''), COALESCE(v_fila->>'negocio', ''),
            COALESCE(v_fila->>'contacto', ''), COALESCE(v_fila->>'rif_cedula', ''), COALESCE(v_fila->>'telefono', ''),
            COALESCE(v_fila->>'direccion', ''), COALESCE(v_fila->>'items', '[]'), COALESCE(v_fila->>'tipo_pago', 'credito'),
            COALESCE(NULLIF(v_fila->>'total_cajas', '')::numeric, 0), COALESCE(NULLIF(v_fila->>'total', '')::numeric, 0),
            COALESCE(v_fila->>'nota', ''), COALESCE(NULLIF(v_fila->>'estado', ''), 'nuevo'),
            COALESCE(v_fila->>'pedido_id', ''), COALESCE(v_fila->>'atendido_por', ''), COALESCE(v_fila->>'atendido_at', ''),
            COALESCE(v_fila->>'motivo', ''), COALESCE(v_fila->>'cliente_id', ''),
            COALESCE(v_fila->>'latitud', ''), COALESCE(v_fila->>'longitud', '')
          )
          ON CONFLICT (id) DO UPDATE SET
            vendedor_id = EXCLUDED.vendedor_id, vendedor = EXCLUDED.vendedor,
            estado = EXCLUDED.estado, pedido_id = EXCLUDED.pedido_id,
            atendido_por = EXCLUDED.atendido_por, atendido_at = EXCLUDED.atendido_at, motivo = EXCLUDED.motivo;

        -- ---------------- Pagos: el vendedor solo REPORTA en sus pedidos; conciliar y comisiones = gestión ----------------
        ELSIF v_tabla = 'Pagos' THEN
          IF NOT v_toma THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          IF NOT v_gestion THEN
            SELECT * INTO v_pg FROM public.pagos WHERE id = COALESCE(v_fila->>'id', '');
            IF FOUND AND (v_pg.estado <> 'reportado' OR v_pg.pedido_id <> COALESCE(v_fila->>'pedido_id', '')) THEN
              RAISE EXCEPTION 'Solo Administración modifica pagos ya verificados.' USING HINT = 'forbidden';
            END IF;
            IF COALESCE(NULLIF(v_fila->>'estado', ''), 'reportado') <> 'reportado'
               OR COALESCE(v_fila->>'comision_estado', '') <> COALESCE(v_pg.comision_estado, '') THEN
              RAISE EXCEPTION 'Solo Administración verifica y concilia los pagos.' USING HINT = 'forbidden';
            END IF;
            IF NOT public.skala_puede_pedido(v_ses, COALESCE(v_fila->>'pedido_id', '')) THEN
              RAISE EXCEPTION 'Pedido no encontrado.' USING HINT = 'not_found';
            END IF;
          END IF;
          INSERT INTO public.pagos (
            id, pedido_id, fecha_pago, created_at, registrado_por, registrado_por_id,
            moneda, monto, tasa, monto_usd, referencia, tipo_pago_real, estado,
            conciliado_at, conciliado_por, motivo, comision_estado, comision_pct,
            comision_usd, comision_moneda, comision_monto, comision_tasa,
            comision_fecha, comision_ref, comision_pagada_at, comision_pagada_por, canal_cobro
          ) VALUES (
            v_fila->>'id', COALESCE(v_fila->>'pedido_id', ''), SUBSTRING(COALESCE(v_fila->>'fecha_pago', '') FROM 1 FOR 10),
            COALESCE(v_fila->>'created_at', ''), COALESCE(v_fila->>'registrado_por', ''), COALESCE(v_fila->>'registrado_por_id', ''),
            COALESCE(NULLIF(v_fila->>'moneda', ''), 'USD'),
            COALESCE(NULLIF(v_fila->>'monto', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'tasa', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'monto_usd', '')::numeric, 0),
            COALESCE(v_fila->>'referencia', ''), COALESCE(v_fila->>'tipo_pago_real', ''),
            COALESCE(NULLIF(v_fila->>'estado', ''), 'reportado'),
            COALESCE(v_fila->>'conciliado_at', ''), COALESCE(v_fila->>'conciliado_por', ''), COALESCE(v_fila->>'motivo', ''),
            COALESCE(v_fila->>'comision_estado', ''),
            COALESCE(NULLIF(v_fila->>'comision_pct', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'comision_usd', '')::numeric, 0),
            COALESCE(v_fila->>'comision_moneda', ''),
            COALESCE(NULLIF(v_fila->>'comision_monto', '')::numeric, 0),
            COALESCE(NULLIF(v_fila->>'comision_tasa', '')::numeric, 0),
            SUBSTRING(COALESCE(v_fila->>'comision_fecha', '') FROM 1 FOR 10),
            COALESCE(v_fila->>'comision_ref', ''), COALESCE(v_fila->>'comision_pagada_at', ''), COALESCE(v_fila->>'comision_pagada_por', ''),
            CASE WHEN COALESCE(v_fila->>'canal_cobro', '') IN ('en_persona', 'online_telefono') THEN v_fila->>'canal_cobro' ELSE '' END
          )
          ON CONFLICT (id) DO UPDATE SET
            fecha_pago = EXCLUDED.fecha_pago, moneda = EXCLUDED.moneda, monto = EXCLUDED.monto,
            tasa = EXCLUDED.tasa, monto_usd = EXCLUDED.monto_usd, referencia = EXCLUDED.referencia,
            tipo_pago_real = EXCLUDED.tipo_pago_real, estado = EXCLUDED.estado,
            conciliado_at = EXCLUDED.conciliado_at, conciliado_por = EXCLUDED.conciliado_por, motivo = EXCLUDED.motivo,
            comision_estado = EXCLUDED.comision_estado, comision_pct = EXCLUDED.comision_pct,
            comision_usd = EXCLUDED.comision_usd, comision_moneda = EXCLUDED.comision_moneda,
            comision_monto = EXCLUDED.comision_monto, comision_tasa = EXCLUDED.comision_tasa,
            comision_fecha = EXCLUDED.comision_fecha, comision_ref = EXCLUDED.comision_ref,
            comision_pagada_at = EXCLUDED.comision_pagada_at, comision_pagada_por = EXCLUDED.comision_pagada_por,
            canal_cobro = CASE WHEN EXCLUDED.canal_cobro <> '' THEN EXCLUDED.canal_cobro ELSE public.pagos.canal_cobro END;

        -- ---------------- Visitas: quien toma pedidos registra / anula las suyas; gestión, todas ----------------
        ELSIF v_tabla = 'Visitas' THEN
          IF NOT v_toma THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          IF COALESCE(v_fila->>'canal', '') NOT IN ('en_persona', 'online_telefono') THEN
            RAISE EXCEPTION 'Indicá cómo atendiste al cliente: en persona u online / por teléfono.' USING HINT = 'canal';
          END IF;
          IF NOT v_gestion AND (
            COALESCE(v_fila->>'vendedor_id', '') <> (v_ses->>'id')
            OR EXISTS (SELECT 1 FROM public.visitas WHERE id = v_fila->>'id' AND vendedor_id <> (v_ses->>'id'))
          ) THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          INSERT INTO public.visitas (
            id, fecha, cliente_id, negocio, vendedor_id, vendedor, canal, tipo, submotivo, nota,
            pedido_id, pago_id, mision_id, latitud, longitud, distancia_m, en_sitio, gps_aprendido,
            anulada, anulada_motivo, created_at, updated_at
          ) VALUES (
            v_fila->>'id', COALESCE(v_fila->>'fecha', ''), COALESCE(v_fila->>'cliente_id', ''), COALESCE(v_fila->>'negocio', ''),
            COALESCE(v_fila->>'vendedor_id', ''), COALESCE(v_fila->>'vendedor', ''), v_fila->>'canal',
            CASE WHEN COALESCE(v_fila->>'tipo', '') IN ('pedido', 'cobro', 'visita_ruta', 'no_disponible', 'no_visitado', 'alta_cliente')
              THEN v_fila->>'tipo' ELSE 'visita_ruta' END,
            left(COALESCE(v_fila->>'submotivo', ''), 60), left(COALESCE(v_fila->>'nota', ''), 300),
            COALESCE(v_remap->>COALESCE(v_fila->>'pedido_id', ''), COALESCE(v_fila->>'pedido_id', '')),
            COALESCE(v_fila->>'pago_id', ''), COALESCE(v_fila->>'mision_id', ''),
            COALESCE(v_fila->>'latitud', ''), COALESCE(v_fila->>'longitud', ''), COALESCE(v_fila->>'distancia_m', ''),
            COALESCE((v_fila->>'en_sitio')::boolean, false), COALESCE((v_fila->>'gps_aprendido')::boolean, false),
            COALESCE((v_fila->>'anulada')::boolean, false), COALESCE(v_fila->>'anulada_motivo', ''),
            COALESCE(v_fila->>'created_at', ''), COALESCE(v_fila->>'updated_at', '')
          )
          ON CONFLICT (id) DO UPDATE SET
            -- una visita no se reescribe: solo se anula (cliente equivocado) dejando constancia
            anulada = EXCLUDED.anulada, anulada_motivo = EXCLUDED.anulada_motivo, updated_at = EXCLUDED.updated_at;

        -- ---------------- Tasas BCV: quien cobra agrega días nuevos; corregir o cargar 'manual' = gestión ----------------
        ELSIF v_tabla = 'Tasas' THEN
          IF NOT v_toma THEN
            RAISE EXCEPTION 'Tu usuario no tiene permiso para esto.' USING HINT = 'forbidden';
          END IF;
          IF SUBSTRING(COALESCE(v_fila->>'fecha', '') FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$'
             AND public.skala_num(v_fila->>'tasa') > 0 THEN
            v_fuente := COALESCE(NULLIF(v_fila->>'fuente', ''), 'bcv');
            IF v_gestion THEN
              INSERT INTO public.tasas (fecha, tasa, fuente, updated_at)
              VALUES (SUBSTRING(v_fila->>'fecha' FROM 1 FOR 10), public.skala_num(v_fila->>'tasa'), v_fuente, COALESCE(v_fila->>'updated_at', ''))
              ON CONFLICT (fecha) DO UPDATE SET
                tasa = CASE WHEN public.tasas.fuente = 'manual' AND EXCLUDED.fuente <> 'manual' THEN public.tasas.tasa ELSE EXCLUDED.tasa END,
                fuente = CASE WHEN public.tasas.fuente = 'manual' AND EXCLUDED.fuente <> 'manual' THEN public.tasas.fuente ELSE EXCLUDED.fuente END,
                updated_at = EXCLUDED.updated_at;
            ELSE
              -- vendedor: solo días que faltan, como 'bcv'; nunca pisa una tasa ya guardada
              INSERT INTO public.tasas (fecha, tasa, fuente, updated_at)
              VALUES (SUBSTRING(v_fila->>'fecha' FROM 1 FOR 10), public.skala_num(v_fila->>'tasa'), 'bcv', COALESCE(v_fila->>'updated_at', ''))
              ON CONFLICT (fecha) DO NOTHING;
            END IF;
          END IF;

        ELSE
          RAISE EXCEPTION 'Tabla desconocida: %', v_tabla USING HINT = 'tabla';
        END IF;
      END LOOP;
    EXCEPTION
      WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT, v_hint = PG_EXCEPTION_HINT;
        RETURN jsonb_build_object('ok', false, 'error', v_msg, 'code', COALESCE(NULLIF(v_hint, ''), 'error'));
      WHEN others THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        RETURN jsonb_build_object('ok', false, 'error', 'No se pudo guardar: ' || v_msg, 'code', 'internal');
    END;

    -- ids: correlativos reasignados por choque { "SKL-...-003": "SKL-...-004" }
    RETURN jsonb_build_object('ok', true, 'ids', v_remap);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Operación desconocida.', 'code', 'unknown_op');
END;
$$;

-- ==================== 7. PERMISOS ====================
-- Las funciones auxiliares son SECURITY DEFINER y en Supabase cualquier función de "public" es invocable por
-- /rest/v1/rpc/<nombre>. Sin estos REVOKE, cualquiera con la clave pública podría pedir skala_secreto()
-- (CRM_SECRET) o skala_crear_token('U1', true) y entrar como Master. Solo quedan expuestas skala_db y skala_importar.
REVOKE EXECUTE ON FUNCTION public.skala_secreto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_hash_pin(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_firmar(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_crear_token(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_roles_de(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_nombre_roles(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_usuario_publico(public.usuarios) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_verificar_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_intentos_de(text, interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_sumar_intento(text, interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_limpiar_intentos(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_tel_clave(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_mismo_tel(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_mismo_rif(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_puede_pedido(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skala_num(text) FROM PUBLIC, anon, authenticated;

-- El cliente web (anon / authenticated) solo puede invocar las dos funciones RPC con controles propios
REVOKE EXECUTE ON FUNCTION public.skala_db(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.skala_importar(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skala_db(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skala_importar(jsonb) TO anon, authenticated;
