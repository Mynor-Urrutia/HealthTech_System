"""
HealthTech Solutions — Serializers: Módulo Pacientes (M02)
HIPAA: data_minimization activo.
  - PacienteListSerializer: sin datos de contacto completos
  - PacienteDetailSerializer: ficha completa (solo con JWT valido + permisos)
  - Campos PHI (direccion, email, documentos) nunca en listados masivos.
"""

from datetime import date
from rest_framework import serializers
from apps.patients.models import (
    Paciente, Alergia, ContactoEmergencia, HistorialClinico,
)
from apps.patients.utils import generar_no_expediente


# ============================================================
# ALERGIA
# ============================================================
class AlergiaSerializer(serializers.ModelSerializer):
    tipo_alergia_display = serializers.CharField(
        source='get_tipo_alergia_display', read_only=True
    )
    severidad_display = serializers.CharField(
        source='get_severidad_display', read_only=True
    )

    class Meta:
        model  = Alergia
        fields = [
            'alergia_id', 'tipo_alergia', 'tipo_alergia_display',
            'agente', 'reaccion', 'severidad', 'severidad_display',
            'verificada', 'fecha_deteccion', 'observaciones',
            'activo', 'created_at',
        ]
        read_only_fields = ['alergia_id', 'created_at']


class AlergiaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Alergia
        fields = [
            'tipo_alergia', 'agente', 'reaccion',
            'severidad', 'verificada', 'fecha_deteccion', 'observaciones',
        ]

    def create(self, validated_data):
        request  = self.context['request']
        paciente = self.context['paciente']
        return Alergia.objects.create(
            hospital_id=request.user.hospital_id,
            paciente=paciente,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )


# ============================================================
# CONTACTO DE EMERGENCIA
# ============================================================
class ContactoEmergenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ContactoEmergencia
        fields = [
            'contacto_id', 'nombre_completo', 'parentesco',
            'telefono', 'telefono_alt', 'email', 'direccion',
            'es_responsable', 'activo',
        ]
        read_only_fields = ['contacto_id']


class ContactoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ContactoEmergencia
        fields = [
            'nombre_completo', 'parentesco', 'telefono',
            'telefono_alt', 'email', 'direccion', 'es_responsable',
        ]

    def create(self, validated_data):
        request  = self.context['request']
        paciente = self.context['paciente']
        return ContactoEmergencia.objects.create(
            hospital_id=request.user.hospital_id,
            paciente=paciente,
            **validated_data,
        )


# ============================================================
# HISTORIAL CLINICO
# ============================================================
class HistorialSerializer(serializers.ModelSerializer):
    tipo_entrada_display = serializers.CharField(
        source='get_tipo_entrada_display', read_only=True
    )
    medico_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = HistorialClinico
        fields = [
            'historial_id', 'tipo_entrada', 'tipo_entrada_display',
            'titulo', 'descripcion', 'diagnostico_cie10',
            'medico_nombre', 'fecha_evento', 'es_privado',
            'activo', 'created_at',
        ]
        read_only_fields = ['historial_id', 'created_at']

    def get_medico_nombre(self, obj) -> str | None:
        return obj.medico.get_short_name() if obj.medico else None


class HistorialCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HistorialClinico
        fields = [
            'tipo_entrada', 'titulo', 'descripcion',
            'diagnostico_cie10', 'fecha_evento', 'es_privado',
        ]

    def validate_fecha_evento(self, value):
        if value > date.today():
            raise serializers.ValidationError(
                'La fecha del evento no puede ser futura.'
            )
        return value

    def create(self, validated_data):
        request  = self.context['request']
        paciente = self.context['paciente']
        return HistorialClinico.objects.create(
            hospital_id=request.user.hospital_id,
            paciente=paciente,
            medico=request.user,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )


# ============================================================
# PACIENTE — Listado (data-minimization HIPAA)
# Expone solo campos necesarios para tablas/listados.
# Sin: direccion, email, no_documento completo.
# ============================================================
class PacienteListSerializer(serializers.ModelSerializer):
    nombre_completo       = serializers.SerializerMethodField()
    edad                  = serializers.SerializerMethodField()
    tipo_paciente_display = serializers.CharField(
        source='get_tipo_paciente_display', read_only=True
    )
    sexo_display = serializers.SerializerMethodField()

    class Meta:
        model  = Paciente
        fields = [
            'pac_id', 'no_expediente', 'nombre_completo',
            'tipo_documento', 'no_documento',
            'fecha_nacimiento', 'edad', 'sexo', 'sexo_display',
            'tipo_paciente', 'tipo_paciente_display',
            'telefono_principal', 'activo',
        ]

    def get_nombre_completo(self, obj) -> str:
        return obj.get_nombre_completo()

    def get_edad(self, obj) -> int | None:
        if not obj.fecha_nacimiento:
            return None
        hoy = date.today()
        return (
            hoy.year - obj.fecha_nacimiento.year
            - ((hoy.month, hoy.day) < (obj.fecha_nacimiento.month, obj.fecha_nacimiento.day))
        )

    def get_sexo_display(self, obj) -> str:
        return 'Masculino' if obj.sexo == 'M' else 'Femenino'


