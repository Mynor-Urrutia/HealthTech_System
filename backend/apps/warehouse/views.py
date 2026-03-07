"""
HealthTech Solutions — Views: Módulo Bodega (M09)
"""

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly

from .models import Producto, Movimiento
from .serializers import (
    ProductoListSerializer, ProductoDetailSerializer, ProductoCreateSerializer,
    MovimientoListSerializer, MovimientoCreateSerializer,
)


class ProductoViewSet(viewsets.ModelViewSet):
    """
    CRUD del catálogo de productos del almacén.
    Endpoint: /api/v1/warehouse/productos/
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = ['nombre', 'codigo', 'descripcion', 'proveedor']
    filterset_fields   = ['categoria', 'activo']
    ordering_fields    = ['nombre', 'stock_actual', 'categoria', 'created_at']
    ordering           = ['nombre']

    def get_queryset(self):
        user = self.request.user
        qs   = Producto.objects.filter(activo=True)
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductoDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ProductoCreateSerializer
        return ProductoListSerializer

    def perform_destroy(self, instance):
        instance.activo        = False
        instance.updated_by_id = self.request.user.pk
        instance.save()


class MovimientoViewSet(viewsets.ModelViewSet):
    """
    Registro de movimientos de inventario.
    Endpoint: /api/v1/warehouse/movimientos/
    POST crea el movimiento y actualiza stock atomicamente.
    GET lista movimientos (filtrable por producto).
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = ['producto__nombre', 'producto__codigo', 'motivo', 'referencia', 'departamento']
    filterset_fields   = ['tipo_movimiento', 'producto']
    ordering_fields    = ['created_at', 'tipo_movimiento']
    ordering           = ['-created_at']
    http_method_names  = ['get', 'post', 'head', 'options']  # Sin update/delete (log inmutable)

    def get_queryset(self):
        user = self.request.user
        qs   = Movimiento.objects.select_related('producto', 'created_by')
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return MovimientoCreateSerializer
        return MovimientoListSerializer

    def create(self, request, *args, **kwargs):
        ser = MovimientoCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        movimiento = ser.save()
        # Devolver el movimiento creado con formato de lista (incluye stocks)
        return Response(
            MovimientoListSerializer(movimiento).data,
            status=status.HTTP_201_CREATED,
        )
