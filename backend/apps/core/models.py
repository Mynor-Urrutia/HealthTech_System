"""
HealthTech Solutions — Core Models
AuditModel: clase base para TODOS los modelos del sistema.
Cumplimiento HIPAA: trazabilidad completa de creación y modificación.
Compatible con Oracle 19c y Oracle 21c XE.
"""

from django.db import models
from django.conf import settings


class AuditModel(models.Model):
    """
    Modelo base abstracto con campos de auditoría HIPAA.
    Todo modelo del sistema debe heredar de esta clase.

    Campos de auditoría:
      - created_by:  usuario que creó el registro
      - created_at:  fecha/hora de creación (UTC)
      - updated_by:  último usuario que modificó el registro
      - updated_at:  fecha/hora de última modificación (UTC)
      - is_active:   borrado lógico (nunca borrar registros clínicos)
      - hospital_id: tenant — usado por VPD para filtrado automático
    """

    hospital_id = models.IntegerField(
        db_column='HOSPITAL_ID',
        verbose_name='Hospital',
        help_text='ID del hospital — columna usada por VPD para multitenancy',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='%(app_label)s_%(class)s_created',
        db_column='CREATED_BY',
        verbose_name='Creado por',
        null=True,
        editable=False,
    )
    created_at = models.DateTimeField(
        db_column='CREATED_AT',
        auto_now_add=True,
        verbose_name='Fecha de creación',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='%(app_label)s_%(class)s_updated',
        db_column='UPDATED_BY',
        verbose_name='Actualizado por',
        null=True,
        editable=False,
    )
    updated_at = models.DateTimeField(
        db_column='UPDATED_AT',
        auto_now=True,
        verbose_name='Fecha de actualización',
    )
    is_active = models.BooleanField(
        db_column='IS_ACTIVE',
        default=True,
        verbose_name='Activo',
        help_text='Borrado lógico — nunca eliminar registros clínicos físicamente',
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Inyecta created_by/updated_by desde el request si está disponible."""
        user = kwargs.pop('user', None)
        if user:
            if not self.pk:
                self.created_by = user
            self.updated_by = user
        super().save(*args, **kwargs)

    def soft_delete(self, user=None):
        """Borrado lógico — nunca usar .delete() en registros clínicos."""
        self.is_active = False
        self.save(user=user)


class CatalogModel(AuditModel):
    """
    Extensión de AuditModel para tablas de catálogo (lookups).
    Agrega: nombre, descripción y orden de visualización.
    """

    nombre = models.CharField(
        db_column='NOMBRE',
        max_length=100,
        verbose_name='Nombre',
    )
    descripcion = models.CharField(
        db_column='DESCRIPCION',
        max_length=500,
        blank=True,
        default='',
        verbose_name='Descripción',
    )
    orden = models.SmallIntegerField(
        db_column='ORDEN',
        default=0,
        verbose_name='Orden de visualización',
    )

    class Meta:
        abstract = True
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre
