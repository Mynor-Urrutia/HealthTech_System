#!/bin/bash
# ============================================================
# HealthTech Solutions — Script: RMAN → AWS S3 Sync
# Descripción: Sincroniza los backups RMAN hacia S3 para DR
# Ejecutar: cron job en el servidor Oracle (nodo 1 RAC)
# Entorno:  Oracle Linux 7 / AWS CLI v2 con IAM Role adjunto
#
# Cron recomendado (post-backup RMAN):
#   # Full backup — Domingo 03:30 (30 min after RMAN full at 02:00)
#   30 3 * * 0 /opt/healthtech/scripts/rman_s3_sync.sh >> /var/log/healthtech/s3_sync.log 2>&1
#   # Incremental — Lunes-Sábado 03:00
#   0 3 * * 1-6 /opt/healthtech/scripts/rman_s3_sync.sh >> /var/log/healthtech/s3_sync.log 2>&1
#   # Arch logs — Cada 30 min (after RMAN arch backup at xx:05)
#   10,40 * * * * /opt/healthtech/scripts/rman_s3_sync.sh ARCH_ONLY >> /var/log/healthtech/s3_sync.log 2>&1
#
# RPO: 30 minutos | RTO objetivo: 2 horas
# HIPAA: Datos cifrados en tránsito (TLS 1.3) y en reposo (SSE-AES256)
# ============================================================

set -euo pipefail

# ---- Configuración ----
BACKUP_LOCAL="/backup/rman"
S3_BUCKET="s3://healthtech-backup-prod"
S3_PREFIX_RMAN="${S3_BUCKET}/rman/"
LOG_DIR="/var/log/healthtech"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HOSTNAME=$(hostname)
ARCH_ONLY="${1:-}"

# ---- Validación de dependencias ----
if ! command -v aws &>/dev/null; then
    echo "[${TIMESTAMP}] ERROR: AWS CLI no encontrado. Instalar con: pip3 install awscli"
    exit 1
fi

if [ ! -d "${BACKUP_LOCAL}" ]; then
    echo "[${TIMESTAMP}] ERROR: Directorio de backup RMAN no existe: ${BACKUP_LOCAL}"
    exit 1
fi

mkdir -p "${LOG_DIR}"

echo "[${TIMESTAMP}] ===== INICIO SYNC RMAN → S3 | Host: ${HOSTNAME} ====="

# ---- Función de sincronización ----
sync_to_s3() {
    local source_dir="$1"
    local s3_dest="$2"
    local description="$3"

    echo "[$(date '+%H:%M:%S')] Sincronizando ${description}..."
    aws s3 sync "${source_dir}" "${s3_dest}" \
        --sse AES256 \
        --storage-class STANDARD_IA \
        --delete \
        --exclude "*.tmp" \
        --only-show-errors

    if [ $? -eq 0 ]; then
        echo "[$(date '+%H:%M:%S')] OK: ${description} sincronizado exitosamente."
    else
        echo "[$(date '+%H:%M:%S')] ERROR: Fallo en sync de ${description}."
        return 1
    fi
}

# ---- Modo: solo archive logs (cada 30 minutos) ----
if [ "${ARCH_ONLY}" = "ARCH_ONLY" ]; then
    sync_to_s3 "${BACKUP_LOCAL}/arch_" "${S3_PREFIX_RMAN}arch/" "Archive Logs"
    echo "[$(date '+%H:%M:%S')] ===== FIN SYNC (ARCH_ONLY) ====="
    exit 0
fi

# ---- Sync completo: backups + archive logs + controlfile ----
sync_to_s3 "${BACKUP_LOCAL}" "${S3_PREFIX_RMAN}" "Backup RMAN Completo"

# ---- Verificar tamaño total en S3 ----
echo "[$(date '+%H:%M:%S')] Verificando tamaño total en S3..."
S3_SIZE=$(aws s3 ls "${S3_PREFIX_RMAN}" --recursive --human-readable --summarize 2>/dev/null \
    | grep "Total Size" | awk '{print $3, $4}' || echo "N/A")
echo "[$(date '+%H:%M:%S')] Tamaño total en S3: ${S3_SIZE}"

# ---- Verificar archivos más recientes en S3 ----
echo "[$(date '+%H:%M:%S')] Archivos más recientes en S3:"
aws s3 ls "${S3_PREFIX_RMAN}" --recursive | sort -k1,2 | tail -5

# ---- Aplicar política de lifecycle (verificar que está activa) ----
echo "[$(date '+%H:%M:%S')] Verificando lifecycle policy en S3..."
aws s3api get-bucket-lifecycle-configuration \
    --bucket "healthtech-backup-prod" \
    --query 'Rules[*].{ID:ID,Status:Status}' \
    --output text 2>/dev/null || echo "[WARN] No se pudo verificar lifecycle policy."

echo "[$(date '+%H:%M:%S')] ===== FIN SYNC RMAN → S3 | Host: ${HOSTNAME} ====="

# ---- Notificación SNS en caso de error (comentar si no se usa SNS) ----
# aws sns publish \
#     --topic-arn "arn:aws:sns:us-east-1:123456789012:healthtech-alerts" \
#     --message "RMAN S3 Sync completado exitosamente en ${HOSTNAME}" \
#     --subject "HealthTech Backup OK"

exit 0
