"""
HealthTech Solutions — WSGI config
"""

import os
from django.core.wsgi import get_wsgi_application
from decouple import config

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{config('DJANGO_ENV', default='dev')}"
)

application = get_wsgi_application()
