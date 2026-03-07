"""
HealthTech Solutions — Serializers: Módulo Citas (M03)
HIPAA: data_minimization activo.
  - CitaListSerializer:   sin notas clínicas completas
  - CitaDetailSerializer: ficha completa (solo con JWT válido + permisos)
  - CitaCreateSerializer: validación de horario y conflictos
"""

from datetime import date, datetime
from rest_framework import serializers

from apps.appointments.models import (
    Cita, ESTADOS_CANCELABLES, ESTADOS_CONFIRMABLES, ESTADOS_COMPLETABLES,
)


# ============================================================
# CITA — Listado (data-minimization HIPAA)
# Expone solo los campos necesarios para tablas/agendas.
# Sin: notas_medico completas, datos PHI del paciente.
# ============================================================
class CitaListSerializer(serializers.ModelSerializer):
    paciente_nombre     = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    medico_nombre       = serializers.SerializerMethodField()
    tipo_cita_display   = serializers.CharField(source='get_tipo_cita_display',  read_only=True)
    estado_display      = serializers.CharField(source='get_estado_display',     read_only=True)
    prioridad_display   = serializers.CharField(source='get_prioridad_display',  read_only=True)
    hora_inicio_fmt     = serializers.SerializerMethodField()
    hora_fin_fmt        = serializers.SerializerMethodField()

    class Meta:
        model  = Cita
        fields = [
            'cit_id', 'fecha_cita',
            'hora_inicio', 'hora_inicio_fmt',
            'hora_fin',    'hora_fin_fmt',
            'duracion_min',
            'tipo_cita', 'tipo_cita_display',
            'motivo',
            'estado', 'estado_display',
            'prioridad', 'prioridad_display',
            'sala',
            'paciente_nombre', 'paciente_expediente',
            'medico_nombre',
            'activo',
        ]

    def get_paciente_nombre(self, obj) -> str:
        return obj.paciente.get_nombre_completo() if obj.paciente_id else ''

    def get_paciente_expediente(self, obj) -> str:
        return obj.paciente.no_expediente if obj.paciente_id else ''

    def get_medico_nombre(self, obj) -> str:
        return obj.medico.get_short_name() if obj.medico_id else ''

    def get_hora_inicio_fmt(self, obj) -> str:
        return obj.hora_inicio.strftime('%H:%M') if obj.hora_inicio else ''

    def get_hora_fin_fmt(self, obj) -> str:
        return obj.hora_fin.strftime('%H:%M') if obj.hora_fin else ''


# ============================================================
# CITA — Ficha completa
# ============================================================
class CitaDetailSerializer(CitaListSerializer):
    cancelada_por_nombre = serializers.SerializerMethodField()

    class Meta(CitaListSerializer.Meta):
        fields = CitaListSerializer.Meta.fields + [
            'hospital_id',
            'notas_medico', 'notas_admin',
            'motivo_cancelacion',
            'cancelada_por_nombre', 'cancelada_en',
            'created_at', 'updated_at',
        ]

    def get_cancelada_por_nombre(self, obj) -> str | None:
        return obj.cancelada_por.get_short_name() if obj.cancelada_por_id else None


# ============================================================
# CITA — Creación / Edición
# ============================================================
class CitaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Cita
        fields = [
            'paciente', 'medico',
            'fecha_cita', 'hora_inicio', 'hora_fin', 'duracion_min',
            'tipo_cita', 'motivo', 'prioridad', 'sala', 'notas_admin',
        ]

    def validate_fecha_cita(self, value):
        """No permite programar citas en fechas pasadas."""
        if value < date.today():
            raise serializers.ValidationError(
                'No se puede programar una cita en una fecha pasada.'
            )
        return value

    def validate(self, attrs):
        hora_inicio = attrs.get('hora_inicio')
        hora_fin    = attrs.get('hora_fin')
        fecha_cita  = attrs.get('fecha_cita')
        medico      = attrs.get('medico')
        hospital_id = self.context['request'].user.hospital_id

        # Validar que hora_fin > hora_inicio
        if hora_inicio and hora_fin and hora_fin <= hora_inicio:
            raise serializers.ValidationError({
                'hora_fin': 'La hora de fin debe ser posterior a la hora de inicio.'
            })

        # Calcular duración si no se envía
        if hora_inicio and hora_fin and 'duracion_min' not in attrs:
            dt_inicio = datetime.combine(date.today(), hora_inicio)
            dt_fin    = datetime.combine(date.today(), hora_fin)
            attrs['duracion_min'] = int((dt_fin - dt_inicio).seconds / 60)

        # Verificar conflicto de horario del médico (doble-booking)
        if medico and fecha_cita and hora_inicio:
            qs = Cita.objects.filter(
                hospital_id=hospital_id,
                medico=medico,
                fecha_cita=fecha_cita,
                hora_inicio=hora_inicio,
                activo=True,
            )
            # En edición, excluir la cita actual
            instance = self.instance
            if instance:
                qs = qs.exclude(pk=instance.pk)

            if qs.exists():
                raise serializers.ValidationError({
                    'hora_inicio': (
                        f'El médico ya tiene una cita programada el '
                        f'{fecha_cita} a las {hora_inicio.strftime("%H:%M")}.'
                    )
                })

        return attrs

    def create(self, validated_data):
        request = self.context['request']
        return Cita.objects.create(
            hospital_id=request.user.hospital_id,
            created_by=request.user,
            updated_by=request.user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


# ============================================================
# Serializer de acción: cancelar cita
# ============================================================
class CitaCancelarSerializer(serializers.Serializer):
    motivo_cancelacion = serializers.CharField(
        max_length=500,
        required=True,
        error_messages={'required': 'Debe indicar el motivo de cancelación.'},
    )

    def validate_motivo_cancelacion(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                'El motivo de cancelación debe tener al menos 5 caracteres.'
            )
        return value.strip()


# ============================================================
# Serializer de acción: completar cita
# ============================================================
class CitaCompletarSerializer(serializers.Serializer):
    notas_medico = serializers.CharField(required=False, allow_blank=True, default='')
