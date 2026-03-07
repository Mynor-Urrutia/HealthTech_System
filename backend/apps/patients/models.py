"""
HealthTech Solutions — Models: Módulo Pacientes (M02)
Tablas: PAC_PACIENTES, PAC_ALERGIAS,
        PAC_CONTACTOS_EMERGENCIA, PAC_HISTORIAL_CLINICO

HIPAA: todas las tablas en PHI_DATA (cifrado TDE en PROD).
VPD:   HOSPITAL_ID presente en TODAS las tablas PAC_.
Soft-delete: columna ACTIVO — nunca DELETE fisico en datos PHI.

Convenciones Oracle 19c:
  - db_table en UPPER_CASE con prefijo PAC_
  - db_column en UPPER_CASE
  - indexes = [] porque se definen en el DDL de Oracle
"""

from django.db import models


# ============================================================
# Catálogos / choices
# ============================================================
TIPO_DOC_CHOICES = [
    ('DPI',       'DPI'),
    ('PASAPORTE', 'Pasaporte'),
    ('CUI',       'CUI'),
    ('CEDULA',    'Cedula'),
    ('OTRO',      'Otro'),
]

SEXO_CHOICES = [
    ('M', 'Masculino'),
    ('F', 'Femenino'),
]

ESTADO_CIVIL_CHOICES = [
    ('SOLTERO',    'Soltero/a'),
    ('CASADO',     'Casado/a'),
    ('UNION_LIBRE','Union Libre'),
    ('DIVORCIADO', 'Divorciado/a'),
    ('VIUDO',      'Viudo/a'),
]

TIPO_PAC_CHOICES = [
    ('GENERAL',  'General'),
    ('IGSS',     'IGSS'),
    ('PRIVADO',  'Privado'),
    ('SEGURO',   'Seguro Medico'),
    ('EXTERIOR', 'Exterior'),
    ('OTRO',     'Otro'),
]

TIPO_ALERGIA_CHOICES = [
    ('MEDICAMENTO', 'Medicamento'),
    ('ALIMENTO',    'Alimento'),
    ('AMBIENTAL',   'Ambiental'),
    ('LATEX',       'Latex'),
    ('OTRO',        'Otro'),
]

SEVERIDAD_CHOICES = [
    ('LEVE',         'Leve'),
    ('MODERADA',     'Moderada'),
    ('SEVERA',       'Severa'),
    ('ANAFILACTICA', 'Anafila ctica'),
]

TIPO_ENTRADA_CHOICES = [
    ('CONSULTA',        'Consulta'),
    ('HOSPITALIZACION', 'Hospitalizacion'),
    ('CIRUGIA',         'Cirugia'),
    ('LABORATORIO',     'Laboratorio'),
    ('IMAGEN',          'Imagen / Radiologia'),
    ('MEDICAMENTO',     'Medicamento'),
    ('VACUNA',          'Vacuna'),
    ('OTRO',            'Otro'),
]


