"""
HealthTech Solutions — Serializers: Módulo de Seguridad
HIPAA: campos PHI filtrados por defecto, hospital_id inyectado por backend.
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from apps.security.models import (
    Hospital, Rol, Permiso, RolPermiso, Usuario, AuditoriaAcceso
)


# ============================================================
# HOSPITAL
# ============================================================
class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Hospital
        fields = [
            'hospital_id', 'codigo', 'nombre', 'nombre_corto',
            'direccion', 'telefono', 'email', 'timezone', 'activo',
        ]
        read_only_fields = ['hospital_id']


# ============================================================
# ROL
# ============================================================
class RolSerializer(serializers.ModelSerializer):
    nivel_display = serializers.CharField(source='get_nivel_display', read_only=True)

    class Meta:
        model  = Rol
        fields = [
            'rol_id', 'codigo', 'nombre', 'descripcion',
            'nivel', 'nivel_display', 'es_sistema', 'activo',
        ]
        read_only_fields = ['rol_id', 'es_sistema']


class RolBriefSerializer(serializers.ModelSerializer):
    """Versión compacta para embeber en otros serializers."""
    class Meta:
        model  = Rol
        fields = ['rol_id', 'codigo', 'nombre', 'nivel']


# ============================================================
# USUARIO
# ============================================================
class UsuarioListSerializer(serializers.ModelSerializer):
    """Listado — sin datos PHI sensibles, solo lo necesario para tablas."""
    rol          = RolBriefSerializer(read_only=True)
    hospital_nombre = serializers.CharField(source='hospital.nombre_corto', read_only=True)
    full_name    = serializers.SerializerMethodField()

    class Meta:
        model  = Usuario
        fields = [
            'usr_id', 'username', 'full_name', 'email',
            'tipo_personal', 'rol', 'hospital_nombre',
            'activo', 'cuenta_bloqueada', 'ultimo_login',
        ]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name()


class UsuarioDetailSerializer(serializers.ModelSerializer):
    """Detalle completo — solo para el propio usuario o Admin Hospital."""
    rol          = RolBriefSerializer(read_only=True)
    rol_id       = serializers.PrimaryKeyRelatedField(
        queryset=Rol.objects.filter(activo=True),
        source='rol', write_only=True,
    )
    hospital_id  = serializers.PrimaryKeyRelatedField(
        queryset=Hospital.objects.filter(activo=True),
        source='hospital', write_only=True, required=False,
    )
    hospital_nombre = serializers.CharField(source='hospital.nombre_corto', read_only=True)
    full_name    = serializers.SerializerMethodField()

    class Meta:
        model  = Usuario
        fields = [
            'usr_id', 'username', 'full_name',
            'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido',
            'email', 'telefono', 'tipo_personal',
            'especialidad', 'no_colegiado',
            'rol', 'rol_id', 'hospital_id', 'hospital_nombre',
            'activo', 'cuenta_bloqueada',
            'debe_cambiar_pass', 'ultimo_login',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'usr_id', 'username', 'hospital_nombre',
            'cuenta_bloqueada', 'ultimo_login',
            'created_at', 'updated_at',
        ]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name()


class UsuarioCreateSerializer(serializers.ModelSerializer):
    """Creación de usuario — solo para Admin Hospital o Super Admin."""
    password  = serializers.CharField(write_only=True, min_length=10)
    rol_id    = serializers.PrimaryKeyRelatedField(
        queryset=Rol.objects.filter(activo=True),
        source='rol',
    )
    hospital_id = serializers.PrimaryKeyRelatedField(
        queryset=Hospital.objects.filter(activo=True),
        source='hospital', required=False,
    )

    class Meta:
        model  = Usuario
        fields = [
            'username', 'password',
            'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido',
            'email', 'telefono', 'tipo_personal',
            'especialidad', 'no_colegiado', 'rol_id',
            'hospital_id',
        ]

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate_rol_id(self, rol):
        """SUPER_ADMIN solo puede ser asignado por otro SUPER_ADMIN."""
        request = self.context.get('request')
        if rol.codigo == 'SUPER_ADMIN':
            if not request or request.user.rol.codigo != 'SUPER_ADMIN':
                raise serializers.ValidationError(
                    'Solo un Super Admin puede asignar el rol SUPER_ADMIN.'
                )
        return rol

    def create(self, validated_data):
        request    = self.context.get('request')
        password   = validated_data.pop('password')
        hospital   = validated_data.pop('hospital', None) or request.user.hospital
        created_by = request.user

        user = Usuario(
            hospital=hospital,
            hospital_id=hospital.hospital_id,
            created_by=created_by,
            updated_by=created_by,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class CambiarPasswordSerializer(serializers.Serializer):
    """Cambio de contraseña autenticado."""
    password_actual = serializers.CharField(write_only=True)
    password_nuevo  = serializers.CharField(write_only=True, min_length=10)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user

        if not user.check_password(attrs['password_actual']):
            raise serializers.ValidationError(
                {'password_actual': 'La contraseña actual es incorrecta.'}
            )
        if attrs['password_nuevo'] != attrs['password_confirm']:
            raise serializers.ValidationError(
                {'password_confirm': 'Las contraseñas nuevas no coinciden.'}
            )
        try:
            validate_password(attrs['password_nuevo'], user)
        except ValidationError as e:
            raise serializers.ValidationError({'password_nuevo': list(e.messages)})

        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['password_nuevo'])
        user.debe_cambiar_pass = False
        user.pass_cambiado_en  = __import__('django.utils.timezone', fromlist=['now']).now()
        user.save(update_fields=['password', 'debe_cambiar_pass',
                                 'pass_cambiado_en', 'updated_at'])
        return user


class DesbloquearUsuarioSerializer(serializers.Serializer):
    """Desbloqueo de cuenta — solo Admin Hospital o Super Admin."""
    resetear_password = serializers.BooleanField(default=False)
    nuevo_password    = serializers.CharField(write_only=True, required=False, min_length=10)

    def validate(self, attrs):
        if attrs.get('resetear_password') and not attrs.get('nuevo_password'):
            raise serializers.ValidationError(
                {'nuevo_password': 'Se requiere nuevo_password si resetear_password es True.'}
            )
        return attrs


# ============================================================
# AUDITORÍA (solo lectura)
# ============================================================
class AuditoriaAccesoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = AuditoriaAcceso
        fields = [
            'auditoria_id', 'hospital_id', 'usuario_nombre',
            'username_intento', 'tipo_evento', 'modulo', 'accion',
            'tabla_afectada', 'registro_id', 'ip_origen',
            'descripcion', 'exitoso', 'duracion_ms', 'created_at',
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, obj) -> str | None:
        return obj.usuario.get_full_name() if obj.usuario else None
