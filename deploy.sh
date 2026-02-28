#!/bin/bash
# ============================================================
# HealthTech - Script de Despliegue en Producción (Linux)
# ============================================================
# Uso: sudo bash deploy.sh
# Requisitos previos:
#   - Ubuntu/Debian 22.04+ o RHEL/Rocky 8+
#   - Oracle Instant Client instalado
#   - Python 3.11+
#   - Node.js 18+ y npm
#   - Nginx instalado
# ============================================================

set -e  # Exit on any error

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
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ======================== VERIFICACIONES ========================
log "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
log "${BLUE}║     HealthTech - Despliegue en Producción        ║${NC}"
log "${BLUE}╚══════════════════════════════════════════════════╝${NC}"

if [ "$EUID" -ne 0 ]; then
    error "Este script debe ejecutarse como root (sudo)."
fi

command -v python3 >/dev/null 2>&1 || error "Python3 no encontrado."
command -v node >/dev/null 2>&1 || error "Node.js no encontrado."
command -v npm >/dev/null 2>&1 || error "npm no encontrado."
command -v nginx >/dev/null 2>&1 || error "Nginx no encontrado. Instálelo con: apt install nginx"

log "✓ Dependencias del sistema verificadas"

# ======================== CREAR USUARIO ========================
if ! id "${APP_USER}" &>/dev/null; then
    log "Creando usuario del sistema: ${APP_USER}..."
    useradd --system --shell /bin/bash --home-dir ${APP_DIR} --create-home ${APP_USER}
fi
log "✓ Usuario ${APP_USER} configurado"

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
${VENV_DIR}/bin/pip install --upgrade pip
${VENV_DIR}/bin/pip install -r ${BACKEND_DIR}/requirements.txt
log "✓ Dependencias de Python instaladas"

# Verificar .env
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    warn "No se encontró .env - Creando desde plantilla..."
    cp ${BACKEND_DIR}/.env.example ${BACKEND_DIR}/.env

    # Generar SECRET_KEY automáticamente
    SECRET_KEY=$(${VENV_DIR}/bin/python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
    sed -i "s|DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${SECRET_KEY}|" ${BACKEND_DIR}/.env
    sed -i "s|DJANGO_DEBUG=.*|DJANGO_DEBUG=False|" ${BACKEND_DIR}/.env
    sed -i "s|DJANGO_ALLOWED_HOSTS=.*|DJANGO_ALLOWED_HOSTS=${DOMAIN},localhost|" ${BACKEND_DIR}/.env
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://${DOMAIN}|" ${BACKEND_DIR}/.env

    warn "⚠ IMPORTANTE: Edite ${BACKEND_DIR}/.env con las credenciales de su base de datos Oracle."
fi

# Crear directorios necesarios
mkdir -p ${BACKEND_DIR}/logs
mkdir -p ${BACKEND_DIR}/media
mkdir -p ${BACKEND_DIR}/staticfiles

# Coleccionar archivos estáticos y ejecutar migraciones
cd ${BACKEND_DIR}
${VENV_DIR}/bin/python manage.py collectstatic --noinput
${VENV_DIR}/bin/python manage.py migrate --noinput
log "✓ Migraciones y archivos estáticos completados"

chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# ======================== FRONTEND ========================
log "Construyendo Frontend React..."

cd ${FRONTEND_DIR}

# Crear .env de producción si no existe
if [ ! -f "${FRONTEND_DIR}/.env.production" ]; then
    cat > ${FRONTEND_DIR}/.env.production << EOF
VITE_API_BASE_URL=https://${DOMAIN}
EOF
fi

npm install
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
    
    # Redirigir HTTP a HTTPS (descomente si tiene SSL)
    # return 301 https://\$host\$request_uri;

    # Frontend - archivos estáticos de React
    root ${FRONTEND_DIR}/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net;" always;

    # API Backend - Proxy a Gunicorn
    location /api/ {
        proxy_pass http://127.0.0.1:${GUNICORN_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:${GUNICORN_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Archivos estáticos de Django
    location /static/ {
        alias ${BACKEND_DIR}/staticfiles/;
        expires 30d;
        access_log off;
    }

    # Archivos media (uploads)
    location /media/ {
        alias ${BACKEND_DIR}/media/;
        expires 7d;
        access_log off;
    }

    # React Router - SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Bloquear acceso a archivos ocultos
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Límite de tamaño de uploads (archivos médicos)
    client_max_body_size 50M;
}
EOF

# Habilitar site
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
log "✓ Nginx configurado y activo"

# ======================== FIREWALL ========================
if command -v ufw >/dev/null 2>&1; then
    ufw allow 'Nginx Full' 2>/dev/null || true
    log "✓ Firewall configurado"
fi

# ======================== RESUMEN ========================
echo ""
log "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
log "${BLUE}║        ¡Despliegue Completado con Éxito!         ║${NC}"
log "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
log "Dashboard:     http://${DOMAIN}"
log "API Backend:   http://${DOMAIN}/api/"
log "Django Admin:  http://${DOMAIN}/admin/"
echo ""
log "${YELLOW}⚠ Pasos Pendientes:${NC}"
echo "  1. Edite ${BACKEND_DIR}/.env con credenciales de Oracle reales"
echo "  2. Configure SSL con: sudo certbot --nginx -d ${DOMAIN}"
echo "  3. Reinicie servicios: sudo systemctl restart ${APP_NAME} nginx"
echo ""
log "${YELLOW}Comandos Útiles:${NC}"
echo "  Ver logs:      sudo journalctl -u ${APP_NAME} -f"
echo "  Reiniciar:     sudo systemctl restart ${APP_NAME}"
echo "  Estado:        sudo systemctl status ${APP_NAME}"
echo "  Logs Gunicorn: tail -f ${BACKEND_DIR}/logs/gunicorn-error.log"
echo ""
