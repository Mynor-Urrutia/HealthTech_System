"""
HealthTech Solutions — Serializers: Módulo Emergencias (M04)
HIPAA: data_minimization activo.
  - EmergenciaListSerializer:   sin notas clínicas completas
  - EmergenciaDetailSerializer: ficha completa (solo JWT válido + permisos)
  - EmergenciaCreateSerializer: validación de fecha/hora y signos vitales
  - EmergenciaAtenderSerializer: asignar médico + iniciar atención
  - EmergenciaAltaSerializer:   dar de alta con tipo y destino
"""

from datetime import date
from rest_framework import serializers

from apps.emergency.models import (
    Emergencia,
    ESTADOS_ACTIVOS, ESTADOS_ATENDIBLES,
    ESTADOS_CON_ALTA, ESTADOS_TRANSFERIBLES,
)


# ============================================================
# EMERGENCIA — Listado (data-minimization HIPAA)
# ============================================================
class EmergenciaListSerializer(serializers.ModelSerializer):
    paciente_nombre     = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    medico_nombre       = serializers.SerializerMethodField()
    nivel_triaje_display = serializers.CharField(source='get_nivel_triaje_display', read_only=True)
    estado_display      = serializers.CharField(source='get_estado_display', read_only=True)
    hora_ingreso_fmt    = serializers.SerializerMethodField()
    presion_display     = serializers.SerializerMethodField()

    class Meta:
        model  = Emergencia
        fields = [
            'emg_id', 'fecha_ingreso', 'hora_ingreso', 'hora_ingreso_fmt',
            'nivel_triaje', 'nivel_triaje_display',
            'motivo_consulta',
            'estado', 'estado_display',
            'paciente_nombre', 'paciente_expediente',
            'medico_nombre',
            'presion_display',
            'temperatura', 'saturacion_o2', 'frecuencia_cardiaca',
            'activo',
        ]

    def get_paciente_nombre(self, obj) -> str:
        return obj.paciente.get_nombre_completo() if obj.paciente_id else ''

    def get_paciente_expediente(self, obj) -> str:
        return obj.paciente.no_expediente if obj.paciente_id else ''

    def get_medico_nombre(self, obj) -> str:
        return obj.medico.get_short_name() if obj.medico_id else 'Sin asignar'

    def get_hora_ingreso_fmt(self, obj) -> str:
        return obj.hora_ingreso.strftime('%H:%M') if obj.hora_ingreso else ''

    def get_presion_display(self, obj) -> str:
        return obj.get_presion_display()


# ============================================================
# EMERGENCIA — Ficha completa
# ============================================================
class EmergenciaDetailSerializer(EmergenciaListSerializer):
    enfermero_nombre    = serializers.SerializerMethodField()
    tipo_alta_display   = serializers.CharField(source='get_tipo_alta_display', read_only=True)
    hora_alta_fmt       = serializers.SerializerMethodField()

    class Meta(EmergenciaListSerializer.Meta):
        fields = EmergenciaListSerializer.Meta.fields + [
            'hospital_id',
            'enfermero_nombre',
            'presion_sistolica', 'presion_diastolica',
            'frecuencia_resp', 'glucosa', 'peso_kg',
            'diagnostico', 'cie10_codigo',
            'tratamiento', 'notas_medico', 'notas_enfermero',
            'tipo_alta', 'tipo_alta_display',
            'fecha_alta', 'hora_alta', 'hora_alta_fmt', 'destino_alta',
            'created_at', 'updated_at',
        ]

    def get_enfermero_nombre(self, obj) -> str:
        return obj.enfermero.get_short_name() if obj.enfermero_id else 'Sin asignar'

    def get_hora_alta_fmt(self, obj) -> str:
        return obj.hora_alta.strftime('%H:%M') if obj.hora_alta else ''


# ============================================================
# EMERGENCIA — Creación / Edición
# ============================================================
class EmergenciaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Emergencia
        fields = [
            'paciente', 'medico', 'enfermero',
            'fecha_ingreso', 'hora_ingreso', 'motivo_consulta',
            'nivel_triaje',
            'presion_sistolica', 'presion_diastolica',
            'frecuencia_cardiaca', 'frecuencia_resp',
            'temperatura', 'saturacion_o2', 'glucosa', 'peso_kg',
            'notas_enfermero',
        ]

    def validate_fecha_ingreso(self, value):
        if value > date.today():
            raise serializers.ValidationError(
                'La fecha de ingreso no puede ser futura.'
            )
        return value

    def validate(self, attrs):
        # Validar saturación O2 (0–100%)
        sat = attrs.get('saturacion_o2')
        if sat is not None and not (0 <= sat <= 100):
            raise serializers.ValidationError({
                'saturacion_o2': 'La saturación de O2 debe estar entre 0 y 100.'
            })
        # Validar temperatura (rango fisiológico)
        temp = attrs.get('temperatura')
        if temp is not None and not (25 <= float(temp) <= 45):
            raise serializers.ValidationError({
                'temperatura': 'La temperatura debe estar entre 25°C y 45°C.'
            })
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        return Emergencia.objects.create(
            hospital_id=request.user.hospital_id,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


# ============================================================
# Serializer de acción: iniciar atención (asignar médico)
# ============================================================
class EmergenciaAtenderSerializer(serializers.Serializer):
    medico_id = serializers.IntegerField(
        required=True,
        error_messages={'required': 'Debe asignar un médico para iniciar la atención.'},
    )

    def validate_medico_id(self, value):
        from apps.security.models import Usuario
        try:
            Usuario.objects.get(pk=value, activo=True)
        except Usuario.DoesNotExist:
            raise serializers.ValidationError('El médico indicado no existe o no está activo.')
        return value


# ============================================================
# Serializer de acción: dar de alta
# ============================================================
class EmergenciaAltaSerializer(serializers.Serializer):
    tipo_alta    = serializers.ChoiceField(
        choices=[c[0] for c in Emergencia._meta.get_field('tipo_alta').choices],
        required=True,
        error_messages={'required': 'Debe indicar el tipo de alta.'},
    )
    diagnostico  = serializers.CharField(max_length=500, required=True)
    cie10_codigo = serializers.CharField(max_length=10, required=False, allow_blank=True, default='')
    tratamiento  = serializers.CharField(required=False, allow_blank=True, default='')
    notas_medico = serializers.CharField(required=False, allow_blank=True, default='')
    destino_alta = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')

    def validate_diagnostico(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError('El diagnóstico debe tener al menos 5 caracteres.')
        return value.strip()


# ============================================================
# Serializer de acción: observación (con notas)
# ============================================================
class EmergenciaObservacionSerializer(serializers.Serializer):
    notas_medico = serializers.CharField(required=False, allow_blank=True, default='')
