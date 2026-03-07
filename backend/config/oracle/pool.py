"""
HealthTech Solutions — Oracle Connection Pool
Maneja la diferencia entre:
  - DEV:     Oracle 21c XE (conexión simple)
  - STAGING: Oracle 19c single node
  - PROD:    Oracle 19c RAC con SCAN, Failover, Load Balance
"""

import oracledb
import logging
from django.conf import settings

logger = logging.getLogger('healthtech.audit')

_pools: dict = {}


def _set_app_context(connection, requested_tag):
    """
    Callback ejecutado al obtener una conexión del pool.
    Establece el contexto de aplicación Oracle para VPD:
      - HOSPITAL_ID: filtra filas por tenant (hospital)
      - USER_ROL:    permite bypass a SUPER_ADMIN
    Requiere que el hospital_id y user_rol estén en el thread local.
    """
    from config.oracle.vpd import get_current_hospital_id, get_current_user_rol
    hospital_id = get_current_hospital_id()
    user_rol    = get_current_user_rol()

    if settings.VPD_ENABLED and (hospital_id or user_rol):
        with connection.cursor() as cursor:
            if hospital_id:
                cursor.callproc('HEALTHTECH_PKG.SET_HOSPITAL', [hospital_id])
            if user_rol:
                cursor.callproc('HEALTHTECH_PKG.SET_USER_ROL', [user_rol])
        logger.debug(
            f'Contexto VPD establecido: HOSPITAL_ID={hospital_id} | USER_ROL={user_rol}'
        )


def get_pool(service: str = 'default') -> oracledb.ConnectionPool:
    """
    Retorna el pool de conexiones Oracle según el entorno.
    service: 'default' (OLTP) | 'reports' (solo PROD RAC Nodo 2)
    """
    global _pools

    if service in _pools:
        return _pools[service]

    oracle_env = settings.ORACLE_ENV
    db_config = settings.DATABASES.get(service, settings.DATABASES['default'])

    if oracle_env == 'dev':
        # Oracle 21c XE — pool pequeño, sin session_callback
        pool = oracledb.create_pool(
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            dsn=f"{db_config['HOST']}:{db_config['PORT']}/{db_config['NAME']}",
            min=2,
            max=5,
            increment=1,
        )
        logger.info('Pool Oracle DEV (21c XE) inicializado')

    elif oracle_env == 'staging':
        # Oracle 19c single node — pool mediano, VPD activado
        pool = oracledb.create_pool(
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            dsn=f"{db_config['HOST']}:{db_config['PORT']}/{db_config['NAME']}",
            min=3,
            max=10,
            increment=2,
            session_callback=_set_app_context if settings.VPD_ENABLED else None,
        )
        logger.info('Pool Oracle STAGING (19c single) inicializado')

    else:
        # Oracle 19c RAC — pool grande, usa tnsnames.ora con SCAN
        # El DSN vacío en HOST/PORT hace que Oracle use tnsnames.ora
        pool = oracledb.create_pool(
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            dsn=db_config['NAME'],             # TNS alias del tnsnames.ora
            min=5,
            max=20,
            increment=2,
            getmode=oracledb.POOL_GETMODE_WAIT,
            session_callback=_set_app_context,
        )
        logger.info(f'Pool Oracle PROD RAC (19c) inicializado — servicio: {service}')

    _pools[service] = pool
    return pool


def close_all_pools():
    """Cierra todos los pools al apagar el servidor."""
    global _pools
    for name, pool in _pools.items():
        try:
            pool.close(force=False)
            logger.info(f'Pool Oracle cerrado: {name}')
        except Exception as e:
            logger.error(f'Error cerrando pool {name}: {e}')
    _pools.clear()
