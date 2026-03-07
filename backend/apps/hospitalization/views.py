"""
HealthTech Solutions — Views: Módulo Encamamiento (M05)
HIPAA: Auditoría PHI_ACCESS en TODOS los accesos a encamamientos.
VPD:   Filtro manual por hospital_id en DEV.

Máquina de estados (Encamamiento):
  INGRESADO → EN_TRATAMIENTO → EGRESADO
                             ↘ TRASLADADO
                             ↘ FALLECIDO

Al crear encamamiento → cama pasa a OCUPADA.
Al egresar           → cama pasa a DISPONIBLE.
"""

import logging
from datetime import date

from django.conf import settings
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly
from apps.hospitalization.models import (
    Cama, Encamamiento,
    ESTADOS_ACTIVOS_ENC, ESTADOS_EGRESABLES, ESTADOS_TRATABLES,
)
from apps.hospitalization.serializers import (
    CamaSerializer,
    EncamamientoListSerializer, EncamamientoDetailSerializer,
    EncamamientoCreateSerializer,
    EncamamientoEgresoSerializer, EncamamientoEvolucionSerializer,
)
from apps.security.models import AuditoriaAcceso

logger = logging.getLogger('healthtech.audit')


def _get_ip(request) -> str:
    x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR', '0.0.0.0')


def _audit_phi(request, accion: str, enc_id: str, descripcion: str = '') -> None:
    try:
        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='PHI_ACCESS',
            modulo='hospitalization',
            accion=accion,
            tabla_afectada='ENC_ENCAMAMIENTOS',
            registro_id=enc_id,
            ip_origen=_get_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            descripcion=descripcion or f'{accion} encamamiento #{enc_id}',
            exitoso=True,
        )
    except Exception as exc:
        logger.warning('Fallo al registrar auditoría PHI (hospitalization): %s', exc)


