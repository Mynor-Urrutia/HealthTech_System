"""
HealthTech Solutions — Views: Módulo de Seguridad
Endpoints: Auth (login/logout/refresh), Usuarios, Roles, Auditoría
"""

import csv
import io
import logging
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import IsSuperAdmin, IsAdminHospital, IsPersonalClinico
from apps.security.models import (
    Hospital, Rol, Usuario, Sesion, AuditoriaAcceso
)
from apps.security.serializers import (
    HospitalSerializer, RolSerializer,
    UsuarioListSerializer, UsuarioDetailSerializer,
    UsuarioCreateSerializer, CambiarPasswordSerializer,
    DesbloquearUsuarioSerializer, AuditoriaAccesoSerializer,
)
from apps.security.tokens import CustomTokenObtainSerializer

logger = logging.getLogger('healthtech.security')


# ============================================================
# AUTH — Login / Logout / Refresh
# ============================================================
class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/token/
    Retorna access + refresh token con claims de hospital y rol.
    Registra auditoría HIPAA del intento de login.
    """
    serializer_class = CustomTokenObtainSerializer
    permission_classes = [AllowAny]


class LogoutView(generics.GenericAPIView):
    """
    POST /api/v1/auth/logout/
    Revoca el refresh token y registra el logout en auditoría.
    Body: { "refresh": "<token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Se requiere el refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            jti   = token.get('jti', '')

            # Revocar sesión en BD
            Sesion.objects.filter(
                refresh_token_jti=jti, revocada=False
            ).update(
                revocada=True,
                revocada_en=timezone.now(),
                motivo_revocacion='logout',
            )

            # Blacklist en simplejwt
            token.blacklist()

            # Auditoría
            AuditoriaAcceso.objects.create(
                hospital_id=request.user.hospital_id,
                usuario=request.user,
                tipo_evento='LOGOUT',
                modulo='security',
                accion='logout',
                ip_origen=self._get_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                descripcion='Logout exitoso',
                exitoso=True,
            )

            return Response({'detail': 'Sesión cerrada correctamente.'})

        except TokenError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def _get_ip(request) -> str:
        x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
        return x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR', '0.0.0.0')


class MiPerfilView(generics.RetrieveUpdateAPIView):
    """
    GET/PUT /api/v1/auth/me/
    Perfil del usuario autenticado — solo sus propios datos.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = UsuarioDetailSerializer

    def get_object(self):
        return self.request.user


class CambiarPasswordView(generics.GenericAPIView):
    """
    POST /api/v1/auth/change-password/
    Cambia la contraseña del usuario autenticado.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = CambiarPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Revocar todas las sesiones activas al cambiar contraseña (seguridad)
        Sesion.objects.filter(
            usuario=request.user, revocada=False
        ).update(
            revocada=True,
            revocada_en=timezone.now(),
            motivo_revocacion='password_change',
        )

        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='PASSWORD_CHANGE',
            modulo='security',
            ip_origen='0.0.0.0',
            descripcion='Contraseña cambiada exitosamente',
            exitoso=True,
        )

        return Response({'detail': 'Contraseña actualizada. Por favor vuelva a iniciar sesión.'})


