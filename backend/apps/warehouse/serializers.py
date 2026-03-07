"""
HealthTech Solutions — Serializers: Módulo Bodega (M09)
"""

from rest_framework import serializers
from .models import Producto, Movimiento, TIPOS_NEGATIVOS


# ============================================================
# PRODUCTO
# ============================================================

class ProductoListSerializer(serializers.ModelSerializer):
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_stock      = serializers.CharField(read_only=True)

    class Meta:
        model  = Producto
        fields = [
            'pro_id', 'codigo', 'nombre', 'categoria', 'categoria_display',
            'unidad_medida', 'stock_actual', 'stock_minimo', 'stock_maximo',
            'ubicacion', 'estado_stock', 'activo',
        ]


class ProductoDetailSerializer(ProductoListSerializer):
    class Meta(ProductoListSerializer.Meta):
        fields = ProductoListSerializer.Meta.fields + [
            'descripcion', 'precio_unitario', 'proveedor',
            'hospital_id', 'created_at', 'updated_at',
        ]


class ProductoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Producto
        fields = [
            'codigo', 'nombre', 'descripcion', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'stock_maximo',
            'precio_unitario', 'proveedor', 'ubicacion',
        ]

    def validate(self, data):
        if data.get('stock_actual', 0) < 0:
            raise serializers.ValidationError({'stock_actual': 'No puede ser negativo.'})
        if data.get('stock_minimo', 0) < 0:
            raise serializers.ValidationError({'stock_minimo': 'No puede ser negativo.'})
        return data

    def create(self, validated_data):
        user = self.context['request'].user
        return Producto.objects.create(
            **validated_data,
            hospital_id   = user.hospital_id,
            created_by_id = user.pk,
            updated_by_id = user.pk,
        )

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.updated_by_id = self.context['request'].user.pk
        instance.save()
        return instance


# ============================================================
# MOVIMIENTO
# ============================================================

class MovimientoListSerializer(serializers.ModelSerializer):
    tipo_display    = serializers.CharField(source='get_tipo_movimiento_display', read_only=True)
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    responsable     = serializers.SerializerMethodField()

    class Meta:
        model  = Movimiento
        fields = [
            'mov_id', 'tipo_movimiento', 'tipo_display',
            'producto', 'producto_nombre', 'producto_codigo',
            'cantidad', 'cantidad_anterior', 'cantidad_posterior',
            'motivo', 'referencia', 'departamento',
            'responsable', 'created_at',
        ]

    def get_responsable(self, obj):
        u = obj.created_by
        if not u:
            return 'Sistema'
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username


class MovimientoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Movimiento
        fields = [
            'producto', 'tipo_movimiento', 'cantidad',
            'motivo', 'referencia', 'departamento', 'proveedor',
        ]

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError('La cantidad debe ser mayor que cero.')
        return value

    def validate(self, data):
        producto = data.get('producto')
        cantidad = data.get('cantidad', 0)
        tipo     = data.get('tipo_movimiento', '')

        if tipo in TIPOS_NEGATIVOS and producto:
            if producto.stock_actual < cantidad:
                raise serializers.ValidationError(
                    f"Stock insuficiente. Disponible: {producto.stock_actual} {producto.unidad_medida}."
                )
        return data

    def create(self, validated_data):
        from django.db.models import F
        user     = self.context['request'].user
        producto = validated_data['producto']
        cantidad = validated_data['cantidad']
        tipo     = validated_data['tipo_movimiento']

        cantidad_anterior = producto.stock_actual

        # Calcular stock posterior
        if tipo in ('ENTRADA', 'AJUSTE_POSITIVO'):
            cantidad_posterior = cantidad_anterior + cantidad
            Producto.objects.filter(pk=producto.pk).update(
                stock_actual=F('stock_actual') + cantidad,
                updated_by_id=user.pk,
            )
        else:  # SALIDA, AJUSTE_NEGATIVO, BAJA
            cantidad_posterior = cantidad_anterior - cantidad
            Producto.objects.filter(pk=producto.pk).update(
                stock_actual=F('stock_actual') - cantidad,
                updated_by_id=user.pk,
            )

        return Movimiento.objects.create(
            **validated_data,
            hospital_id        = user.hospital_id,
            cantidad_anterior  = cantidad_anterior,
            cantidad_posterior = cantidad_posterior,
            created_by_id      = user.pk,
        )
