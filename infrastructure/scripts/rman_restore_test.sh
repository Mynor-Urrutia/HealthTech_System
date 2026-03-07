#!/bin/bash
# ============================================================
# HealthTech Solutions — Script: RMAN Restore Test (Mensual)
# Descripción: Verifica la integridad de los backups RMAN
#              sin hacer restore real (VALIDATE only)
# Ejecutar:   Primer domingo de cada mes, 04:00 AM
# Cron:       0 4 1-7 * 0 /opt/healthtech/scripts/rman_restore_test.sh
#
# HIPAA 45 CFR §164.308(a)(7): Require periodic testing of DR procedures
# ============================================================

set -euo pipefail

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/var/log/healthtech/rman_restore_test_$(date '+%Y%m%d').log"
RMAN_LOG="/var/log/healthtech/rman_validate_$(date '+%Y%m%d').log"
ORACLE_SID="${ORACLE_SID:-HTPROD}"
ORACLE_HOME="${ORACLE_HOME:-/u01/app/oracle/product/19c/dbhome_1}"

export ORACLE_SID ORACLE_HOME
export PATH="${ORACLE_HOME}/bin:${PATH}"
export LD_LIBRARY_PATH="${ORACLE_HOME}/lib:${LD_LIBRARY_PATH:-}"

echo "[${TIMESTAMP}] ===== INICIO RMAN RESTORE TEST MENSUAL =====" | tee -a "${LOG_FILE}"
echo "[${TIMESTAMP}] Oracle SID: ${ORACLE_SID}" | tee -a "${LOG_FILE}"

# ---- Ejecutar RMAN VALIDATE ----
echo "[$(date '+%H:%M:%S')] Ejecutando RMAN RESTORE DATABASE VALIDATE..." | tee -a "${LOG_FILE}"

rman target / nocatalog log="${RMAN_LOG}" <<'RMAN_EOF'
RUN {
  -- Validar backup de la base de datos completa
  RESTORE DATABASE VALIDATE;
  -- Validar archive logs disponibles
  RESTORE ARCHIVELOG ALL VALIDATE;
  -- Verificar el controlfile de backup más reciente
  RESTORE CONTROLFILE VALIDATE;
}

-- Mostrar resultado de la validación
LIST FAILURE;
EXIT;
RMAN_EOF

RMAN_EXIT=$?

if [ ${RMAN_EXIT} -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] OK: RMAN VALIDATE completado exitosamente." | tee -a "${LOG_FILE}"
    STATUS="EXITOSO"
else
    echo "[$(date '+%H:%M:%S')] ERROR: RMAN VALIDATE falló con código ${RMAN_EXIT}." | tee -a "${LOG_FILE}"
    STATUS="FALLIDO"
fi

# ---- Verificar que no haya RMAN-XXXXX errors en el log ----
if grep -q "RMAN-[0-9]" "${RMAN_LOG}" 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] WARN: Se encontraron errores RMAN en el log:" | tee -a "${LOG_FILE}"
    grep "RMAN-[0-9]" "${RMAN_LOG}" | tee -a "${LOG_FILE}"
    STATUS="CON_ADVERTENCIAS"
fi

# ---- Resumen ----
echo "[$(date '+%H:%M:%S')] ===== RESULTADO: ${STATUS} =====" | tee -a "${LOG_FILE}"
echo "[$(date '+%H:%M:%S')] Log RMAN: ${RMAN_LOG}" | tee -a "${LOG_FILE}"
echo "[$(date '+%H:%M:%S')] Log Prueba: ${LOG_FILE}" | tee -a "${LOG_FILE}"

# ---- Copiar log de prueba a S3 (evidencia HIPAA) ----
if command -v aws &>/dev/null; then
    aws s3 cp "${LOG_FILE}" "s3://healthtech-backup-prod/audit/restore-tests/" --sse AES256
    aws s3 cp "${RMAN_LOG}" "s3://healthtech-backup-prod/audit/restore-tests/" --sse AES256
    echo "[$(date '+%H:%M:%S')] Log de evidencia subido a S3." | tee -a "${LOG_FILE}"
fi

echo "[$(date '+%H:%M:%S')] ===== FIN RMAN RESTORE TEST =====" | tee -a "${LOG_FILE}"

exit ${RMAN_EXIT}
