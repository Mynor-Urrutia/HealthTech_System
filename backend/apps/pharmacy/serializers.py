"""
HealthTech Solutions — Serializers: Módulo Farmacia (M08)
HIPAA data-minimization: List < Detail < Create
"""

from rest_framework import serializers
from .models import Medicamento, Dispensacion


# ============================================================
# MEDICAMENTO — Catálogo
# ============================================================

class MedicamentoListSerializer(serializers.ModelSerializer):
    """Lista compacta del catálogo (data-minimization)."""
    forma_farma_display = serializers.CharField(source='get_forma_farma_display', read_only=True)
    categoria_display   = serializers.CharField(source='get_categoria_display',   read_only=True)
    stock_bajo          = serializers.SerializerMethodField()

    class Meta:
        model  = Medicamento
        fields = [
            'med_id', 'nombre_generico', 'nombre_comercial', 'concentracion',
            'forma_farma', 'forma_farma_display', 'categoria', 'categoria_display',
            'unidad_medida', 'stock_actual', 'stock_minimo', 'requiere_receta',
            'stock_bajo', 'activo',
        ]

    def get_stock_bajo(self, obj):
        return obj.stock_actual <= obj.stock_minimo


class MedicamentoDetailSerializer(MedicamentoListSerializer):
    """Ficha completa del medicamento."""
    class Meta(MedicamentoListSerializer.Meta):
        fields = MedicamentoListSerializer.Meta.fields + [
            'principio_activo', 'precio_unitario',
            'hospital_id', 'created_at', 'updated_at',
        ]


class MedicamentoCreateSerializer(serializers.ModelSerializer):
    """Creación y edición de medicamentos."""

    class Meta:
        model  = Medicamento
        fields = [
            'nombre_generico', 'nombre_comercial', 'principio_activo',
            'concentracion', 'forma_farma', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'precio_unitario', 'requiere_receta',
        ]

    def validate_stock_actual(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value

    def validate_stock_minimo(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock mínimo no puede ser negativo.")
        return value

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        return Medicamento.objects.create(
            **validated_data,
            hospital_id    = user.hospital_id,
            created_by_id  = user.pk,
            updated_by_id  = user.pk,
        )

    def update(self, instance, validated_data):
        request = self.context['request']
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.updated_by_id = request.user.pk
        instance.save()
        return instance


class MedicamentoReponerSerializer(serializers.Serializer):
    """Reposición de stock (acción /reponer/)."""
    cantidad = serializers.IntegerField(min_value=1)
    notas    = serializers.CharField(max_length=500, required=False, allow_blank=True)


# ============================================================
# DISPENSACION
# ============================================================

class DispensacionListSerializer(serializers.ModelSerializer):
    """Lista compacta de dispensaciones (data-minimization)."""
    estado_display    = serializers.CharField(source='get_estado_display',    read_only=True)
    via_admin_display = serializers.CharField(source='get_via_admin_display', read_only=True)
    paciente_nombre   = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    medicamento_nombre  = serializers.SerializerMethodField()
    medicamento_concentracion = serializers.SerializerMethodField()
    medicamento_forma  = serializers.SerializerMethodField()

    class Meta:
        model  = Dispensacion
        fields = [
            'dis_id', 'estado', 'estado_display',
            'paciente_nombre', 'paciente_expediente',
            'medicamento_nombre', 'medicamento_concentracion', 'medicamento_forma',
            'cantidad', 'via_admin', 'via_admin_display',
            'fecha_prescripcion', 'activo',
        ]

    def get_paciente_nombre(self, obj):
        p = obj.paciente
        return f"{p.primer_nombre} {p.primer_apellido}".strip() if p else ''

    def get_paciente_expediente(self, obj):
        return obj.paciente.no_expediente if obj.paciente else ''

    def get_medicamento_nombre(self, obj):
        return obj.medicamento.nombre_generico if obj.medicamento else ''

    def get_medicamento_concentracion(self, obj):
        return obj.medicamento.concentracion if obj.medicamento else ''

    def get_medicamento_forma(self, obj):
        return obj.medicamento.get_forma_farma_display() if obj.medicamento else ''


class DispensacionDetailSerializer(DispensacionListSerializer):
    """Ficha completa de dispensación."""
    medico_nombre      = serializers.SerializerMethodField()
    dispensado_por_nombre = serializers.SerializerMethodField()
    medicamento_categoria = serializers.SerializerMethodField()
    medicamento_unidad = serializers.SerializerMethodField()
    hora_dispensacion_fmt = serializers.SerializerMethodField()

    class Meta(DispensacionListSerializer.Meta):
        fields = DispensacionListSerializer.Meta.fields + [
            'dosis', 'frecuencia', 'duracion_dias', 'indicaciones',
            'medico_nombre', 'dispensado_por_nombre',
            'medicamento_categoria', 'medicamento_unidad',
            'fecha_dispensacion', 'hora_dispensacion', 'hora_dispensacion_fmt',
            'notas_farmacia', 'motivo_cancelacion',
            'hospital_id', 'created_at', 'updated_at',
        ]

    def _nombre_usuario(self, u):
        if not u:
            return 'No asignado'
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username

    def get_medico_nombre(self, obj):
        return self._nombre_usuario(obj.medico_prescribe)

    def get_dispensado_por_nombre(self, obj):
        return self._nombre_usuario(obj.dispensado_por)

    def get_medicamento_categoria(self, obj):
        return obj.medicamento.get_categoria_display() if obj.medicamento else ''

    def get_medicamento_unidad(self, obj):
        return obj.medicamento.unidad_medida if obj.medicamento else ''

    def get_hora_dispensacion_fmt(self, obj):
        if obj.hora_dispensacion:
            return obj.hora_dispensacion.strftime('%H:%M')
        return ''


class DispensacionCreateSerializer(serializers.ModelSerializer):
    """Crear una nueva dispensación (estado inicial: PENDIENTE)."""

    class Meta:
        model  = Dispensacion
        fields = [
            'medicamento', 'paciente', 'medico_prescribe',
            'cantidad', 'dosis', 'frecuencia', 'duracion_dias',
            'via_admin', 'indicaciones', 'fecha_prescripcion',
            'emergencia', 'encamamiento', 'cita',
        ]

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor que cero.")
        return value

    def validate(self, data):
        med = data.get('medicamento')
        cantidad = data.get('cantidad', 0)
        if med and med.stock_actual < cantidad:
            raise serializers.ValidationError(
                f"Stock insuficiente. Disponible: {med.stock_actual} {med.unidad_medida}."
            )
        return data

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        return Dispensacion.objects.create(
            **validated_data,
            hospital_id   = user.hospital_id,
            estado        = 'PENDIENTE',
            created_by_id = user.pk,
            updated_by_id = user.pk,
        )


class DispensacionDispensarSerializer(serializers.Serializer):
    """Dispensar medicamento (PENDIENTE → DISPENSADA)."""
    notas_farmacia = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class DispensacionCancelarSerializer(serializers.Serializer):
    """Cancelar dispensación pendiente."""
    motivo_cancelacion = serializers.CharField(min_length=5, max_length=500)
