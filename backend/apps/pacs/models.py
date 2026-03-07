"""
HealthTech Solutions — Models: PACS Module (Imagen Médica)
Tabla: IMG_ESTUDIOS

PHI: contiene información clínica vinculada a pacientes.
VPD: HOSPITAL_ID para multitenancy.
S3:  Imágenes DICOM almacenadas en AWS S3; solo metadatos en Oracle.
Soft-delete: columna ACTIVO.
"""

from django.db import models


MODALIDAD_CHOICES = [
    ('XRAY',           'Rayos X'),
    ('CT',             'Tomografía Computarizada (CT/TAC)'),
    ('MRI',            'Resonancia Magnética (MRI/RMN)'),
    ('ULTRASONIDO',    'Ultrasonido / Ecografía'),
    ('MAMMOGRAFIA',    'Mamografía'),
    ('PET',            'PET Scan'),
    ('ANGIOGRAFIA',    'Angiografía'),
    ('FLUOROSCOPIA',   'Fluoroscopía'),
    ('DENSITOMETRIA',  'Densitometría Ósea'),
    ('OTRO',           'Otro'),
]

REGION_CHOICES = [
    ('CRANEO',        'Cráneo / Cerebro'),
    ('TORAX',         'Tórax'),
    ('ABDOMEN',       'Abdomen'),
    ('COLUMNA',       'Columna Vertebral'),
    ('EXTREMIDADES',  'Extremidades'),
    ('PELVIS',        'Pelvis'),
    ('CORAZON',       'Corazón / Cardiovascular'),
    ('CUELLO',        'Cuello'),
    ('MAMA',          'Mama'),
    ('CUERPO_ENTERO', 'Cuerpo Entero'),
    ('OTRO',          'Otro'),
]

ESTADO_CHOICES = [
    ('SOLICITADO', 'Solicitado'),
    ('EN_PROCESO', 'En Proceso'),
    ('COMPLETADO', 'Completado'),
    ('CANCELADO',  'Cancelado'),
]

PRIORIDAD_CHOICES = [
    ('NORMAL',     'Normal'),
    ('URGENTE',    'Urgente'),
    ('EMERGENCIA', 'Emergencia'),
]


class EstudioImagen(models.Model):
    """
    Estudio de imagen médica (PACS).
    Metadatos del estudio en Oracle; imágenes DICOM en AWS S3.
    """
    est_id              = models.AutoField(db_column='EST_ID', primary_key=True)
    hospital_id         = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones principales
    paciente            = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='estudios_imagen',
    )
    medico_sol          = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_SOL_ID', on_delete=models.PROTECT,
        related_name='estudios_solicitados',
    )
    tecnico             = models.ForeignKey(
        'security.Usuario',
        db_column='TECNICO_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estudios_realizados',
    )
    radiologo           = models.ForeignKey(
        'security.Usuario',
        db_column='RADIOLOGO_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estudios_informados',
    )

    # Origen opcional
    encamamiento        = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estudios_imagen',
    )
    emergencia          = models.ForeignKey(
        'emergency.Emergencia',
        db_column='EMG_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estudios_imagen',
    )
    cita                = models.ForeignKey(
        'appointments.Cita',
        db_column='CIT_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estudios_imagen',
    )

    # Clasificación
    modalidad           = models.CharField(
        db_column='MODALIDAD', max_length=30, choices=MODALIDAD_CHOICES,
    )
    region_anatomica    = models.CharField(
        db_column='REGION_ANATOMICA', max_length=30,
        choices=REGION_CHOICES, default='OTRO',
    )
    descripcion_clinica = models.CharField(
        db_column='DESCRIPCION_CLINICA', max_length=500,
    )
    prioridad           = models.CharField(
        db_column='PRIORIDAD', max_length=20,
        choices=PRIORIDAD_CHOICES, default='NORMAL',
    )
    estado              = models.CharField(
        db_column='ESTADO', max_length=20,
        choices=ESTADO_CHOICES, default='SOLICITADO',
    )

    # Fechas
    fecha_solicitud     = models.DateField(db_column='FECHA_SOLICITUD')
    fecha_realizacion   = models.DateField(db_column='FECHA_REALIZACION', null=True, blank=True)
    fecha_informe       = models.DateField(db_column='FECHA_INFORME', null=True, blank=True)

    # AWS S3 — metadatos de almacenamiento
    s3_bucket           = models.CharField(db_column='S3_BUCKET', max_length=100, blank=True, default='')
    s3_prefix           = models.CharField(db_column='S3_PREFIX', max_length=500, blank=True, default='')
    num_imagenes        = models.PositiveSmallIntegerField(db_column='NUM_IMAGENES', default=0)

    # Informe radiológico
    informe             = models.TextField(db_column='INFORME', blank=True, default='')
    motivo_cancelacion  = models.CharField(
        db_column='MOTIVO_CANCELACION', max_length=500, blank=True, default='',
    )

    # Auditoría HIPAA
    activo              = models.BooleanField(db_column='ACTIVO', default=True)
    created_by          = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='estudios_creados',
    )
    created_at          = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by          = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='estudios_actualizados',
    )
    updated_at          = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'IMG_ESTUDIOS'
        verbose_name        = 'Estudio de Imagen'
        verbose_name_plural = 'Estudios de Imagen'
        ordering            = ['-fecha_solicitud', '-created_at']
        indexes             = []   # definidos en DDL Oracle

    def __str__(self):
        return f'[EST-{self.est_id}] {self.modalidad} — Pac-{self.paciente_id}'

    @property
    def tiene_imagenes(self) -> bool:
        return self.num_imagenes > 0

    @property
    def tiene_informe(self) -> bool:
        return bool(self.informe and self.informe.strip())
