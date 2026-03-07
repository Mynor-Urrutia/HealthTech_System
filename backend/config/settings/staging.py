"""
HealthTech Solutions — Settings STAGING
Oracle 19c — 1 nodo en Proxmox
VPD activo, TDE desactivado (simula pre-prod)
"""

from .base import *

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=lambda v: [s.strip() for s in v.split(',')])

# ============================================================
# Base de datos — Oracle 19c single node (Proxmox)
# ============================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.oracle',
        'NAME': config('ORACLE_SERVICE', default='HTPDB'),
        'USER': config('ORACLE_USER'),
        'PASSWORD': config('ORACLE_PASSWORD'),
        'HOST': config('ORACLE_HOST'),
        'PORT': config('ORACLE_PORT', default='1521'),
        'OPTIONS': {
            'use_oracledb': True,
        },
        'CONN_MAX_AGE': 120,
    }
}

# ============================================================
# CORS
# ============================================================
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# Email — SMTP real en staging
# ============================================================
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')

# ============================================================
# Almacenamiento — S3 en staging (bucket separado)
# ============================================================
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# ============================================================
# Seguridad
# ============================================================
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
