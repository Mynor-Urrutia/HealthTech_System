"""
HealthTech Solutions — Models: Módulo de Seguridad (M01)
Tablas: SEC_HOSPITALES, SEC_ROLES, SEC_PERMISOS,
        SEC_ROLES_PERMISOS, SEC_USUARIOS,
        SEC_SESIONES, SEC_AUDITORIA_ACCESOS

Convenciones Oracle 19c:
  - db_table en UPPER_CASE con prefijo SEC_
  - db_column en UPPER_CASE
  - Sequences con CACHE 50 (manejadas por Oracle, no Django)
  - Sin tipo JSON nativo — usar TextField con validación
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from apps.security.managers import UsuarioManager


# ============================================================
# HOSPITAL — Tabla raíz, sin VPD
# ============================================================
class Hospital(models.Model):
    hospital_id    = models.AutoField(db_column='HOSPITAL_ID', primary_key=True)
    codigo         = models.CharField(db_column='CODIGO', max_length=20, unique=True)
    nombre         = models.CharField(db_column='NOMBRE', max_length=150)
    nombre_corto   = models.CharField(db_column='NOMBRE_CORTO', max_length=50)
    direccion      = models.CharField(db_column='DIRECCION', max_length=300, blank=True, default='')
    telefono       = models.CharField(db_column='TELEFONO', max_length=20, blank=True, default='')
    email          = models.EmailField(db_column='EMAIL', max_length=100, blank=True, default='')
    nit            = models.CharField(db_column='NIT', max_length=20, blank=True, default='', unique=True)
    logo_s3_key    = models.CharField(db_column='LOGO_S3_KEY', max_length=500, blank=True, default='')
    timezone       = models.CharField(db_column='TIMEZONE', max_length=50, default='America/Guatemala')
    activo         = models.BooleanField(db_column='ACTIVO', default=True)
    created_at     = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_at     = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table = 'SEC_HOSPITALES'
        verbose_name = 'Hospital'
        verbose_name_plural = 'Hospitales'
        ordering = ['nombre']

    def __str__(self):
        return f'{self.nombre_corto} ({self.codigo})'


# ============================================================
# ROL — Catálogo global de roles
# ============================================================
NIVEL_CHOICES = [
    (1, 'Super Admin'),
    (2, 'Admin Hospital'),
    (3, 'Personal Clínico'),
    (4, 'Personal de Apoyo'),
    (5, 'Externo'),
]


class Rol(models.Model):
    rol_id      = models.AutoField(db_column='ROL_ID', primary_key=True)
    codigo      = models.CharField(db_column='CODIGO', max_length=50, unique=True)
    nombre      = models.CharField(db_column='NOMBRE', max_length=100)
    descripcion = models.CharField(db_column='DESCRIPCION', max_length=500, blank=True, default='')
    nivel       = models.SmallIntegerField(db_column='NIVEL', choices=NIVEL_CHOICES)
    es_sistema  = models.BooleanField(db_column='ES_SISTEMA', default=False)
    activo      = models.BooleanField(db_column='ACTIVO', default=True)
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_at  = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table = 'SEC_ROLES'
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'
        ordering = ['nivel', 'nombre']

    def __str__(self):
        return self.nombre


# ============================================================
# PERMISO — Granular por módulo y acción
# ============================================================
ACCION_CHOICES = [
    ('view',     'Ver'),
    ('create',   'Crear'),
    ('edit',     'Editar'),
    ('delete',   'Eliminar'),
    ('export',   'Exportar'),
    ('approve',  'Aprobar'),
    ('dispense', 'Dispensar'),
    ('audit',    'Auditar'),
]


class Permiso(models.Model):
    permiso_id  = models.AutoField(db_column='PERMISO_ID', primary_key=True)
    modulo      = models.CharField(db_column='MODULO', max_length=50)
    accion      = models.CharField(db_column='ACCION', max_length=30, choices=ACCION_CHOICES)
    codigo      = models.CharField(db_column='CODIGO', max_length=100, unique=True)
    descripcion = models.CharField(db_column='DESCRIPCION', max_length=300, blank=True, default='')
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table = 'SEC_PERMISOS'
        verbose_name = 'Permiso'
        verbose_name_plural = 'Permisos'
        ordering = ['modulo', 'accion']

    def __str__(self):
        return self.codigo


class RolPermiso(models.Model):
    rol         = models.ForeignKey(Rol, db_column='ROL_ID', on_delete=models.CASCADE,
                                    related_name='rol_permisos')
    permiso     = models.ForeignKey(Permiso, db_column='PERMISO_ID', on_delete=models.CASCADE,
                                    related_name='rol_permisos')
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table = 'SEC_ROLES_PERMISOS'
        unique_together = [['rol', 'permiso']]
        verbose_name = 'Rol-Permiso'

    def __str__(self):
        return f'{self.rol.codigo} → {self.permiso.codigo}'


# ============================================================
# USUARIO — AbstractBaseUser con hospital_id (PHI)
# ============================================================
TIPO_PERSONAL_CHOICES = [
    ('MEDICO',         'Médico'),
    ('ENFERMERO',      'Enfermero/a'),
    ('FARMACEUTICO',   'Farmacéutico'),
    ('LABORATORISTA',  'Laboratorista'),
    ('ADMINISTRATIVO', 'Administrativo'),
    ('BODEGUERO',      'Bodeguero'),
    ('AUDITOR',        'Auditor'),
    ('PROVEEDOR',      'Proveedor'),
    ('PACIENTE',       'Paciente'),
    ('OTRO',           'Otro'),
]


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Modelo de usuario personalizado.
    Extiende AbstractBaseUser para control total sobre Oracle.
    hospital_id es la columna de particionamiento VPD.
    """
    usr_id           = models.AutoField(db_column='USR_ID', primary_key=True)
    hospital         = models.ForeignKey(
        Hospital,
        db_column='HOSPITAL_ID',
        on_delete=models.PROTECT,
        related_name='usuarios',
    )
    # Nota: Django expone automáticamente `hospital_id` (attname del FK).
    # No declarar un IntegerField separado para evitar conflicto de nombres.
    rol              = models.ForeignKey(
        Rol,
        db_column='ROL_ID',
        on_delete=models.PROTECT,
        related_name='usuarios',
    )
    # Credenciales
    username         = models.CharField(db_column='USERNAME', max_length=50, unique=True)
    # Datos personales (PHI — en tablespace cifrado en PROD)
    primer_nombre    = models.CharField(db_column='PRIMER_NOMBRE', max_length=100)
    segundo_nombre   = models.CharField(db_column='SEGUNDO_NOMBRE', max_length=100, blank=True, default='')
    primer_apellido  = models.CharField(db_column='PRIMER_APELLIDO', max_length=100)
    segundo_apellido = models.CharField(db_column='SEGUNDO_APELLIDO', max_length=100, blank=True, default='')
    email            = models.EmailField(db_column='EMAIL', max_length=150)
    telefono         = models.CharField(db_column='TELEFONO', max_length=20, blank=True, default='')
    # Tipo de personal
    tipo_personal    = models.CharField(db_column='TIPO_PERSONAL', max_length=30,
                                        choices=TIPO_PERSONAL_CHOICES)
    especialidad     = models.CharField(db_column='ESPECIALIDAD', max_length=100, blank=True, default='')
    no_colegiado     = models.CharField(db_column='NO_COLEGIADO', max_length=30, blank=True, default='')
    foto_s3_key      = models.CharField(db_column='FOTO_S3_KEY', max_length=500, blank=True, default='')
    # Estado de cuenta
    activo           = models.BooleanField(db_column='ACTIVO', default=True)
    cuenta_bloqueada = models.BooleanField(db_column='CUENTA_BLOQUEADA', default=False)
    intentos_fallidos = models.SmallIntegerField(db_column='INTENTOS_FALLIDOS', default=0)
    debe_cambiar_pass = models.BooleanField(db_column='DEBE_CAMBIAR_PASS', default=False)
    ultimo_login     = models.DateTimeField(db_column='ULTIMO_LOGIN', null=True, blank=True)
    pass_cambiado_en = models.DateTimeField(db_column='PASS_CAMBIADO_EN', default=timezone.now)
    # Auditoría
    created_by       = models.ForeignKey(
        'self', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='usuarios_creados',
    )
    created_at       = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by       = models.ForeignKey(
        'self', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='usuarios_actualizados',
    )
    updated_at       = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)
    is_active        = models.BooleanField(db_column='IS_ACTIVE', default=True)
    # Campo requerido por PermissionsMixin (Django admin).
    # Se activa en SUPER_ADMIN/ADMIN_HOSPITAL mediante el comando setup_dev.
    is_staff         = models.BooleanField(db_column='IS_STAFF', default=False)

    objects = UsuarioManager()

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email', 'primer_nombre', 'primer_apellido']

    class Meta:
        db_table = 'SEC_USUARIOS'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering = ['primer_apellido', 'primer_nombre']
        # El índice sobre HOSPITAL_ID se define en el DDL de Oracle (03_sec_usuarios.sql).
        # No se declara aquí para evitar conflicto con --run-syncdb en DEV.
        indexes = []

    def __str__(self):
        return f'{self.get_full_name()} ({self.username})'

    def get_full_name(self) -> str:
        partes = [self.primer_nombre, self.segundo_nombre,
                  self.primer_apellido, self.segundo_apellido]
        return ' '.join(p for p in partes if p).strip()

    def get_short_name(self) -> str:
        return f'{self.primer_nombre} {self.primer_apellido}'

    @property
    def rol_codigo(self) -> str:
        return self.rol.codigo if self.rol_id else ''

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def incrementar_intento_fallido(self):
        self.intentos_fallidos += 1
        if self.intentos_fallidos >= 5:
            self.cuenta_bloqueada = True
        self.save(update_fields=['intentos_fallidos', 'cuenta_bloqueada', 'updated_at'])

    def resetear_intentos(self):
        self.intentos_fallidos = 0
        self.cuenta_bloqueada = False
        self.ultimo_login = timezone.now()
        self.save(update_fields=['intentos_fallidos', 'cuenta_bloqueada',
                                 'ultimo_login', 'updated_at'])


# ============================================================
# SESION — Control de tokens activos
# ============================================================
class Sesion(models.Model):
    sesion_id         = models.AutoField(db_column='SESION_ID', primary_key=True)
    hospital_id       = models.IntegerField(db_column='HOSPITAL_ID')
    usuario           = models.ForeignKey(
        Usuario, db_column='USR_ID', on_delete=models.CASCADE,
        related_name='sesiones',
    )
    refresh_token_jti = models.CharField(db_column='REFRESH_TOKEN_JTI', max_length=100, unique=True)
    ip_origen         = models.GenericIPAddressField(db_column='IP_ORIGEN')
    user_agent        = models.CharField(db_column='USER_AGENT', max_length=500, blank=True, default='')
    dispositivo       = models.CharField(db_column='DISPOSITIVO', max_length=100, blank=True, default='')
    creada_en         = models.DateTimeField(db_column='CREADA_EN', auto_now_add=True)
    expira_en         = models.DateTimeField(db_column='EXPIRA_EN')
    revocada          = models.BooleanField(db_column='REVOCADA', default=False)
    revocada_en       = models.DateTimeField(db_column='REVOCADA_EN', null=True, blank=True)
    motivo_revocacion = models.CharField(db_column='MOTIVO_REVOCACION', max_length=100,
                                         blank=True, default='')

    class Meta:
        db_table = 'SEC_SESIONES'
        verbose_name = 'Sesión'
        verbose_name_plural = 'Sesiones'
        ordering = ['-creada_en']

    def revocar(self, motivo: str = 'logout'):
        self.revocada = True
        self.revocada_en = timezone.now()
        self.motivo_revocacion = motivo
        self.save(update_fields=['revocada', 'revocada_en', 'motivo_revocacion'])


