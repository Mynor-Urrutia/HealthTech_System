#!/usr/bin/env python
"""HealthTech Solutions — Django management utility."""

import os
import sys
from decouple import config


def main():
    os.environ.setdefault(
        'DJANGO_SETTINGS_MODULE',
        f"config.settings.{config('DJANGO_ENV', default='dev')}"
    )
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "No se pudo importar Django. "
            "Verifica que esté instalado y que el entorno virtual esté activo."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
