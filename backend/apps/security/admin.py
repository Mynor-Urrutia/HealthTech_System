from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from apps.security.models import Hospital, Rol, Permiso, RolPermiso, Usuario, AuditoriaAcceso


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display  = ['codigo', 'nombre_corto', 'nombre', 'activo']
    list_filter   = ['activo']
    search_fields = ['codigo', 'nombre', 'nit']


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
    list_display  = ['codigo', 'nombre', 'nivel', 'es_sistema', 'activo']
    list_filter   = ['nivel', 'activo', 'es_sistema']


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display   = ['username', 'get_full_name', 'hospital', 'rol', 'activo', 'cuenta_bloqueada']
    list_filter    = ['activo', 'cuenta_bloqueada', 'tipo_personal', 'hospital']
    search_fields  = ['username', 'primer_nombre', 'primer_apellido', 'email']
    ordering       = ['primer_apellido']
    fieldsets      = (
        (None, {'fields': ('username', 'password')}),
        ('Datos personales', {'fields': (
            'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido',
            'email', 'telefono',
        )}),
        ('Hospital y rol', {'fields': ('hospital', 'rol', 'tipo_personal', 'especialidad', 'no_colegiado')}),
        ('Estado', {'fields': ('activo', 'cuenta_bloqueada', 'debe_cambiar_pass', 'is_active')}),
    )


@admin.register(AuditoriaAcceso)
class AuditoriaAccesoAdmin(admin.ModelAdmin):
    list_display   = ['created_at', 'tipo_evento', 'username_intento', 'ip_origen', 'exitoso']
    list_filter    = ['tipo_evento', 'exitoso', 'modulo']
    search_fields  = ['username_intento', 'ip_origen', 'descripcion']
    readonly_fields = [f.name for f in AuditoriaAcceso._meta.get_fields()]

    def has_add_permission(self, request):
        return False   # Auditoría: solo lectura

    def has_change_permission(self, request, obj=None):
        return False   # Inmutable

    def has_delete_permission(self, request, obj=None):
        return False   # Nunca borrar registros de auditoría