# ============================================================
# AUDITORÍA DE ACCESOS — Log HIPAA
# ============================================================
TIPO_EVENTO_CHOICES = [
    ('LOGIN_OK',        'Login exitoso'),
    ('LOGIN_FAIL',      'Login fallido'),
    ('LOGOUT',          'Logout'),
    ('TOKEN_REFRESH',   'Refresh de token'),
    ('TOKEN_REVOKED',   'Token revocado'),
    ('PASSWORD_CHANGE', 'Cambio de contraseña'),
    ('ACCOUNT_LOCKED',  'Cuenta bloqueada'),
    ('PHI_ACCESS',      'Acceso a PHI'),
    ('PHI_MODIFY',      'Modificación de PHI'),
    ('PHI_DELETE',      'Eliminación lógica de PHI'),
    ('EXPORT',          'Exportación de datos'),
    ('ADMIN_ACTION',    'Acción administrativa'),
]


class AuditoriaAcceso(models.Model):
    auditoria_id     = models.AutoField(db_column='AUDITORIA_ID', primary_key=True)
    hospital_id      = models.IntegerField(db_column='HOSPITAL_ID', null=True, blank=True)
    usuario          = models.ForeignKey(
        Usuario, db_column='USR_ID', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='auditorias',
    )
    username_intento = models.CharField(db_column='USERNAME_INTENTO', max_length=50,
                                        blank=True, default='')
    tipo_evento      = models.CharField(db_column='TIPO_EVENTO', max_length=50,
                                        choices=TIPO_EVENTO_CHOICES)
    modulo           = models.CharField(db_column='MODULO', max_length=50, blank=True, default='')
    accion           = models.CharField(db_column='ACCION', max_length=50, blank=True, default='')
    tabla_afectada   = models.CharField(db_column='TABLA_AFECTADA', max_length=100,
                                        blank=True, default='')
    registro_id      = models.CharField(db_column='REGISTRO_ID', max_length=50,
                                        blank=True, default='')
    ip_origen        = models.GenericIPAddressField(db_column='IP_ORIGEN')
    user_agent       = models.CharField(db_column='USER_AGENT', max_length=500,
                                        blank=True, default='')
    descripcion      = models.CharField(db_column='DESCRIPCION', max_length=1000,
                                        blank=True, default='')
    exitoso          = models.BooleanField(db_column='EXITOSO', default=True)
    mensaje_error    = models.CharField(db_column='MENSAJE_ERROR', max_length=500,
                                        blank=True, default='')
    duracion_ms      = models.IntegerField(db_column='DURACION_MS', null=True, blank=True)
    created_at       = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table = 'SEC_AUDITORIA_ACCESOS'
        verbose_name = 'Auditoría de Acceso'
        verbose_name_plural = 'Auditorías de Acceso'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.tipo_evento} | {self.username_intento or self.usuario_id} | {self.created_at}'
