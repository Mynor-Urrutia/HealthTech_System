#!/bin/bash
# ============================================================
# HealthTech - Script de Despliegue en Producción (Linux)
# ============================================================
# Uso: sudo bash deploy.sh [dominio]
# Ejemplo: sudo bash deploy.sh healthtech.miempresa.com
#
# Requisitos previos:
#   - Ubuntu/Debian 22.04+ o RHEL/Rocky 8+
#   - Oracle Database XE instalado y corriendo
#   - Python 3.11+
#   - Node.js 18+ y npm
#   - Nginx instalado
# ============================================================

set -e

# ======================== CONFIGURACIÓN ========================
APP_NAME="healthtech"
APP_DIR="/opt/healthtech"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/venv"
APP_USER="healthtech"
DOMAIN="${1:-$(hostname -f)}"
GUNICORN_WORKERS=3
GUNICORN_PORT=8000

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
ask() { echo -e "${CYAN}[?]${NC} $1"; }

# ======================== VERIFICACIONES ========================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   HealthTech - Despliegue en Producción (Linux)      ║${NC}"
echo -e "${BLUE}║   Sistema de Gestión Hospitalaria HIPAA              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    error "Este script debe ejecutarse como root (sudo)."
fi

command -v python3 >/dev/null 2>&1 || error "Python3 no encontrado. Instale con: apt install python3 python3-venv python3-pip"
command -v node >/dev/null 2>&1 || error "Node.js no encontrado. Instale con: apt install nodejs npm"
command -v npm >/dev/null 2>&1 || error "npm no encontrado."
command -v nginx >/dev/null 2>&1 || error "Nginx no encontrado. Instale con: apt install nginx"

log "✓ Dependencias del sistema verificadas"

# ======================== CONFIGURACIÓN DE ORACLE DB ========================
echo ""
echo -e "${BLUE}── Configuración de Base de Datos Oracle ──${NC}"
echo ""

# Preguntar si quiere configurar Oracle
ask "¿Desea crear la base de datos y usuario de Oracle ahora? (s/n)"
read -r SETUP_ORACLE

if [[ "$SETUP_ORACLE" =~ ^[sS]$ ]]; then

    # Verificar que sqlplus está disponible
    if ! command -v sqlplus >/dev/null 2>&1; then
        # Intentar encontrarlo en rutas comunes de Oracle
        ORACLE_PATHS=(
            "/opt/oracle/product/*/dbhome_1/bin"
            "/u01/app/oracle/product/*/dbhome_1/bin"
            "/opt/oracle/instantclient*"
            "/usr/lib/oracle/*/client64/bin"
        )
        SQLPLUS_FOUND=false
        for p in "${ORACLE_PATHS[@]}"; do
            for match in $p; do
                if [ -f "${match}/sqlplus" ]; then
                    export PATH="${match}:$PATH"
                    SQLPLUS_FOUND=true
                    log "sqlplus encontrado en: ${match}"
                    break 2
                fi
            done
        done
        if [ "$SQLPLUS_FOUND" = false ]; then
            warn "sqlplus no encontrado en el PATH."
            ask "Ingrese la ruta completa al directorio bin de Oracle (ej: /opt/oracle/product/21c/dbhomeXE/bin):"
            read -r ORACLE_BIN_PATH
            if [ -f "${ORACLE_BIN_PATH}/sqlplus" ]; then
                export PATH="${ORACLE_BIN_PATH}:$PATH"
            else
                error "sqlplus no encontrado en ${ORACLE_BIN_PATH}. Verifique su instalación de Oracle."
            fi
        fi
    fi

    # Configurar ORACLE_HOME y LD_LIBRARY_PATH si no están definidos
    if [ -z "$ORACLE_HOME" ]; then
        ORACLE_HOME_GUESS=$(dirname $(dirname $(which sqlplus 2>/dev/null || echo "/opt/oracle/product/21c/dbhomeXE/bin/sqlplus")))
        export ORACLE_HOME="${ORACLE_HOME_GUESS}"
        export LD_LIBRARY_PATH="${ORACLE_HOME}/lib:${LD_LIBRARY_PATH}"
        log "ORACLE_HOME configurado como: ${ORACLE_HOME}"
    fi

    # Pedir datos de conexión
    echo ""
    ask "Host del servidor Oracle (Enter para 'localhost'):"
    read -r DB_HOST
    DB_HOST="${DB_HOST:-localhost}"

    ask "Puerto de Oracle (Enter para '1521'):"
    read -r DB_PORT
    DB_PORT="${DB_PORT:-1521}"

    ask "Nombre del servicio/SID (Enter para 'XE'):"
    read -r DB_SID
    DB_SID="${DB_SID:-XE}"

    ask "Contraseña del usuario SYS/SYSTEM de Oracle:"
    read -rs ORACLE_SYS_PASSWORD
    echo ""

    # Nombre de usuario para HealthTech
    ask "Nombre del usuario a crear para HealthTech (Enter para 'healthtech'):"
    read -r HT_DB_USER
    HT_DB_USER="${HT_DB_USER:-healthtech}"

    # Pedir contraseña del nuevo usuario
    while true; do
        ask "Contraseña para el usuario '${HT_DB_USER}' (mínimo 8 caracteres):"
        read -rs HT_DB_PASSWORD
        echo ""

        if [ ${#HT_DB_PASSWORD} -lt 8 ]; then
            warn "La contraseña debe tener al menos 8 caracteres. Intente de nuevo."
            continue
        fi

        ask "Confirme la contraseña:"
        read -rs HT_DB_PASSWORD_CONFIRM
        echo ""

        if [ "$HT_DB_PASSWORD" != "$HT_DB_PASSWORD_CONFIRM" ]; then
            warn "Las contraseñas no coinciden. Intente de nuevo."
            continue
        fi

        break
    done

    log "Creando tablespace y usuario en Oracle..."

    # Construir connection string
    if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
        CONN_STR="sys/${ORACLE_SYS_PASSWORD} as sysdba"
    else
        CONN_STR="sys/${ORACLE_SYS_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_SID} as sysdba"
    fi

    # Ejecutar SQL para crear tablespace, usuario y privilegios
    sqlplus -S "${CONN_STR}" <<EOSQL
    WHENEVER SQLERROR CONTINUE
    SET SERVEROUTPUT ON

    -- Crear tablespace si no existe
    DECLARE
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM dba_tablespaces WHERE tablespace_name = 'HEALTHTECH_TS';
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'CREATE TABLESPACE HEALTHTECH_TS DATAFILE ''/opt/oracle/oradata/XE/healthtech.dbf'' SIZE 500M AUTOEXTEND ON NEXT 100M MAXSIZE 5G';
            DBMS_OUTPUT.PUT_LINE('✓ Tablespace HEALTHTECH_TS creado exitosamente');
        ELSE
            DBMS_OUTPUT.PUT_LINE('→ Tablespace HEALTHTECH_TS ya existe, se reutilizará');
        END IF;
    END;
    /

    -- Crear usuario si no existe
    DECLARE
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = UPPER('${HT_DB_USER}');
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'CREATE USER ${HT_DB_USER} IDENTIFIED BY "${HT_DB_PASSWORD}" DEFAULT TABLESPACE HEALTHTECH_TS TEMPORARY TABLESPACE TEMP QUOTA UNLIMITED ON HEALTHTECH_TS';
            DBMS_OUTPUT.PUT_LINE('✓ Usuario ${HT_DB_USER} creado exitosamente');
        ELSE
            EXECUTE IMMEDIATE 'ALTER USER ${HT_DB_USER} IDENTIFIED BY "${HT_DB_PASSWORD}"';
            DBMS_OUTPUT.PUT_LINE('→ Usuario ${HT_DB_USER} ya existe, contraseña actualizada');
        END IF;
    END;
    /

    -- Asignar privilegios
    GRANT CONNECT, RESOURCE TO ${HT_DB_USER};
    GRANT CREATE SESSION TO ${HT_DB_USER};
    GRANT CREATE TABLE TO ${HT_DB_USER};
    GRANT CREATE SEQUENCE TO ${HT_DB_USER};
    GRANT CREATE VIEW TO ${HT_DB_USER};
    GRANT CREATE PROCEDURE TO ${HT_DB_USER};
    GRANT UNLIMITED TABLESPACE TO ${HT_DB_USER};

    COMMIT;
    EXIT;
EOSQL

    if [ $? -eq 0 ]; then
        log "✓ Base de datos Oracle configurada exitosamente"
    else
        warn "⚠ Hubo advertencias durante la configuración de Oracle. Revise los mensajes anteriores."
    fi

else
    # Si no configura Oracle ahora, pedir datos manualmente
    echo ""
    ask "Host del servidor Oracle (Enter para 'localhost'):"
    read -r DB_HOST
    DB_HOST="${DB_HOST:-localhost}"

    ask "Puerto de Oracle (Enter para '1521'):"
    read -r DB_PORT
    DB_PORT="${DB_PORT:-1521}"

    ask "Nombre del servicio/SID (Enter para 'XE'):"
    read -r DB_SID
    DB_SID="${DB_SID:-XE}"

    ask "Usuario de la base de datos (Enter para 'healthtech'):"
    read -r HT_DB_USER
    HT_DB_USER="${HT_DB_USER:-healthtech}"

    ask "Contraseña del usuario '${HT_DB_USER}':"
    read -rs HT_DB_PASSWORD
    echo ""
fi

# ======================== CREAR USUARIO DEL SISTEMA ========================
if ! id "${APP_USER}" &>/dev/null; then
    log "Creando usuario del sistema: ${APP_USER}..."
    useradd --system --shell /bin/bash --home-dir ${APP_DIR} --create-home ${APP_USER}
fi
log "✓ Usuario del sistema '${APP_USER}' configurado"

# ======================== COPIAR PROYECTO ========================
log "Copiando proyecto a ${APP_DIR}..."
mkdir -p ${APP_DIR}
cp -r . ${APP_DIR}/
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# ======================== BACKEND ========================
log "Configurando Backend Django..."

# Crear entorno virtual
if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv ${VENV_DIR}
fi

# Instalar dependencias
${VENV_DIR}/bin/pip install --upgrade pip -q
${VENV_DIR}/bin/pip install -r ${BACKEND_DIR}/requirements.txt -q
log "✓ Dependencias de Python instaladas"

# Generar .env del backend con los datos recopilados
SECRET_KEY=$(${VENV_DIR}/bin/python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

cat > ${BACKEND_DIR}/.env << EOF
# HealthTech - Variables de Entorno (generado por deploy.sh)
# Fecha: $(date)

DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN},localhost,127.0.0.1

DB_ENGINE=django.db.backends.oracle
DB_NAME=${DB_SID}
DB_USER=${HT_DB_USER}
DB_PASSWORD=${HT_DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}

CORS_ALLOWED_ORIGINS=https://${DOMAIN},http://${DOMAIN}

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=1
EOF

log "✓ Archivo .env generado con credenciales"

# Crear directorios necesarios
mkdir -p ${BACKEND_DIR}/logs
mkdir -p ${BACKEND_DIR}/media
mkdir -p ${BACKEND_DIR}/staticfiles

# Ejecutar migraciones y coleccionar archivos estáticos
cd ${BACKEND_DIR}
${VENV_DIR}/bin/python manage.py collectstatic --noinput
log "✓ Archivos estáticos recopilados"

${VENV_DIR}/bin/python manage.py migrate --noinput
log "✓ Migraciones de base de datos aplicadas"

# Preguntar si crear superusuario
ask "¿Desea crear un usuario administrador para el sistema? (s/n)"
read -r CREATE_ADMIN

if [[ "$CREATE_ADMIN" =~ ^[sS]$ ]]; then
    ask "Nombre de usuario del administrador (Enter para 'admin'):"
    read -r ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"

    ask "Email del administrador (Enter para 'admin@healthtech.local'):"
    read -r ADMIN_EMAIL
    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@healthtech.local}"

    ask "Contraseña del administrador:"
    read -rs ADMIN_PASSWORD
    echo ""

    ${VENV_DIR}/bin/python manage.py shell -c "
from users.models import CustomUser
if not CustomUser.objects.filter(username='${ADMIN_USER}').exists():
    u = CustomUser.objects.create_superuser('${ADMIN_USER}', '${ADMIN_EMAIL}', '${ADMIN_PASSWORD}')
    u.role = 'ADMIN'
    u.first_name = 'Administrador'
    u.last_name = 'Sistema'
    u.save()
    print('✓ Superusuario ${ADMIN_USER} creado')
else:
    print('→ Usuario ${ADMIN_USER} ya existe')
"
fi

chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# ======================== FRONTEND ========================
log "Construyendo Frontend React..."

cd ${FRONTEND_DIR}

# Crear .env de producción
cat > ${FRONTEND_DIR}/.env.production << EOF
VITE_API_BASE_URL=https://${DOMAIN}
EOF

npm install --silent
npm run build
log "✓ Frontend compilado en ${FRONTEND_DIR}/dist"

# ======================== GUNICORN SERVICE ========================
log "Configurando servicio Gunicorn..."

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=HealthTech Gunicorn Application Server
After=network.target

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${BACKEND_DIR}
Environment="PATH=${VENV_DIR}/bin"
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${VENV_DIR}/bin/gunicorn core.wsgi:application \\
    --workers ${GUNICORN_WORKERS} \\
    --bind 127.0.0.1:${GUNICORN_PORT} \\
    --timeout 120 \\
    --access-logfile ${BACKEND_DIR}/logs/gunicorn-access.log \\
    --error-logfile ${BACKEND_DIR}/logs/gunicorn-error.log \\
    --capture-output
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APP_NAME}
systemctl restart ${APP_NAME}
log "✓ Servicio Gunicorn configurado y activo"

