"""
HealthTech Solutions — Views: Módulo Cirugía (M06)
ViewSet: CirugiaViewSet

HIPAA: _audit_phi() registra cada acceso a datos PHI.
RBAC:  IsPersonalClinico + SameHospitalOnly.
VPD:   Filtro manual por hospital_id en DEV (Oracle VPD en PROD).

Máquina de estados:
  iniciar  : PROGRAMADA → EN_CURSO   (captura fecha/hora reales)
  completar: EN_CURSO   → COMPLETADA (hallazgos, diagnóstico post-op, duración real)
  suspender: EN_CURSO   → SUSPENDIDA (motivo requerido)
  cancelar : PROGRAMADA → CANCELADA  (motivo requerido)
"""

import datetime

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly
from apps.security.models import AuditoriaAcceso

from .models import (
    Cirugia,
    ESTADOS_INICIABLES,
    ESTADOS_COMPLETABLES,
    ESTADOS_SUSPENDIBLES,
    ESTADOS_CANCELABLES,
    ESTADOS_ACTIVOS,
)
from .serializers import (
    CirugiaListSerializer,
    CirugiaDetailSerializer,
    CirugiaCreateSerializer,
    CirugiaIniciarSerializer,
    CirugiaCompletarSerializer,
    CirugiaFinalizarSerializer,
)

# En DEV, VPD está desactivado; el filtro se aplica manualmente
VPD_ENABLED = False


# ============================================================
# Helper: Auditoría HIPAA
# ============================================================
def _audit_phi(request, resource_id, accion, detalle=''):
    try:
        AuditoriaAcceso.objects.create(
            usuario_id=request.user.pk,
            hospital_id=getattr(request.user, 'hospital_id', 1),
            tabla_accedida='CIR_CIRUGIAS',
            registro_id=resource_id,
            accion=accion,
            detalle=detalle,
            ip_origen=request.META.get('REMOTE_ADDR', ''),
        )
    except Exception:
        pass   # No interrumpir flujo clínico por fallo de auditoría


