"""
HealthTech Solutions — Tests: Módulo de Pacientes (M02)
Cobertura:
  - Listar pacientes (requiere autenticación)
  - Crear paciente válido
  - Crear paciente con datos faltantes retorna 400
  - Obtener detalle de paciente
  - Buscar por nombre/expediente
  - Soft-delete (activo=False, no DELETE físico)
  - Aislamiento por hospital (VPD simulado)
"""
import pytest
from rest_framework import status
from django.utils import timezone
import datetime


pytestmark = pytest.mark.django_db


# ============================================================
# Fixture: payload de paciente de prueba
# ============================================================
@pytest.fixture
def payload_paciente():
    return {
        'primer_nombre':    'María',
        'primer_apellido':  'López',
        'tipo_documento':   'DPI',
        'no_documento':     '1234567890101',
        'fecha_nacimiento': '1990-06-15',
        'sexo':             'F',
        'tipo_paciente':    'GENERAL',
        'telefono_principal': '+502 5555-1234',
    }


@pytest.fixture
def paciente(db, hospital, usuario_medico):
    """Paciente de prueba creado directamente en BD."""
    from apps.patients.models import Paciente
    return Paciente.objects.create(
        hospital_id=hospital.hospital_id,
        primer_nombre='Carlos',
        primer_apellido='Ramírez',
        tipo_documento='DPI',
        no_documento='9876543210101',
        fecha_nacimiento=datetime.date(1985, 3, 20),
        sexo='M',
        tipo_paciente='GENERAL',
        no_expediente='EXP-2026-0001',
        activo=True,
        created_by=usuario_medico,
    )


# ============================================================
# Tests — Listado
# ============================================================
class TestPacienteListar:
    """Tests del endpoint GET /api/v1/patients/"""

    def test_listar_sin_autenticacion_retorna_401(self, api_client):
        resp = api_client.get('/api/v1/patients/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_listar_autenticado_retorna_200(self, auth_client_medico):
        resp = auth_client_medico.get('/api/v1/patients/')
        assert resp.status_code == status.HTTP_200_OK

    def test_listar_retorna_estructura_paginada(self, auth_client_medico):
        resp = auth_client_medico.get('/api/v1/patients/')
        data = resp.json()
        assert 'results' in data
        assert 'count' in data

    def test_listar_solo_pacientes_del_mismo_hospital(
        self, auth_client_medico, paciente, db, hospital
    ):
        """El listado solo retorna pacientes del hospital del usuario."""
        from apps.security.models import Hospital, Rol, Usuario
        from apps.patients.models import Paciente

        # Crear otro hospital
        otro_hospital = Hospital.objects.create(
            codigo='HOSP-OTRO',
            nombre='Hospital Otro',
            nombre_corto='H. Otro',
            nit='8888888-0',
        )

        # Paciente de otro hospital — NO debe aparecer
        Paciente.objects.create(
            hospital_id=otro_hospital.hospital_id,
            primer_nombre='Pedro',
            primer_apellido='Martínez',
            tipo_documento='DPI',
            no_documento='1111111110101',
            fecha_nacimiento=datetime.date(1970, 1, 1),
            sexo='M',
            tipo_paciente='GENERAL',
            no_expediente='EXP-OTRO-001',
            activo=True,
        )

        resp = auth_client_medico.get('/api/v1/patients/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        # El paciente del otro hospital NO debe aparecer
        expedientes = [p.get('no_expediente') for p in data['results']]
        assert 'EXP-OTRO-001' not in expedientes


# ============================================================
# Tests — Crear paciente
# ============================================================
class TestPacienteCrear:
    """Tests del endpoint POST /api/v1/patients/"""

    def test_crear_paciente_valido(self, auth_client_medico, payload_paciente):
        resp = auth_client_medico.post(
            '/api/v1/patients/', payload_paciente, format='json'
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data['primer_nombre'] == 'María'
        assert data['primer_apellido'] == 'López'

    def test_crear_paciente_genera_no_expediente(
        self, auth_client_medico, payload_paciente
    ):
        """Al crear un paciente se debe generar automáticamente no_expediente."""
        resp = auth_client_medico.post(
            '/api/v1/patients/', payload_paciente, format='json'
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data.get('no_expediente') is not None
        assert data.get('no_expediente') != ''

    def test_crear_sin_nombre_retorna_400(self, auth_client_medico, payload_paciente):
        """Faltan campos requeridos — retorna 400."""
        payload = payload_paciente.copy()
        del payload['primer_nombre']
        resp = auth_client_medico.post(
            '/api/v1/patients/', payload, format='json'
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_crear_sin_autenticacion_retorna_401(self, api_client, payload_paciente):
        resp = api_client.post(
            '/api/v1/patients/', payload_paciente, format='json'
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_crear_con_sexo_invalido_retorna_400(
        self, auth_client_medico, payload_paciente
    ):
        payload = payload_paciente.copy()
        payload['sexo'] = 'X'   # Valor inválido
        resp = auth_client_medico.post(
            '/api/v1/patients/', payload, format='json'
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Tests — Detalle
# ============================================================
class TestPacienteDetalle:
    """Tests del endpoint GET /api/v1/patients/{id}/"""

    def test_obtener_detalle_propio_hospital(
        self, auth_client_medico, paciente
    ):
        resp = auth_client_medico.get(f'/api/v1/patients/{paciente.pac_id}/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data['primer_apellido'] == 'Ramírez'

    def test_detalle_inexistente_retorna_404(self, auth_client_medico):
        resp = auth_client_medico.get('/api/v1/patients/999999/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_detalle_sin_autenticacion_retorna_401(self, api_client, paciente):
        resp = api_client.get(f'/api/v1/patients/{paciente.pac_id}/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================
# Tests — Búsqueda
# ============================================================
class TestPacienteBusqueda:
    """Tests de búsqueda por nombre y expediente."""

    def test_buscar_por_apellido(self, auth_client_medico, paciente):
        resp = auth_client_medico.get(
            '/api/v1/patients/', {'search': 'Ramírez'}
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data['count'] >= 1

    def test_buscar_por_expediente(self, auth_client_medico, paciente):
        resp = auth_client_medico.get(
            '/api/v1/patients/', {'search': 'EXP-2026-0001'}
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data['count'] >= 1

    def test_buscar_sin_resultados(self, auth_client_medico):
        resp = auth_client_medico.get(
            '/api/v1/patients/', {'search': 'PacienteInexistente99999'}
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data['count'] == 0


# ============================================================
# Tests — Soft Delete (HIPAA: no DELETE físico)
# ============================================================
class TestPacienteSoftDelete:
    """HIPAA requiere que los datos PHI no se eliminen físicamente."""

    def test_delete_hace_soft_delete(self, auth_client_medico, paciente):
        """DELETE debe desactivar el paciente, no eliminarlo físicamente."""
        from apps.patients.models import Paciente

        resp = auth_client_medico.delete(
            f'/api/v1/patients/{paciente.pac_id}/'
        )
        assert resp.status_code in (
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        )

        # El registro aún existe en BD con activo=False
        pac = Paciente.objects.filter(pac_id=paciente.pac_id).first()
        assert pac is not None           # No eliminado físicamente
        assert pac.activo is False       # Desactivado lógicamente

    def test_paciente_desactivado_no_aparece_en_listado(
        self, auth_client_medico, paciente
    ):
        """Paciente con activo=False no debe aparecer en el listado."""
        paciente.activo = False
        paciente.save()

        resp = auth_client_medico.get('/api/v1/patients/')
        data = resp.json()

        ids = [p.get('pac_id') for p in data['results']]
        assert paciente.pac_id not in ids
