"""
HealthTech Solutions — Serializers: PACS Module
Data-minimization: ListSerializer devuelve solo campos para listas.
DetailSerializer devuelve ficha completa.
"""

from rest_framework import serializers
from .models import EstudioImagen


class EstudioListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listas — data-minimization HIPAA."""
    paciente_nombre    = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    medico_nombre      = serializers.SerializerMethodField()
    modalidad_display  = serializers.CharField(source='get_modalidad_display',  read_only=True)
    estado_display     = serializers.CharField(source='get_estado_display',     read_only=True)
    prioridad_display  = serializers.CharField(source='get_prioridad_display',  read_only=True)
    region_display     = serializers.CharField(source='get_region_anatomica_display', read_only=True)

    class Meta:
        model  = EstudioImagen
        fields = [
            'est_id', 'modalidad', 'modalidad_display',
            'region_anatomica', 'region_display',
            'descripcion_clinica', 'estado', 'estado_display',
            'prioridad', 'prioridad_display',
            'fecha_solicitud', 'fecha_realizacion', 'fecha_informe',
            'num_imagenes', 'tiene_imagenes', 'tiene_informe',
            'paciente_nombre', 'paciente_expediente', 'medico_nombre',
        ]

    def get_paciente_nombre(self, obj):
        p = obj.paciente
        return f'{p.primer_nombre} {p.primer_apellido}' if p else None

    def get_paciente_expediente(self, obj):
        return obj.paciente.no_expediente if obj.paciente else None

    def get_medico_nombre(self, obj):
        m = obj.medico_sol
        return f'Dr. {m.primer_nombre} {m.primer_apellido}' if m else None


class EstudioDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para la vista de detalle."""
    paciente_nombre     = serializers.SerializerMethodField()
    paciente_expediente  = serializers.SerializerMethodField()
    medico_nombre        = serializers.SerializerMethodField()
    tecnico_nombre       = serializers.SerializerMethodField()
    radiologo_nombre     = serializers.SerializerMethodField()
    modalidad_display    = serializers.CharField(source='get_modalidad_display',       read_only=True)
    estado_display       = serializers.CharField(source='get_estado_display',          read_only=True)
    prioridad_display    = serializers.CharField(source='get_prioridad_display',       read_only=True)
    region_display       = serializers.CharField(source='get_region_anatomica_display', read_only=True)

    class Meta:
        model  = EstudioImagen
        fields = [
            'est_id', 'hospital_id',
            'modalidad', 'modalidad_display',
            'region_anatomica', 'region_display',
            'descripcion_clinica', 'estado', 'estado_display',
            'prioridad', 'prioridad_display',
            'fecha_solicitud', 'fecha_realizacion', 'fecha_informe',
            'num_imagenes', 'tiene_imagenes', 'tiene_informe', 'informe',
            's3_bucket', 's3_prefix',
            'motivo_cancelacion',
            'paciente_nombre', 'paciente_expediente',
            'medico_nombre', 'tecnico_nombre', 'radiologo_nombre',
            'created_at', 'updated_at',
        ]

    def get_paciente_nombre(self, obj):
        p = obj.paciente
        return f'{p.primer_nombre} {p.primer_apellido}' if p else None

    def get_paciente_expediente(self, obj):
        return obj.paciente.no_expediente if obj.paciente else None

    def get_medico_nombre(self, obj):
        m = obj.medico_sol
        return f'Dr. {m.primer_nombre} {m.primer_apellido}' if m else None

    def get_tecnico_nombre(self, obj):
        t = obj.tecnico
        return f'{t.primer_nombre} {t.primer_apellido}' if t else None

    def get_radiologo_nombre(self, obj):
        r = obj.radiologo
        return f'Dr. {r.primer_nombre} {r.primer_apellido}' if r else None


class EstudioCreateSerializer(serializers.ModelSerializer):
    """Serializer para creación y edición de estudios."""

    class Meta:
        model  = EstudioImagen
        fields = [
            'paciente', 'medico_sol', 'tecnico', 'radiologo',
            'encamamiento', 'emergencia', 'cita',
            'modalidad', 'region_anatomica', 'descripcion_clinica',
            'prioridad', 'fecha_solicitud',
        ]

    def validate_fecha_solicitud(self, value):
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError('La fecha de solicitud no puede ser en el pasado.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        validated_data['hospital_id'] = user.hospital_id
        validated_data['created_by_id'] = user.pk
        validated_data['updated_by_id'] = user.pk
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context['request']
        validated_data['updated_by_id'] = request.user.pk
        return super().update(instance, validated_data)


class EstudioInformeSerializer(serializers.ModelSerializer):
    """Serializer para cargar el informe radiológico."""

    class Meta:
        model  = EstudioImagen
        fields = ['informe', 'fecha_informe', 'radiologo']

    def update(self, instance, validated_data):
        from datetime import date
        validated_data['estado'] = 'COMPLETADO'
        validated_data['fecha_informe'] = validated_data.get('fecha_informe', date.today())
        validated_data['updated_by_id'] = self.context['request'].user.pk
        return super().update(instance, validated_data)
