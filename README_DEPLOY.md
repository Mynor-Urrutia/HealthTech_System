# Guía de Despliegue para HealthTech System (Linux)

Esta guía explica cómo utilizar el script `deploy_linux.sh` para levantar el proyecto en un servidor en la nube (como EC2 de AWS, DigitalOcean, Linode) basado en **Ubuntu 20.04 / 22.04 o Debian**.

El script se encarga de instalar casi toda la arquitectura: Python, Node.js, Oracle Instant Client, Nginx (Frontend y Proxy Inverso) y Gunicorn (Servidor WSGI para Django).

## Prerrequisitos
1. **Un servidor Linux** con acceso a internet.
2. **Acceso Root** o un usuario con permisos `sudo`.
3. Tu servidor **debe poder conectarse a tu clúster Oracle RAC** en privado o mediante IP pública (es decir, hacer ping a `10.0.0.21`).

---

## Instrucciones Paso a Paso

### 1. Ajustar Variables del Script
Abre el archivo `deploy_linux.sh` y ajusta las variables en la parte superior según tus preferencias:
```bash
PROJECT_NAME="healthtech"
PROJECT_DIR="/var/www/healthtech"
USER="ubuntuser"         # <-- Cámbiate a tu usuario real (ej. ubuntu, debian)
DOMAIN_NAME="tu-ip-publica-o-dominio.com"   # <-- Cámbiate a tu IP o Dominio
```

### 2. Ejecutar el Script 
Copia el archivo `deploy_linux.sh` a tu servidor, dale permisos de ejecución y ejecútalo como superusuario.

```bash
chmod +x deploy_linux.sh
sudo ./deploy_linux.sh
```

El script tomará un rato ya que descarga dependencias pesadas como el *Oracle Instant Client* y compila herramientas de desarrollo base.

### 3. Clonar y Configurar tu Código Fuente
El script generará la estructura de carpetas, pero no bajará tu código porque suele ser privado.
Haz esto:

```bash
# Entra al directorio del proyecto
cd /var/www/healthtech

# Clona tu código allí (ajusta la ruta de tu repo remoto git)
# git clone https://tugeithubo-gitlab/healthtech.git .
```

### 4. Verificar Variables de Entorno (.env)
El script `deploy_linux.sh` **creará automáticamente un archivo `.env` base** en `/var/www/healthtech/.env` con una clave secreta segura y preconfigurado para entorno de producción apuntando a tu clúster RAC.

Deberás abrir este archivo para validar tus credenciales reales (asegurarte de que el usuario, contraseña y DSN de Oracle sean correctos):

```bash
nano /var/www/healthtech/.env
```

### 5. Configurar la Base de Datos (Si aplica)
Ya con el código y el `.env` listo en el servidor, si aún no has creado las tablas o los datos en el RAC (por ejemplo, si no corriste las migraciones desde tu entorno local), puedes ejecutar las migraciones desde el servidor de producción:

```bash
cd /var/www/healthtech/backend
source venv/bin/activate

# Crear el esquema cruzando hacia el RAC
python manage.py migrate

deactivate
```

*(El paso de colectar archivos estáticos `collectstatic` ya fue realizado automáticamente por el script durante el despliegue).*

### 6. Reiniciar Servicios
Finalmente, reinicia los dos servicios principales de Linux para que tomen tus últimos cambios y lean el `.env` que acabas de crear:

```bash
sudo systemctl restart gunicorn_healthtech
sudo systemctl restart nginx
```

Si vas a `http://tu-dominio.com` o a la IP de la máquina en tu navegador, deberías poder ver el frontend Vite desplegado y procesando las peticiones a la base de datos a través de los proxies del Nginx (usando `/api/`).
