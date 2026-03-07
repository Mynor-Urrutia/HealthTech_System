"""
HealthTech Solutions — Settings PRODUCCIÓN
Oracle 19c RAC — 2 nodos VMware
VPD activo, TDE activo, SCAN listener, Load Balance + Failover
"""

from .base import *

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=lambda v: [s.strip() for s in v.split(',')])

# ============================================================
# Base de datos — Oracle 19c RAC con SCAN
# Router separa OLTP (nodo 1) de Reportes (nodo 2)
# ============================================================
DATABASES = {
    # Servicio OLTP — Escrituras y lecturas transaccionales
    'default': {
        'ENGINE': 'django.db.backends.oracle',
        'NAME': config('ORACLE_DSN', default=config('ORACLE_OLTP_SERVICE', default='')),     # Acepta DSN completo de RAC o alias TNS
        'USER': config('ORACLE_USER'),
        'PASSWORD': config('ORACLE_PASSWORD'),
        'HOST': '',    # Vacío: usa tnsnames.ora
        'PORT': '',
        'CONN_MAX_AGE': 300,
    },
    # Servicio REPORTS — Consultas pesadas en nodo 2
    'reports': {
        'ENGINE': 'django.db.backends.oracle',
        'NAME': config('ORACLE_DSN_REPORTS', default=config('ORACLE_REPORTS_SERVICE', default='')),  # Acepta DSN completo o alias TNS
        'USER': config('ORACLE_USER'),
        'PASSWORD': config('ORACLE_PASSWORD'),
        'HOST': '',
        'PORT': '',
        'CONN_MAX_AGE': 300,
    },
}

# Router de base de datos para RAC
DATABASE_ROUTERS = ['config.oracle.router.OracleRACRouter']

# ============================================================
# CORS — Solo dominios internos de producción
# ============================================================
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# Seguridad HTTPS estricta (HIPAA — TLS 1.3)
# ============================================================
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ============================================================
# Almacenamiento — S3 PACS producción
# ============================================================
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# ============================================================
# Email producción
# ============================================================
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.ejemplo.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')

# ============================================================
# Caché — Para sesiones y rate limiting en prod
# ============================================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'healthtech-cache',
    }
}
