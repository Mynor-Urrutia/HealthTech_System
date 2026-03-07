"""
HealthTech Solutions — JWT Personalizado
Agrega hospital_id, rol y nombre completo al payload del token.
Referenciado en settings/base.py → SIMPLE_JWT.TOKEN_OBTAIN_SERIALIZER
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
import logging

logger = logging.getLogger('healthtech.security')


class HealthTechRefreshToken(RefreshToken):
    """
    Extiende RefreshToken para agregar claims personalizados
    usados por el frontend y el middleware VPD.
    """

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)

        # ---- Claims personalizados en el payload ----
        token['hospital_id']    = user.hospital_id
        token['hospital_nombre']= user.hospital.nombre_corto if user.hospital_id else 'Sistema'
        token['rol']            = user.rol.codigo
        token['rol_nombre']     = user.rol.nombre
        token['full_name']      = user.get_full_name()
        token['tipo_personal']  = user.tipo_personal
        token['debe_cambiar_pass'] = user.debe_cambiar_pass

        return token


class CustomTokenObtainSerializer(TokenObtainPairSerializer):
    """
    Serializer de login personalizado.
    Referenciado en: settings/base.py → SIMPLE_JWT.TOKEN_OBTAIN_SERIALIZER

    Extiende el login estándar para:
      1. Verificar que la cuenta no esté bloqueada
      2. Registrar intentos fallidos (bloqueo tras 5 intentos)
      3. Agregar claims de hospital y rol al JWT
      4. Retornar datos del usuario en la respuesta
    """

    @classmethod
    def get_token(cls, user) -> HealthTechRefreshToken:
        return HealthTechRefreshToken.for_user(user)

    def validate(self, attrs):
        from apps.security.models import AuditoriaAcceso

        username = attrs.get(self.username_field, '')
        request  = self.context.get('request')
        ip       = self._get_client_ip(request)
        ua       = request.META.get('HTTP_USER_AGENT', '')[:500] if request else ''

        # ---- Buscar usuario antes de validar contraseña ----
        from apps.security.models import Usuario
        from rest_framework.exceptions import AuthenticationFailed
        try:
            user = Usuario.objects.select_related('rol', 'hospital').get(username=username)
        except Usuario.DoesNotExist:
            self._log_auditoria(
                hospital_id=None, usuario=None, username_intento=username,
                tipo_evento='LOGIN_FAIL', exitoso=False,
                descripcion='Usuario no existe', ip=ip, ua=ua,
            )
            # Retornar 401 genérico — no revelar si el usuario existe (HIPAA)
            raise AuthenticationFailed('Credenciales inválidas.')

        # ---- Cuenta bloqueada ----
        if user.cuenta_bloqueada:
            self._log_auditoria(
                hospital_id=user.hospital_id, usuario=user, username_intento=username,
                tipo_evento='LOGIN_FAIL', exitoso=False,
                descripcion='Cuenta bloqueada por exceso de intentos fallidos',
                ip=ip, ua=ua,
            )
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed(
                'Cuenta bloqueada. Contacte al administrador del hospital.'
            )

        # ---- Usuario inactivo ----
        if not user.activo or not user.is_active:
            self._log_auditoria(
                hospital_id=user.hospital_id, usuario=user, username_intento=username,
                tipo_evento='LOGIN_FAIL', exitoso=False,
                descripcion='Usuario inactivo', ip=ip, ua=ua,
            )
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed('Usuario inactivo.')

        # ---- Validar credenciales (lanza excepción si falla) ----
        try:
            data = super().validate(attrs)
        except Exception:
            user.incrementar_intento_fallido()
            self._log_auditoria(
                hospital_id=user.hospital_id, usuario=user, username_intento=username,
                tipo_evento='LOGIN_FAIL', exitoso=False,
                descripcion=f'Contraseña incorrecta (intento {user.intentos_fallidos})',
                ip=ip, ua=ua,
            )
            if user.cuenta_bloqueada:
                self._log_auditoria(
                    hospital_id=user.hospital_id, usuario=user, username_intento=username,
                    tipo_evento='ACCOUNT_LOCKED', exitoso=False,
                    descripcion='Cuenta bloqueada automáticamente tras 5 intentos',
                    ip=ip, ua=ua,
                )
            raise

        # ---- Login exitoso ----
        user.resetear_intentos()

        self._log_auditoria(
            hospital_id=user.hospital_id, usuario=user, username_intento=username,
            tipo_evento='LOGIN_OK', exitoso=True,
            descripcion=f'Login exitoso desde {ip}',
            ip=ip, ua=ua,
        )

        # ---- Datos del usuario en la respuesta ----
        data['user'] = {
            'id':               user.usr_id,
            'username':         user.username,
            'full_name':        user.get_full_name(),
            'email':            user.email,
            'rol':              user.rol.codigo,
            'rol_nombre':       user.rol.nombre,
            'hospital_id':      user.hospital_id,
            'hospital_nombre':  user.hospital.nombre_corto,
            'tipo_personal':    user.tipo_personal,
            'foto_s3_key':      user.foto_s3_key,
            'debe_cambiar_pass': user.debe_cambiar_pass,
        }

        return data

    def _log_auditoria(self, hospital_id, usuario, username_intento,
                       tipo_evento, exitoso, descripcion, ip, ua):
        """Registra el evento de acceso en la tabla de auditoría HIPAA."""
        try:
            AuditoriaAcceso.objects.create(
                hospital_id=hospital_id,
                usuario=usuario,
                username_intento=username_intento,
                tipo_evento=tipo_evento,
                modulo='security',
                accion='login',
                ip_origen=ip or '0.0.0.0',
                user_agent=ua,
                descripcion=descripcion,
                exitoso=exitoso,
            )
        except Exception as e:
            logger.error(f'Error registrando auditoría: {e}')

    @staticmethod
    def _get_client_ip(request) -> str:
        if not request:
            return '0.0.0.0'
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '0.0.0.0')
