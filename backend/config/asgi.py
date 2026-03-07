"""
HealthTech Solutions — ASGI config
"""

import os
from django.core.asgi import get_asgi_application
from decouple import config

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{config('DJANGO_ENV', default='dev')}"
)

application = get_asgi_application()
