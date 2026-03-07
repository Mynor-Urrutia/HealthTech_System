"""
HealthTech Solutions — conftest.py raíz
Fixtures compartidos por todos los módulos de test.

NOTA: NO se sobreescribe django_db_setup — pytest-django lo maneja
automáticamente creando las tablas via migrate en SQLite.
"""
import pytest


@pytest.fixture
def api_client():
    """DRF TestAPIClient para todos los tests."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def hospital(db):
    """Hospital de prueba reutilizable."""
    from apps.security.models import Hospital
    return Hospital.objects.create(
        codigo='HOSP-TEST',
        nombre='Hospital de Prueba HealthTech',
        nombre_corto='H. Prueba',
        nit='9999999-0',
    )


@pytest.fixture
def rol_medico(db):
    """Rol MEDICO de prueba."""
    from apps.security.models import Rol
    return Rol.objects.create(
        codigo='MEDICO',
        nombre='Médico',
        nivel=3,
        es_sistema=True,
    )


@pytest.fixture
def rol_admin(db):
    """Rol ADMIN_HOSPITAL de prueba."""
    from apps.security.models import Rol
    return Rol.objects.create(
        codigo='ADMIN_HOSPITAL',
        nombre='Administrador de Hospital',
        nivel=2,
        es_sistema=True,
    )


@pytest.fixture
def rol_super_admin(db):
    """Rol SUPER_ADMIN de prueba."""
    from apps.security.models import Rol
    return Rol.objects.create(
        codigo='SUPER_ADMIN',
        nombre='Super Administrador',
        nivel=1,
        es_sistema=True,
    )


@pytest.fixture
def usuario_medico(db, hospital, rol_medico):
    """Usuario médico de prueba autenticado."""
    from apps.security.models import Usuario
    user = Usuario.objects.create_user(
        username='dr.test',
        email='dr.test@healthtech.gt',
        password='TestPass2026!',
        hospital_id=hospital.hospital_id,   # integer requerido por UsuarioManager
        rol=rol_medico,
        primer_nombre='Juan',
        primer_apellido='Pérez',
        tipo_personal='MEDICO',
    )
    return user


@pytest.fixture
def usuario_admin(db, hospital, rol_admin):
    """Usuario administrador de hospital de prueba."""
    from apps.security.models import Usuario
    user = Usuario.objects.create_user(
        username='admin.test',
        email='admin.test@healthtech.gt',
        password='TestAdmin2026!',
        hospital_id=hospital.hospital_id,   # integer requerido por UsuarioManager
        rol=rol_admin,
        primer_nombre='Ana',
        primer_apellido='García',
        tipo_personal='ADMINISTRATIVO',
    )
    return user


@pytest.fixture
def auth_client_medico(api_client, usuario_medico):
    """API Client autenticado como médico."""
    api_client.force_authenticate(user=usuario_medico)
    return api_client


@pytest.fixture
def auth_client_admin(api_client, usuario_admin):
    """API Client autenticado como admin."""
    api_client.force_authenticate(user=usuario_admin)
    return api_client
