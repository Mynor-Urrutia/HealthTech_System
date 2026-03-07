"""
HealthTech Solutions — Views base + Health Check endpoint
"""

import logging
from django.db import connection
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

logger = logging.getLogger('healthtech.audit')


class HealthCheckView(APIView):
    """
    GET /api/v1/health/
    Verifica el estado del sistema: API, BD Oracle, configuración.
    Sin autenticación — usado por load balancer y monitoreo.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        health = {
            'status': 'ok',
            'service': 'HealthTech Solutions API',
            'version': '1.0.0',
            'oracle_env': settings.ORACLE_ENV,
            'vpd_enabled': settings.VPD_ENABLED,
            'tde_enabled': settings.TDE_ENABLED,
            'database': self._check_database(),
        }

        overall_status = (
            status.HTTP_200_OK
            if health['database']['status'] == 'ok'
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )

        return Response(health, status=overall_status)

    def _check_database(self) -> dict:
        """
        Verifica conectividad con Oracle usando DUAL (sin privilegios DBA).
        V$INSTANCE requiere SELECT_CATALOG_ROLE que healthtech_dev no tiene en DEV.
        """
        try:
            with connection.cursor() as cursor:
                # Ping básico con DUAL — accesible para cualquier usuario Oracle
                cursor.execute("SELECT 'pong' FROM DUAL")
                cursor.fetchone()
                # Versión del servidor (accesible via V$VERSION sin DBA)
                try:
                    cursor.execute(
                        "SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1"
                    )
                    row = cursor.fetchone()
                    version = row[0] if row else 'Oracle'
                except Exception:
                    version = 'Oracle (versión no disponible)'
                return {
                    'status': 'ok',
                    'version': version,
                }
        except Exception as e:
            logger.error(f'Health check DB error: {e}')
            return {
                'status': 'error',
                'message': str(e),
            }
