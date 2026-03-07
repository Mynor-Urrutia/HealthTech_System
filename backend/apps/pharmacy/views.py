"""
HealthTech Solutions — Views: Módulo Farmacia (M08)
ViewSets: MedicamentoViewSet, DispensacionViewSet
"""

import datetime
from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from django.conf import settings
from apps.core.permissions import IsPersonalClinico, SameHospitalOnly

from .models import (
    Medicamento, Dispensacion,
    ESTADOS_DISPENSABLES, ESTADOS_CANCELABLES,
)
from .serializers import (
    MedicamentoListSerializer, MedicamentoDetailSerializer, MedicamentoCreateSerializer,
    MedicamentoReponerSerializer,
    DispensacionListSerializer, DispensacionDetailSerializer, DispensacionCreateSerializer,
    DispensacionDispensarSerializer, DispensacionCancelarSerializer,
)


def _audit_phi(request, modulo, accion, objeto_id, descripcion=''):
    """Registra evento en SEC_AUDITORIA_ACCESOS (best-effort)."""
    try:
        from apps.security.models import AuditoriaAcceso
        AuditoriaAcceso.objects.create(
            usuario_id  = request.user.pk,
            hospital_id = request.user.hospital_id,
            modulo      = modulo,
            accion      = accion,
            objeto_id   = str(objeto_id),
            descripcion = descripcion[:500],
            ip_address  = request.META.get('REMOTE_ADDR', ''),
        )
    except Exception:
        pass


# ============================================================
# MEDICAMENTO — Catálogo
# ============================================================

class MedicamentoViewSet(viewsets.ModelViewSet):
    """
    CRUD del catálogo de medicamentos del hospital.
    Endpoint: /api/v1/pharmacy/medicamentos/
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = ['nombre_generico', 'nombre_comercial', 'principio_activo', 'concentracion']
    filterset_fields   = ['categoria', 'forma_farma', 'requiere_receta', 'activo']
    ordering_fields    = ['nombre_generico', 'stock_actual', 'categoria', 'created_at']
    ordering           = ['nombre_generico']

    def get_queryset(self):
        user = self.request.user
        qs   = Medicamento.objects.filter(activo=True)
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MedicamentoDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return MedicamentoCreateSerializer
        if self.action == 'reponer':
            return MedicamentoReponerSerializer
        return MedicamentoListSerializer

    def perform_destroy(self, instance):
        instance.activo        = False
        instance.updated_by_id = self.request.user.pk
        instance.save()

    @action(detail=True, methods=['post'], url_path='reponer')
    def reponer(self, request, pk=None):
        """
        POST /api/v1/pharmacy/medicamentos/{id}/reponer/
        Body: { "cantidad": 50, "notas": "..." }
        Agrega stock al medicamento.
        """
        medicamento = self.get_object()
        ser = MedicamentoReponerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        cantidad_anterior = medicamento.stock_actual
        Medicamento.objects.filter(pk=medicamento.pk).update(
            stock_actual=F('stock_actual') + d['cantidad'],
            updated_by_id=request.user.pk,
        )
        medicamento.refresh_from_db()

        _audit_phi(
            request, 'pharmacy', 'REPONER_STOCK', medicamento.med_id,
            f"{medicamento.nombre_generico}: {cantidad_anterior} → {medicamento.stock_actual} "
            f"(+{d['cantidad']}). {d.get('notas', '')}",
        )
        return Response(MedicamentoDetailSerializer(medicamento).data)


# ============================================================
# DISPENSACION
# ============================================================

class DispensacionViewSet(viewsets.ModelViewSet):
    """
    CRUD de dispensaciones + acciones de flujo de estado.
    Endpoint: /api/v1/pharmacy/dispensaciones/
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields      = [
        'paciente__primer_apellido', 'paciente__primer_nombre',
        'paciente__no_expediente', 'medicamento__nombre_generico',
        'medicamento__nombre_comercial',
    ]
    filterset_fields   = ['estado', 'via_admin', 'fecha_prescripcion', 'medicamento']
    ordering_fields    = ['fecha_prescripcion', 'estado', 'created_at']
    ordering           = ['-fecha_prescripcion', '-created_at']

    def get_queryset(self):
        user = self.request.user
        qs   = Dispensacion.objects.select_related(
            'paciente', 'medicamento', 'medico_prescribe', 'dispensado_por'
        ).filter(activo=True)
        if not settings.VPD_ENABLED and getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DispensacionDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return DispensacionCreateSerializer
        if self.action == 'dispensar':
            return DispensacionDispensarSerializer
        if self.action == 'cancelar':
            return DispensacionCancelarSerializer
        return DispensacionListSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        _audit_phi(
            self.request, 'pharmacy', 'CREAR_DISPENSACION', instance.dis_id,
            f"Dispensación creada: {instance.medicamento.nombre_generico} x{instance.cantidad} "
            f"→ {instance.paciente}",
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(request, 'pharmacy', 'VER_DISPENSACION', instance.dis_id,
                   f"Detalle dispensación DIS-{instance.dis_id}")
        ser = self.get_serializer(instance)
        return Response(ser.data)

    def perform_destroy(self, instance):
        instance.activo        = False
        instance.updated_by_id = self.request.user.pk
        instance.save()

    # ----------------------------------------------------------
    # Acciones de la máquina de estados
    # ----------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='dispensar')
    def dispensar(self, request, pk=None):
        """
        POST /api/v1/pharmacy/dispensaciones/{id}/dispensar/
        PENDIENTE → DISPENSADA. Descuenta stock del medicamento.
        """
        dispensacion = self.get_object()

        if dispensacion.estado not in ESTADOS_DISPENSABLES:
            return Response(
                {'detail': f"No se puede dispensar desde estado '{dispensacion.estado}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = DispensacionDispensarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        # Verificar stock suficiente (doble check en el momento de dispensar)
        med = dispensacion.medicamento
        if med.stock_actual < dispensacion.cantidad:
            return Response(
                {'detail': f"Stock insuficiente. Disponible: {med.stock_actual} {med.unidad_medida}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Descontar stock (operación atómica con F())
        Medicamento.objects.filter(pk=med.pk).update(
            stock_actual=F('stock_actual') - dispensacion.cantidad
        )

        # Actualizar dispensación
        now = datetime.datetime.now()
        dispensacion.estado             = 'DISPENSADA'
        dispensacion.dispensado_por_id  = request.user.pk
        dispensacion.fecha_dispensacion = now.date()
        dispensacion.hora_dispensacion  = now.time()
        dispensacion.notas_farmacia     = d.get('notas_farmacia', dispensacion.notas_farmacia)
        dispensacion.updated_by_id      = request.user.pk
        dispensacion.save()

        _audit_phi(
            request, 'pharmacy', 'DISPENSAR', dispensacion.dis_id,
            f"DIS-{dispensacion.dis_id}: {med.nombre_generico} x{dispensacion.cantidad} "
            f"dispensado a {dispensacion.paciente}",
        )
        return Response(DispensacionDetailSerializer(dispensacion).data)

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """
        POST /api/v1/pharmacy/dispensaciones/{id}/cancelar/
        PENDIENTE → CANCELADA.
        """
        dispensacion = self.get_object()

        if dispensacion.estado not in ESTADOS_CANCELABLES:
            return Response(
                {'detail': f"No se puede cancelar desde estado '{dispensacion.estado}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = DispensacionCancelarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        dispensacion.estado             = 'CANCELADA'
        dispensacion.motivo_cancelacion = d['motivo_cancelacion']
        dispensacion.updated_by_id      = request.user.pk
        dispensacion.save()

        _audit_phi(
            request, 'pharmacy', 'CANCELAR_DISPENSACION', dispensacion.dis_id,
            f"DIS-{dispensacion.dis_id} cancelada. Motivo: {d['motivo_cancelacion']}",
        )
        return Response(DispensacionDetailSerializer(dispensacion).data)
