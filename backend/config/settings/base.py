"""
HealthTech Solutions — Settings Base
Compartido por todos los entornos (dev, staging, prod)
Compatibilidad: Oracle 19c RAC / Oracle 21c XE
"""

from pathlib import Path
from decouple import config
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('DJANGO_SECRET_KEY')

DEBUG = False

ALLOWED_HOSTS = []

# ============================================================
# Aplicaciones instaladas
# ============================================================
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'storages',
]

LOCAL_APPS = [
    'apps.core',
    'apps.security',
    'apps.patients',
    'apps.appointments',
    'apps.emergency',
    'apps.hospitalization',
    'apps.surgery',
    'apps.laboratory',
    'apps.pharmacy',
    'apps.warehouse',
    'apps.nursing',
    'apps.pacs',        # PACS — Imagen médica (metadatos Oracle + DICOM en S3)
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ============================================================
# Middleware — Orden importa para VPD y seguridad
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
    # Middleware propio: establece contexto de hospital para VPD
    'config.oracle.vpd.OracleVPDMiddleware',
    # Middleware de auditoría HIPAA
    'apps.core.middleware.HIPAAAuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# ============================================================
# Django REST Framework
# ============================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    # Throttling para proteger endpoints sensibles (HIPAA)
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '200/minute',
    },
}

# ============================================================
# JWT Configuration
# ============================================================
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=8),    # Turno laboral
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    # PK personalizado: Usuario usa usr_id en lugar de id (estándar Django)
    # simplejwt necesita saber el nombre del campo PK para crear el token.
    'USER_ID_FIELD': 'usr_id',
    'USER_ID_CLAIM': 'user_id',
    # Claims personalizados — referenciado por LoginView via serializer_class
    # (TOKEN_OBTAIN_SERIALIZER no se usa porque LoginView sobrescribe serializer_class)
    'TOKEN_OBTAIN_SERIALIZER': 'apps.security.tokens.CustomTokenObtainSerializer',
}

# ============================================================
# Internacionalización
# ============================================================
LANGUAGE_CODE = 'es-gt'
TIME_ZONE = 'America/Guatemala'
USE_I18N = True
USE_TZ = True

# ============================================================
# Archivos estáticos y media
# ============================================================
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================================
# Modelo de usuario personalizado
# ============================================================
AUTH_USER_MODEL = 'security.Usuario'

# ============================================================
# Validadores de Contraseña — HIPAA 45 CFR §164.308(a)(5)(ii)(D)
# ============================================================
AUTH_PASSWORD_VALIDATORS = [
    # HIPAA: complejidad obligatoria (10+ chars, upper, lower, digit, especial)
    {
        'NAME': 'apps.core.validators.HIPAAPasswordValidator',
    },
    # Prevención de DoS: máximo 128 caracteres
    {
        'NAME': 'apps.core.validators.MaximumLengthValidator',
    },
    # Django built-in: detecta contraseñas muy similares al username/email
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
        'OPTIONS': {
            'user_attributes': ('username', 'email', 'primer_nombre', 'primer_apellido'),
            'max_similarity': 0.7,
        },
    },
    # Django built-in: lista negra de contraseñas comunes (20.000+)
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
]

# ============================================================
# Seguridad HTTP (se sobreescribe en prod con valores más estrictos)
# ============================================================
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True

# ============================================================
# Logging base — Auditoría HIPAA
# ============================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'hipaa_audit': {
            'format': '[{asctime}] [{levelname}] [HOSPITAL:{hospital_id}] '
                      '[USER:{user_id}] [{module}] {message}',
            'style': '{',
        },
        'verbose': {
            'format': '[{asctime}] [{levelname}] [{module}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'audit_file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'hipaa_audit.log',
            'formatter': 'hipaa_audit',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'healthtech.audit': {
            'handlers': ['audit_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'healthtech.security': {
            'handlers': ['audit_file', 'console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# ============================================================
# AWS S3 — PACS (imágenes médicas)
# ============================================================
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = config('AWS_PACS_BUCKET', default='healthtech-pacs-dev')
AWS_S3_REGION_NAME = config('AWS_REGION', default='us-east-1')
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = 'private'                    # Nunca público — HIPAA
AWS_S3_CUSTOM_DOMAIN = None
AWS_QUERYSTRING_EXPIRE = 900                   # URLs pre-firmadas: 15 min

# ============================================================
# Configuración de Oracle — Variables compartidas
# ============================================================
ORACLE_ENV = config('ORACLE_ENV', default='dev')
VPD_ENABLED = config('VPD_ENABLED', default=False, cast=bool)
TDE_ENABLED = config('TDE_ENABLED', default=False, cast=bool)
