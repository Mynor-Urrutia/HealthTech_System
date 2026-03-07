"""
HealthTech Solutions — Models: Módulo Laboratorio (M07)
Tablas: LAB_ORDENES, LAB_RESULTADOS

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Máquina de estados (OrdenLab):
  PENDIENTE → EN_PROCESO → COMPLETADA
                         ↘ CANCELADA (desde cualquier estado activo)
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
PRIORIDAD_CHOICES = [
    ('NORMAL',     'Normal'),
    ('URGENTE',    'Urgente'),
    ('EMERGENCIA', 'Emergencia'),
]

TIPO_MUESTRA_CHOICES = [
    ('SANGRE',   'Sangre'),
    ('ORINA',    'Orina'),
    ('HECES',    'Heces'),
    ('ESPUTO',   'Esputo'),
    ('LCR',      'Líquido Cefalorraquídeo'),
    ('TEJIDO',   'Tejido / Biopsia'),
    ('HISOPADO', 'Hisopado'),
    ('OTRO',     'Otro'),
]

ESTADO_CHOICES = [
    ('PENDIENTE',  'Pendiente'),
    ('EN_PROCESO', 'En Proceso'),
    ('COMPLETADA', 'Completada'),
    ('CANCELADA',  'Cancelada'),
]

ESTADO_RESULTADO_CHOICES = [
    ('NORMAL',   'Normal'),
    ('ALTO',     'Alto'),
    ('BAJO',     'Bajo'),
    ('CRITICO',  'Crítico'),
    ('PENDIENTE','Pendiente'),
]

# Transiciones válidas
ESTADOS_PROCESABLES  = ('PENDIENTE',)
ESTADOS_COMPLETABLES = ('EN_PROCESO',)
ESTADOS_CANCELABLES  = ('PENDIENTE', 'EN_PROCESO')
ESTADOS_ACTIVOS      = ('PENDIENTE', 'EN_PROCESO')


# ============================================================
# ORDEN DE LABORATORIO — Solicitud de exámenes
# ============================================================
class OrdenLab(models.Model):
    """
    Orden de exámenes de laboratorio.
    Una orden puede contener múltiples exámenes (campo texto).
    Los resultados individuales se registran en ResultadoLab.
    """
    lab_id      = models.AutoField(db_column='LAB_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones principales
    paciente = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='ordenes_lab',
    )
    medico_solic = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_SOLIC_ID', on_delete=models.PROTECT,
        related_name='ordenes_lab_solicitadas',
    )
    laboratorista = models.ForeignKey(
        'security.Usuario',
        db_column='LABORATORISTA_ID', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='ordenes_lab_procesadas',
    )

    # Origen opcional (trazabilidad entre módulos)
    emergencia = models.ForeignKey(
        'emergency.Emergencia',
        db_column='EMG_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ordenes_lab',
    )
    encamamiento = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ordenes_lab',
    )
    cita = models.ForeignKey(
        'appointments.Cita',
        db_column='CIT_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ordenes_lab',
    )

    # Datos de la solicitud
    fecha_solicitud = models.DateField(db_column='FECHA_SOLICITUD')
    hora_solicitud  = models.TimeField(db_column='HORA_SOLICITUD')

    # Clasificación
    prioridad    = models.CharField(
        db_column='PRIORIDAD', max_length=20,
        choices=PRIORIDAD_CHOICES, default='NORMAL',
    )
    tipo_muestra = models.CharField(
        db_column='TIPO_MUESTRA', max_length=30,
        choices=TIPO_MUESTRA_CHOICES, default='SANGRE',
    )
    grupo_examen = models.CharField(
        db_column='GRUPO_EXAMEN', max_length=30, blank=True, default='',
    )
    examenes_solicitados = models.CharField(
        db_column='EXAMENES_SOLICITADOS', max_length=2000,
    )
    observaciones_clin = models.CharField(
        db_column='OBSERVACIONES_CLIN', max_length=500, blank=True, default='',
    )

    # Estado (máquina de estados)
    estado = models.CharField(
        db_column='ESTADO', max_length=30,
        choices=ESTADO_CHOICES, default='PENDIENTE',
    )

    # Toma de muestra (se completa al procesar)
    fecha_muestra = models.DateField(db_column='FECHA_MUESTRA', null=True, blank=True)
    hora_muestra  = models.TimeField(db_column='HORA_MUESTRA',  null=True, blank=True)

    # Entrega de resultados (se completa al finalizar)
    fecha_resultado = models.DateField(db_column='FECHA_RESULTADO', null=True, blank=True)
    hora_resultado  = models.TimeField(db_column='HORA_RESULTADO',  null=True, blank=True)

    # Notas y cancelación
    notas_laboratorio  = models.CharField(
        db_column='NOTAS_LABORATORIO', max_length=1000, blank=True, default='',
    )
    motivo_cancelacion = models.CharField(
        db_column='MOTIVO_CANCELACION', max_length=500, blank=True, default='',
    )

    # Auditoría HIPAA
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ordenes_lab_creadas',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ordenes_lab_actualizadas',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'LAB_ORDENES'
        verbose_name        = 'Orden de Laboratorio'
        verbose_name_plural = 'Órdenes de Laboratorio'
        ordering            = ['-fecha_solicitud', '-hora_solicitud']
        indexes             = []   # Definidos en DDL Oracle: IDX_LAB_*

    def __str__(self):
        return (
            f'[LAB-{self.lab_id}] {self.paciente} — '
            f'{self.fecha_solicitud} ({self.estado})'
        )


# ============================================================
# RESULTADO DE LABORATORIO — Resultado individual por examen
# ============================================================
class ResultadoLab(models.Model):
    """
    Resultado individual de un examen dentro de una orden.
    Una orden puede tener uno o muchos resultados (uno por examen).
    Se crean al completar la orden mediante la acción 'completar'.
    """
    res_id      = models.AutoField(db_column='RES_ID', primary_key=True)
    orden       = models.ForeignKey(
        'laboratory.OrdenLab',
        db_column='LAB_ID', on_delete=models.CASCADE,
        related_name='resultados',
    )
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Datos del resultado
    nombre_examen    = models.CharField(db_column='NOMBRE_EXAMEN',    max_length=200)
    valor            = models.CharField(db_column='VALOR',            max_length=500)
    unidad           = models.CharField(db_column='UNIDAD',           max_length=50,  blank=True, default='')
    rango_min        = models.CharField(db_column='RANGO_MIN',        max_length=100, blank=True, default='')
    rango_max        = models.CharField(db_column='RANGO_MAX',        max_length=100, blank=True, default='')
    valor_referencia = models.CharField(db_column='VALOR_REFERENCIA', max_length=200, blank=True, default='')
    interpretacion   = models.CharField(db_column='INTERPRETACION',   max_length=500, blank=True, default='')
    estado_resultado = models.CharField(
        db_column='ESTADO_RESULTADO', max_length=20,
        choices=ESTADO_RESULTADO_CHOICES, default='NORMAL',
    )

    # Auditoría
    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='resultados_lab_creados',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'LAB_RESULTADOS'
        verbose_name        = 'Resultado de Laboratorio'
        verbose_name_plural = 'Resultados de Laboratorio'
        ordering            = ['nombre_examen']
        indexes             = []

    def __str__(self):
        return (
            f'[RES-{self.res_id}] {self.nombre_examen}: '
            f'{self.valor} {self.unidad} ({self.estado_resultado})'
        )
