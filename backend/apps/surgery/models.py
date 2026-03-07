"""
HealthTech Solutions — Models: Módulo Cirugía (M06)
Tabla: CIR_CIRUGIAS

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Máquina de estados:
  PROGRAMADA → EN_CURSO → COMPLETADA
                        ↘ SUSPENDIDA
             ↘ CANCELADA   (desde PROGRAMADA)
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
PRIORIDAD_CHOICES = [
    ('EMERGENCIA', 'Emergencia'),
    ('URGENTE',    'Urgente'),
    ('ELECTIVA',   'Electiva'),
]

TIPO_ANESTESIA_CHOICES = [
    ('GENERAL',  'General'),
    ('REGIONAL', 'Regional'),
    ('LOCAL',    'Local'),
    ('SEDACION', 'Sedación'),
    ('NINGUNA',  'Ninguna'),
]

ESTADO_CHOICES = [
    ('PROGRAMADA',  'Programada'),
    ('EN_CURSO',    'En Curso'),
    ('COMPLETADA',  'Completada'),
    ('SUSPENDIDA',  'Suspendida'),
    ('CANCELADA',   'Cancelada'),
]

# Transiciones válidas de la máquina de estados
ESTADOS_INICIABLES   = ('PROGRAMADA',)
ESTADOS_COMPLETABLES = ('EN_CURSO',)
ESTADOS_SUSPENDIBLES = ('EN_CURSO',)
ESTADOS_CANCELABLES  = ('PROGRAMADA',)
ESTADOS_ACTIVOS      = ('PROGRAMADA', 'EN_CURSO')


# ============================================================
# CIRUGIA — Intervención quirúrgica programada / emergente
# ============================================================
class Cirugia(models.Model):
    """
    Registro de intervención quirúrgica.
    hospital_id es la columna de particionamiento VPD.
    """
    cir_id      = models.AutoField(db_column='CIR_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Paciente y equipo quirúrgico
    paciente = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='cirugias',
    )
    cirujano = models.ForeignKey(
        'security.Usuario',
        db_column='CIRUJANO_ID', on_delete=models.PROTECT,
        related_name='cirugias_como_cirujano',
    )
    anestesiologo = models.ForeignKey(
        'security.Usuario',
        db_column='ANESTESIOLOGO_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='cirugias_como_anestesiologo',
    )
    enfermero_inst = models.ForeignKey(
        'security.Usuario',
        db_column='ENFERMERO_INST_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='cirugias_como_enfermero_inst',
    )
    enfermero_circ = models.ForeignKey(
        'security.Usuario',
        db_column='ENFERMERO_CIRC_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='cirugias_como_enfermero_circ',
    )

    # Origen opcional (desde emergencia o encamamiento)
    emergencia = models.ForeignKey(
        'emergency.Emergencia',
        db_column='EMG_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='cirugias',
    )
    encamamiento = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='cirugias',
    )

    # Programación
    fecha_programada  = models.DateField(db_column='FECHA_PROGRAMADA')
    hora_ini_prog     = models.TimeField(db_column='HORA_INI_PROG')
    hora_fin_prog     = models.TimeField(db_column='HORA_FIN_PROG', null=True, blank=True)
    duracion_est_min  = models.SmallIntegerField(db_column='DURACION_EST_MIN', null=True, blank=True)

    # Quirófano y clasificación
    quirofano       = models.CharField(db_column='QUIROFANO',     max_length=30)
    tipo_cirugia    = models.CharField(db_column='TIPO_CIRUGIA',  max_length=200)
    especialidad    = models.CharField(db_column='ESPECIALIDAD',  max_length=100, blank=True, default='')
    prioridad       = models.CharField(
        db_column='PRIORIDAD', max_length=20,
        choices=PRIORIDAD_CHOICES, default='ELECTIVA',
    )
    tipo_anestesia  = models.CharField(
        db_column='TIPO_ANESTESIA', max_length=30,
        choices=TIPO_ANESTESIA_CHOICES, default='GENERAL',
    )

    # Pre-operatorio
    cie10_pre         = models.CharField(db_column='CIE10_PRE',        max_length=10,  blank=True, default='')
    diagnostico_preop = models.CharField(db_column='DIAGNOSTICO_PREOP', max_length=500, blank=True, default='')
    notas_preop       = models.TextField(db_column='NOTAS_PREOP',      blank=True, default='')

    # Estado (máquina de estados)
    estado = models.CharField(
        db_column='ESTADO', max_length=30,
        choices=ESTADO_CHOICES, default='PROGRAMADA',
    )

    # Datos reales intraoperatorios / post-operatorios
    fecha_inicio_real  = models.DateField(db_column='FECHA_INICIO_REAL',  null=True, blank=True)
    hora_inicio_real   = models.TimeField(db_column='HORA_INICIO_REAL',   null=True, blank=True)
    fecha_fin_real     = models.DateField(db_column='FECHA_FIN_REAL',     null=True, blank=True)
    hora_fin_real      = models.TimeField(db_column='HORA_FIN_REAL',      null=True, blank=True)
    duracion_real_min  = models.SmallIntegerField(db_column='DURACION_REAL_MIN', null=True, blank=True)

    hallazgos          = models.TextField(db_column='HALLAZGOS',         blank=True, default='')
    complicaciones     = models.CharField(db_column='COMPLICACIONES',    max_length=500, blank=True, default='')
    notas_postop       = models.TextField(db_column='NOTAS_POSTOP',      blank=True, default='')
    diagnostico_postop = models.CharField(db_column='DIAGNOSTICO_POSTOP', max_length=500, blank=True, default='')
    cie10_post         = models.CharField(db_column='CIE10_POST',        max_length=10,  blank=True, default='')

    # Motivo de cancelación / suspensión
    motivo_cancelacion = models.CharField(db_column='MOTIVO_CANCELACION', max_length=500, blank=True, default='')

    # Auditoría HIPAA
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='cirugias_creadas',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='cirugias_actualizadas',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'CIR_CIRUGIAS'
        verbose_name        = 'Cirugía'
        verbose_name_plural = 'Cirugías'
        ordering            = ['fecha_programada', 'hora_ini_prog']
        indexes             = []   # Definidos en DDL Oracle: IDX_CIR_*

    def __str__(self):
        return (
            f'[CIR-{self.cir_id}] {self.tipo_cirugia} — '
            f'{self.fecha_programada} {self.hora_ini_prog} '
            f'Qx:{self.quirofano} ({self.prioridad})'
        )
