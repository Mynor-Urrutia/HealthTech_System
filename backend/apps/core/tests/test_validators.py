"""
HealthTech Solutions — Tests: Validadores HIPAA de Contraseña
HIPAA 45 CFR §164.308(a)(5)(ii)(D)

Cobertura:
  - Longitud mínima (10 chars)
  - Mayúscula requerida
  - Minúscula requerida
  - Dígito requerido
  - Carácter especial requerido
  - No contener username
  - No caracteres repetidos (4+)
  - No secuencias numéricas
  - Longitud máxima (128)
  - Contraseña válida (pasa todas las reglas)
"""
import pytest
from django.core.exceptions import ValidationError

from apps.core.validators import HIPAAPasswordValidator, MaximumLengthValidator


# ============================================================
# Fixture: instancia del validador
# ============================================================
@pytest.fixture
def validator():
    return HIPAAPasswordValidator()


@pytest.fixture
def max_validator():
    return MaximumLengthValidator()


# ============================================================
# Tests — HIPAAPasswordValidator
# ============================================================
class TestHIPAAPasswordValidator:
    """Tests de cumplimiento HIPAA para el validador de contraseñas."""

    # --- Contraseña válida ---
    @pytest.mark.hipaa
    def test_password_valida_pasa_todas_las_reglas(self, validator):
        """Una contraseña que cumple todos los requisitos no debe lanzar error."""
        # No debe lanzar excepción
        validator.validate('Salud2026!Admin')

    @pytest.mark.hipaa
    def test_multiples_passwords_validas(self, validator):
        contraseñas_validas = [
            'Admin@2026Hlt',
            'HealthTech!99',
            'HIPAA#Compl3x',
            'Guatemala2026*',
            'P@ssw0rd!HIPAA',
        ]
        for pwd in contraseñas_validas:
            validator.validate(pwd)   # No debe lanzar

    # --- Longitud mínima ---
    @pytest.mark.hipaa
    def test_password_muy_corta_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('Abc1!xyz')   # 8 chars — menor a 10
        messages = [str(e) for e in exc_info.value.messages]
        assert any('10 caracteres' in m for m in messages)

    @pytest.mark.hipaa
    def test_password_exactamente_min_length_pasa(self, validator):
        """Exactamente 10 chars con todos los requisitos debe pasar."""
        validator.validate('Admin!2026')   # Exactamente 10

    # --- Mayúsculas ---
    @pytest.mark.hipaa
    def test_sin_mayuscula_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('admin2026!xyz')
        messages = [str(e) for e in exc_info.value.messages]
        assert any('mayúscula' in m.lower() or 'mayuscula' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_con_mayuscula_pasa(self, validator):
        validator.validate('Admin2026!xyz')   # A es mayúscula

    # --- Minúsculas ---
    @pytest.mark.hipaa
    def test_sin_minuscula_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('ADMIN2026!XYZ')
        messages = [str(e) for e in exc_info.value.messages]
        assert any('minúscula' in m.lower() or 'minuscula' in m.lower() for m in messages)

    # --- Dígitos ---
    @pytest.mark.hipaa
    def test_sin_digito_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('AdminPass!XYZ')
        messages = [str(e) for e in exc_info.value.messages]
        assert any('dígito' in m.lower() or 'digito' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_con_digito_pasa(self, validator):
        validator.validate('AdminPass!1')

    # --- Carácter especial ---
    @pytest.mark.hipaa
    def test_sin_especial_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('AdminPass12XYZ')
        messages = [str(e) for e in exc_info.value.messages]
        assert any('especial' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_especiales_validos(self, validator):
        """Verifica que cada carácter especial permitido sea aceptado."""
        especiales = '!@#$%^&*()-_=+[]{}|;:\'",.<>?/~`\\'
        for char in especiales:
            pwd = f'AdminPass1{char}'
            try:
                validator.validate(pwd)
            except ValidationError as e:
                msgs = [str(m) for m in e.messages]
                # Puede fallar por otras reglas (ej. char repetido), pero NO por falta de especial
                assert not any('especial' in m.lower() for m in msgs), \
                    f"Carácter '{char}' debería ser válido como especial, falló: {msgs}"

    # --- No contiene username ---
    @pytest.mark.hipaa
    def test_contiene_username_falla(self, validator):
        """La contraseña no debe contener el nombre de usuario."""
        class MockUser:
            def get_username(self):
                return 'drperez'

        with pytest.raises(ValidationError) as exc_info:
            validator.validate('Admin!drperez2026', user=MockUser())
        messages = [str(e) for e in exc_info.value.messages]
        assert any('usuario' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_contiene_username_case_insensitive(self, validator):
        """La verificación de username debe ser case-insensitive."""
        class MockUser:
            def get_username(self):
                return 'DrPerez'

        with pytest.raises(ValidationError):
            validator.validate('Admin!drperez2026', user=MockUser())

    @pytest.mark.hipaa
    def test_sin_username_en_contexto_no_falla(self, validator):
        """Sin user=None no debe verificar username."""
        validator.validate('Admin!Pass2026')   # Sin user, no debe fallar

    # --- Caracteres repetidos ---
    @pytest.mark.hipaa
    def test_cuatro_chars_repetidos_falla(self, validator):
        # Regex es case-sensitive: 'aaaa' son 4 minúsculas iguales
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('Zaaaa!Admin26')   # 'aaaa' — 4 iguales consecutivos
        messages = [str(e) for e in exc_info.value.messages]
        assert any('consecutivos' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_tres_chars_repetidos_pasa(self, validator):
        """3 caracteres repetidos (bajo el umbral de 4) deben pasar."""
        validator.validate('Aaa!Admin2026')   # solo 'aaa', 3 repetidos — OK

    @pytest.mark.hipaa
    def test_cuatro_nums_repetidos_falla(self, validator):
        with pytest.raises(ValidationError):
            validator.validate('Admin!1111Pass')   # '1111' repetido

    # --- Secuencias numéricas ---
    @pytest.mark.hipaa
    def test_secuencia_ascendente_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('Admin!1234Pass')   # '1234' secuencial
        messages = [str(e) for e in exc_info.value.messages]
        assert any('secuencia' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_secuencia_descendente_falla(self, validator):
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('Admin!9876Pass')   # '9876' secuencial
        messages = [str(e) for e in exc_info.value.messages]
        assert any('secuencia' in m.lower() for m in messages)

    @pytest.mark.hipaa
    def test_tres_digitos_secuenciales_pasa(self, validator):
        """3 dígitos secuenciales están bajo el umbral de 4."""
        validator.validate('Admin!123Pass')   # solo '123' — OK

    # --- Múltiples errores acumulados ---
    @pytest.mark.hipaa
    def test_multiple_errores_reportados(self, validator):
        """Una contraseña muy débil debe reportar múltiples errores."""
        with pytest.raises(ValidationError) as exc_info:
            validator.validate('pass')   # Falla: longitud, upper, digit, special
        assert len(exc_info.value.messages) >= 3

    # --- get_help_text ---
    def test_get_help_text_contiene_hipaa_ref(self, validator):
        help_text = validator.get_help_text()
        assert 'HIPAA' in help_text or '164.308' in help_text
        assert '10' in help_text   # MIN_LENGTH


# ============================================================
# Tests — MaximumLengthValidator
# ============================================================
class TestMaximumLengthValidator:
    """Tests para el validador de longitud máxima (anti-DoS)."""

    def test_password_128_chars_pasa(self, max_validator):
        pwd = 'A' * 127 + '!'   # Exactamente 128 chars
        max_validator.validate(pwd)

    def test_password_129_chars_falla(self, max_validator):
        pwd = 'A' * 128 + '!'   # 129 chars — supera el límite
        with pytest.raises(ValidationError) as exc_info:
            max_validator.validate(pwd)
        assert '128' in str(exc_info.value)

    def test_password_muy_larga_falla(self, max_validator):
        pwd = 'A' * 1000
        with pytest.raises(ValidationError):
            max_validator.validate(pwd)

    def test_get_help_text_menciona_max(self, max_validator):
        help_text = max_validator.get_help_text()
        assert '128' in help_text
