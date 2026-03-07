"""
HealthTech Solutions — Oracle RAC Database Router
Separa el tráfico OLTP (Nodo 1) del tráfico de Reportes (Nodo 2).
Solo activo en PROD. En DEV/Staging usa siempre 'default'.
"""

from django.conf import settings

# Apps cuyos modelos van al servicio de reportes en Nodo 2
REPORTING_APPS = set()  # Se puebla dinámicamente según hints


class OracleRACRouter:
    """
    Enruta queries a la base de datos correcta según el tipo de operación:
      - Escrituras y OLTP: 'default' (Servicio OLTP RAC)
      - Reportes y dashboards: 'reports' (Servicio REPORTS RAC, Nodo 2)
    """

    def db_for_read(self, model, **hints):
        """
        Lecturas pesadas/reportes → Nodo 2 (servicio REPORTS).
        Lecturas transaccionales → Nodo 1 (servicio OLTP, default).
        """
        if settings.ORACLE_ENV != 'prod':
            return 'default'

        # El hint 'using_db' permite forzar desde el código:
        # Model.objects.using('reports').filter(...)
        if hints.get('using_db') == 'reports':
            return 'reports'

        # Hint 'reporting=True' para queries de dashboard
        if hints.get('reporting'):
            return 'reports'

        return 'default'

    def db_for_write(self, model, **hints):
        """Todas las escrituras van al servicio OLTP (Nodo 1)."""
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """Permite relaciones entre objetos del mismo clúster RAC."""
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Las migraciones siempre corren en 'default'."""
        return db == 'default'
