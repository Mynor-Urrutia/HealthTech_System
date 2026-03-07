"""
HealthTech Solutions — Serializers: Módulo Encamamiento (M05)
HIPAA: data_minimization activo.
  - CamaSerializer:              ficha de cama (estado, tipo, ubicación)
  - EncamamientoListSerializer:  listado sin notas clínicas
  - EncamamientoDetailSerializer: ficha completa
  - EncamamientoCreateSerializer: validación (cama disponible, fecha)
  - EncamamientoEgresoSerializer: tipo_egreso + diagnóstico de egreso
  - EncamamientoEvolucionSerializer: actualizar notas de evolución
"""

from datetime import date
from rest_framework import serializers

from apps.hospitalization.models import (
    Cama, Encamamiento,
    ESTADOS_ACTIVOS_ENC, ESTADOS_EGRESABLES,
)


# ============================================================
# CAMA
# ============================================================
class CamaSerializer(serializers.ModelSerializer):
    tipo_cama_display  = serializers.CharField(source='get_tipo_cama_display',  read_only=True)
    estado_display     = serializers.CharField(source='get_estado_display',     read_only=True)

    class Meta:
        model  = Cama
        fields = [
            'cama_id', 'hospital_id',
            'numero_cama', 'piso', 'sala',
            'tipo_cama', 'tipo_cama_display',
            'estado', 'estado_display',
            'tiene_oxigeno', 'tiene_monitor', 'tiene_ventilador',
            'observaciones', 'activo',
        ]
        read_only_fields = ['hospital_id']

    def create(self, validated_data):
        request = self.context['request']
        return Cama.objects.create(
            hospital_id=request.user.hospital_id,
            **validated_data,
        )

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


# ============================================================
# ENCAMAMIENTO — Listado (data-minimization HIPAA)
# ============================================================
class EncamamientoListSerializer(serializers.ModelSerializer):
    paciente_nombre     = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    medico_nombre       = serializers.SerializerMethodField()
    cama_info           = serializers.SerializerMethodField()
    estado_display      = serializers.CharField(source='get_estado_display', read_only=True)
    hora_ingreso_fmt    = serializers.SerializerMethodField()
    dias_estancia_calc  = serializers.SerializerMethodField()

    class Meta:
        model  = Encamamiento
        fields = [
            'enc_id', 'paciente', 'fecha_ingreso', 'hora_ingreso', 'hora_ingreso_fmt',
            'motivo_ingreso', 'estado', 'estado_display',
            'paciente_nombre', 'paciente_expediente',
            'medico_nombre', 'cama_info',
            'dias_estancia_calc', 'activo',
        ]

    def get_paciente_nombre(self, obj) -> str:
        return obj.paciente.get_nombre_completo() if obj.paciente_id else ''

    def get_paciente_expediente(self, obj) -> str:
        return obj.paciente.no_expediente if obj.paciente_id else ''

    def get_medico_nombre(self, obj) -> str:
        return obj.medico.get_short_name() if obj.medico_id else ''

    def get_cama_info(self, obj) -> dict:
        if not obj.cama_id:
            return {}
        return {
            'numero': obj.cama.numero_cama,
            'sala':   obj.cama.sala,
            'piso':   obj.cama.piso,
            'tipo':   obj.cama.get_tipo_cama_display(),
        }

    def get_hora_ingreso_fmt(self, obj) -> str:
        return obj.hora_ingreso.strftime('%H:%M') if obj.hora_ingreso else ''

    def get_dias_estancia_calc(self, obj) -> int:
        return obj.calcular_dias_estancia()


# ============================================================
# ENCAMAMIENTO — Ficha completa
# ============================================================
class EncamamientoDetailSerializer(EncamamientoListSerializer):
    enfermero_nombre   = serializers.SerializerMethodField()
    tipo_egreso_display = serializers.CharField(source='get_tipo_egreso_display', read_only=True)
    hora_egreso_fmt    = serializers.SerializerMethodField()

    class Meta(EncamamientoListSerializer.Meta):
        fields = EncamamientoListSerializer.Meta.fields + [
            'hospital_id',
            'enfermero_nombre',
            'diagnostico_ingreso', 'cie10_ingreso',
            'notas_ingreso', 'evolucion', 'indicaciones',
            'tipo_egreso', 'tipo_egreso_display',
            'fecha_egreso', 'hora_egreso', 'hora_egreso_fmt',
            'diagnostico_egreso', 'cie10_egreso', 'destino_egreso',
            'dias_estancia',
            'created_at', 'updated_at',
        ]

    def get_enfermero_nombre(self, obj) -> str:
        return obj.enfermero.get_short_name() if obj.enfermero_id else 'Sin asignar'

    def get_hora_egreso_fmt(self, obj) -> str:
        return obj.hora_egreso.strftime('%H:%M') if obj.hora_egreso else ''


# ============================================================
# ENCAMAMIENTO — Creación
# ============================================================
class EncamamientoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Encamamiento
        fields = [
            'paciente', 'cama', 'medico', 'enfermero',
            'emergencia', 'cita',
            'fecha_ingreso', 'hora_ingreso',
            'motivo_ingreso', 'diagnostico_ingreso', 'cie10_ingreso',
            'notas_ingreso', 'indicaciones',
        ]

    def validate_cama(self, cama):
        """La cama debe estar DISPONIBLE o RESERVADA."""
        if cama.estado not in ('DISPONIBLE', 'RESERVADA'):
            raise serializers.ValidationError(
                f'La cama {cama.numero_cama} no está disponible (estado: {cama.get_estado_display()}).'
            )
        return cama

    def validate_fecha_ingreso(self, value):
        if value > date.today():
            raise serializers.ValidationError('La fecha de ingreso no puede ser futura.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        cama    = validated_data['cama']

        enc = Encamamiento.objects.create(
            hospital_id=request.user.hospital_id,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )
        # Marcar cama como OCUPADA
        cama.estado = 'OCUPADA'
        cama.save(update_fields=['estado', 'updated_at'])
        return enc

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


# ============================================================
# Serializer de acción: egreso
# ============================================================
class EncamamientoEgresoSerializer(serializers.Serializer):
    tipo_egreso        = serializers.ChoiceField(
        choices=[c[0] for c in Encamamiento._meta.get_field('tipo_egreso').choices
                 if c[0]],
        required=True,
    )
    diagnostico_egreso = serializers.CharField(max_length=500, required=True)
    cie10_egreso       = serializers.CharField(max_length=10,  required=False, allow_blank=True, default='')
    destino_egreso     = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    notas_medico       = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_diagnostico_egreso(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError('El diagnóstico debe tener al menos 5 caracteres.')
        return value.strip()


# ============================================================
# Serializer de acción: actualizar evolución/indicaciones
# ============================================================
class EncamamientoEvolucionSerializer(serializers.Serializer):
    evolucion    = serializers.CharField(required=False, allow_blank=True, default='')
    indicaciones = serializers.CharField(required=False, allow_blank=True, default='')
