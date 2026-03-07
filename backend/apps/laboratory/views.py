"""
HealthTech Solutions — Views: Módulo Laboratorio (M07)
ViewSet: OrdenLabViewSet

HIPAA: _audit_phi() registra cada acceso a datos PHI.
RBAC:  IsPersonalClinico + SameHospitalOnly.
VPD:   Filtro manual por hospital_id en DEV (Oracle VPD en PROD).

Máquina de estados:
  procesar : PENDIENTE  → EN_PROCESO  (toma de muestra, captura hora real)
  completar: EN_PROCESO → COMPLETADA  (ingresa resultados individuales)
  cancelar : PENDIENTE | EN_PROCESO → CANCELADA (motivo requerido)
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
    OrdenLab,
    ResultadoLab,
    ESTADOS_PROCESABLES,
    ESTADOS_COMPLETABLES,
    ESTADOS_CANCELABLES,
    ESTADOS_ACTIVOS,
)
from .serializers import (
    OrdenLabListSerializer,
    OrdenLabDetailSerializer,
    OrdenLabCreateSerializer,
    OrdenProcesarSerializer,
    OrdenCompletarSerializer,
    OrdenCancelarSerializer,
)

VPD_ENABLED = False


# ============================================================
# Helper: Auditoría HIPAA
# ============================================================
def _audit_phi(request, resource_id, accion, detalle=''):
    try:
        AuditoriaAcceso.objects.create(
            usuario_id=request.user.pk,
            hospital_id=getattr(request.user, 'hospital_id', 1),
            tabla_accedida='LAB_ORDENES',
            registro_id=resource_id,
            accion=accion,
            detalle=detalle,
            ip_origen=request.META.get('REMOTE_ADDR', ''),
        )
    except Exception:
        pass


# ============================================================
# ViewSet principal
# ============================================================
class OrdenLabViewSet(viewsets.ModelViewSet):
    """
    CRUD de órdenes de laboratorio + acciones de estado.

    Endpoints adicionales:
      POST /{id}/procesar/  — PENDIENTE  → EN_PROCESO  (toma de muestra)
      POST /{id}/completar/ — EN_PROCESO → COMPLETADA  (ingreso de resultados)
      POST /{id}/cancelar/  — activos    → CANCELADA
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    serializer_class   = OrdenLabListSerializer

    # --------------------------------------------------------
    # QuerySet con VPD manual + filtros
    # --------------------------------------------------------
    def get_queryset(self):
        user   = self.request.user
        rol    = getattr(user, 'rol_codigo', '')
        params = self.request.query_params

        qs = OrdenLab.objects.filter(activo=True).select_related(
            'paciente', 'medico_solic', 'laboratorista',
        )

        # VPD manual (DEV)
        if not VPD_ENABLED and rol != 'SUPER_ADMIN':
            hospital_id = getattr(user, 'hospital_id', None)
            if hospital_id:
                qs = qs.filter(hospital_id=hospital_id)

        # --- Filtros dinámicos ---
        if params.get('estado'):
            qs = qs.filter(estado=params['estado'])
        if params.get('prioridad'):
            qs = qs.filter(prioridad=params['prioridad'])
        if params.get('tipo_muestra'):
            qs = qs.filter(tipo_muestra=params['tipo_muestra'])
        if params.get('fecha'):
            qs = qs.filter(fecha_solicitud=params['fecha'])
        if params.get('fecha_desde'):
            qs = qs.filter(fecha_solicitud__gte=params['fecha_desde'])
        if params.get('fecha_hasta'):
            qs = qs.filter(fecha_solicitud__lte=params['fecha_hasta'])
        if params.get('hoy') == '1':
            qs = qs.filter(fecha_solicitud=datetime.date.today())
        if params.get('activos') == '1':
            qs = qs.filter(estado__in=ESTADOS_ACTIVOS)
        if params.get('search'):
            q = params['search']
            qs = qs.filter(
                Q(paciente__primer_nombre__icontains=q)    |
                Q(paciente__primer_apellido__icontains=q)  |
                Q(examenes_solicitados__icontains=q)       |
                Q(paciente__no_expediente__icontains=q)
            )
        return qs

    # --------------------------------------------------------
    # Serializer según acción
    # --------------------------------------------------------
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrdenLabDetailSerializer
        if self.action == 'create':
            return OrdenLabCreateSerializer
        return OrdenLabListSerializer

    # --------------------------------------------------------
    # Retrieve con auditoría PHI
    # --------------------------------------------------------
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(
            request, instance.lab_id, 'READ_DETAIL',
            f'Orden LAB-{instance.lab_id} — Paciente {instance.paciente_id}',
        )
        serializer = OrdenLabDetailSerializer(instance, context={'request': request})
        return Response(serializer.data)

    # --------------------------------------------------------
    # Soft-delete
    # --------------------------------------------------------
    def perform_destroy(self, instance):
        instance.activo       = False
        instance.updated_by_id = self.request.user.pk
        instance.save()

    # ============================================================
    # Máquina de estados
    # ============================================================

    @action(detail=True, methods=['post'])
    def procesar(self, request, pk=None):
        """
        PENDIENTE → EN_PROCESO
        Registra la toma de muestra con hora real del servidor.
        """
        orden = self.get_object()

        if orden.estado not in ESTADOS_PROCESABLES:
            return Response(
                {'detail': f'No se puede procesar una orden en estado "{orden.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrdenProcesarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        now = timezone.localtime(timezone.now())
        orden.estado        = 'EN_PROCESO'
        orden.fecha_muestra = now.date()
        orden.hora_muestra  = now.time()

        if d.get('laboratorista_id'):
            orden.laboratorista_id = d['laboratorista_id']
        if d.get('notas_laboratorio'):
            orden.notas_laboratorio = d['notas_laboratorio']

        orden.updated_by_id = request.user.pk
        orden.save()

        _audit_phi(
            request, orden.lab_id, 'LAB_PROCESO',
            f'Muestra tomada: {orden.examenes_solicitados[:80]}',
        )
        return Response(OrdenLabDetailSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """
        EN_PROCESO → COMPLETADA
        Crea los ResultadoLab individuales y cierra la orden.
        """
        orden = self.get_object()

        if orden.estado not in ESTADOS_COMPLETABLES:
            return Response(
                {'detail': f'No se puede completar una orden en estado "{orden.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrdenCompletarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        now = timezone.localtime(timezone.now())
        orden.estado          = 'COMPLETADA'
        orden.fecha_resultado  = now.date()
        orden.hora_resultado   = now.time()
        if d.get('notas_laboratorio'):
            orden.notas_laboratorio = d['notas_laboratorio']
        orden.updated_by_id = request.user.pk
        orden.save()

        # Crear ResultadoLab para cada examen
        hospital_id = getattr(request.user, 'hospital_id', 1)
        bulk = []
        for res in d['resultados']:
            bulk.append(ResultadoLab(
                orden_id         = orden.lab_id,
                hospital_id      = hospital_id,
                nombre_examen    = res['nombre_examen'],
                valor            = res['valor'],
                unidad           = res.get('unidad', ''),
                rango_min        = res.get('rango_min', ''),
                rango_max        = res.get('rango_max', ''),
                valor_referencia = res.get('valor_referencia', ''),
                interpretacion   = res.get('interpretacion', ''),
                estado_resultado = res.get('estado_resultado', 'NORMAL'),
                created_by_id    = request.user.pk,
            ))
        ResultadoLab.objects.bulk_create(bulk)

        # Auditoría: marcar si hay resultados críticos
        criticos = sum(1 for r in d['resultados'] if r.get('estado_resultado') == 'CRITICO')
        detalle  = f'Completada con {len(bulk)} resultados'
        if criticos:
            detalle += f' — {criticos} CRÍTICO(S)'

        _audit_phi(request, orden.lab_id, 'LAB_COMPLETADA', detalle)

        # Reload para incluir resultados en la respuesta
        orden.refresh_from_db()
        return Response(OrdenLabDetailSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """
        PENDIENTE | EN_PROCESO → CANCELADA
        Motivo obligatorio.
        """
        orden = self.get_object()

        if orden.estado not in ESTADOS_CANCELABLES:
            return Response(
                {'detail': f'No se puede cancelar una orden en estado "{orden.get_estado_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrdenCancelarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        orden.estado             = 'CANCELADA'
        orden.motivo_cancelacion = serializer.validated_data['motivo']
        orden.updated_by_id      = request.user.pk
        orden.save()

        _audit_phi(
            request, orden.lab_id, 'LAB_CANCELADA',
            f'Cancelada: {serializer.validated_data["motivo"][:80]}',
        )
        return Response(OrdenLabDetailSerializer(orden, context={'request': request}).data)
