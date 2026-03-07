"""
HealthTech Solutions — Models: Módulo Enfermería (M10)
Tablas: ENF_SIGNOS_VITALES, ENF_NOTAS

PHI: contiene datos clínicos vinculados a pacientes.
VPD: HOSPITAL_ID para multitenancy.
Inmutabilidad: ningún registro se elimina físicamente.
Notas y signos vitales son registros de auditoría clínica (append-only).
"""

from django.db import models


TIPO_NOTA_CHOICES = [
    ('EVOLUCION',    'Evolución de Enfermería'),
    ('PROCEDIMIENTO','Procedimiento'),
    ('MEDICAMENTO',  'Administración de Medicamento'),
    ('INCIDENTE',    'Incidente / Evento Adverso'),
    ('INGRESO',      'Nota de Ingreso'),
    ('EGRESO',       'Nota de Egreso'),
    ('OTRO',         'Otro'),
]


class SignoVital(models.Model):
    """
    Registro de signos vitales tomados por enfermería.
    Append-only: no se modifica ni elimina (trazabilidad clínica).
    """
    sig_id      = models.AutoField(db_column='SIG_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    paciente    = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='signos_vitales',
    )
    encamamiento = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='signos_vitales',
    )

    # Signos vitales
    temperatura           = models.DecimalField(
        db_column='TEMPERATURA', max_digits=4, decimal_places=1,
        null=True, blank=True, help_text='°C',
    )
    presion_sistolica     = models.IntegerField(
        db_column='PRESION_SISTOLICA', null=True, blank=True, help_text='mmHg',
    )
    presion_diastolica    = models.IntegerField(
        db_column='PRESION_DIASTOLICA', null=True, blank=True, help_text='mmHg',
    )
    frecuencia_cardiaca   = models.IntegerField(
        db_column='FRECUENCIA_CARDIACA', null=True, blank=True, help_text='bpm',
    )
    frecuencia_respiratoria = models.IntegerField(
        db_column='FRECUENCIA_RESPIRATORIA', null=True, blank=True, help_text='rpm',
    )
    saturacion_o2         = models.DecimalField(
        db_column='SATURACION_O2', max_digits=5, decimal_places=2,
        null=True, blank=True, help_text='%',
    )
    glucemia              = models.DecimalField(
        db_column='GLUCEMIA', max_digits=6, decimal_places=1,
        null=True, blank=True, help_text='mg/dL',
    )
    peso                  = models.DecimalField(
        db_column='PESO', max_digits=5, decimal_places=2,
        null=True, blank=True, help_text='kg',
    )
    talla                 = models.DecimalField(
        db_column='TALLA', max_digits=5, decimal_places=2,
        null=True, blank=True, help_text='cm',
    )
    glasgow               = models.IntegerField(
        db_column='GLASGOW', null=True, blank=True, help_text='3-15',
    )
    observaciones         = models.CharField(
        db_column='OBSERVACIONES', max_length=500, blank=True, default='',
    )

    created_by  = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='signos_registrados',
    )
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table            = 'ENF_SIGNOS_VITALES'
        verbose_name        = 'Signo Vital'
        verbose_name_plural = 'Signos Vitales'
        ordering            = ['-created_at']
        indexes             = []

    def __str__(self):
        return f'[SIG-{self.sig_id}] Pac-{self.paciente_id} {self.created_at}'

    @property
    def presion_arterial(self):
        if self.presion_sistolica and self.presion_diastolica:
            return f'{self.presion_sistolica}/{self.presion_diastolica}'
        return None

    @property
    def imc(self):
        if self.peso and self.talla and self.talla > 0:
            talla_m = float(self.talla) / 100
            return round(float(self.peso) / (talla_m ** 2), 1)
        return None


class NotaEnfermeria(models.Model):
    """
    Nota clínica registrada por enfermería.
    Append-only: no se modifica ni elimina (trazabilidad clínica).
    """
    nota_id     = models.AutoField(db_column='NOTA_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    paciente    = models.ForeignKey(
        'patients.Paciente',
        db_column='PAC_ID', on_delete=models.PROTECT,
        related_name='notas_enfermeria',
    )
    encamamiento = models.ForeignKey(
        'hospitalization.Encamamiento',
        db_column='ENC_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_enfermeria',
    )

    tipo_nota   = models.CharField(
        db_column='TIPO_NOTA', max_length=30,
        choices=TIPO_NOTA_CHOICES, default='EVOLUCION',
    )
    contenido   = models.TextField(db_column='CONTENIDO')
    es_urgente  = models.BooleanField(db_column='ES_URGENTE', default=False)

    created_by  = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='notas_enfermeria_creadas',
    )
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table            = 'ENF_NOTAS'
        verbose_name        = 'Nota de Enfermería'
        verbose_name_plural = 'Notas de Enfermería'
        ordering            = ['-created_at']
        indexes             = []

    def __str__(self):
        return f'[NOTA-{self.nota_id}] {self.tipo_nota} Pac-{self.paciente_id}'
