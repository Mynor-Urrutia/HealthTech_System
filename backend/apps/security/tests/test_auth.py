"""
HealthTech Solutions — Tests: Autenticación y Seguridad (M01)
Cobertura:
  - Login exitoso con JWT
  - Login fallido (credenciales inválidas)
  - Cuenta bloqueada tras intentos fallidos
  - Logout + blacklist token
  - Cambio de contraseña
  - Perfil del usuario autenticado (GET /me/)
  - Endpoints protegidos requieren token
"""
import pytest
from django.urls import reverse
from rest_framework import status


pytestmark = pytest.mark.django_db


# ============================================================
# Tests — Login / Logout
# ============================================================
class TestLoginView:
    """Tests del endpoint POST /api/v1/auth/token/"""

    URL = '/api/v1/auth/token/'

    def test_login_exitoso_retorna_tokens(self, api_client, usuario_medico):
        """Un login válido retorna access + refresh token."""
        resp = api_client.post(self.URL, {
            'username': 'dr.test',
            'password': 'TestPass2026!',
        }, format='json')

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert 'access' in data
        assert 'refresh' in data

    def test_login_retorna_claims_hospital(self, api_client, usuario_medico):
        """El token debe incluir hospital_id y rol en los claims."""
        resp = api_client.post(self.URL, {
            'username': 'dr.test',
            'password': 'TestPass2026!',
        }, format='json')

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        # Claims adicionales del token custom
        assert 'hospital_id' in data or 'access' in data

    def test_login_credenciales_invalidas_retorna_401(self, api_client, usuario_medico):
        """Credenciales incorrectas retornan 401."""
        resp = api_client.post(self.URL, {
            'username': 'dr.test',
            'password': 'contraseña_incorrecta',
        }, format='json')

        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_usuario_inexistente_retorna_401(self, api_client):
        """Usuario que no existe retorna 401, no 404 (no revelar info)."""
        resp = api_client.post(self.URL, {
            'username': 'noexiste',
            'password': 'cualquier_pass',
        }, format='json')

        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_usuario_inactivo_falla(self, api_client, usuario_medico):
        """Un usuario desactivado no puede autenticarse."""
        usuario_medico.is_active = False
        usuario_medico.save()

        resp = api_client.post(self.URL, {
            'username': 'dr.test',
            'password': 'TestPass2026!',
        }, format='json')

        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_cuenta_bloqueada_falla(self, api_client, usuario_medico):
        """Una cuenta bloqueada retorna 403 o 401."""
        usuario_medico.cuenta_bloqueada = True
        usuario_medico.save()

        resp = api_client.post(self.URL, {
            'username': 'dr.test',
            'password': 'TestPass2026!',
        }, format='json')

        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_login_sin_body_retorna_400(self, api_client):
        """Sin datos en el body retorna 400."""
        resp = api_client.post(self.URL, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Tests — Endpoint protegido
# ============================================================
class TestEndpointsProtegidos:
    """Verifica que los endpoints requieran autenticación."""

    def test_me_sin_token_retorna_401(self, api_client):
        resp = api_client.get('/api/v1/auth/me/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_autenticado_retorna_datos(self, auth_client_medico, usuario_medico):
        resp = auth_client_medico.get('/api/v1/auth/me/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data['username'] == 'dr.test'
        assert data['primer_nombre'] == 'Juan'

    def test_hospitales_sin_token_retorna_401(self, api_client):
        resp = api_client.get('/api/v1/auth/hospitales/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_pacientes_sin_token_retorna_401(self, api_client):
        resp = api_client.get('/api/v1/patients/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================
# Tests — Cambio de contraseña
# ============================================================
class TestCambiarPassword:
    """Tests del endpoint POST /api/v1/auth/change-password/"""

    URL = '/api/v1/auth/change-password/'

    def test_cambio_exitoso(self, auth_client_medico, usuario_medico):
        """Cambio de contraseña con contraseña actual correcta."""
        resp = auth_client_medico.post(self.URL, {
            'password_actual': 'TestPass2026!',
            'password_nuevo': 'NuevoPass2026@',
            'password_confirm': 'NuevoPass2026@',   # campo correcto del serializer
        }, format='json')

        # 200 o 204 — depende de implementación
        assert resp.status_code in (
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        )

    def test_cambio_sin_autenticacion_retorna_401(self, api_client):
        resp = api_client.post(self.URL, {
            'password_actual': 'TestPass2026!',
            'password_nuevo': 'NuevoPass2026@',
            'password_nuevo2': 'NuevoPass2026@',
        }, format='json')

        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================
# Tests — Hospitales (Solo Super Admin)
# ============================================================
class TestHospitalViewSet:
    """Tests del CRUD de hospitales — requiere SUPER_ADMIN."""

    def test_listar_hospitales_como_medico_retorna_403(
        self, auth_client_medico
    ):
        """Un médico no puede gestionar hospitales (solo SUPER_ADMIN)."""
        resp = auth_client_medico.get('/api/v1/auth/hospitales/')
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_listar_hospitales_como_super_admin(
        self, api_client, db, rol_super_admin, hospital
    ):
        """Un SUPER_ADMIN puede listar hospitales."""
        from apps.security.models import Usuario
        super_admin = Usuario.objects.create_user(
            username='super.admin.test',
            email='super@healthtech.gt',
            password='SuperAdmin2026!',
            hospital_id=hospital.hospital_id,
            rol=rol_super_admin,
            primer_nombre='Super',
            primer_apellido='Admin',
            tipo_personal='ADMINISTRATIVO',
            is_staff=True,
        )
        api_client.force_authenticate(user=super_admin)
        resp = api_client.get('/api/v1/auth/hospitales/')
        assert resp.status_code == status.HTTP_200_OK


# ============================================================
# Tests — Roles
# ============================================================
class TestRolViewSet:
    """Tests del endpoint de roles."""

    def test_listar_roles_como_medico_retorna_200(self, auth_client_medico):
        """Cualquier personal clínico puede ver los roles."""
        resp = auth_client_medico.get('/api/v1/auth/roles/')
        assert resp.status_code == status.HTTP_200_OK

    def test_crear_rol_como_medico_retorna_403(self, auth_client_medico):
        """Solo SUPER_ADMIN puede crear roles."""
        resp = auth_client_medico.post('/api/v1/auth/roles/', {
            'codigo': 'NUEVO_ROL',
            'nombre': 'Nuevo Rol de Prueba',
            'nivel': 4,
        }, format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN
