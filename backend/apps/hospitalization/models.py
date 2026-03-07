"""
HealthTech Solutions — Models: Módulo Encamamiento (M05)
Tablas: ENC_CAMAS, ENC_ENCAMAMIENTOS

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Máquina de estados (Encamamiento):
  INGRESADO → EN_TRATAMIENTO → EGRESADO
                             ↘ TRASLADADO
                             ↘ FALLECIDO
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
TIPO_CAMA_CHOICES = [
    ('GENERAL',      'General'),
    ('UCI',          'UCI / Cuidados Intensivos'),
    ('PEDIATRICA',   'Pediátrica'),
    ('MATERNIDAD',   'Maternidad'),
    ('CIRUGIA',      'Cirugía'),
    ('AISLAMIENTO',  'Aislamiento'),
    ('OBSERVACION',  'Observación'),
]

ESTADO_CAMA_CHOICES = [
    ('DISPONIBLE',    'Disponible'),
    ('OCUPADA',       'Ocupada'),
    ('RESERVADA',     'Reservada'),
    ('MANTENIMIENTO', 'En Mantenimiento'),
]

ESTADO_ENC_CHOICES = [
    ('INGRESADO',      'Ingresado'),
    ('EN_TRATAMIENTO', 'En Tratamiento'),
    ('EGRESADO',       'Egresado'),
    ('TRASLADADO',     'Trasladado'),
    ('FALLECIDO',      'Fallecido'),
]

TIPO_EGRESO_CHOICES = [
    ('ALTA_MEDICA',   'Alta Médica'),
    ('VOLUNTARIA',    'Voluntaria'),
    ('TRASLADO',      'Traslado'),
    ('FALLECIMIENTO', 'Fallecimiento'),
    ('FUGA',          'Fuga'),
]

# Transiciones de estado
ESTADOS_TRATABLES    = ('INGRESADO',)
ESTADOS_EGRESABLES   = ('INGRESADO', 'EN_TRATAMIENTO')
ESTADOS_ACTIVOS_ENC  = ('INGRESADO', 'EN_TRATAMIENTO')


# ============================================================
# CAMA — Catálogo de camas
# ============================================================
class Cama(models.Model):
    """
    Catálogo de camas hospitalarias.
    El estado OCUPADA/DISPONIBLE se actualiza automáticamente
    al crear/egresar un encamamiento.
    """
    cama_id     = models.AutoField(db_column='CAMA_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    numero_cama      = models.CharField(db_column='NUMERO_CAMA', max_length=10)
    piso             = models.CharField(db_column='PISO',    max_length=10, blank=True, default='')
    sala             = models.CharField(db_column='SALA',    max_length=50, blank=True, default='')
    tipo_cama        = models.CharField(db_column='TIPO_CAMA', max_length=30, choices=TIPO_CAMA_CHOICES)
    estado           = models.CharField(db_column='ESTADO',  max_length=20, choices=ESTADO_CAMA_CHOICES, default='DISPONIBLE')

    tiene_oxigeno    = models.BooleanField(db_column='TIENE_OXIGENO',    default=False)
    tiene_monitor    = models.BooleanField(db_column='TIENE_MONITOR',    default=False)
    tiene_ventilador = models.BooleanField(db_column='TIENE_VENTILADOR', default=False)
    observaciones    = models.CharField(db_column='OBSERVACIONES', max_length=500, blank=True, default='')

    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'ENC_CAMAS'
        verbose_name        = 'Cama'
        verbose_name_plural = 'Camas'
        ordering            = ['sala', 'piso', 'numero_cama']
        unique_together     = [['hospital_id', 'numero_cama']]
        indexes             = []

    def __str__(self):
        return f'Cama {self.numero_cama} — {self.sala} ({self.get_tipo_cama_display()})'


# ============================================================
# ENCAMAMIENTO — Admisión hospitalaria
# ============================================================
class Encamamiento(models.Model):
    """
    Registro de admisión hospitalaria (estancia en cama).
    hospital_id es la columna de particionamiento VPD.
    """
    enc_id      = models.AutoField(db_column='ENC_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones
    paciente  = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='encamamientos',
    )
    cama      = models.ForeignKey(
        'hospitalization.Cama',
        db_column='CAMA_ID', on_delete=models.PROTECT,
        related_name='encamamientos',
    )
    medico    = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_ID', on_delete=models.PROTECT,
        related_name='encamamientos_medico',
    )
    enfermero = models.ForeignKey(
        'security.Usuario',
        db_column='ENFERMERO_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='encamamientos_enfermero',
    )

    # Orígenes opcionales
    emergencia = models.ForeignKey(
        'emergency.Emergencia',
        db_column='EMG_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='encamamientos',
    )
    cita = models.ForeignKey(
        'appointments.Cita',
        db_column='CIT_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='encamamientos',
    )

    # Admisión
    fecha_ingreso       = models.DateField(db_column='FECHA_INGRESO')
    hora_ingreso        = models.TimeField(db_column='HORA_INGRESO')
    motivo_ingreso      = models.CharField(db_column='MOTIVO_INGRESO', max_length=500)
    diagnostico_ingreso = models.CharField(db_column='DIAGNOSTICO_INGRESO', max_length=500, blank=True, default='')
    cie10_ingreso       = models.CharField(db_column='CIE10_INGRESO', max_length=10, blank=True, default='')

    # Estado
    estado = models.CharField(
        db_column='ESTADO', max_length=30,
        choices=ESTADO_ENC_CHOICES, default='INGRESADO',
    )

    # Notas clínicas (PHI)
    notas_ingreso = models.TextField(db_column='NOTAS_INGRESO', blank=True, default='')
    evolucion     = models.TextField(db_column='EVOLUCION',     blank=True, default='')
    indicaciones  = models.TextField(db_column='INDICACIONES',  blank=True, default='')

    # Egreso
    tipo_egreso         = models.CharField(db_column='TIPO_EGRESO', max_length=30, choices=TIPO_EGRESO_CHOICES, blank=True, default='')
    fecha_egreso        = models.DateField(db_column='FECHA_EGRESO', null=True, blank=True)
    hora_egreso         = models.TimeField(db_column='HORA_EGRESO',  null=True, blank=True)
    diagnostico_egreso  = models.CharField(db_column='DIAGNOSTICO_EGRESO', max_length=500, blank=True, default='')
    cie10_egreso        = models.CharField(db_column='CIE10_EGRESO', max_length=10, blank=True, default='')
    destino_egreso      = models.CharField(db_column='DESTINO_EGRESO', max_length=200, blank=True, default='')
    dias_estancia       = models.SmallIntegerField(db_column='DIAS_ESTANCIA', null=True, blank=True)

    # Auditoría
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='encamamientos_creados',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='encamamientos_actualizados',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'ENC_ENCAMAMIENTOS'
        verbose_name        = 'Encamamiento'
        verbose_name_plural = 'Encamamientos'
        ordering            = ['-fecha_ingreso', '-hora_ingreso']
        indexes             = []

    def __str__(self):
        return f'[ENC-{self.enc_id}] {self.paciente} — Cama {self.cama} ({self.estado})'

    def calcular_dias_estancia(self) -> int:
        if self.fecha_egreso and self.fecha_ingreso:
            return (self.fecha_egreso - self.fecha_ingreso).days
        from datetime import date
        return (date.today() - self.fecha_ingreso).days