# ============================================================
# CAMAS ViewSet
# ============================================================
class CamaViewSet(viewsets.ModelViewSet):
    """
    CRUD de camas hospitalarias.
    GET    /api/v1/hospitalization/camas/
    POST   /api/v1/hospitalization/camas/
    GET    /api/v1/hospitalization/camas/{id}/
    PUT/PATCH/DELETE ...
    """
    serializer_class   = CamaSerializer
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['estado', 'tipo_cama', 'piso', 'sala']
    search_fields      = ['numero_cama', 'sala', 'piso']
    ordering_fields    = ['sala', 'piso', 'numero_cama', 'estado']
    ordering           = ['sala', 'piso', 'numero_cama']

    def get_queryset(self):
        qs   = Cama.objects.filter(activo=True)
        user = self.request.user
        if not settings.VPD_ENABLED:
            if getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
                qs = qs.filter(hospital_id=user.hospital_id)

        # Filtro rápido: solo disponibles
        solo_disp = self.request.query_params.get('disponibles')
        if solo_disp and solo_disp.lower() in ('1', 'true'):
            qs = qs.filter(estado='DISPONIBLE')

        return qs

    def destroy(self, request, *args, **kwargs):
        cama = self.get_object()
        if cama.estado == 'OCUPADA':
            return Response(
                {'detail': 'No se puede desactivar una cama que está ocupada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cama.activo = False
        cama.save(update_fields=['activo', 'updated_at'])
        return Response({'detail': f'Cama {cama.numero_cama} desactivada.'}, status=status.HTTP_200_OK)


# ============================================================
# ENCAMAMIENTOS ViewSet
# ============================================================
class EncamamientoViewSet(viewsets.ModelViewSet):
    """
    CRUD de admisiones hospitalarias.
    GET    /api/v1/hospitalization/
    POST   /api/v1/hospitalization/
    GET    /api/v1/hospitalization/{id}/
    PUT/PATCH ...
    DELETE /api/v1/hospitalization/{id}/   (soft-delete)

    Acciones:
    POST /api/v1/hospitalization/{id}/tratamiento/  INGRESADO → EN_TRATAMIENTO
    POST /api/v1/hospitalization/{id}/evolucion/    Actualiza notas evolución + indicaciones
    POST /api/v1/hospitalization/{id}/egreso/       → EGRESADO | TRASLADADO | FALLECIDO
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['estado', 'medico']
    search_fields      = [
        'motivo_ingreso', 'diagnostico_ingreso', 'diagnostico_egreso',
        'paciente__primer_apellido', 'paciente__primer_nombre',
        'paciente__no_expediente',
        'medico__primer_apellido', 'medico__primer_nombre',
        'cama__numero_cama', 'cama__sala',
    ]
    ordering_fields    = ['fecha_ingreso', 'estado', 'created_at']
    ordering           = ['-fecha_ingreso', '-hora_ingreso']

    def get_queryset(self):
        qs   = Encamamiento.objects.select_related(
            'paciente', 'medico', 'enfermero', 'cama'
        ).filter(activo=True)
        user = self.request.user

        if not settings.VPD_ENABLED:
            if getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
                qs = qs.filter(hospital_id=user.hospital_id)

        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            try: qs = qs.filter(fecha_ingreso__gte=fecha_desde)
            except Exception: pass
        if fecha_hasta:
            try: qs = qs.filter(fecha_ingreso__lte=fecha_hasta)
            except Exception: pass

        solo_activos = self.request.query_params.get('activos')
        if solo_activos and solo_activos.lower() in ('1', 'true'):
            qs = qs.filter(estado__in=ESTADOS_ACTIVOS_ENC)

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EncamamientoDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EncamamientoCreateSerializer
        return EncamamientoListSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(request, 'view', str(instance.enc_id),
                   f'Consulta encamamiento: {instance.paciente} — {instance.fecha_ingreso}')
        return Response(EncamamientoDetailSerializer(instance, context={'request': request}).data)

    def create(self, request, *args, **kwargs):
        serializer = EncamamientoCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        enc = serializer.save()
        _audit_phi(request, 'create', str(enc.enc_id),
                   f'Encamamiento creado: {enc.paciente} — Cama {enc.cama}')
        return Response(
            EncamamientoDetailSerializer(enc, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = EncamamientoCreateSerializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        enc = serializer.save()
        _audit_phi(request, 'edit', str(enc.enc_id), f'Encamamiento actualizado: #{enc.enc_id}')
        return Response(EncamamientoDetailSerializer(enc, context={'request': request}).data)

    def destroy(self, request, *args, **kwargs):
        enc = self.get_object()
        if enc.estado in ESTADOS_ACTIVOS_ENC:
            enc.cama.estado = 'DISPONIBLE'
            enc.cama.save(update_fields=['estado', 'updated_at'])
        enc.activo     = False
        enc.updated_by = request.user
        enc.save(update_fields=['activo', 'updated_by', 'updated_at'])
        _audit_phi(request, 'delete', str(enc.enc_id), f'Encamamiento soft-deleted: #{enc.enc_id}')
        return Response({'detail': f'Encamamiento #{enc.enc_id} desactivado.'}, status=status.HTTP_200_OK)

    # ── Acción: iniciar tratamiento ────────────────────────
    @action(detail=True, methods=['post'], url_path='tratamiento')
    def tratamiento(self, request, pk=None):
        """POST /api/v1/hospitalization/{id}/tratamiento/ — INGRESADO → EN_TRATAMIENTO"""
        enc = self.get_object()
        if enc.estado not in ESTADOS_TRATABLES:
            return Response(
                {'detail': f'No se puede iniciar tratamiento desde "{enc.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        enc.estado     = 'EN_TRATAMIENTO'
        enc.updated_by = request.user
        enc.save(update_fields=['estado', 'updated_by', 'updated_at'])
        _audit_phi(request, 'edit', str(enc.enc_id), f'Encamamiento en tratamiento: #{enc.enc_id}')
        return Response(EncamamientoDetailSerializer(enc, context={'request': request}).data)

    # ── Acción: actualizar evolución ───────────────────────
    @action(detail=True, methods=['post'], url_path='evolucion')
    def evolucion(self, request, pk=None):
        """POST /api/v1/hospitalization/{id}/evolucion/ — agrega notas de evolución e indicaciones"""
        enc = self.get_object()
        if enc.estado not in ESTADOS_ACTIVOS_ENC:
            return Response(
                {'detail': 'Solo se puede actualizar evolución en pacientes activos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EncamamientoEvolucionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields = ['updated_by', 'updated_at']
        if data.get('evolucion'):
            enc.evolucion = data['evolucion']
            update_fields.append('evolucion')
        if data.get('indicaciones'):
            enc.indicaciones = data['indicaciones']
            update_fields.append('indicaciones')

        enc.updated_by = request.user
        enc.save(update_fields=update_fields)
        _audit_phi(request, 'edit', str(enc.enc_id), f'Evolución actualizada: #{enc.enc_id}')
        return Response(EncamamientoDetailSerializer(enc, context={'request': request}).data)

    # ── Acción: egreso ────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='egreso')
    def egreso(self, request, pk=None):
        """
        POST /api/v1/hospitalization/{id}/egreso/
        Body: { tipo_egreso, diagnostico_egreso, cie10_egreso, destino_egreso, notas_medico }
        Transición: INGRESADO | EN_TRATAMIENTO → EGRESADO | TRASLADADO | FALLECIDO
        """
        enc = self.get_object()
        if enc.estado not in ESTADOS_EGRESABLES:
            return Response(
                {'detail': f'No se puede egresar desde el estado "{enc.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EncamamientoEgresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tipo_egreso = data['tipo_egreso']
        estado_final = {
            'ALTA_MEDICA':   'EGRESADO',
            'VOLUNTARIA':    'EGRESADO',
            'FUGA':          'EGRESADO',
            'TRASLADO':      'TRASLADADO',
            'FALLECIMIENTO': 'FALLECIDO',
        }.get(tipo_egreso, 'EGRESADO')

        now = timezone.now()
        enc.estado             = estado_final
        enc.tipo_egreso        = tipo_egreso
        enc.fecha_egreso       = now.date()
        enc.hora_egreso        = now.time().replace(microsecond=0)
        enc.diagnostico_egreso = data['diagnostico_egreso']
        enc.cie10_egreso       = data.get('cie10_egreso', '')
        enc.destino_egreso     = data.get('destino_egreso', '')
        enc.dias_estancia      = enc.calcular_dias_estancia()
        enc.updated_by         = request.user

        update_fields = [
            'estado', 'tipo_egreso', 'fecha_egreso', 'hora_egreso',
            'diagnostico_egreso', 'cie10_egreso', 'destino_egreso',
            'dias_estancia', 'updated_by', 'updated_at',
        ]
        if data.get('notas_medico'):
            enc.evolucion = (enc.evolucion or '') + f'\n\n[EGRESO] {data["notas_medico"]}'
            update_fields.append('evolucion')

        enc.save(update_fields=update_fields)

        # Liberar la cama
        enc.cama.estado = 'DISPONIBLE'
        enc.cama.save(update_fields=['estado', 'updated_at'])

        _audit_phi(request, 'edit', str(enc.enc_id),
                   f'Egreso: #{enc.enc_id} — {tipo_egreso} — {data["diagnostico_egreso"][:80]}')
        return Response(EncamamientoDetailSerializer(enc, context={'request': request}).data)
