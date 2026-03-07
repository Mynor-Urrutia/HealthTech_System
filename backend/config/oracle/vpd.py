"""
HealthTech Solutions — VPD Middleware
Establece el contexto de hospital en Oracle para Virtual Private Database.
En DEV (Oracle 21c XE): solo guarda el hospital_id en thread local, no llama a Oracle.
En PROD (Oracle 19c RAC): llama a HEALTHTECH_PKG.SET_HOSPITAL y SET_USER_ROL por cada request.

Contexto Oracle establecido:
  HEALTHTECH_CTX.HOSPITAL_ID — filtra filas por hospital (tenant)
  HEALTHTECH_CTX.USER_ROL    — permite bypass a SUPER_ADMIN (acceso cross-hospital)
"""

import threading
import logging
from django.conf import settings
from django.db import connection

logger = logging.getLogger('healthtech.audit')

# Thread local para pasar el hospital_id y rol al pool callback
_thread_local = threading.local()


def get_current_hospital_id() -> int | None:
    """Retorna el hospital_id del request actual desde el thread local."""
    return getattr(_thread_local, 'hospital_id', None)


def get_current_user_rol() -> str | None:
    """Retorna el rol del usuario del request actual desde el thread local."""
    return getattr(_thread_local, 'user_rol', None)


def set_current_hospital_id(hospital_id: int | None):
    """Establece el hospital_id en el thread local."""
    _thread_local.hospital_id = hospital_id


def set_current_user_rol(user_rol: str | None):
    """Establece el rol del usuario en el thread local."""
    _thread_local.user_rol = user_rol


class OracleVPDMiddleware:
    """
    Middleware que lee el hospital_id y el rol del JWT y los registra en Oracle
    mediante un Application Context para que VPD filtre automáticamente.

    Flujo:
      1. Request llega con JWT → middleware extrae hospital_id y rol
      2. Se guardan en thread local (_thread_local)
      3. Al abrir conexión Oracle, pool callback llama a SET_HOSPITAL + SET_USER_ROL
      4. VPD_HOSPITAL_POLICY aplica el predicado correcto por rol:
         - SUPER_ADMIN: sin predicado (acceso a todos los hospitales)
         - Otros roles: HOSPITAL_ID = <id_del_hospital>
      5. Al finalizar el request, se limpia el thread local
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        hospital_id = self._extract_hospital_id(user)
        user_rol = self._extract_user_rol(user)

        set_current_hospital_id(hospital_id)
        set_current_user_rol(user_rol)

        if settings.VPD_ENABLED and (hospital_id or user_rol):
            try:
                self._set_oracle_context(hospital_id, user_rol)
            except Exception as e:
                logger.error(f'Error estableciendo contexto VPD: {e}')

        response = self.get_response(request)

        # Limpiar thread local al finalizar request
        set_current_hospital_id(None)
        set_current_user_rol(None)
        return response

    def _extract_hospital_id(self, user) -> int | None:
        """
        Extrae el hospital_id del usuario autenticado.
        El JWT custom incluye hospital_id en el payload.
        """
        if user and user.is_authenticated:
            return getattr(user, 'hospital_id', None)
        return None

    def _extract_user_rol(self, user) -> str | None:
        """
        Extrae el código de rol del usuario autenticado.
        Permite que VPD_HOSPITAL_POLICY conceda acceso total a SUPER_ADMIN.
        El modelo Usuario expone rol_codigo como @property (security/models.py).
        """
        if user and user.is_authenticated:
            # rol_codigo es @property en Usuario → str como 'SUPER_ADMIN'
            return getattr(user, 'rol_codigo', None)
        return None

    def _set_oracle_context(self, hospital_id: int | None, user_rol: str | None):
        """
        Llama al paquete PL/SQL para establecer HOSPITAL_ID y USER_ROL en Oracle.
        Solo se ejecuta si VPD_ENABLED=True (staging y prod).
        """
        with connection.cursor() as cursor:
            if hospital_id:
                cursor.callproc('HEALTHTECH_PKG.SET_HOSPITAL', [hospital_id])
            if user_rol:
                cursor.callproc('HEALTHTECH_PKG.SET_USER_ROL', [user_rol])
        logger.debug(
            f'VPD context set: HOSPITAL_ID={hospital_id} | USER_ROL={user_rol}'
        )
