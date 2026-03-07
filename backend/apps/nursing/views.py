"""
HealthTech Solutions — Views: Módulo Enfermería (M10)
"""

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly

from .models import SignoVital, NotaEnfermeria
from .serializers import (
    SignoVitalListSerializer, SignoVitalCreateSerializer,
    NotaEnfermeriaListSerializer, NotaEnfermeriaCreateSerializer,
)


class SignoVitalViewSet(viewsets.ModelViewSet):
    """
    Registro de signos vitales por enfermería.
    Endpoint: /api/v1/nursing/signos-vitales/
    Append-only: no se permite PUT/PATCH/DELETE.
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = ['paciente__primer_apellido', 'paciente__primer_nombre',
                          'paciente__no_expediente', 'observaciones']
    filterset_fields   = ['paciente', 'encamamiento']
    ordering_fields    = ['created_at']
    ordering           = ['-created_at']
    http_method_names  = ['get', 'post', 'head', 'options']  # Append-only

    def get_queryset(self):
        user = self.request.user
        qs   = SignoVital.objects.select_related('paciente', 'created_by')
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return SignoVitalCreateSerializer
        return SignoVitalListSerializer

    def create(self, request, *args, **kwargs):
        ser = SignoVitalCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        signo = ser.save()
        return Response(
            SignoVitalListSerializer(signo).data,
            status=status.HTTP_201_CREATED,
        )


class NotaEnfermeriaViewSet(viewsets.ModelViewSet):
    """
    Notas clínicas de enfermería.
    Endpoint: /api/v1/nursing/notas/
    Append-only: no se permite PUT/PATCH/DELETE.
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = ['contenido', 'paciente__primer_apellido',
                          'paciente__primer_nombre', 'paciente__no_expediente']
    filterset_fields   = ['paciente', 'encamamiento', 'tipo_nota', 'es_urgente']
    ordering_fields    = ['created_at', 'tipo_nota']
    ordering           = ['-created_at']
    http_method_names  = ['get', 'post', 'head', 'options']  # Append-only

    def get_queryset(self):
        user = self.request.user
        qs   = NotaEnfermeria.objects.select_related('paciente', 'created_by')
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return NotaEnfermeriaCreateSerializer
        return NotaEnfermeriaListSerializer

    def create(self, request, *args, **kwargs):
        ser = NotaEnfermeriaCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        nota = ser.save()
        return Response(
            NotaEnfermeriaListSerializer(nota).data,
            status=status.HTTP_201_CREATED,
        )
