# 🏥 HealthTech Solutions - Guía Maestra de Proyecto (SaaS Médico)
**Contexto:** Proyecto de Maestría en Auditoría Informática y Continuidad de Negocio.

## 🏢 1. Entorno y Arquitectura Híbrida
* **Core Database:** Oracle RAC (Real Application Clusters) de 2 nodos sobre Oracle Linux 7.
* **Red Interna:** Segmento `10.0.0.x/24` (Acceso restringido).
* **Virtualización:** Almacenamiento gestionado por Proxmox; 50 servidores en VMware.
* **Nube:** Infraestructura híbrida con AWS (Site-to-Site VPN) para DR (Disaster Recovery).
* **Seguridad:** Cumplimiento estricto de **HIPAA** y normativas de privacidad de datos médicos.

## 🛠 2. Stack Tecnológico de Desarrollo
* **Frontend:** React (Vite) + Tailwind CSS (Diseño accesible y dashboards médicos).
* **Backend:** Django REST Framework (DRF) + `python-oracledb`.
* **Multitenancy:** Aislamiento lógico por esquema o VPD (Virtual Private Database) para 10 hospitales.
* **Autenticación:** JWT con RBAC (Médicos, Admin Hospital, Auditores).
* **Imágenes:** Almacenamiento PACS integrado con AWS S3 (Ciclo de vida de retención).

---

## 🏗 3. Estándares de Ingeniería y Cumplimiento

### A. Seguridad de Datos (HIPAA Compliance)
* **Encryption at Rest:** Uso de Transparent Data Encryption (TDE) en Oracle para datos PHI.
* **Encryption in Transit:** TLS 1.3 obligatorio para toda comunicación Web/API.
* **Audit Trail:** Todas las entidades deben heredar de un `AuditModel` (tracking de `created_by`, `updated_at`, etc.).
* **Data Minimization:** Los Serializers de Django deben filtrar campos sensibles por defecto.

### B. Base de Datos (Oracle RAC)
* **Naming:** Tablas en `UPPER_CASE` con prefijos por módulo. Definir `db_table` en el Meta de Django.
* **Alta Disponibilidad:** Configurar `Failover` y `Load Balance` en las cadenas de conexión.
* **Continuidad:** Estrategias de backup RMAN y replicación hacia AWS para BCP (Business Continuity Planning).

### C. Frontend (UI/UX)
* **Separación:** No se permite lógica de negocio en componentes de React; usar Hooks y Services.
* **Contexto de Tenant:** El `hospital_id` debe persistir en el estado global para filtrar toda la data.

---

## 🤖 4. Guía de Interacción con Claude CLI (Antigravity)
Al trabajar desde la terminal, priorizar consultas bajo este contexto:

1.  **Auditoría:** "Genera un reporte de accesos a la tabla PACIENTES filtrando por Hospital ID X".
2.  **Infraestructura:** "¿Cómo configurar el `tnsnames.ora` para soportar el balanceo de carga entre mis dos nodos 10.0.0.x?".
3.  **Seguridad:** "Revisa este middleware de Django para asegurar que no haya fugas de datos entre hospitales".
4.  **Continuidad:** "Basado en mi setup de Proxmox, sugiere un plan de replicación de Oracle RAC hacia AWS".

---
**Nota:** Este documento es el marco de referencia para toda generación de código. Priorizar seguridad y trazabilidad sobre velocidad de desarrollo.