# ======================== NGINX ========================
log "Configurando Nginx..."

cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${FRONTEND_DIR}/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:${GUNICORN_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:${GUNICORN_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/ {
        alias ${BACKEND_DIR}/staticfiles/;
        expires 30d;
        access_log off;
    }

    location /media/ {
        alias ${BACKEND_DIR}/media/;
        expires 7d;
        access_log off;
    }

    # React Router SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\. { deny all; }

    client_max_body_size 50M;
}
EOF

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
log "✓ Nginx configurado"

# Firewall
if command -v ufw >/dev/null 2>&1; then
    ufw allow 'Nginx Full' 2>/dev/null || true
    log "✓ Firewall configurado"
fi

# ======================== RESUMEN ========================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ¡Despliegue Completado Exitosamente!           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
log "🌐 Dashboard:     http://${DOMAIN}"
log "🔌 API Backend:   http://${DOMAIN}/api/"
log "⚙️  Django Admin:  http://${DOMAIN}/admin/"
echo ""
log "${YELLOW}📝 Siguiente paso: configurar SSL gratuito con Let's Encrypt:${NC}"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d ${DOMAIN}"
echo ""
log "${YELLOW}Comandos Útiles:${NC}"
echo "   Ver logs:      sudo journalctl -u ${APP_NAME} -f"
echo "   Reiniciar:     sudo systemctl restart ${APP_NAME}"
echo "   Estado:        sudo systemctl status ${APP_NAME}"
echo "   Logs Gunicorn: tail -f ${BACKEND_DIR}/logs/gunicorn-error.log"
echo "   Editar config: sudo nano ${BACKEND_DIR}/.env"
echo ""
