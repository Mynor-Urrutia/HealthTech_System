"""
HealthTech Solutions — Utilidades: Módulo Pacientes (M02)

generar_no_expediente:
  Genera el número de expediente en formato YYYYMMDDXXX.
    - YYYYMMDD : fecha del sistema en el momento de registro.
    - XXX      : correlativo de 3 dígitos (001–999), reinicia cada día por hospital.

  Garantías:
    - Unicidad: usa SELECT FOR UPDATE para bloquear filas concurrentes.
    - Transaccional: debe llamarse dentro de un bloque atomic() o dentro
      de la transacción implícita de Paciente.objects.create().
    - Límite diario: 999 expedientes por hospital por día.
      Si se alcanza, eleva ValueError (nunca debe ocurrir en producción con
      volúmenes normales).

  Ejemplo:
    >>> generar_no_expediente(hospital_id=1)
    '20260304001'   # Primera vez en el día
    >>> generar_no_expediente(hospital_id=1)
    '20260304002'   # Segunda llamada ese mismo día
"""

from datetime import date
from django.db import transaction


def generar_no_expediente(hospital_id: int) -> str:
    """
    Genera y reserva el siguiente número de expediente para un hospital
    en el formato YYYYMMDDXXX, con correlativo atómico a nivel de BD.

    Args:
        hospital_id: ID del hospital para el que se genera el expediente.

    Returns:
        str: Número de expediente (ej. '20260304001').

    Raises:
        ValueError: Si se superan los 999 expedientes diarios para el hospital.
    """
    from apps.patients.models import Paciente   # Import local → evita circular

    hoy    = date.today()
    prefijo = hoy.strftime('%Y%m%d')   # Ej.: '20260304'

    with transaction.atomic():
        # Oracle: select_for_update() no soporta LIMIT/OFFSET.
        # Recuperamos TODOS los expedientes del día para el hospital
        # (sin .first()) y calculamos el máximo en Python.
        # El bloqueo SELECT FOR UPDATE evita inserciones concurrentes
        # con el mismo correlativo.
        expedientes = list(
            Paciente.objects
            .filter(
                hospital_id=hospital_id,
                no_expediente__startswith=prefijo,
            )
            .select_for_update()           # Bloqueo a nivel Oracle
            .values_list('no_expediente', flat=True)
        )

        if expedientes:
            # Extrae correlativos numéricos válidos y toma el máximo
            correlativos = []
            for exp in expedientes:
                try:
                    correlativos.append(int(exp[-3:]))
                except (ValueError, IndexError):
                    pass
            correlativo = (max(correlativos) + 1) if correlativos else 1
        else:
            correlativo = 1

        if correlativo > 999:
            raise ValueError(
                f'Se alcanzó el límite diario de 999 expedientes '
                f'para hospital_id={hospital_id} en fecha {prefijo}.'
            )

        return f'{prefijo}{correlativo:03d}'
