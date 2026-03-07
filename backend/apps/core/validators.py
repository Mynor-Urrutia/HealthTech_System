"""
HealthTech Solutions — Validadores de Contraseña HIPAA
45 CFR §164.308(a)(5)(ii)(D): contraseñas complejas requeridas.

Reglas HIPAA mínimas:
  ✓ 10+ caracteres
  ✓ Al menos 1 mayúscula
  ✓ Al menos 1 minúscula
  ✓ Al menos 1 dígito
  ✓ Al menos 1 carácter especial
  ✓ No contiene el username
  ✓ No es una contraseña común

Registrar en settings/base.py → AUTH_PASSWORD_VALIDATORS
"""

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class HIPAAPasswordValidator:
    """
    Valida que la contraseña cumpla los requisitos de complejidad HIPAA.
    HIPAA 45 CFR §164.308(a)(5)(ii)(D).
    """

    MIN_LENGTH         = 10
    REQUIRE_UPPERCASE  = True
    REQUIRE_LOWERCASE  = True
    REQUIRE_DIGIT      = True
    REQUIRE_SPECIAL    = True

    SPECIAL_CHARS = r"""!@#$%^&*()_+-=[]{}|;':",.<>?/~`\\"""

    def validate(self, password: str, user=None):
        errors = []

        if len(password) < self.MIN_LENGTH:
            errors.append(
                _(f'La contraseña debe tener al menos {self.MIN_LENGTH} caracteres.')
            )

        if self.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append(_(
                'La contraseña debe contener al menos una letra mayúscula (A-Z).'
            ))

        if self.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append(_(
                'La contraseña debe contener al menos una letra minúscula (a-z).'
            ))

        if self.REQUIRE_DIGIT and not re.search(r'\d', password):
            errors.append(_(
                'La contraseña debe contener al menos un dígito (0-9).'
            ))

        if self.REQUIRE_SPECIAL and not re.search(
            r'[!@#$%^&*()\-_=+\[\]{}|;:\'",.<>?/~`\\]', password
        ):
            errors.append(_(
                'La contraseña debe contener al menos un carácter especial '
                '(!@#$%^&*()-_=+[]{}|;:\'",.<>?/~`).'
            ))

        # No debe contener el username completo (case-insensitive)
        if user and hasattr(user, 'get_username'):
            username = user.get_username()
            if username and username.lower() in password.lower():
                errors.append(_(
                    'La contraseña no puede contener el nombre de usuario.'
                ))

        # Detectar secuencias repetidas simples (ej: aaaa, 1111)
        if re.search(r'(.)\1{3,}', password):
            errors.append(_(
                'La contraseña no puede contener 4 o más caracteres iguales consecutivos.'
            ))

        # Detectar secuencias numéricas simples (ej: 1234, 9876)
        digits = re.findall(r'\d+', password)
        for d in digits:
            if len(d) >= 4:
                nums = [int(c) for c in d]
                diffs = [nums[i+1] - nums[i] for i in range(len(nums)-1)]
                if all(x == 1 for x in diffs) or all(x == -1 for x in diffs):
                    errors.append(_(
                        'La contraseña no puede contener secuencias numéricas simples (ej: 1234, 9876).'
                    ))
                    break

        if errors:
            raise ValidationError(errors)

    def get_help_text(self) -> str:
        return _(
            f'La contraseña debe tener al menos {self.MIN_LENGTH} caracteres, '
            'incluir mayúsculas, minúsculas, dígitos y caracteres especiales. '
            'Requisito HIPAA 45 CFR §164.308(a)(5)(ii)(D).'
        )


class MaximumLengthValidator:
    """Previene ataques de DoS con contraseñas extremadamente largas."""

    MAX_LENGTH = 128

    def validate(self, password: str, user=None):
        if len(password) > self.MAX_LENGTH:
            raise ValidationError(
                _(f'La contraseña no puede exceder {self.MAX_LENGTH} caracteres.'),
                code='password_too_long',
            )

    def get_help_text(self) -> str:
        return _(f'La contraseña no debe exceder {self.MAX_LENGTH} caracteres.')