# ============================================================
# ViewSet principal
# ============================================================
class CirugiaViewSet(viewsets.ModelViewSet):
    """
    CRUD de cirugías + acciones de máquina de estados.

    Endpoints adicionales:
      POST /{id}/iniciar/   — PROGRAMADA → EN_CURSO
      POST /{id}/completar/ — EN_CURSO   → COMPLETADA
      POST /{id}/suspender/ — EN_CURSO   → SUSPENDIDA
      POST /{id}/cancelar/  — PROGRAMADA → CANCELADA
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    serializer_class   = CirugiaListSerializer

    # --------------------------------------------------------
    # QuerySet con filtros VPD + query params
    # --------------------------------------------------------
    def get_queryset(self):
        user      = self.request.user
        rol       = getattr(user, 'rol_codigo', '')
        params    = self.request.query_params

        qs = Cirugia.objects.filter(activo=True).select_related(
            'paciente', 'cirujano', 'anestesiologo',
            'enfermero_inst', 'enfermero_circ',
        )

        # VPD manual
        if not VPD_ENABLED and rol != 'SUPER_ADMIN':
            hospital_id = getattr(user, 'hospital_id', None)
            if hospital_id:
                qs = qs.filter(hospital_id=hospital_id)

        # --- Filtros dinámicos ---
        if params.get('estado'):
            qs = qs.filter(estado=params['estado'])
        if params.get('prioridad'):
            qs = qs.filter(prioridad=params['prioridad'])
        if params.get('cirujano'):
            qs = qs.filter(cirujano_id=params['cirujano'])
        if params.get('quirofano'):
            qs = qs.filter(quirofano__icontains=params['quirofano'])
        if params.get('fecha'):
            qs = qs.filter(fecha_programada=params['fecha'])
        if params.get('fecha_desde'):
            qs = qs.filter(fecha_programada__gte=params['fecha_desde'])
        if params.get('fecha_hasta'):
            qs = qs.filter(fecha_programada__lte=params['fecha_hasta'])
        if params.get('hoy') == '1':
            qs = qs.filter(fecha_programada=datetime.date.today())
        if params.get('activos') == '1':
            qs = qs.filter(estado__in=ESTADOS_ACTIVOS)
        if params.get('search'):
            q = params['search']
            qs = qs.filter(
                Q(paciente__primer_nombre__icontains=q)  |
                Q(paciente__primer_apellido__icontains=q) |
                Q(tipo_cirugia__icontains=q)             |
                Q(quirofano__icontains=q)                |
                Q(especialidad__icontains=q)
            )
        return qs

    # --------------------------------------------------------
    # Serializer según acción
    # --------------------------------------------------------
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CirugiaDetailSerializer
        if self.action == 'create':
            return CirugiaCreateSerializer
        return CirugiaListSerializer

    # --------------------------------------------------------
    # Retrieve con auditoría PHI
    # --------------------------------------------------------
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(
            request, instance.cir_id, 'READ_DETAIL',
            f'Cirugía {instance.tipo_cirugia} — Paciente {instance.paciente_id}',
        )
        serializer = CirugiaDetailSerializer(instance, context={'request': request})
        return Response(serializer.data)

    # --------------------------------------------------------
    # Soft-delete en lugar de DELETE físico
    # --------------------------------------------------------
    def perform_destroy(self, instance):
        instance.activo       = False
        instance.updated_by_id = self.request.user.pk
        instance.save()

    # ============================================================
    # Máquina de estados
    # ============================================================

    @action(detail=True, methods=['post'])
    def iniciar(self, request, pk=None):
        """
        PROGRAMADA → EN_CURSO
        Captura fecha y hora de inicio real.
        """
        cirugia = self.get_object()

        if cirugia.estado not in ESTADOS_INICIABLES:
            return Response(
                {'detail': f'No se puede iniciar una cirugía en estado "{cirugia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CirugiaIniciarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        now = timezone.localtime(timezone.now())
        cirugia.estado            = 'EN_CURSO'
        cirugia.fecha_inicio_real = now.date()
        cirugia.hora_inicio_real  = now.time()

        notas_adicionales = serializer.validated_data.get('notas_preop_adicionales', '')
        if notas_adicionales:
            cirugia.notas_preop = (
                (cirugia.notas_preop + '\n' if cirugia.notas_preop else '') +
                notas_adicionales
            )

        cirugia.updated_by_id = request.user.pk
        cirugia.save()

        _audit_phi(
            request, cirugia.cir_id, 'CIR_INICIO',
            f'Cirugía iniciada: {cirugia.tipo_cirugia} — Qx {cirugia.quirofano}',
        )
        return Response(CirugiaDetailSerializer(cirugia, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """
        EN_CURSO → COMPLETADA
        Registra hallazgos, diagnóstico post-op y calcula duración real.
        """
        cirugia = self.get_object()

        if cirugia.estado not in ESTADOS_COMPLETABLES:
            return Response(
                {'detail': f'No se puede completar una cirugía en estado "{cirugia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CirugiaCompletarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        now = timezone.localtime(timezone.now())
        cirugia.estado         = 'COMPLETADA'
        cirugia.fecha_fin_real = now.date()
        cirugia.hora_fin_real  = now.time()

        # Calcular duración real
        if cirugia.fecha_inicio_real and cirugia.hora_inicio_real:
            dt_inicio = datetime.datetime.combine(
                cirugia.fecha_inicio_real, cirugia.hora_inicio_real
            )
            dt_fin = datetime.datetime.combine(
                cirugia.fecha_fin_real, cirugia.hora_fin_real
            )
            cirugia.duracion_real_min = max(0, int((dt_fin - dt_inicio).total_seconds() / 60))

        cirugia.hallazgos          = d['hallazgos']
        cirugia.diagnostico_postop = d['diagnostico_postop']
        cirugia.cie10_post         = d.get('cie10_post', '')
        cirugia.complicaciones     = d.get('complicaciones', '')
        cirugia.notas_postop       = d.get('notas_postop', '')
        cirugia.updated_by_id      = request.user.pk
        cirugia.save()

        _audit_phi(
            request, cirugia.cir_id, 'CIR_COMPLETADA',
            f'Completada: {cirugia.tipo_cirugia} — '
            f'Duración real: {cirugia.duracion_real_min} min',
        )
        return Response(CirugiaDetailSerializer(cirugia, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def suspender(self, request, pk=None):
        """
        EN_CURSO → SUSPENDIDA
        Motivo obligatorio. La cirugía puede re-programarse posteriormente.
        """
        cirugia = self.get_object()

        if cirugia.estado not in ESTADOS_SUSPENDIBLES:
            return Response(
                {'detail': f'No se puede suspender una cirugía en estado "{cirugia.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CirugiaFinalizarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cirugia.estado             = 'SUSPENDIDA'
        cirugia.motivo_cancelacion = serializer.validated_data['motivo']
        cirugia.updated_by_id      = request.user.pk
        cirugia.save()

        _audit_phi(
            request, cirugia.cir_id, 'CIR_SUSPENDIDA',
            f'Suspendida: {serializer.validated_data["motivo"][:80]}',
        )
        return Response(CirugiaDetailSerializer(cirugia, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """
        PROGRAMADA → CANCELADA
        Motivo obligatorio. Solo se puede cancelar antes de iniciar.
        """
        cirugia = self.get_object()

        if cirugia.estado not in ESTADOS_CANCELABLES:
            return Response(
                {'detail': f'No se puede cancelar una cirugía en estado "{cirugia.get_estado_display()}". '
                           f'Si ya inició, use "Suspender".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CirugiaFinalizarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cirugia.estado             = 'CANCELADA'
        cirugia.motivo_cancelacion = serializer.validated_data['motivo']
        cirugia.updated_by_id      = request.user.pk
        cirugia.save()

        _audit_phi(
            request, cirugia.cir_id, 'CIR_CANCELADA',
            f'Cancelada: {serializer.validated_data["motivo"][:80]}',
        )
        return Response(CirugiaDetailSerializer(cirugia, context={'request': request}).data)