# ============================================================
# HOSPITALES (solo Super Admin)
# ============================================================
class HospitalViewSet(viewsets.ModelViewSet):
    """
    CRUD de hospitales — solo SUPER_ADMIN
    GET    /api/v1/auth/hospitales/
    POST   /api/v1/auth/hospitales/
    GET    /api/v1/auth/hospitales/{id}/
    PUT    /api/v1/auth/hospitales/{id}/
    DELETE /api/v1/auth/hospitales/{id}/  → desactivación lógica
    """
    queryset           = Hospital.objects.filter(activo=True)
    serializer_class   = HospitalSerializer
    permission_classes = [IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        """Desactivación lógica — nunca borrar un hospital."""
        hospital = self.get_object()
        hospital.activo = False
        hospital.save(update_fields=['activo', 'updated_at'])
        return Response(
            {'detail': f'Hospital {hospital.nombre_corto} desactivado.'},
            status=status.HTTP_200_OK,
        )


# ============================================================
# ROLES
# ============================================================
class RolViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/auth/roles/        → Todos los roles activos
    POST   /api/v1/auth/roles/        → Solo Super Admin
    PUT    /api/v1/auth/roles/{id}/   → Solo Super Admin, no roles de sistema
    """
    queryset           = Rol.objects.filter(activo=True)
    serializer_class   = RolSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsSuperAdmin()]
        return [IsPersonalClinico()]

    def destroy(self, request, *args, **kwargs):
        rol = self.get_object()
        if rol.es_sistema:
            return Response(
                {'detail': 'Los roles de sistema no pueden ser eliminados.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        rol.activo = False
        rol.save(update_fields=['activo', 'updated_at'])
        return Response({'detail': f'Rol {rol.nombre} desactivado.'})


# ============================================================
# USUARIOS
# ============================================================
class UsuarioViewSet(viewsets.ModelViewSet):
    """
    CRUD de usuarios con VPD activo en PROD.
    GET    /api/v1/auth/usuarios/
    POST   /api/v1/auth/usuarios/
    GET    /api/v1/auth/usuarios/{id}/
    PUT    /api/v1/auth/usuarios/{id}/
    POST   /api/v1/auth/usuarios/{id}/desbloquear/
    POST   /api/v1/auth/usuarios/{id}/desactivar/
    """
    permission_classes = [IsAdminHospital]
    filterset_fields   = ['tipo_personal', 'activo', 'cuenta_bloqueada']
    search_fields      = ['username', 'primer_nombre', 'primer_apellido', 'email']
    ordering_fields    = ['primer_apellido', 'primer_nombre', 'created_at']

    def get_queryset(self):
        """
        VPD filtra a nivel de BD en PROD.
        En DEV filtramos manualmente por hospital_id del usuario.
        """
        qs = Usuario.objects.select_related('rol', 'hospital').filter(is_active=True)
        user = self.request.user

        # En DEV (VPD desactivado) filtrar manualmente
        from django.conf import settings
        if not settings.VPD_ENABLED and user.rol.codigo != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCreateSerializer
        if self.action in ('retrieve', 'update', 'partial_update'):
            return UsuarioDetailSerializer
        return UsuarioListSerializer

    def destroy(self, request, *args, **kwargs):
        """Desactivación lógica — nunca borrar usuarios (HIPAA)."""
        usuario = self.get_object()
        usuario.is_active = False
        usuario.activo    = False
        usuario.save(update_fields=['is_active', 'activo', 'updated_at'])
        return Response({'detail': f'Usuario {usuario.username} desactivado.'})

    @action(detail=True, methods=['post'], url_path='desbloquear')
    def desbloquear(self, request, pk=None):
        """POST /api/v1/auth/usuarios/{id}/desbloquear/"""
        usuario = self.get_object()
        serializer = DesbloquearUsuarioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        usuario.cuenta_bloqueada  = False
        usuario.intentos_fallidos = 0
        fields = ['cuenta_bloqueada', 'intentos_fallidos', 'updated_at']

        if serializer.validated_data.get('resetear_password'):
            usuario.set_password(serializer.validated_data['nuevo_password'])
            usuario.debe_cambiar_pass = True
            fields += ['password', 'debe_cambiar_pass']

        usuario.save(update_fields=fields)

        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='ADMIN_ACTION',
            modulo='security',
            accion='desbloquear',
            tabla_afectada='SEC_USUARIOS',
            registro_id=str(usuario.usr_id),
            ip_origen='0.0.0.0',
            descripcion=f'Cuenta de {usuario.username} desbloqueada',
            exitoso=True,
        )

        return Response({'detail': f'Usuario {usuario.username} desbloqueado.'})

    @action(detail=True, methods=['post'], url_path='desactivar')
    def desactivar(self, request, pk=None):
        """POST /api/v1/auth/usuarios/{id}/desactivar/"""
        usuario = self.get_object()
        if usuario == request.user:
            return Response(
                {'detail': 'No puede desactivar su propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.activo    = False
        usuario.is_active = False
        usuario.save(update_fields=['activo', 'is_active', 'updated_at'])
        return Response({'detail': f'Usuario {usuario.username} desactivado.'})


# ============================================================
# AUDITORÍA (solo lectura — Auditores y Admin)
# ============================================================
class AuditoriaAccesoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/auth/auditoria/         → Listado con filtros
    GET /api/v1/auth/auditoria/{id}/    → Detalle
    """
    serializer_class = AuditoriaAccesoSerializer
    filterset_fields = ['tipo_evento', 'modulo', 'exitoso', 'hospital_id']
    search_fields    = ['username_intento', 'ip_origen', 'descripcion']
    ordering_fields  = ['created_at']
    ordering         = ['-created_at']

    def get_permissions(self):
        from apps.core.permissions import IsAuditor
        return [IsAuditor()]

    def get_queryset(self):
        from django.conf import settings
        qs   = AuditoriaAcceso.objects.all()
        user = self.request.user

        if not settings.VPD_ENABLED and user.rol.codigo != 'SUPER_ADMIN':
            qs = qs.filter(hospital_id=user.hospital_id)

        # Filtros de fecha desde query params
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(created_at__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(created_at__date__lte=fecha_hasta)

        return qs

    @action(detail=False, methods=['get'], url_path='reporte')
    def reporte(self, request):
        """
        GET /api/v1/auth/auditoria/reporte/
        Genera un reporte CSV del log de auditoría HIPAA.

        Query params:
          fecha_desde (YYYY-MM-DD) — inicio del período
          fecha_hasta (YYYY-MM-DD) — fin del período
          tipo_evento               — filtro por tipo de evento
          modulo                    — filtro por módulo
          usuario_id                — filtro por usuario (ID)
          format                    — 'csv' (por defecto) o 'json'

        Registra el evento EXPORT en la propia tabla de auditoría.
        Requiere rol Auditor o Admin Hospital.
        """
        # Usar el mismo queryset filtrado que el listado
        qs = self.get_queryset().select_related('usuario', 'usuario__hospital')

        # Filtro adicional por usuario específico
        usuario_id = request.query_params.get('usuario_id')
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)

        # Registrar el evento EXPORT en auditoría (HIPAA: toda exportación debe quedar registrada)
        fecha_desde = request.query_params.get('fecha_desde', 'inicio')
        fecha_hasta = request.query_params.get('fecha_hasta', 'hoy')
        AuditoriaAcceso.objects.create(
            hospital_id=request.user.hospital_id,
            usuario=request.user,
            tipo_evento='EXPORT',
            modulo='security',
            accion='reporte_auditoria_csv',
            descripcion=f'Exportación de auditoría HIPAA: {fecha_desde} → {fecha_hasta}',
            ip_origen=request.META.get('REMOTE_ADDR', '0.0.0.0'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            exitoso=True,
        )

        # Limitar exportación a 50.000 registros para evitar timeouts
        qs = qs[:50_000]

        # ---- Generar CSV ----
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        # Encabezado
        writer.writerow([
            'auditoria_id', 'timestamp', 'hospital_id',
            'usuario', 'tipo_evento', 'modulo', 'accion',
            'tabla_afectada', 'registro_id', 'ip_origen',
            'exitoso', 'descripcion',
        ])

        for a in qs:
            writer.writerow([
                a.auditoria_id,
                a.created_at.strftime('%Y-%m-%d %H:%M:%S') if a.created_at else '',
                a.hospital_id or '',
                a.usuario.username if a.usuario_id else (a.username_intento or 'anónimo'),
                a.tipo_evento,
                a.modulo,
                a.accion,
                a.tabla_afectada or '',
                a.registro_id or '',
                a.ip_origen or '',
                'SÍ' if a.exitoso else 'NO',
                a.descripcion or '',
            ])

        csv_content = output.getvalue()
        filename = (
            f'healthtech_auditoria_hipaa_'
            f'{fecha_desde}_a_{fecha_hasta}.csv'
        ).replace(' ', '_')

        response = HttpResponse(
            csv_content,
            content_type='text/csv; charset=utf-8',
        )
        # UTF-8 BOM para compatibilidad con Excel
        response.content = b'\xef\xbb\xbf' + csv_content.encode('utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Records-Exported'] = str(qs.count() if hasattr(qs, 'count') else 0)
        return response
