# Plan de Continuidad de Negocio (BCP) y Recuperación ante Desastres (DRP)
## HealthTech Solutions — SaaS Médico Multi-Hospital

**Clasificación:** CONFIDENCIAL — Información PHI bajo HIPAA
**Versión:** 1.0
**Fecha:** 2026-03-06
**Propietario:** Dirección de Tecnología
**Revisión anual:** Obligatoria (HIPAA 45 CFR §164.308(a)(7))

---

## 1. Resumen Ejecutivo

HealthTech Solutions opera un sistema SaaS médico crítico para 10 hospitales en Guatemala. Este documento define los procedimientos de continuidad y recuperación ante desastres para garantizar la disponibilidad de los datos de salud protegidos (PHI) conforme a HIPAA.

| Métrica | Objetivo |
|---------|----------|
| **RPO** (Recovery Point Objective) | 30 minutos |
| **RTO** (Recovery Time Objective) | 2 horas |
| **Disponibilidad objetivo** | 99.9% (< 8.7 h downtime/año) |
| **Retención de backups** | 7 días local + 30 días S3 |

---

## 2. Arquitectura de Alta Disponibilidad

```
┌─────────────────────────────────────────────────┐
│              SITIO PRINCIPAL (Proxmox)           │
│  ┌──────────────┐    ┌──────────────┐            │
│  │ Oracle RAC   │◄───│ Oracle RAC   │            │
│  │  Nodo 1      │    │  Nodo 2      │            │
│  │ 10.0.0.11    │    │ 10.0.0.12    │            │
│  └──────┬───────┘    └──────┬───────┘            │
│         │   ASM / Shared Storage                 │
│         └──────────┬─────────┘                   │
│              ┌─────┴──────┐                      │
│              │ Proxmox SAN│                      │
│              └────────────┘                      │
└──────────────────────┬──────────────────────────┘
                       │ Site-to-Site VPN
                       ▼
┌─────────────────────────────────────────────────┐
│              AWS (Disaster Recovery)             │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │  S3 Bucket       │   │  RDS Oracle        │  │
│  │  (Backups RMAN)  │   │  (Standby — warm)  │  │
│  └──────────────────┘   └────────────────────┘  │
│  ┌──────────────────────────────────────────┐   │
│  │  EC2 Auto Scaling (Frontend + Backend)   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 3. Escenarios de Fallo y Procedimientos

### 3.1 Fallo de un nodo RAC (Escenario más común)

**Detección:** Oracle Clusterware detecta el fallo automáticamente en < 30 segundos.

**Respuesta automática:**
- Oracle TAF (Transparent Application Failover) redirige conexiones activas al nodo superviviente
- El connection pool de Django (`config/oracle/pool.py`) reconecta automáticamente
- Sin intervención manual requerida

**Verificación (DBA):**
```bash
# En el nodo superviviente
srvctl status database -d HTPROD
crsctl status resource -t
# Verificar que todas las instancias estén UP
```

**RTO estimado:** < 2 minutos (automático)

---

### 3.2 Fallo de ambos nodos RAC / Storage failure

**Detección:** Alertas de Proxmox + Oracle Enterprise Manager.

**Procedimiento de recuperación:**

1. **Declarar incidente** (DBA Lead + CTO — 15 min)
2. **Activar DR en AWS** (DBA + DevOps — 30 min):
   ```bash
   # En AWS: restaurar desde último backup S3
   aws s3 sync s3://healthtech-backup-prod/rman/ /restore/rman/
   ```
3. **Restaurar base de datos Oracle** (DBA — 60 min):
   ```bash
   # Script: infrastructure/scripts/rman_restore_test.sh (en modo real)
   rman target /
   RMAN> RESTORE DATABASE;
   RMAN> RECOVER DATABASE;
   RMAN> ALTER DATABASE OPEN RESETLOGS;
   ```
4. **Reconfigurar conexión Django** (DevOps — 15 min):
   ```bash
   # Actualizar .env de producción con nuevo DSN
   ORACLE_DSN=htprod-aws.healthtech.internal/HTPROD
   # Reiniciar Gunicorn
   systemctl restart gunicorn-healthtech
   ```
5. **Notificar hospitales** (Soporte — inmediato)
6. **Verificar integridad de datos** (DBA + QA — 30 min)

**RTO estimado:** 1.5 – 2 horas

---

### 3.3 Fallo del servidor de aplicaciones (Django/Gunicorn)

**Respuesta automática:** Proxmox HA reinicia la VM en < 5 minutos.

**Si la VM no levanta:**
```bash
# En otro nodo Proxmox
qm start <vmid>
# O levantar instancia EC2 de emergencia en AWS
aws ec2 start-instances --instance-ids i-XXXXX
```

**RTO estimado:** 5 – 15 minutos

---

### 3.4 Pérdida del sitio principal completo (desastre mayor)

**Criterio de activación:** Sitio principal inaccesible por > 30 minutos.

**Runbook:**

| Paso | Responsable | Acción | Tiempo |
|------|-------------|--------|--------|
| 1 | CTO | Declarar desastre, activar equipo DR | 0–15 min |
| 2 | DBA | Restaurar Oracle en RDS AWS desde S3 | 15–75 min |
| 3 | DevOps | DNS failover a IP de AWS (Route 53) | 15–20 min |
| 4 | DevOps | Escalar EC2 Auto Scaling Group | 20–25 min |
| 5 | QA | Smoke tests en ambiente DR | 75–90 min |
| 6 | Soporte | Notificar hospitales con nuevo URL | 90–95 min |
| 7 | DBA | Habilitar modo lectura hasta validar datos | Inmediato |

---

## 4. Estrategia de Backup RMAN

### 4.1 Cronograma

| Tipo | Frecuencia | Hora | Script |
|------|-----------|------|--------|
| Full Backup | Domingos | 02:00 | `03_rman_backup.rman` (sección FULL) |
| Incremental L1 Acumulativo | Lun–Sáb | 02:00 | `03_rman_backup.rman` (sección INCR) |
| Archive Logs | Cada 30 min | xx:05, xx:35 | `03_rman_backup.rman` (sección ARCH) |
| Sync a S3 | Post-backup | +30 min | `infrastructure/scripts/rman_s3_sync.sh` |
| Restore Test | Mensual | Dom 04:00 | `infrastructure/scripts/rman_restore_test.sh` |

### 4.2 Retención

| Nivel | Local (Proxmox) | AWS S3 |
|-------|----------------|--------|
| Backups RMAN | 7 días | 30 días (STANDARD_IA) |
| Archive Logs | 48 horas | 7 días |
| Logs de auditoría HIPAA | No aplica | 6 años (GLACIER) |

### 4.3 Cifrado

- **En tránsito:** TLS 1.3 (VPN Site-to-Site + AWS SDK)
- **En reposo local:** Oracle TDE (Transparent Data Encryption) en tablespace PHI_DATA
- **En reposo S3:** SSE-AES256 (Server-Side Encryption)
- **Llave de cifrado:** Gestionada por AWS KMS con rotación automática anual

---

## 5. Política de Acceso a Backups (HIPAA)

- Solo el equipo DBA y el CTO tienen acceso al bucket S3 de backups
- Acceso auditado via AWS CloudTrail
- MFA requerido para operaciones de restore
- Las credenciales de DR se rotan cada 90 días
- Los logs de restore se almacenan en S3 como evidencia de cumplimiento HIPAA

---

## 6. Pruebas y Mantenimiento

### 6.1 Prueba mensual de restore (automatizada)
```bash
# Ejecuta el script de validación (no restaura, solo valida)
/opt/healthtech/scripts/rman_restore_test.sh
# Log en: s3://healthtech-backup-prod/audit/restore-tests/
```

### 6.2 Simulacro semestral (manual)
- **Cuándo:** Junio y Diciembre
- **Qué:** Simular fallo de nodo RAC y realizar failover completo a AWS
- **Quién:** DBA Lead + DevOps Lead + CTO
- **Evidencia:** Acta de simulacro + logs firmados (requisito HIPAA)

### 6.3 Revisión anual del BCP
- Actualizar contactos de escalación
- Revisar RTO/RPO ante cambios de arquitectura
- Actualizar runbooks con lecciones aprendidas de simulacros

---

## 7. Contactos de Escalación

| Rol | Responsabilidad | Contacto |
|-----|----------------|---------|
| DBA Lead | Recuperación Oracle RAC | DBA on-call: +502 XXXX-XXXX |
| DevOps Lead | Infraestructura AWS | DevOps on-call: +502 XXXX-XXXX |
| CTO | Autorización de DR | CTO: +502 XXXX-XXXX |
| AWS Support | Soporte infraestructura cloud | Business Support: aws-support |
| Oracle Support | Soporte base de datos | My Oracle Support: MOS |

---

## 8. Cumplimiento HIPAA

Este BCP cumple con los siguientes requisitos del HIPAA Security Rule:

| Sección HIPAA | Requisito | Implementación |
|--------------|-----------|----------------|
| §164.308(a)(7)(i) | Plan de contingencia | Este documento |
| §164.308(a)(7)(ii)(A) | Data Backup Plan | RMAN + S3 (sección 4) |
| §164.308(a)(7)(ii)(B) | Disaster Recovery Plan | Runbooks (sección 3) |
| §164.308(a)(7)(ii)(C) | Emergency Mode Operation | Modo lectura durante DR |
| §164.308(a)(7)(ii)(D) | Testing and Revision | Pruebas mensuales (sección 6) |
| §164.308(a)(7)(ii)(E) | Applications and Data Criticality | Sistema crítico — 99.9% SLA |
| §164.312(a)(2)(ii) | Emergency Access Procedure | Credenciales de emergencia en bóveda segura |

---

*Documento generado: 2026-03-06 | Próxima revisión: 2027-03-06*
*Clasificación: CONFIDENCIAL — No distribuir sin autorización del CTO*
