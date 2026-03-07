"""
HealthTech Solutions — Middleware de Auditoría HIPAA
Registra accesos a endpoints clínicos sensibles.
"""

import logging
import time

logger = logging.getLogger('healthtech.audit')

# Prefijos de URL que contienen PHI — se auditan siempre
PHI_ENDPOINTS = (
    '/api/v1/patients/',
    '/api/v1/appointments/',
    '/api/v1/emergency/',
    '/api/v1/hospitalization/',
    '/api/v1/surgery/',
    '/api/v1/laboratory/',
    '/api/v1/pharmacy/',
    '/api/v1/nursing/',
    '/api/v1/warehouse/',   # M09: inventario hospitalario (multi-tenant)
    '/api/v1/imaging/',     # PACS: estudios de imagen médica (PHI)
)


class HIPAAAuditMiddleware:
    """
    Registra en el log de auditoría HIPAA:
      - Quién accedió (user_id)
      - Desde qué hospital (hospital_id)
      - Qué endpoint (método + URL)
      - Cuándo (timestamp)
      - Resultado (status code)
      - Tiempo de respuesta
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.monotonic()
        response = self.get_response(request)
        duration = time.monotonic() - start_time

        if self._is_phi_endpoint(request.path):
            self._log_access(request, response, duration)

        return response

    def _is_phi_endpoint(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in PHI_ENDPOINTS)

    def _log_access(self, request, response, duration: float):
        user = getattr(request, 'user', None)
        user_id = user.pk if user and user.is_authenticated else 'anonymous'
        hospital_id = getattr(user, 'hospital_id', 'N/A') if user else 'N/A'

        logger.info(
            f'PHI_ACCESS | user={user_id} | hospital={hospital_id} | '
            f'method={request.method} | path={request.path} | '
            f'status={response.status_code} | duration={duration:.3f}s | '
            f'ip={self._get_client_ip(request)}'
        )

    def _get_client_ip(self, request) -> str:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
