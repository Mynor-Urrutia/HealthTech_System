"""
HealthTech Solutions — Views: Módulo Citas (M03)
HIPAA: Auditoría PHI_ACCESS en TODOS los accesos a citas.
VPD:   En DEV se filtra manualmente por hospital_id del usuario autenticado.
       En PROD Oracle VPD aplica el filtro a nivel de sesión de BD.

Máquina de estados de la cita:
  PROGRAMADA  → confirmar()  → CONFIRMADA
  CONFIRMADA  → completar()  → COMPLETADA
  PROGRAMADA|CONFIRMADA|EN_PROGRESO → cancelar() → CANCELADA
"""

import logging
from datetime import date, timezone as dt_timezone

from django.conf import settings
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly
from apps.appointments.models import (
    Cita,
    ESTADOS_CANCELABLES, ESTADOS_CONFIRMABLES, ESTADOS_COMPLETABLES,
)
from apps.appointments.serializers import (
    CitaListSerializer, CitaDetailSerializer, CitaCreateSerializer,
    CitaCancelarSerializer, CitaCompletarSerializer,
)
from apps.security.models import AuditoriaAcceso

logger = logging.getLogger('healthtech.audit')


# ============================================================
# Helpers internos
# ============================================================
def _get_ip(request) -> str:
    x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR', '0.0.0.0')


def _audit_phi(request, accion: str, cit_id: str, descripcion: str = '') -> None:
    """Registra evento PHI_ACCESS en SEC_AUDITORIA_ACCESOS. Cumplimiento HIPAA."""
    try:
        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='PHI_ACCESS',
            modulo='appointments',
            accion=accion,
            tabla_afectada='CIT_CITAS',
            registro_id=cit_id,
            ip_origen=_get_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            descripcion=descripcion or f'{accion} cita #{cit_id}',
            exitoso=True,
        )
    except Exception as exc:
        logger.warning('Fallo al registrar auditoría PHI (citas): %s', exc)


