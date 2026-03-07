"""
HealthTech Solutions — Models: Módulo Farmacia (M08)
Tablas: FAR_MEDICAMENTOS, FAR_DISPENSACIONES

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Máquina de estados (Dispensacion):
  PENDIENTE → DISPENSADA
            ↘ CANCELADA
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
FORMA_FARMA_CHOICES = [
    ('TABLETA',     'Tableta'),
    ('CAPSULA',     'Cápsula'),
    ('JARABE',      'Jarabe'),
    ('INYECTABLE',  'Inyectable'),
    ('CREMA',       'Crema'),
    ('SOLUCION',    'Solución'),
    ('SUPOSITORIO', 'Supositorio'),
    ('GOTAS',       'Gotas'),
    ('PARCHE',      'Parche'),
    ('OTRO',        'Otro'),
]

CATEGORIA_CHOICES = [
    ('ANALGESICO',       'Analgésico'),
    ('ANTIBIOTICO',      'Antibiótico'),
    ('ANTIHIPERTENSIVO', 'Antihipertensivo'),
    ('ANTIDIABETICO',    'Antidiabético'),
    ('VITAMINA',         'Vitamina / Suplemento'),
    ('ANTIINFLAMATORIO', 'Antiinflamatorio'),
    ('CARDIOVASCULAR',   'Cardiovascular'),
    ('NEUROLOGICO',      'Neurológico'),
    ('RESPIRATORIO',     'Respiratorio'),
    ('OTRO',             'Otro'),
]

VIA_ADMIN_CHOICES = [
    ('ORAL',          'Oral'),
    ('INTRAVENOSA',   'Intravenosa'),
    ('INTRAMUSCULAR', 'Intramuscular'),
    ('SUBCUTANEA',    'Subcutánea'),
    ('TOPICA',        'Tópica'),
    ('INHALATORIA',   'Inhalatoria'),
    ('SUBLINGUAL',    'Sublingual'),
    ('RECTAL',        'Rectal'),
    ('NASAL',         'Nasal'),
    ('OFTALMICA',     'Oftálmica'),
    ('OTICA',         'Ótica'),
    ('OTRO',          'Otro'),
]

ESTADO_DIS_CHOICES = [
    ('PENDIENTE',  'Pendiente'),
    ('DISPENSADA', 'Dispensada'),
    ('CANCELADA',  'Cancelada'),
]

# Transiciones válidas
ESTADOS_DISPENSABLES = ('PENDIENTE',)
ESTADOS_CANCELABLES  = ('PENDIENTE',)


# ============================================================
# MEDICAMENTO — Catálogo de medicamentos del hospital
# ============================================================
class Medicamento(models.Model):
    """
    Catálogo de medicamentos del hospital.
    Gestiona stock, forma farmacéutica y categoría.
    """
    med_id      = models.AutoField(db_column='MED_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Identificación
    nombre_generico  = models.CharField(db_column='NOMBRE_GENERICO',  max_length=200)
    nombre_comercial = models.CharField(db_column='NOMBRE_COMERCIAL', max_length=200, blank=True, default='')
    principio_activo = models.CharField(db_column='PRINCIPIO_ACTIVO', max_length=200, blank=True, default='')
    concentracion    = models.CharField(db_column='CONCENTRACION',    max_length=100, blank=True, default='')

    # Clasificación
    forma_farma   = models.CharField(
        db_column='FORMA_FARMA', max_length=30,
        choices=FORMA_FARMA_CHOICES, default='TABLETA',
    )
    categoria     = models.CharField(
        db_column='CATEGORIA', max_length=50,
        choices=CATEGORIA_CHOICES, default='OTRO',
    )
    unidad_medida = models.CharField(db_column='UNIDAD_MEDIDA', max_length=30, default='tableta')

    # Inventario
    stock_actual    = models.IntegerField(db_column='STOCK_ACTUAL',    default=0)
    stock_minimo    = models.IntegerField(db_column='STOCK_MINIMO',    default=10)
    precio_unitario = models.DecimalField(
        db_column='PRECIO_UNITARIO', max_digits=10, decimal_places=2, default=0,
    )

    # Control
    requiere_receta = models.BooleanField(db_column='REQUIERE_RECETA', default=False)

    # Auditoría HIPAA
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='medicamentos_creados',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='medicamentos_actualizados',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'FAR_MEDICAMENTOS'
        verbose_name        = 'Medicamento'
        verbose_name_plural = 'Medicamentos'
        ordering            = ['nombre_generico']
        indexes             = []  # Definidos en DDL Oracle: IDX_FAR_MED_*

    def __str__(self):
        return f'[MED-{self.med_id}] {self.nombre_generico} {self.concentracion}'


# ============================================================
# DISPENSACION — Registro de dispensación a paciente
# ============================================================
class Dispensacion(models.Model):
    """
    Registro de dispensación de un medicamento a un paciente.
    Una dispensación corresponde a una prescripción médica específica.
    Al dispensar se descuenta el stock del medicamento automáticamente.
    """
    dis_id      = models.AutoField(db_column='DIS_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones principales
    medicamento = models.ForeignKey(
        'pharmacy.Medicamento',
        db_column='MED_ID', on_delete=models.PROTECT,
        related_name='dispensaciones',
    )
    paciente = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='dispensaciones',
    )
    medico_prescribe = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_PRES_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones_prescritas',
    )
    dispensado_por = models.ForeignKey(
        'security.Usuario',
        db_column='DISPENSADO_POR_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones_realizadas',
    )

    # Origen opcional (trazabilidad entre módulos)
    emergencia = models.ForeignKey(
        'emergency.Emergencia',
        db_column='EMG_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones',
    )
    encamamiento = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones',
    )
    cita = models.ForeignKey(
        'appointments.Cita',
        db_column='CIT_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones',
    )

    # Prescripción
    cantidad      = models.DecimalField(db_column='CANTIDAD', max_digits=10, decimal_places=3)
    dosis         = models.CharField(db_column='DOSIS',      max_length=200, blank=True, default='')
    frecuencia    = models.CharField(db_column='FRECUENCIA', max_length=100, blank=True, default='')
    duracion_dias = models.SmallIntegerField(db_column='DURACION_DIAS', null=True, blank=True)
    via_admin     = models.CharField(
        db_column='VIA_ADMIN', max_length=30,
        choices=VIA_ADMIN_CHOICES, default='ORAL',
    )
    indicaciones = models.CharField(db_column='INDICACIONES', max_length=500, blank=True, default='')

    # Estado (máquina de estados)
    estado = models.CharField(
        db_column='ESTADO', max_length=20,
        choices=ESTADO_DIS_CHOICES, default='PENDIENTE',
    )

    # Fechas
    fecha_prescripcion  = models.DateField(db_column='FECHA_PRESCRIPCION')
    fecha_dispensacion  = models.DateField(db_column='FECHA_DISPENSACION',  null=True, blank=True)
    hora_dispensacion   = models.TimeField(db_column='HORA_DISPENSACION',   null=True, blank=True)

    # Notas
    notas_farmacia     = models.CharField(db_column='NOTAS_FARMACIA',     max_length=1000, blank=True, default='')
    motivo_cancelacion = models.CharField(db_column='MOTIVO_CANCELACION', max_length=500,  blank=True, default='')

    # Auditoría HIPAA
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones_creadas',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dispensaciones_actualizadas',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'FAR_DISPENSACIONES'
        verbose_name        = 'Dispensación'
        verbose_name_plural = 'Dispensaciones'
        ordering            = ['-fecha_prescripcion', '-created_at']
        indexes             = []  # Definidos en DDL Oracle: IDX_FAR_DIS_*

    def __str__(self):
        return (
            f'[DIS-{self.dis_id}] {self.medicamento.nombre_generico} → '
            f'{self.paciente} ({self.estado})'
        )
