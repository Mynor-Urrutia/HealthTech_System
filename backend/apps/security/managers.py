"""
HealthTech Solutions — Custom User Manager
Compatible con AbstractBaseUser para Oracle 19c
"""

from django.contrib.auth.models import BaseUserManager


class UsuarioManager(BaseUserManager):

    def create_user(self, username, email, password, hospital_id, rol, **extra_fields):
        if not username:
            raise ValueError('El username es obligatorio.')
        if not email:
            raise ValueError('El email es obligatorio.')
        if not hospital_id:
            raise ValueError('El hospital_id es obligatorio.')

        email = self.normalize_email(email)
        user = self.model(
            username=username,
            email=email,
            hospital_id=hospital_id,
            rol=rol,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password, **extra_fields):
        """
        Crea un superusuario de sistema (SUPER_ADMIN).
        hospital_id=0 indica acceso a toda la red.
        """
        from apps.security.models import Rol
        try:
            rol_superadmin = Rol.objects.get(codigo='SUPER_ADMIN')
        except Rol.DoesNotExist:
            raise ValueError(
                'No existe el rol SUPER_ADMIN. '
                'Ejecuta los seeds de la BD primero.'
            )

        extra_fields.setdefault('tipo_personal', 'OTRO')
        extra_fields.setdefault('primer_nombre', 'Super')
        extra_fields.setdefault('primer_apellido', 'Admin')
        extra_fields.setdefault('activo', True)

        return self.create_user(
            username=username,
            email=email,
            password=password,
            hospital_id=0,          # 0 = acceso global (sin VPD)
            rol=rol_superadmin,
            **extra_fields,
        )
