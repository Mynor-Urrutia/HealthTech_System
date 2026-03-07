"""
HealthTech Solutions — Permisos RBAC base
Roles jerarquicos para el sistema hospitalario.

NOTA: request.user.rol es un objeto Rol (ForeignKey).
      Usar request.user.rol_codigo (property) o request.user.rol.codigo
      para comparar con strings de rol.
"""

from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """Acceso total — red de hospitales completa."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'rol_codigo', None) == 'SUPER_ADMIN'
        )


class IsAdminHospital(BasePermission):
    """Administrador de un hospital especifico."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'rol_codigo', '') in ('SUPER_ADMIN', 'ADMIN_HOSPITAL')
        )


class IsMedico(BasePermission):
    """Personal medico (medicos y admin)."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'rol_codigo', '') in ('SUPER_ADMIN', 'ADMIN_HOSPITAL', 'MEDICO')
        )


class IsPersonalClinico(BasePermission):
    """Cualquier personal con acceso a la plataforma clinica."""
    ROLES_CLINICOS = (
        'SUPER_ADMIN', 'ADMIN_HOSPITAL', 'MEDICO',
        'ENFERMERO', 'FARMACEUTICO', 'LABORATORISTA',
        'ADMINISTRATIVO', 'BODEGUERO', 'AUDITOR', 'PROVEEDOR',
    )

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'rol_codigo', '') in self.ROLES_CLINICOS
        )


class IsAuditor(BasePermission):
    """Auditores — solo lectura; Super Admin puede leer y escribir."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        rol = getattr(request.user, 'rol_codigo', '')
        if rol == 'AUDITOR':
            return request.method in ('GET', 'HEAD', 'OPTIONS')
        return rol == 'SUPER_ADMIN'


class SameHospitalOnly(BasePermission):
    """
    Garantiza que el usuario solo acceda a objetos de su propio hospital.
    Usado como permiso de objeto (has_object_permission).
    Complementa VPD — doble capa de seguridad en DEV.
    """
    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'rol_codigo', '') == 'SUPER_ADMIN':
            return True
        obj_hospital_id = getattr(obj, 'hospital_id', None)
        return obj_hospital_id == request.user.hospital_id
