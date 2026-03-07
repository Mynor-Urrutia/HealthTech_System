"""
HealthTech Solutions — Views: Módulo Emergencias (M04)
HIPAA: Auditoría PHI_ACCESS en TODOS los accesos.
VPD:   En DEV se filtra manualmente por hospital_id del usuario autenticado.
       En PROD Oracle VPD aplica el filtro a nivel de sesión de BD.

Máquina de estados:
  ESPERA       → atender()            → EN_ATENCION
  EN_ATENCION  → observacion()        → OBSERVACION
  EN_ATENCION
  | OBSERVACION → dar_alta()          → ALTA | TRANSFERIDO | FALLECIDO
"""

import logging
from datetime import date, time

from django.conf import settings
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly
from apps.emergency.models import (
    Emergencia,
    ESTADOS_ATENDIBLES, ESTADOS_OBSERVABLES,
    ESTADOS_CON_ALTA, ESTADOS_ACTIVOS,
)
from apps.emergency.serializers import (
    EmergenciaListSerializer, EmergenciaDetailSerializer,
    EmergenciaCreateSerializer, EmergenciaAtenderSerializer,
    EmergenciaAltaSerializer, EmergenciaObservacionSerializer,
)
from apps.security.models import AuditoriaAcceso

logger = logging.getLogger('healthtech.audit')


# ============================================================
# Helpers internos
# ============================================================
def _get_ip(request) -> str:
    x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR', '0.0.0.0')


def _audit_phi(request, accion: str, emg_id: str, descripcion: str = '') -> None:
    """Registra evento PHI_ACCESS en SEC_AUDITORIA_ACCESOS. Cumplimiento HIPAA."""
    try:
        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='PHI_ACCESS',
            modulo='emergency',
            accion=accion,
            tabla_afectada='EMG_EMERGENCIAS',
            registro_id=emg_id,
            ip_origen=_get_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            descripcion=descripcion or f'{accion} emergencia #{emg_id}',
            exitoso=True,
        )
    except Exception as exc:
        logger.warning('Fallo al registrar auditoría PHI (emergency): %s', exc)


