"""
HealthTech Solutions — Models: Módulo Emergencias (M04)
Tabla: EMG_EMERGENCIAS

HIPAA: datos PHI en tablespace cifrado (TDE en PROD).
VPD:   HOSPITAL_ID presente para filtrado automático por hospital.
Soft-delete: columna ACTIVO — nunca DELETE físico.
Triaje: Sistema de Triaje Manchester (5 niveles).

Máquina de estados:
  ESPERA → EN_ATENCION → OBSERVACION → ALTA
                       ↘ TRANSFERIDO
                       ↘ FALLECIDO
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
NIVEL_TRIAJE_CHOICES = [
    ('ROJO',     'Rojo — Inmediato'),
    ('NARANJA',  'Naranja — Muy urgente'),
    ('AMARILLO', 'Amarillo — Urgente'),
    ('VERDE',    'Verde — Poco urgente'),
    ('AZUL',     'Azul — No urgente'),
]

ESTADO_CHOICES = [
    ('ESPERA',       'En Espera'),
    ('EN_ATENCION',  'En Atención'),
    ('OBSERVACION',  'En Observación'),
    ('ALTA',         'Alta'),
    ('TRANSFERIDO',  'Transferido'),
    ('FALLECIDO',    'Fallecido'),
]

TIPO_ALTA_CHOICES = [
    ('VOLUNTARIA',    'Voluntaria'),
    ('MEDICA',        'Alta Médica'),
    ('FUGA',          'Fuga'),
    ('FALLECIMIENTO', 'Fallecimiento'),
    ('TRANSFERENCIA', 'Transferencia'),
]

# Transiciones válidas de la máquina de estados
ESTADOS_ATENDIBLES   = ('ESPERA',)
ESTADOS_OBSERVABLES  = ('EN_ATENCION',)
ESTADOS_CON_ALTA     = ('EN_ATENCION', 'OBSERVACION')
ESTADOS_TRANSFERIBLES = ('EN_ATENCION', 'OBSERVACION')
ESTADOS_ACTIVOS      = ('ESPERA', 'EN_ATENCION', 'OBSERVACION')


# ============================================================
# EMERGENCIA — Registro de atención de urgencias
# ============================================================
class Emergencia(models.Model):
    """
    Registro de atención de urgencias/emergencias.
    hospital_id es la columna de particionamiento VPD.
    """
    emg_id      = models.AutoField(db_column='EMG_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    # Relaciones
    paciente    = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID',
        on_delete=models.PROTECT,
        related_name='emergencias',
    )
    medico      = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_ID',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='emergencias_atendidas',
    )
    enfermero   = models.ForeignKey(
        'security.Usuario',
        db_column='ENFERMERO_ID',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='emergencias_triaje',
    )

    # Ingreso
    fecha_ingreso   = models.DateField(db_column='FECHA_INGRESO')
    hora_ingreso    = models.TimeField(db_column='HORA_INGRESO')
    motivo_consulta = models.CharField(db_column='MOTIVO_CONSULTA', max_length=500)

    # Triaje
    nivel_triaje    = models.CharField(
        db_column='NIVEL_TRIAJE', max_length=20,
        choices=NIVEL_TRIAJE_CHOICES,
    )

    # Signos vitales
    presion_sistolica   = models.SmallIntegerField(db_column='PRESION_SISTOLICA',   null=True, blank=True)
    presion_diastolica  = models.SmallIntegerField(db_column='PRESION_DIASTOLICA',  null=True, blank=True)
    frecuencia_cardiaca = models.SmallIntegerField(db_column='FRECUENCIA_CARDIACA', null=True, blank=True)
    frecuencia_resp     = models.SmallIntegerField(db_column='FRECUENCIA_RESP',     null=True, blank=True)
    temperatura         = models.DecimalField(db_column='TEMPERATURA', max_digits=4, decimal_places=1, null=True, blank=True)
    saturacion_o2       = models.SmallIntegerField(db_column='SATURACION_O2',       null=True, blank=True)
    glucosa             = models.SmallIntegerField(db_column='GLUCOSA',             null=True, blank=True)
    peso_kg             = models.DecimalField(db_column='PESO_KG', max_digits=5, decimal_places=2, null=True, blank=True)

    # Estado
    estado  = models.CharField(
        db_column='ESTADO', max_length=30,
        choices=ESTADO_CHOICES, default='ESPERA',
    )

    # Diagnóstico y tratamiento
    diagnostico   = models.CharField(db_column='DIAGNOSTICO', max_length=500, blank=True, default='')
    cie10_codigo  = models.CharField(db_column='CIE10_CODIGO', max_length=10,  blank=True, default='')
    tratamiento   = models.TextField(db_column='TRATAMIENTO',  blank=True, default='')
    notas_medico  = models.TextField(db_column='NOTAS_MEDICO', blank=True, default='')
    notas_enfermero = models.CharField(db_column='NOTAS_ENFERMERO', max_length=1000, blank=True, default='')

    # Alta / Egreso
    tipo_alta    = models.CharField(db_column='TIPO_ALTA', max_length=30, choices=TIPO_ALTA_CHOICES, blank=True, default='')
    fecha_alta   = models.DateField(db_column='FECHA_ALTA', null=True, blank=True)
    hora_alta    = models.TimeField(db_column='HORA_ALTA',  null=True, blank=True)
    destino_alta = models.CharField(db_column='DESTINO_ALTA', max_length=200, blank=True, default='')

    # Auditoría
    activo      = models.BooleanField(db_column='ACTIVO', default=True)
    created_by  = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='emergencias_creadas',
    )
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by  = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='emergencias_actualizadas',
    )
    updated_at  = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'EMG_EMERGENCIAS'
        verbose_name        = 'Emergencia'
        verbose_name_plural = 'Emergencias'
        ordering            = ['-fecha_ingreso', '-hora_ingreso']
        indexes             = []   # Definidos en DDL Oracle: IDX_EMG_*

    def __str__(self):
        return f'[EMG-{self.emg_id}] {self.paciente} — {self.fecha_ingreso} {self.hora_ingreso} ({self.nivel_triaje})'

    def get_presion_display(self) -> str:
        if self.presion_sistolica and self.presion_diastolica:
            return f'{self.presion_sistolica}/{self.presion_diastolica} mmHg'
        return ''
