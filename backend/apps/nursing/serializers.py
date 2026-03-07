"""
HealthTech Solutions — Serializers: Módulo Enfermería (M10)
"""

from rest_framework import serializers
from .models import SignoVital, NotaEnfermeria


# ============================================================
# SIGNOS VITALES
# ============================================================

class SignoVitalListSerializer(serializers.ModelSerializer):
    enfermera    = serializers.SerializerMethodField()
    presion_arterial = serializers.CharField(read_only=True)
    imc          = serializers.FloatField(read_only=True)

    class Meta:
        model  = SignoVital
        fields = [
            'sig_id', 'paciente', 'encamamiento',
            'temperatura', 'presion_sistolica', 'presion_diastolica',
            'presion_arterial', 'frecuencia_cardiaca', 'frecuencia_respiratoria',
            'saturacion_o2', 'glucemia', 'peso', 'talla', 'imc',
            'glasgow', 'observaciones',
            'enfermera', 'created_at',
        ]

    def get_enfermera(self, obj):
        u = obj.created_by
        if not u:
            return 'Sistema'
        return f'{u.primer_nombre} {u.primer_apellido}'.strip() or u.username


class SignoVitalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SignoVital
        fields = [
            'paciente', 'encamamiento',
            'temperatura', 'presion_sistolica', 'presion_diastolica',
            'frecuencia_cardiaca', 'frecuencia_respiratoria',
            'saturacion_o2', 'glucemia', 'peso', 'talla', 'glasgow',
            'observaciones',
        ]

    def validate_temperatura(self, value):
        if value is not None and not (25 <= float(value) <= 45):
            raise serializers.ValidationError('Temperatura inválida (rango 25-45 °C).')
        return value

    def validate_saturacion_o2(self, value):
        if value is not None and not (0 <= float(value) <= 100):
            raise serializers.ValidationError('Saturación O2 debe estar entre 0 y 100%.')
        return value

    def validate_glasgow(self, value):
        if value is not None and not (3 <= value <= 15):
            raise serializers.ValidationError('Glasgow debe estar entre 3 y 15.')
        return value

    def validate(self, data):
        # Al menos un signo vital debe estar presente
        campos_vitales = [
            'temperatura', 'presion_sistolica', 'presion_diastolica',
            'frecuencia_cardiaca', 'frecuencia_respiratoria',
            'saturacion_o2', 'glucemia', 'peso', 'talla', 'glasgow',
        ]
        if not any(data.get(c) is not None for c in campos_vitales):
            raise serializers.ValidationError(
                'Debe registrar al menos un signo vital.'
            )
        return data

    def create(self, validated_data):
        user = self.context['request'].user
        return SignoVital.objects.create(
            **validated_data,
            hospital_id   = user.hospital_id,
            created_by_id = user.pk,
        )


# ============================================================
# NOTAS DE ENFERMERÍA
# ============================================================

class NotaEnfermeriaListSerializer(serializers.ModelSerializer):
    tipo_nota_display = serializers.CharField(source='get_tipo_nota_display', read_only=True)
    enfermera         = serializers.SerializerMethodField()

    class Meta:
        model  = NotaEnfermeria
        fields = [
            'nota_id', 'paciente', 'encamamiento',
            'tipo_nota', 'tipo_nota_display',
            'contenido', 'es_urgente',
            'enfermera', 'created_at',
        ]

    def get_enfermera(self, obj):
        u = obj.created_by
        if not u:
            return 'Sistema'
        return f'{u.primer_nombre} {u.primer_apellido}'.strip() or u.username


class NotaEnfermeriaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NotaEnfermeria
        fields = [
            'paciente', 'encamamiento',
            'tipo_nota', 'contenido', 'es_urgente',
        ]

    def validate_contenido(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                'La nota debe tener al menos 10 caracteres.'
            )
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        return NotaEnfermeria.objects.create(
            **validated_data,
            hospital_id   = user.hospital_id,
            created_by_id = user.pk,
        )