# ============================================================
# PACIENTE — Registro maestro (PHI)
# ============================================================
class Paciente(models.Model):
    """
    Tabla maestra de pacientes.
    hospital_id es la columna de particionamiento VPD.
    No se usa FK a Hospital para evitar JOIN innecesario en
    cada consulta filtrada por VPD.
    """
    pac_id               = models.AutoField(db_column='PAC_ID', primary_key=True)
    hospital_id          = models.IntegerField(db_column='HOSPITAL_ID')
    no_expediente        = models.CharField(db_column='NO_EXPEDIENTE',    max_length=30)

    # Identidad (PHI)
    primer_nombre        = models.CharField(db_column='PRIMER_NOMBRE',    max_length=100)
    segundo_nombre       = models.CharField(db_column='SEGUNDO_NOMBRE',   max_length=100, blank=True, default='')
    primer_apellido      = models.CharField(db_column='PRIMER_APELLIDO',  max_length=100)
    segundo_apellido     = models.CharField(db_column='SEGUNDO_APELLIDO', max_length=100, blank=True, default='')
    nombre_casada        = models.CharField(db_column='NOMBRE_CASADA',    max_length=100, blank=True, default='')

    # Documento de identidad
    tipo_documento       = models.CharField(db_column='TIPO_DOCUMENTO',   max_length=20,  choices=TIPO_DOC_CHOICES)
    no_documento         = models.CharField(db_column='NO_DOCUMENTO',     max_length=30)

    # Datos demograficos
    fecha_nacimiento     = models.DateField(db_column='FECHA_NACIMIENTO')
    sexo                 = models.CharField(db_column='SEXO',             max_length=1,   choices=SEXO_CHOICES)
    estado_civil         = models.CharField(db_column='ESTADO_CIVIL',     max_length=20,  choices=ESTADO_CIVIL_CHOICES, default='SOLTERO')
    nacionalidad         = models.CharField(db_column='NACIONALIDAD',     max_length=50,  default='GUATEMALTECA')

    # Contacto (PHI)
    direccion            = models.CharField(db_column='DIRECCION',            max_length=500, blank=True, default='')
    municipio            = models.CharField(db_column='MUNICIPIO',            max_length=100, blank=True, default='')
    departamento         = models.CharField(db_column='DEPARTAMENTO',         max_length=100, blank=True, default='')
    telefono_principal   = models.CharField(db_column='TELEFONO_PRINCIPAL',   max_length=20,  blank=True, default='')
    telefono_alternativo = models.CharField(db_column='TELEFONO_ALTERNATIVO', max_length=20,  blank=True, default='')
    email                = models.EmailField(db_column='EMAIL',               max_length=150, blank=True, default='')

    # Cobertura / seguro
    tipo_paciente        = models.CharField(db_column='TIPO_PACIENTE', max_length=30, choices=TIPO_PAC_CHOICES, default='GENERAL')
    no_afiliacion        = models.CharField(db_column='NO_AFILIACION', max_length=50,  blank=True, default='')
    aseguradora          = models.CharField(db_column='ASEGURADORA',   max_length=100, blank=True, default='')

    # Datos medicos relevantes
    grupo_sanguineo      = models.CharField(db_column='GRUPO_SANGUINEO', max_length=5, blank=True, default='')
    factor_rh            = models.CharField(db_column='FACTOR_RH',       max_length=1, blank=True, default='')
    peso_kg              = models.DecimalField(db_column='PESO_KG',  max_digits=5, decimal_places=2, null=True, blank=True)
    talla_cm             = models.DecimalField(db_column='TALLA_CM', max_digits=5, decimal_places=1, null=True, blank=True)

    # PACS — imagen S3
    foto_s3_key          = models.CharField(db_column='FOTO_S3_KEY', max_length=500, blank=True, default='')

    # Medico de cabecera
    medico               = models.ForeignKey(
        'security.Usuario',
        db_column='MEDICO_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='pacientes_a_cargo',
    )

    # Estado y auditoria
    activo               = models.BooleanField(db_column='ACTIVO', default=True)
    created_by           = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='pacientes_creados',
    )
    created_at           = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by           = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='pacientes_actualizados',
    )
    updated_at           = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table      = 'PAC_PACIENTES'
        verbose_name  = 'Paciente'
        verbose_name_plural = 'Pacientes'
        ordering      = ['primer_apellido', 'primer_nombre']
        # Restricciones de unicidad por hospital (VPD en PROD)
        unique_together = [
            ['hospital_id', 'no_expediente'],
            ['hospital_id', 'tipo_documento', 'no_documento'],
        ]
        indexes = []   # Definidos en DDL Oracle: IDX_PAC_HOSPITAL, IDX_PAC_APELLIDO, etc.

    def __str__(self):
        return f'{self.get_nombre_completo()} — Exp. {self.no_expediente}'

    def get_nombre_completo(self) -> str:
        partes = [
            self.primer_nombre, self.segundo_nombre,
            self.primer_apellido, self.segundo_apellido,
        ]
        return ' '.join(p for p in partes if p).strip()