# ============================================================
# EMERGENCIAS ViewSet
# ============================================================
class EmergenciaViewSet(viewsets.ModelViewSet):
    """
    CRUD de registros de emergencias con aislamiento VPD por hospital.

    GET    /api/v1/emergency/              Lista paginada con filtros
    POST   /api/v1/emergency/              Crear nueva emergencia (triaje)
    GET    /api/v1/emergency/{id}/         Ficha completa
    PUT    /api/v1/emergency/{id}/         Actualizar
    PATCH  /api/v1/emergency/{id}/         Actualizar parcial
    DELETE /api/v1/emergency/{id}/         Soft-delete (HIPAA)

    Acciones de máquina de estados:
    POST   /api/v1/emergency/{id}/atender/       ESPERA → EN_ATENCION
    POST   /api/v1/emergency/{id}/observacion/   EN_ATENCION → OBSERVACION
    POST   /api/v1/emergency/{id}/alta/          EN_ATENCION|OBSERVACION → ALTA/TRANSFERIDO/FALLECIDO
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['estado', 'nivel_triaje', 'medico']
    search_fields      = [
        'motivo_consulta',
        'diagnostico',
        'paciente__primer_apellido', 'paciente__primer_nombre',
        'paciente__no_expediente',
        'medico__primer_apellido',   'medico__primer_nombre',
    ]
    ordering_fields    = ['fecha_ingreso', 'hora_ingreso', 'nivel_triaje', 'estado', 'created_at']
    ordering           = ['-fecha_ingreso', '-hora_ingreso']

    def get_queryset(self):
        qs   = Emergencia.objects.select_related(
            'paciente', 'medico', 'enfermero'
        ).filter(activo=True)
        user = self.request.user

        # VPD manual en DEV
        if not settings.VPD_ENABLED:
            if getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
                qs = qs.filter(hospital_id=user.hospital_id)

        # Filtro por rango de fechas
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            try:
                qs = qs.filter(fecha_ingreso__gte=fecha_desde)
            except Exception:
                pass
        if fecha_hasta:
            try:
                qs = qs.filter(fecha_ingreso__lte=fecha_hasta)
            except Exception:
                pass

        # Filtro rápido: solo activos (en espera / en atención / observación)
        solo_activos = self.request.query_params.get('activos')
        if solo_activos and solo_activos.lower() in ('1', 'true'):
            qs = qs.filter(estado__in=ESTADOS_ACTIVOS)

        # Filtro rápido: solo hoy
        solo_hoy = self.request.query_params.get('hoy')
        if solo_hoy and solo_hoy.lower() in ('1', 'true'):
            qs = qs.filter(fecha_ingreso=date.today())

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EmergenciaDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EmergenciaCreateSerializer
        return EmergenciaListSerializer

    # ── Override retrieve: auditoría HIPAA ──────────────────
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(
            request, 'view', str(instance.emg_id),
            f'Consulta emergencia: {instance.paciente} — {instance.fecha_ingreso}'
        )
        return Response(EmergenciaDetailSerializer(instance, context={'request': request}).data)

    # ── Override create: auditoría HIPAA ────────────────────
    def create(self, request, *args, **kwargs):
        serializer = EmergenciaCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        emergencia = serializer.save()
        _audit_phi(
            request, 'create', str(emergencia.emg_id),
            f'Emergencia registrada: {emergencia.paciente} — triaje {emergencia.nivel_triaje}'
        )
        return Response(
            EmergenciaDetailSerializer(emergencia, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Override update: auditoría HIPAA ────────────────────
    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = EmergenciaCreateSerializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        emergencia = serializer.save()
        _audit_phi(
            request, 'edit', str(emergencia.emg_id),
            f'Emergencia actualizada: #{emergencia.emg_id}'
        )
        return Response(EmergenciaDetailSerializer(emergencia, context={'request': request}).data)

    # ── Soft-delete HIPAA ───────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        emergencia = self.get_object()
        emergencia.activo     = False
        emergencia.updated_by = request.user
        emergencia.save(update_fields=['activo', 'updated_by', 'updated_at'])
        _audit_phi(
            request, 'delete', str(emergencia.emg_id),
            f'Emergencia desactivada (soft-delete): #{emergencia.emg_id}'
        )
        return Response(
            {'detail': f'Emergencia #{emergencia.emg_id} desactivada (soft-delete HIPAA).'},
            status=status.HTTP_200_OK,
        )

    # ============================================================
    # Acciones de máquina de estados
    # ============================================================

    @action(detail=True, methods=['post'], url_path='atender')
    def atender(self, request, pk=None):
        """
        POST /api/v1/emergency/{id}/atender/
        Body: { "medico_id": N }
        Transición: ESPERA → EN_ATENCION
        """
        emergencia = self.get_object()

        if emergencia.estado not in ESTADOS_ATENDIBLES:
            return Response(
                {'detail': f'No se puede iniciar atención desde el estado "{emergencia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EmergenciaAtenderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from apps.security.models import Usuario
        medico = Usuario.objects.get(pk=serializer.validated_data['medico_id'])

        emergencia.estado     = 'EN_ATENCION'
        emergencia.medico     = medico
        emergencia.updated_by = request.user
        emergencia.save(update_fields=['estado', 'medico', 'updated_by', 'updated_at'])

        _audit_phi(
            request, 'edit', str(emergencia.emg_id),
            f'Emergencia en atención: #{emergencia.emg_id} — Dr. {medico}'
        )
        return Response(
            EmergenciaDetailSerializer(emergencia, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='observacion')
    def observacion(self, request, pk=None):
        """
        POST /api/v1/emergency/{id}/observacion/
        Body: { "notas_medico": "..." }  (opcional)
        Transición: EN_ATENCION → OBSERVACION
        """
        emergencia = self.get_object()

        if emergencia.estado not in ESTADOS_OBSERVABLES:
            return Response(
                {'detail': f'No se puede pasar a observación desde el estado "{emergencia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EmergenciaObservacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        emergencia.estado     = 'OBSERVACION'
        emergencia.updated_by = request.user
        update_fields = ['estado', 'updated_by', 'updated_at']

        notas = serializer.validated_data.get('notas_medico', '')
        if notas:
            emergencia.notas_medico = notas
            update_fields.append('notas_medico')

        emergencia.save(update_fields=update_fields)

        _audit_phi(
            request, 'edit', str(emergencia.emg_id),
            f'Emergencia en observación: #{emergencia.emg_id}'
        )
        return Response(
            EmergenciaDetailSerializer(emergencia, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='alta')
    def alta(self, request, pk=None):
        """
        POST /api/v1/emergency/{id}/alta/
        Body: {
            "tipo_alta": "MEDICA|VOLUNTARIA|FUGA|FALLECIMIENTO|TRANSFERENCIA",
            "diagnostico": "...",
            "cie10_codigo": "...",   (opcional)
            "tratamiento": "...",    (opcional)
            "notas_medico": "...",   (opcional)
            "destino_alta": "..."    (opcional, requerido si TRANSFERENCIA)
        }
        Transición: EN_ATENCION | OBSERVACION → ALTA | TRANSFERIDO | FALLECIDO
        """
        emergencia = self.get_object()

        if emergencia.estado not in ESTADOS_CON_ALTA:
            return Response(
                {'detail': f'No se puede dar de alta desde el estado "{emergencia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EmergenciaAltaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tipo_alta = data['tipo_alta']

        # Mapear tipo_alta → estado final
        estado_final = {
            'VOLUNTARIA':    'ALTA',
            'MEDICA':        'ALTA',
            'FUGA':          'ALTA',
            'FALLECIMIENTO': 'FALLECIDO',
            'TRANSFERENCIA': 'TRANSFERIDO',
        }.get(tipo_alta, 'ALTA')

        now = timezone.now()
        emergencia.estado       = estado_final
        emergencia.tipo_alta    = tipo_alta
        emergencia.fecha_alta   = now.date()
        emergencia.hora_alta    = now.time().replace(microsecond=0)
        emergencia.diagnostico  = data['diagnostico']
        emergencia.cie10_codigo = data.get('cie10_codigo', '')
        emergencia.destino_alta = data.get('destino_alta', '')
        emergencia.updated_by   = request.user

        update_fields = [
            'estado', 'tipo_alta', 'fecha_alta', 'hora_alta',
            'diagnostico', 'cie10_codigo', 'destino_alta',
            'updated_by', 'updated_at',
        ]

        if data.get('tratamiento'):
            emergencia.tratamiento = data['tratamiento']
            update_fields.append('tratamiento')
        if data.get('notas_medico'):
            emergencia.notas_medico = data['notas_medico']
            update_fields.append('notas_medico')

        emergencia.save(update_fields=update_fields)

        _audit_phi(
            request, 'edit', str(emergencia.emg_id),
            f'Alta emergencia #{emergencia.emg_id}: {tipo_alta} — {data["diagnostico"][:80]}'
        )
        return Response(
            EmergenciaDetailSerializer(emergencia, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )
