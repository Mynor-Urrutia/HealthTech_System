"""
HealthTech Solutions — Models: Módulo Citas (M03)
Tabla: CIT_CITAS

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Convenciones Oracle 19c:
  - db_table en UPPER_CASE con prefijo CIT_
  - db_column en UPPER_CASE
  - indexes = [] porque se definen en el DDL de Oracle
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
TIPO_CITA_CHOICES = [
    ('CONSULTA',      'Consulta General'),
    ('SEGUIMIENTO',   'Seguimiento'),
    ('URGENCIA',      'Urgencia'),
    ('PROCEDIMIENTO', 'Procedimiento'),
    ('CHEQUEO',       'Chequeo General'),
]

ESTADO_CHOICES = [
    ('PROGRAMADA',  'Programada'),
    ('CONFIRMADA',  'Confirmada'),
    ('EN_PROGRESO', 'En Progreso'),
    ('COMPLETADA',  'Completada'),
    ('CANCELADA',   'Cancelada'),
    ('NO_ASISTIO',  'No Asistió'),
]

PRIORIDAD_CHOICES = [
    ('NORMAL',     'Normal'),
    ('PREFERENTE', 'Preferente'),
    ('URGENTE',    'Urgente'),
]

# Estados desde los que se puede cancelar
ESTADOS_CANCELABLES = ('PROGRAMADA', 'CONFIRMADA', 'EN_PROGRESO')
# Estados desde los que se puede confirmar
ESTADOS_CONFIRMABLES = ('PROGRAMADA',)
# Estados desde los que se puede completar
ESTADOS_COMPLETABLES = ('CONFIRMADA', 'EN_PROGRESO')


# ============================================================
# CITA — Registro de cita médica (PHI)
# ============================================================
class Cita(models.Model):
    """
    Tabla maestra de citas médicas.
    hospital_id es la columna de particionamiento VPD.
    Unicidad: (hospital_id, medico_id, fecha_cita, hora_inicio) —
              un médico no puede tener dos citas en el mismo horario.
    """
    cit_id             = models.AutoField(db_column='CIT_ID', primary_key=True)
    hospital_id        = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones
    paciente           = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID',
        on_delete=models.PROTECT,
        related_name='citas',
    )
    medico             = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_ID',
        on_delete=models.PROTECT,
        related_name='citas_asignadas',
    )

    # Horario
    fecha_cita         = models.DateField(db_column='FECHA_CITA')
    hora_inicio        = models.TimeField(db_column='HORA_INICIO')
    hora_fin           = models.TimeField(db_column='HORA_FIN')
    duracion_min       = models.SmallIntegerField(db_column='DURACION_MIN', default=30)

    # Tipo y clasificación
    tipo_cita          = models.CharField(db_column='TIPO_CITA',  max_length=30, choices=TIPO_CITA_CHOICES)
    motivo             = models.CharField(db_column='MOTIVO',     max_length=500)
    estado             = models.CharField(db_column='ESTADO',     max_length=30, choices=ESTADO_CHOICES,   default='PROGRAMADA')
    prioridad          = models.CharField(db_column='PRIORIDAD',  max_length=20, choices=PRIORIDAD_CHOICES, default='NORMAL')
    sala               = models.CharField(db_column='SALA',       max_length=50, blank=True, default='')

    # Notas clínicas (PHI)
    notas_medico       = models.TextField(db_column='NOTAS_MEDICO', blank=True, default='')
    notas_admin        = models.CharField(db_column='NOTAS_ADMIN',  max_length=500, blank=True, default='')

    # Cancelación
    motivo_cancelacion = models.CharField(db_column='MOTIVO_CANCELACION', max_length=500, blank=True, default='')
    cancelada_por      = models.ForeignKey(
        'security.Usuario',
        db_column='CANCELADA_POR',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='citas_canceladas',
    )
    cancelada_en       = models.DateTimeField(db_column='CANCELADA_EN', null=True, blank=True)

    # Estado y auditoría
    activo             = models.BooleanField(db_column='ACTIVO', default=True)
    created_by         = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='citas_creadas',
    )
    created_at         = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by         = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='citas_actualizadas',
    )
    updated_at         = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table      = 'CIT_CITAS'
        verbose_name  = 'Cita'
        verbose_name_plural = 'Citas'
        ordering      = ['fecha_cita', 'hora_inicio']
        unique_together = [['hospital_id', 'medico', 'fecha_cita', 'hora_inicio']]
        indexes       = []   # Definidos en DDL Oracle: IDX_CIT_*

    def __str__(self):
        return f'[{self.fecha_cita} {self.hora_inicio}] {self.paciente} — Dr. {self.medico}'

    def get_duracion_display(self) -> str:
        h, m = divmod(self.duracion_min, 60)
        if h and m:
            return f'{h}h {m}min'
        if h:
            return f'{h}h'
        return f'{m}min'
