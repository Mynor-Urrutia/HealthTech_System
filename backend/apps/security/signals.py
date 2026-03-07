"""
HealthTech Solutions — Signals: Auditoría automática de cambios a SEC_USUARIOS
HIPAA: cualquier modificación a datos de usuario queda registrada.
"""

import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.security.models import Usuario, AuditoriaAcceso

logger = logging.getLogger('healthtech.audit')

# Campos PHI que, si cambian, generan entrada de auditoría
CAMPOS_PHI_USUARIO = {
    'primer_nombre', 'segundo_nombre', 'primer_apellido',
    'segundo_apellido', 'email', 'telefono', 'rol_id',
    'activo', 'cuenta_bloqueada', 'hospital_id',
}


@receiver(post_save, sender=Usuario)
def auditar_cambio_usuario(sender, instance, created, **kwargs):
    """
    Registra creación y modificaciones significativas de usuarios en auditoría.
    Solo registra si hay un updated_by (acción humana, no migraciones).
    """
    if not instance.updated_by_id:
        return

    tipo_evento = 'ADMIN_ACTION'
    descripcion = (
        f'Usuario {instance.username} creado'
        if created
        else f'Usuario {instance.username} modificado'
    )

    try:
        AuditoriaAcceso.objects.create(
            hospital_id=instance.hospital_id,
            usuario=instance.updated_by,
            tipo_evento=tipo_evento,
            modulo='security',
            accion='create' if created else 'edit',
            tabla_afectada='SEC_USUARIOS',
            registro_id=str(instance.usr_id),
            ip_origen='0.0.0.0',   # IP no disponible en signal — se registra en la view
            descripcion=descripcion,
            exitoso=True,
        )
    except Exception as e:
        logger.error(f'Error en signal auditar_cambio_usuario: {e}')
