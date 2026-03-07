"""
HealthTech Solutions — Settings de Test
Sobreescribe base.py para usar SQLite en CI/CD.
Sin Oracle, sin VPD, sin AWS real.
"""
from config.settings.base import *   # noqa: F401, F403

# ============================================================
# Base de datos — SQLite en memoria para velocidad
# ============================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# ============================================================
# Sin requerimientos Oracle para tests
# ============================================================
VPD_ENABLED = False
TDE_ENABLED = False

# ============================================================
# Middleware — Eliminar middleware Oracle-específico
# ============================================================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # HIPAA audit middleware (funciona con cualquier BD)
    'apps.core.middleware.HIPAAAuditMiddleware',
    # OracleVPDMiddleware omitido — no disponible con SQLite
]

# ============================================================
# Hasher rápido — no bcrypt costoso en tests
# ============================================================
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# ============================================================
# Cache en memoria
# ============================================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# ============================================================
# Deshabilitar logging en tests para output limpio
# ============================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {'class': 'logging.NullHandler'},
    },
    'root': {
        'handlers': ['null'],
    },
}

# ============================================================
# Archivos media en temp para tests
# ============================================================
import tempfile
MEDIA_ROOT = tempfile.mkdtemp()

# ============================================================
# Email backend silencioso
# ============================================================
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# ============================================================
# SECRET_KEY fija para tests (no leer .env)
# ============================================================
SECRET_KEY = 'test-secret-key-hipaa-healthtech-2026-not-for-production'

# ============================================================
# AWS — Evitar llamadas reales a S3 en tests
# ============================================================
AWS_ACCESS_KEY_ID = 'test-access-key'
AWS_SECRET_ACCESS_KEY = 'test-secret-key'
AWS_STORAGE_BUCKET_NAME = 'healthtech-test-bucket'