# ============================================================
# CITAS ViewSet
# ============================================================
class CitaViewSet(viewsets.ModelViewSet):
    """
    CRUD de citas médicas con aislamiento VPD por hospital.

    GET    /api/v1/appointments/              Lista paginada con filtros
    POST   /api/v1/appointments/              Crear nueva cita
    GET    /api/v1/appointments/{id}/         Ficha completa de la cita
    PUT    /api/v1/appointments/{id}/         Actualizar cita
    PATCH  /api/v1/appointments/{id}/         Actualizar parcial
    DELETE /api/v1/appointments/{id}/         Soft-delete (HIPAA)

    Acciones especiales:
    POST   /api/v1/appointments/{id}/confirmar/   PROGRAMADA → CONFIRMADA
    POST   /api/v1/appointments/{id}/cancelar/    → CANCELADA (requiere motivo)
    POST   /api/v1/appointments/{id}/completar/   → COMPLETADA (notas opcionales)
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['estado', 'tipo_cita', 'prioridad', 'medico']
    search_fields      = [
        'motivo',
        'paciente__primer_apellido', 'paciente__primer_nombre',
        'paciente__no_expediente',
        'medico__primer_apellido',   'medico__primer_nombre',
        'sala',
    ]
    ordering_fields    = ['fecha_cita', 'hora_inicio', 'estado', 'prioridad', 'created_at']
    ordering           = ['fecha_cita', 'hora_inicio']

    def get_queryset(self):
        qs   = Cita.objects.select_related('paciente', 'medico', 'cancelada_por').filter(activo=True)
        user = self.request.user

        # VPD manual en DEV
        if not settings.VPD_ENABLED:
            if getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
                qs = qs.filter(hospital_id=user.hospital_id)

        # Filtro por rango de fechas (query params opcionales)
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            try:
                qs = qs.filter(fecha_cita__gte=fecha_desde)
            except Exception:
                pass
        if fecha_hasta:
            try:
                qs = qs.filter(fecha_cita__lte=fecha_hasta)
            except Exception:
                pass

        # Filtro rápido: solo las de hoy
        solo_hoy = self.request.query_params.get('hoy')
        if solo_hoy and solo_hoy.lower() in ('1', 'true'):
            qs = qs.filter(fecha_cita=date.today())

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CitaDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return CitaCreateSerializer
        return CitaListSerializer

    # ── Override retrieve: auditoría HIPAA ──────────────────
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(
            request, 'view', str(instance.cit_id),
            f'Consulta cita: {instance.paciente} — {instance.fecha_cita}'
        )
        return Response(CitaDetailSerializer(instance, context={'request': request}).data)

    # ── Override create: auditoría HIPAA ────────────────────
    def create(self, request, *args, **kwargs):
        serializer = CitaCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        cita = serializer.save()
        _audit_phi(
            request, 'create', str(cita.cit_id),
            f'Cita creada: {cita.paciente} el {cita.fecha_cita} a las {cita.hora_inicio}'
        )
        return Response(
            CitaDetailSerializer(cita, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Override update: auditoría HIPAA ────────────────────
    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = CitaCreateSerializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        cita = serializer.save()
        _audit_phi(
            request, 'edit', str(cita.cit_id),
            f'Cita actualizada: {cita.paciente} el {cita.fecha_cita}'
        )
        return Response(CitaDetailSerializer(cita, context={'request': request}).data)

    # ── Soft-delete HIPAA ───────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        cita = self.get_object()
        cita.activo    = False
        cita.updated_by = request.user
        cita.save(update_fields=['activo', 'updated_by', 'updated_at'])
        _audit_phi(
            request, 'delete', str(cita.cit_id),
            f'Cita desactivada (soft-delete): #{cita.cit_id}'
        )
        return Response(
            {'detail': f'Cita #{cita.cit_id} desactivada (soft-delete HIPAA).'},
            status=status.HTTP_200_OK,
        )

    # ============================================================
    # Acciones de máquina de estados
    # ============================================================

    @action(detail=True, methods=['post'], url_path='confirmar')
    def confirmar(self, request, pk=None):
        """
        POST /api/v1/appointments/{id}/confirmar/
        Transición: PROGRAMADA → CONFIRMADA
        """
        cita = self.get_object()

        if cita.estado not in ESTADOS_CONFIRMABLES:
            return Response(
                {'detail': f'No se puede confirmar una cita en estado "{cita.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cita.estado     = 'CONFIRMADA'
        cita.updated_by = request.user
        cita.save(update_fields=['estado', 'updated_by', 'updated_at'])

        _audit_phi(
            request, 'edit', str(cita.cit_id),
            f'Cita confirmada: #{cita.cit_id} — {cita.fecha_cita}'
        )
        return Response(
            CitaDetailSerializer(cita, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """
        POST /api/v1/appointments/{id}/cancelar/
        Body: { "motivo_cancelacion": "..." }
        Transición: PROGRAMADA | CONFIRMADA | EN_PROGRESO → CANCELADA
        """
        cita = self.get_object()

        if cita.estado not in ESTADOS_CANCELABLES:
            return Response(
                {'detail': f'No se puede cancelar una cita en estado "{cita.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CitaCancelarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cita.estado             = 'CANCELADA'
        cita.motivo_cancelacion = serializer.validated_data['motivo_cancelacion']
        cita.cancelada_por      = request.user
        cita.cancelada_en       = timezone.now()
        cita.updated_by         = request.user
        cita.save(update_fields=[
            'estado', 'motivo_cancelacion',
            'cancelada_por', 'cancelada_en',
            'updated_by', 'updated_at',
        ])

        _audit_phi(
            request, 'edit', str(cita.cit_id),
            f'Cita cancelada: #{cita.cit_id} — Motivo: {cita.motivo_cancelacion[:100]}'
        )
        return Response(
            CitaDetailSerializer(cita, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='completar')
    def completar(self, request, pk=None):
        """
        POST /api/v1/appointments/{id}/completar/
        Body: { "notas_medico": "..." }  (opcional)
        Transición: CONFIRMADA | EN_PROGRESO → COMPLETADA
        """
        cita = self.get_object()

        if cita.estado not in ESTADOS_COMPLETABLES:
            return Response(
                {'detail': f'No se puede completar una cita en estado "{cita.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CitaCompletarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cita.estado     = 'COMPLETADA'
        cita.updated_by = request.user
        update_fields   = ['estado', 'updated_by', 'updated_at']

        notas = serializer.validated_data.get('notas_medico', '')
        if notas:
            cita.notas_medico = notas
            update_fields.append('notas_medico')

        cita.save(update_fields=update_fields)

        _audit_phi(
            request, 'edit', str(cita.cit_id),
            f'Cita completada: #{cita.cit_id} — {cita.fecha_cita}'
        )
        return Response(
            CitaDetailSerializer(cita, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )
