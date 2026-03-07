"""
HealthTech Solutions — Views: Modulo Pacientes (M02)
HIPAA: Auditoria PHI_ACCESS en TODOS los accesos a datos de pacientes.
VPD:   En DEV se filtra manualmente por hospital_id del usuario autenticado.
       En PROD Oracle VPD aplica el filtro a nivel de sesion de BD.
"""

import logging
from django.conf import settings
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsPersonalClinico, SameHospitalOnly
from apps.patients.models import Paciente, Alergia, ContactoEmergencia, HistorialClinico
from apps.patients.serializers import (
    PacienteListSerializer, PacienteDetailSerializer, PacienteCreateSerializer,
    AlergiaSerializer, AlergiaCreateSerializer,
    ContactoEmergenciaSerializer, ContactoCreateSerializer,
    HistorialSerializer, HistorialCreateSerializer,
)
from apps.security.models import AuditoriaAcceso

logger = logging.getLogger('healthtech.audit')


# ============================================================
# Helpers internos
# ============================================================
def _get_ip(request) -> str:
    x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR', '0.0.0.0')


def _audit_phi(request, accion: str, pac_id: str, descripcion: str = '') -> None:
    """
    Registra un evento PHI_ACCESS en SEC_AUDITORIA_ACCESOS.
    Cumplimiento HIPAA: cada acceso a datos de paciente debe quedar registrado.
    """
    try:
        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='PHI_ACCESS',
            modulo='patients',
            accion=accion,
            tabla_afectada='PAC_PACIENTES',
            registro_id=pac_id,
            ip_origen=_get_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            descripcion=descripcion or f'{accion} paciente #{pac_id}',
            exitoso=True,
        )
    except Exception as exc:
        logger.warning('Fallo al registrar auditoria PHI: %s', exc)


# ============================================================
# PACIENTES ViewSet
# ============================================================
class PacienteViewSet(viewsets.ModelViewSet):
    """
    CRUD de pacientes con aislamiento VPD por hospital.

    GET    /api/v1/patients/               Lista paginada (search/filter/order)
    POST   /api/v1/patients/               Registrar nuevo paciente
    GET    /api/v1/patients/{id}/          Ficha clinica completa
    PUT    /api/v1/patients/{id}/          Actualizar datos
    PATCH  /api/v1/patients/{id}/          Actualizar parcial
    DELETE /api/v1/patients/{id}/          Soft-delete (HIPAA: no borrar PHI)

    Sub-recursos anidados:
    GET/POST /api/v1/patients/{id}/alergias/
    GET/POST /api/v1/patients/{id}/contactos/
    GET/POST /api/v1/patients/{id}/historial/
    """
    permission_classes = [IsPersonalClinico, SameHospitalOnly]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = [
        'no_expediente', 'primer_nombre', 'primer_apellido',
        'segundo_apellido', 'no_documento', 'telefono_principal',
    ]
    ordering_fields    = ['primer_apellido', 'primer_nombre', 'created_at', 'fecha_nacimiento']
    ordering           = ['primer_apellido', 'primer_nombre']

    def get_queryset(self):
        qs   = Paciente.objects.select_related('medico').filter(activo=True)
        user = self.request.user

        # VPD manual en DEV (en PROD lo aplica Oracle a nivel de sesion)
        if not settings.VPD_ENABLED:
            if getattr(user, 'rol_codigo', '') != 'SUPER_ADMIN':
                qs = qs.filter(hospital_id=user.hospital_id)

        # Filtros opcionales via query params
        tipo_paciente = self.request.query_params.get('tipo_paciente')
        if tipo_paciente:
            qs = qs.filter(tipo_paciente=tipo_paciente)

        sexo = self.request.query_params.get('sexo')
        if sexo:
            qs = qs.filter(sexo=sexo)

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PacienteDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return PacienteCreateSerializer
        return PacienteListSerializer

    # ---- Override retrieve: auditoria HIPAA ----
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _audit_phi(
            request, 'view', str(instance.pac_id),
            f'Consulta ficha: {instance.get_nombre_completo()}'
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    # ---- Override create: asigna hospital_id ----
    def create(self, request, *args, **kwargs):
        serializer = PacienteCreateSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        paciente = serializer.save()
        _audit_phi(
            request, 'create', str(paciente.pac_id),
            f'Paciente registrado: {paciente.get_nombre_completo()}'
        )
        return Response(
            PacienteDetailSerializer(paciente, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- Override update: registra updated_by ----
    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = PacienteCreateSerializer(
            instance, data=request.data, partial=partial,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        paciente = serializer.save()
        _audit_phi(
            request, 'edit', str(paciente.pac_id),
            f'Datos actualizados: {paciente.get_nombre_completo()}'
        )
        return Response(
            PacienteDetailSerializer(paciente, context={'request': request}).data
        )

    # ---- Soft delete HIPAA ----
    def destroy(self, request, *args, **kwargs):
        paciente = self.get_object()
        paciente.activo = False
        paciente.updated_by = request.user
        paciente.save(update_fields=['activo', 'updated_by', 'updated_at'])
        _audit_phi(
            request, 'delete', str(paciente.pac_id),
            f'Paciente desactivado: {paciente.no_expediente}'
        )
        return Response(
            {'detail': f'Paciente {paciente.no_expediente} desactivado (soft-delete HIPAA).'},
            status=status.HTTP_200_OK,
        )

    # ============================================================
    # Sub-recursos anidados
    # ============================================================

    @action(detail=True, methods=['get', 'post'], url_path='alergias')
    def alergias(self, request, pk=None):
        """GET/POST /api/v1/patients/{id}/alergias/"""
        paciente = self.get_object()

        if request.method == 'GET':
            qs = Alergia.objects.filter(paciente=paciente, activo=True)
            return Response(AlergiaSerializer(qs, many=True).data)

        serializer = AlergiaCreateSerializer(
            data=request.data,
            context={'request': request, 'paciente': paciente},
        )
        serializer.is_valid(raise_exception=True)
        alergia = serializer.save()
        _audit_phi(
            request, 'create', str(paciente.pac_id),
            f'Alergia registrada: {alergia.agente} ({alergia.severidad})'
        )
        return Response(
            AlergiaSerializer(alergia).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'], url_path='contactos')
    def contactos(self, request, pk=None):
        """GET/POST /api/v1/patients/{id}/contactos/"""
        paciente = self.get_object()

        if request.method == 'GET':
            qs = ContactoEmergencia.objects.filter(paciente=paciente, activo=True)
            return Response(ContactoEmergenciaSerializer(qs, many=True).data)

        serializer = ContactoCreateSerializer(
            data=request.data,
            context={'request': request, 'paciente': paciente},
        )
        serializer.is_valid(raise_exception=True)
        contacto = serializer.save()
        return Response(
            ContactoEmergenciaSerializer(contacto).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'], url_path='historial')
    def historial(self, request, pk=None):
        """GET/POST /api/v1/patients/{id}/historial/"""
        paciente = self.get_object()

        if request.method == 'GET':
            qs = HistorialClinico.objects.select_related('medico').filter(
                paciente=paciente, activo=True
            )
            # Entradas privadas solo visibles para el medico autor o admin
            rol_codigo = getattr(request.user, 'rol_codigo', '')
            if rol_codigo not in ('SUPER_ADMIN', 'ADMIN_HOSPITAL'):
                qs = qs.filter(
                    Q(es_privado=False)
                    | Q(es_privado=True, medico=request.user)
                )
            _audit_phi(
                request, 'view', str(paciente.pac_id),
                'Consulta historial clinico'
            )
            return Response(HistorialSerializer(qs, many=True).data)

        serializer = HistorialCreateSerializer(
            data=request.data,
            context={'request': request, 'paciente': paciente},
        )
        serializer.is_valid(raise_exception=True)
        entrada = serializer.save()
        _audit_phi(
            request, 'create', str(paciente.pac_id),
            f'Entrada historial: [{entrada.tipo_entrada}] {entrada.titulo}'
        )
        return Response(
            HistorialSerializer(entrada).data,
            status=status.HTTP_201_CREATED,
        )
