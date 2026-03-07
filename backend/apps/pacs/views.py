"""
HealthTech Solutions — Views: PACS Module (Imagen Médica)
Endpoint: /api/v1/imaging/estudios/
"""

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly

from .models import EstudioImagen
from .serializers import (
    EstudioListSerializer,
    EstudioDetailSerializer,
    EstudioCreateSerializer,
    EstudioInformeSerializer,
)


class EstudioImagenViewSet(viewsets.ModelViewSet):
    """
    CRUD de estudios de imagen médica (PACS).
    Endpoint: /api/v1/imaging/estudios/
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = [
        'descripcion_clinica',
        'paciente__primer_apellido', 'paciente__primer_nombre',
        'paciente__no_expediente',
        'medico_sol__primer_apellido',
    ]
    filterset_fields   = ['estado', 'modalidad', 'prioridad', 'fecha_solicitud', 'paciente']
    ordering_fields    = ['fecha_solicitud', 'estado', 'prioridad', 'modalidad']
    ordering           = ['-fecha_solicitud']

    def get_queryset(self):
        user = self.request.user
        qs   = EstudioImagen.objects.select_related(
            'paciente', 'medico_sol', 'tecnico', 'radiologo',
        ).filter(activo=True)
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EstudioDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EstudioCreateSerializer
        return EstudioListSerializer

    def perform_destroy(self, instance):
        """Soft-delete: nunca borrar físicamente datos PHI."""
        instance.activo = False
        instance.updated_by_id = self.request.user.pk
        instance.save(update_fields=['activo', 'updated_by_id', 'updated_at'])

    @action(detail=True, methods=['post'], url_path='iniciar')
    def iniciar(self, request, pk=None):
        """
        POST /api/v1/imaging/estudios/{id}/iniciar/
        SOLICITADO → EN_PROCESO
        """
        estudio = self.get_object()
        if estudio.estado != 'SOLICITADO':
            return Response(
                {'detail': f'No se puede iniciar un estudio en estado {estudio.estado}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        estudio.estado = 'EN_PROCESO'
        estudio.tecnico_id = request.user.pk
        estudio.updated_by_id = request.user.pk
        estudio.save(update_fields=['estado', 'tecnico_id', 'updated_by_id', 'updated_at'])
        return Response(EstudioDetailSerializer(estudio).data)

    @action(detail=True, methods=['post'], url_path='informe')
    def cargar_informe(self, request, pk=None):
        """
        POST /api/v1/imaging/estudios/{id}/informe/
        Carga el informe radiológico → estado COMPLETADO
        Body: {informe, fecha_informe, radiologo}
        """
        estudio = self.get_object()
        if estudio.estado not in ('EN_PROCESO', 'SOLICITADO'):
            return Response(
                {'detail': f'No se puede informar un estudio en estado {estudio.estado}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = EstudioInformeSerializer(
            estudio, data=request.data,
            partial=True, context={'request': request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(EstudioDetailSerializer(estudio).data)

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """
        POST /api/v1/imaging/estudios/{id}/cancelar/
        Body: {motivo_cancelacion}
        """
        estudio = self.get_object()
        if estudio.estado == 'COMPLETADO':
            return Response(
                {'detail': 'No se puede cancelar un estudio ya completado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        motivo = request.data.get('motivo_cancelacion', '').strip()
        if not motivo:
            return Response(
                {'detail': 'El motivo de cancelación es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        estudio.estado = 'CANCELADO'
        estudio.motivo_cancelacion = motivo
        estudio.updated_by_id = request.user.pk
        estudio.save(update_fields=['estado', 'motivo_cancelacion', 'updated_by_id', 'updated_at'])
        return Response(EstudioDetailSerializer(estudio).data)
