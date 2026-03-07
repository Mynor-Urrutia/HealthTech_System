#!/bin/bash

# ==============================================================================
# Script de Despliegue Automatizado - HealthTech System (Ubuntu/Debian)
# ==============================================================================
# Este script prepara un servidor Linux nuevo para alojar la aplicación web
# completa (Frontend en React + Backend en Django + Base de datos Oracle).
# 
# Ejecución: sudo bash deploy_linux.sh
# ==============================================================================
set -e # Detener el script si hay un error crítico

# Variables de Configuración
PROJECT_NAME="healthtech"
PROJECT_DIR="/var/www/$PROJECT_NAME"
# Detectar el usuario real que invocó sudo (o usar el actual si no hay sudo)
USER=${SUDO_USER:-$(whoami)}
DOMAIN_NAME="tu-dominio.com" # O la IP pública del servidor
PYTHON_VERSION="3.12"
NODE_VERSION="20"

echo "==============================================="
echo "   Iniciando Despliegue de HealthTech System   "
echo "==============================================="

# 1. Actualización del Sistema
echo "[1/10] Actualizando el sistema operativo..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git unzip make build-essential libaio1 nginx certbot python3-certbot-nginx

# 2. Instalación de Python y librerías base
echo "[2/10] Instalando Python $PYTHON_VERSION y dependencias..."
apt-get install -y python3-pip python3-venv python3-dev

# 3. Instalación de Node.js
echo "[3/10] Instalando Node.js v$NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# 4. Instalación de Oracle Instant Client (Necesario para oracledb thick mode si aplica o dependencias nativas)
echo "[4/10] Instalando Oracle Instant Client..."
mkdir -p /opt/oracle
cd /opt/oracle
wget https://download.oracle.com/otn_software/linux/instantclient/2115000/instantclient-basic-linux.x64-21.15.0.0.0dbru.zip
unzip -o instantclient-basic-linux.x64-21.15.0.0.0dbru.zip
rm instantclient-basic-linux.x64-21.15.0.0.0dbru.zip
sh -c "echo /opt/oracle/instantclient_21_15 > /etc/ld.so.conf.d/oracle-instantclient.conf"
ldconfig
export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_15:$LD_LIBRARY_PATH
export PATH=/opt/oracle/instantclient_21_15:$PATH

# 5. Preparar Directorio del Proyecto
echo "[5/10] Preparando directorio del proyecto en $PROJECT_DIR..."
mkdir -p $PROJECT_DIR
chown -R $USER:$USER $PROJECT_DIR

# NOTA: En este punto, deberías clonar tu repositorio git dentro de $PROJECT_DIR
# Por ejemplo: git clone https://github.com/tu-usuario/healthech.git $PROJECT_DIR
echo "       [!] Asegúrate de subir o clonar tu código dentro de $PROJECT_DIR antes de continuar."

# 6. Crear archivo .env base para Producción
echo "[6/11] Configurando archivo .env para Producción..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat <<EOF > $PROJECT_DIR/.env
# ==================================================
# Variables Generadas Automáticamente por el Deploy
# ==================================================
DJANGO_ENV=prod
DEBUG=False
DJANGO_SECRET_KEY=$(openssl rand -hex 32)

# --- Oracle RAC (Alta Disponibilidad) ---
ORACLE_ENV=prod
ORACLE_USER=healthtech_dev
ORACLE_PASSWORD=TuPasswordAqui123
ORACLE_DSN="(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.21)(PORT=1521))(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.22)(PORT=1521)))(CONNECT_DATA=(SERVICE_NAME=racdb)))"

# --- URLs permitidas ---
ALLOWED_HOSTS=$DOMAIN_NAME
CORS_ALLOWED_ORIGINS=http://$DOMAIN_NAME,https://$DOMAIN_NAME
EOF
    chown $USER:$USER $PROJECT_DIR/.env
    echo "       [OK] Archivo .env creado. (Recuerda ajustar la IP/Passwords ahí después)"
else
    echo "       [OK] Archivo .env ya existía, se omitió su sobreescritura."
fi

# 7. Configurar Backend (Django)
echo "[7/11] Configurando el Backend (Django)..."
sudo -u $USER bash -c "cd $PROJECT_DIR/backend && python3 -m venv venv"
sudo -u $USER bash -c "$PROJECT_DIR/backend/venv/bin/pip install --upgrade pip"
sudo -u $USER bash -c "$PROJECT_DIR/backend/venv/bin/pip install -r $PROJECT_DIR/backend/requirements/prod.txt"
sudo -u $USER bash -c "$PROJECT_DIR/backend/venv/bin/pip install gunicorn"

# Crear carpeta de logs y recolección de archivos estáticos de Django
sudo -u $USER bash -c "mkdir -p $PROJECT_DIR/backend/logs"
sudo -u $USER bash -c "cd $PROJECT_DIR/backend && $PROJECT_DIR/backend/venv/bin/python manage.py collectstatic --noinput"

# 8. Configurar Frontend (React)
echo "[8/11] Construyendo el Frontend (React)..."
sudo -u $USER bash -c "cd $PROJECT_DIR/frontend && npm install"
sudo -u $USER bash -c "cd $PROJECT_DIR/frontend && npm run build"

# 9. Configurar Gunicorn como servicio Systemd
echo "[9/11] Configurando Gunicorn Service..."
cat <<EOF > /etc/systemd/system/gunicorn_${PROJECT_NAME}.service
[Unit]
Description=Gunicorn daemon for HealthTech System
After=network.target

[Service]
User=$USER
Group=www-data
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/venv/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:$PROJECT_DIR/backend/gunicorn.sock \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start gunicorn_${PROJECT_NAME}
systemctl enable gunicorn_${PROJECT_NAME}

# 10. Configurar Nginx
echo "[10/11] Configurando Nginx..."
cat <<EOF > /etc/nginx/sites-available/$PROJECT_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Servir Frontend (Archivos estáticos de React construidos)
    location / {
        root $PROJECT_DIR/frontend/dist;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy para el API del Backend (Django)
    location /api/ {
        proxy_pass http://unix:$PROJECT_DIR/backend/gunicorn.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Archivos estáticos de Django (Admin panel, etc.)
    location /static/ {
        alias $PROJECT_DIR/backend/staticfiles/;
    }

    # Archivos Media de Django (Subidas de usuarios)
    location /media/ {
        alias $PROJECT_DIR/backend/media/;
    }
}
EOF

ln -s /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
# Eliminar la configuración por defecto de Nginx si existe
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 11. Consideraciones Finales
echo "[11/11] Despliegue estructural finalizado."
echo "==============================================="
echo "   SIGUIENTES PASOS MANUALES OBLIGATORIOS:     "
echo "==============================================="
echo " 1. Sube el código fuente al servidor a la ruta: $PROJECT_DIR"
echo " 2. Revisa el archivo generado en $PROJECT_DIR/.env y valida tus contraseñas del RAC."
echo " 3. Aplica las migraciones a la BD si es necesario:"
echo "    cd $PROJECT_DIR/backend && ./venv/bin/python manage.py migrate"
echo " 4. Reinicia gunicorn:"
echo "    sudo systemctl restart gunicorn_${PROJECT_NAME}"
echo " 5. (Opcional) Configura SSL (HTTPS) con Let's Encrypt:"
echo "    sudo certbot --nginx -d $DOMAIN_NAME"
echo "==============================================="