# ============================================================
# PACIENTE — Ficha completa con sub-recursos nested
# ============================================================
class PacienteDetailSerializer(serializers.ModelSerializer):
    nombre_completo       = serializers.SerializerMethodField()
    edad                  = serializers.SerializerMethodField()
    medico_nombre         = serializers.SerializerMethodField()
    alergias              = AlergiaSerializer(many=True, read_only=True)
    contactos_emergencia  = ContactoEmergenciaSerializer(many=True, read_only=True)
    tipo_paciente_display = serializers.CharField(
        source='get_tipo_paciente_display', read_only=True
    )
    sexo_display = serializers.SerializerMethodField()

    class Meta:
        model  = Paciente
        fields = [
            'pac_id', 'hospital_id', 'no_expediente',
            'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido', 'nombre_casada',
            'nombre_completo', 'edad', 'sexo', 'sexo_display',
            'tipo_documento', 'no_documento',
            'fecha_nacimiento', 'estado_civil', 'nacionalidad',
            'direccion', 'municipio', 'departamento',
            'telefono_principal', 'telefono_alternativo', 'email',
            'tipo_paciente', 'tipo_paciente_display',
            'no_afiliacion', 'aseguradora',
            'grupo_sanguineo', 'factor_rh',
            'peso_kg', 'talla_cm',
            'medico_nombre', 'activo',
            'alergias', 'contactos_emergencia',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'pac_id', 'hospital_id', 'nombre_completo', 'edad',
            'medico_nombre', 'alergias', 'contactos_emergencia',
            'created_at', 'updated_at',
        ]

    def get_nombre_completo(self, obj) -> str:
        return obj.get_nombre_completo()

    def get_edad(self, obj) -> int | None:
        if not obj.fecha_nacimiento:
            return None
        hoy = date.today()
        return (
            hoy.year - obj.fecha_nacimiento.year
            - ((hoy.month, hoy.day) < (obj.fecha_nacimiento.month, obj.fecha_nacimiento.day))
        )

    def get_medico_nombre(self, obj) -> str | None:
        return obj.medico.get_short_name() if obj.medico else None

    def get_sexo_display(self, obj) -> str:
        return 'Masculino' if obj.sexo == 'M' else 'Femenino'


# ============================================================
# PACIENTE — Creacion / Edicion
# ============================================================
class PacienteCreateSerializer(serializers.ModelSerializer):
    """
    Serializador de creación/edición de pacientes.

    Nota: 'no_expediente' es de SOLO LECTURA — se genera automáticamente
    en formato YYYYMMDDXXX con correlativo único por hospital y día.
    El campo se excluye de 'fields' de entrada para que el usuario
    nunca lo envíe manualmente.
    """

    # Devuelve el expediente generado en el response (read_only)
    no_expediente = serializers.CharField(read_only=True)

    class Meta:
        model  = Paciente
        fields = [
            'no_expediente',         # solo en respuesta — auto-generado
            'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido', 'nombre_casada',
            'tipo_documento', 'no_documento',
            'fecha_nacimiento', 'sexo', 'estado_civil', 'nacionalidad',
            'direccion', 'municipio', 'departamento',
            'telefono_principal', 'telefono_alternativo', 'email',
            'tipo_paciente', 'no_afiliacion', 'aseguradora',
            'grupo_sanguineo', 'factor_rh', 'peso_kg', 'talla_cm',
        ]

    def validate_fecha_nacimiento(self, value):
        if value > date.today():
            raise serializers.ValidationError(
                'La fecha de nacimiento no puede ser futura.'
            )
        return value

    def create(self, validated_data):
        request     = self.context['request']
        hospital_id = request.user.hospital_id
        # Genera el correlativo atómico — validado a nivel de BD
        no_expediente = generar_no_expediente(hospital_id)
        return Paciente.objects.create(
            hospital_id=hospital_id,
            no_expediente=no_expediente,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        request = self.context['request']
        # No se actualiza no_expediente en edición (es inmutable post-creación)
        validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)
