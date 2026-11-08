# Gobernanza Multiagente y Multimodelo — Proyecto Skala Venezuela (`agent.md`)

> **Nota:** Este archivo (`agent.md`) es espejo exacto de [`AGENTS.md`](./AGENTS.md) para garantizar que cualquier agente o herramienta que busque `agent.md` o `AGENTS.md` cargue las mismas reglas inquebrantables.

---

## 1. Regla de Oro de Selección de Modelos

1. **Siempre que se necesite TOCAR CÓDIGO → Usaremos a Claude.**
   - Incluye cualquier creación, modificación o refactorización en:
     - Frontend Web y PWA: `catalogo-skala/*.html`, `catalogo-skala/sw.js`, `catalogo-skala/js/*.js`, `catalogo-skala/css/*.css`.
     - Backend Google Apps Script: `crm/Code.gs`.
     - Base de Datos y RPCs Supabase: `supabase/*.sql`.
     - App Nativa Android: `android/**/*.java`, `android/**/*.kts`, `android/**/*.xml`, `android/*.bat`.
     - Suites de Pruebas: `catalogo-skala/tests/*.js`, `crm/tests/*.js`.
2. **Siempre que CERTIFIQUEMOS / VERIFIQUEMOS ERRORES EN EL CÓDIGO → Usaremos a Claude.**
   - Incluye debugging, caza de bugs, auditoría de vulnerabilidades en código/SQL, creación o ejecución de tests (`node:test`, `Playwright`, `fake-gas.js`) y validación de compilación Android.
3. **Para el RESTO DE TAREAS DE PREPARACIÓN → Usaremos a Argon 4 (Gemini 4 Argon).**
   - Incluye investigación profunda del repositorio, análisis de brechas (*Gap Analysis*), diseño arquitectónico, preparación de planes de migración (ej. Google Sheets → Supabase), redacción/actualización de documentación (`SPEC.md`, `MIGRACION.md`, `INSTALAR.md`, `AGENTS.md`, `agent.md`) y preparación de prompts quirúrgicos para Claude.

---

## 2. Protocolo de Handoff (Entrega de Turno)

- **De Argon 4 a Claude:** Cuando la preparación está lista y se requiere tocar o certificar código, **Argon 4 NO edita archivos de código**; en su lugar, presenta el diagnóstico, la lista exacta de archivos/líneas afectados y el bloque de instrucciones listo para ejecutar con **Claude**.
- **De Claude a Argon 4:** Una vez que **Claude** aplica los cambios en el código y certifica con pruebas que no existen errores ni regresiones, entrega el reporte de verificación (`status`, `artifacts`, `risks`, `next_recommended`).

---

## 3. Resumen de Arquitectura (`catalogo-skala`)

- **11 Tablas de Dominio:** `Usuarios`, `Clientes`, `Pedidos`, `PedidoItems`, `Historial`, `Precios`, `Inventario`, `PedidosWeb`, `Config`, `Pagos`, `Tasas` (+ `skala_secretos` en Supabase).
- **4 Roles (RBAC Multi-Rol):** `master`, `admin`, `vendedor`, `despachador`.
- **Motores de Persistencia:** Google Apps Script + Google Sheets (`crm/Code.gs`) en transición espejo sin pérdida hacia Supabase PostgreSQL (`supabase/schema.sql` + `catalogo-skala/js/crm-api.js`).
