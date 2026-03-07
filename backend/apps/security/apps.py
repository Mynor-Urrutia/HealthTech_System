from django.apps import AppConfig


class SecurityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.security'
    verbose_name = 'M01 — Seguridad y Usuarios'

    def ready(self):
        import apps.security.signals  # noqa: F401