# ============================================================
# ALERGIA — Catálogo de alergias del paciente (PHI)
# ============================================================
class Alergia(models.Model):
    alergia_id      = models.AutoField(db_column='ALERGIA_ID', primary_key=True)
    hospital_id     = models.IntegerField(db_column='HOSPITAL_ID')
    paciente        = models.ForeignKey(
        Paciente, db_column='PAC_ID', on_delete=models.CASCADE,
        related_name='alergias',
    )
    tipo_alergia    = models.CharField(db_column='TIPO_ALERGIA',  max_length=50,   choices=TIPO_ALERGIA_CHOICES)
    agente          = models.CharField(db_column='AGENTE',        max_length=200)
    reaccion        = models.CharField(db_column='REACCION',      max_length=500,  blank=True, default='')
    severidad       = models.CharField(db_column='SEVERIDAD',     max_length=20,   choices=SEVERIDAD_CHOICES, default='MODERADA')
    verificada      = models.BooleanField(db_column='VERIFICADA', default=False)
    fecha_deteccion = models.DateField(db_column='FECHA_DETECCION', null=True, blank=True)
    observaciones   = models.CharField(db_column='OBSERVACIONES', max_length=1000, blank=True, default='')
    activo          = models.BooleanField(db_column='ACTIVO', default=True)
    created_by      = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='alergias_registradas',
    )
    created_at      = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by      = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='alergias_actualizadas',
    )
    updated_at      = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    SEVERIDAD_ORDEN = {'ANAFILACTICA': 0, 'SEVERA': 1, 'MODERADA': 2, 'LEVE': 3}

    class Meta:
        db_table     = 'PAC_ALERGIAS'
        verbose_name = 'Alergia'
        verbose_name_plural = 'Alergias'
        ordering     = ['severidad', 'agente']
        indexes      = []

    def __str__(self):
        return f'{self.get_tipo_alergia_display()}: {self.agente} ({self.get_severidad_display()})'


# ============================================================
# CONTACTO DE EMERGENCIA (PHI)
# ============================================================
class ContactoEmergencia(models.Model):
    contacto_id     = models.AutoField(db_column='CONTACTO_ID', primary_key=True)
    hospital_id     = models.IntegerField(db_column='HOSPITAL_ID')
    paciente        = models.ForeignKey(
        Paciente, db_column='PAC_ID', on_delete=models.CASCADE,
        related_name='contactos_emergencia',
    )
    nombre_completo = models.CharField(db_column='NOMBRE_COMPLETO', max_length=200)
    parentesco      = models.CharField(db_column='PARENTESCO',      max_length=50)
    telefono        = models.CharField(db_column='TELEFONO',         max_length=20)
    telefono_alt    = models.CharField(db_column='TELEFONO_ALT',     max_length=20,  blank=True, default='')
    email           = models.EmailField(db_column='EMAIL',           max_length=150, blank=True, default='')
    direccion       = models.CharField(db_column='DIRECCION',        max_length=500, blank=True, default='')
    es_responsable  = models.BooleanField(db_column='ES_RESPONSABLE', default=False)
    activo          = models.BooleanField(db_column='ACTIVO', default=True)
    created_at      = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_at      = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table     = 'PAC_CONTACTOS_EMERGENCIA'
        verbose_name = 'Contacto de Emergencia'
        verbose_name_plural = 'Contactos de Emergencia'
        ordering     = ['-es_responsable', 'nombre_completo']
        indexes      = []

    def __str__(self):
        return f'{self.nombre_completo} ({self.parentesco})'


# ============================================================
# HISTORIAL CLINICO — Log de eventos medicos (PHI)
# ============================================================
class HistorialClinico(models.Model):
    historial_id      = models.AutoField(db_column='HISTORIAL_ID', primary_key=True)
    hospital_id       = models.IntegerField(db_column='HOSPITAL_ID')
    paciente          = models.ForeignKey(
        Paciente, db_column='PAC_ID', on_delete=models.CASCADE,
        related_name='historial',
    )
    tipo_entrada      = models.CharField(db_column='TIPO_ENTRADA', max_length=50, choices=TIPO_ENTRADA_CHOICES)
    titulo            = models.CharField(db_column='TITULO',        max_length=200)
    # TextField -> NCLOB en Oracle — soporta texto largo multilingue
    descripcion       = models.TextField(db_column='DESCRIPCION',   blank=True, default='')
    diagnostico_cie10 = models.CharField(db_column='DIAGNOSTICO_CIE10', max_length=10, blank=True, default='')
    medico            = models.ForeignKey(
        'security.Usuario', db_column='MEDICO_ID', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='historial_registrado',
    )
    fecha_evento      = models.DateField(db_column='FECHA_EVENTO')
    es_privado        = models.BooleanField(db_column='ES_PRIVADO', default=False)
    activo            = models.BooleanField(db_column='ACTIVO', default=True)
    created_by        = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='historial_creado',
    )
    created_at        = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by        = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='historial_actualizado',
    )
    updated_at        = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table     = 'PAC_HISTORIAL_CLINICO'
        verbose_name = 'Historial Clinico'
        verbose_name_plural = 'Historial Clinico'
        ordering     = ['-fecha_evento', '-created_at']
        indexes      = []

    def __str__(self):
        return f'[{self.get_tipo_entrada_display()}] {self.titulo} ({self.fecha_evento})'
