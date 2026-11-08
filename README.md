# catalogo-skala — Dist. Ontiveros Only Skala (Venezuela)

Plataforma integral B2B de exhibición mayorista, toma de pedidos offline-first, CRM, inventario, despacho, cobranzas bimonetarias (`USD` / `Bs` BCV) y liquidación de comisiones para **Distribuidora Ontiveros Only Skala**.

## Documentación Técnica y Gobernanza SDD

- **[`SPEC.md`](./SPEC.md):** Especificación formal del sistema (SDD), diccionario de las **11 tablas de dominio** (`Usuarios`, `Clientes`, `Pedidos`, `PedidoItems`, `Historial`, `Precios`, `Inventario`, `PedidosWeb`, `Config`, `Pagos`, `Tasas`), contratos de las **34 acciones API** y especificación de seguridad para la migración a Supabase.
- **[`AGENTS.md`](./AGENTS.md) / [`agent.md`](./agent.md):** Reglas de gobernanza multiagente y multimodelo (**Argon 4** para preparación, arquitectura y SDD; **Claude** para tocar código y certificar/verificar errores).
- **[`supabase/MIGRACION.md`](./supabase/MIGRACION.md):** Guía paso a paso para migrar la base de datos de Google Sheets a **Supabase PostgreSQL** con 0% pérdida de datos.
- **[`crm/INSTALAR.md`](./crm/INSTALAR.md):** Guía de instalación y configuración del backend en Google Apps Script (`crm/Code.gs`).
- **[`android/LEEME.md`](./android/LEEME.md):** Compilación de la APK nativa Android (`Skala Equipo`) y publicación de actualizaciones OTA.

## Publicación en Netlify (Doble Dominio + Beta en Producción)

El repositorio publica **dos catálogos y paneles web independientes** conectados a la misma base de datos en **Supabase (`Dist.Ontiveros` · `sntrykeefsacrzeygule`)**, operando actualmente en **fase BETA en producción** en paralelo con el sistema administrativo actual:

1. **Importadora Skala Venezuela (`skala-venezuela.netlify.app`):**
   - Directorio de publicación: `catalogo-skala/` (configurado por defecto en [`netlify.toml`](./netlify.toml)).
   - Service Worker: `skala-equipo-v37`.
2. **Distribuciones Ontiveros (`dist-ontiveros.netlify.app`):**
   - Directorio de publicación: `catalogo-distribuidora/` (o `Base directory = catalogo-distribuidora` en Netlify).
   - Service Worker: `dist-ontiveros-v41`.

Para publicar cambios en ambos sitios, subilos a la rama `main` del repositorio conectado a Netlify (`git push origin main`).
