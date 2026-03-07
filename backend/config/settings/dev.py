"""
HealthTech Solutions — Settings DEV
Oracle 21c XE local — Sin VPD, sin TDE
"""

from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# ============================================================
# Base de datos — Oracle 21c XE (local)
# Conexión directa, sin SCAN, sin pool RAC
# ============================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.oracle',
        # Easy Connect completo como NAME (sin HOST/PORT separados).
        # Cuando HOST está vacío, Django pasa NAME directamente como DSN,
        # lo que fuerza el modo service_name en oracledb thin (no SID).
        # Usamos el DSN completo de RAC si está disponible, o construimos la cadena local
        'NAME': config('ORACLE_DSN', default=(
            f"{config('ORACLE_HOST', default='localhost')}"
            f":{config('ORACLE_PORT', default='1521')}"
            f"/{config('ORACLE_SERVICE', default='xepdb1')}"
        )),
        'USER':     config('ORACLE_USER',     default='healthtech_dev'),
        'PASSWORD': config('ORACLE_PASSWORD'),
        'HOST':     '',   # Vacío: Django pasa NAME como DSN directo
        'PORT':     '',
        'OPTIONS':  {},   # oracledb 3.x thin — sin parámetros extra
        'CONN_MAX_AGE': 60,
        'TEST': {
            'NAME': 'healthtech_test',
        },
    }
}

# ============================================================
# CORS — Permitir frontend local
# ============================================================
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',   # Vite dev server
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# Debug toolbar
# ============================================================
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE.insert(1, 'debug_toolbar.middleware.DebugToolbarMiddleware')
INTERNAL_IPS = ['127.0.0.1']

# ============================================================
# Email — consola en DEV
# ============================================================
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ============================================================
# Almacenamiento — local en DEV (no S3)
# ============================================================
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# ============================================================
# Logging DEV — más verboso
# ============================================================
LOGGING['loggers']['django']['level'] = 'DEBUG'
LOGGING['handlers']['console']['formatter'] = 'verbose'

# ============================================================
# JWT más permisivo en DEV
# ============================================================
from datetime import timedelta
SIMPLE_JWT = {
    **SIMPLE_JWT,
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}
