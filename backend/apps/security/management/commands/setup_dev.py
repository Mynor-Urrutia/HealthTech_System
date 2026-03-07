"""
manage.py setup_dev
===================
Inicializa la base de datos Oracle 21c XE (entorno DEV) con:
  1. Migraciones pendientes
  2. Hospital de desarrollo (HOSPITAL_DEV)
  3. Roles del sistema (10 roles)
  4. Permisos granulares por modulo (8 acciones x 10 modulos)
  5. Asignacion de permisos a roles
  6. Superadmin de desarrollo

Uso:
    python manage.py setup_dev
    python manage.py setup_dev --reset-admin   # Solo resetea la contrasena del admin

Idempotente: seguro de ejecutar multiples veces.
"""

import sys
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Inicializa la BD de desarrollo con datos semilla (hospital, roles, permisos, superadmin).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-admin',
            action='store_true',
            help='Solo resetea la contrasena del superadmin de DEV.',
        )
        parser.add_argument(
            '--skip-migrations',
            action='store_true',
            help='Omite las migraciones (util si ya estan aplicadas).',
        )

    def _w(self, msg):
        """Escribe al stdout forzando UTF-8 para evitar cp1252 en Windows."""
        self.stdout.write(msg)

    def handle(self, *args, **options):
        # Reconfigura stdout a UTF-8 si el terminal no lo soporta
        if hasattr(self.stdout, '_out') and hasattr(self.stdout._out, 'reconfigure'):
            try:
                self.stdout._out.reconfigure(encoding='utf-8')
            except Exception:
                pass

        self._w(self.style.MIGRATE_HEADING('\n=== HealthTech Solutions --- setup_dev ===\n'))

        if options['reset_admin']:
            self._reset_admin()
            return

        if not options['skip_migrations']:
            self._run_migrations()

        with transaction.atomic():
            hospital = self._seed_hospital()
            self._seed_roles()
            self._seed_permisos()
            self._seed_roles_permisos()
            self._seed_superadmin(hospital)

        self._w(self.style.SUCCESS('\n[OK] setup_dev completado.\n'))
        self._print_credentials()

    # ------------------------------------------------------------------
    # PASO 1 — Migraciones
    # ------------------------------------------------------------------
    def _run_migrations(self):
        self._w('  -> Aplicando migraciones...')
        from django.core.management import call_command
        call_command('migrate', '--run-syncdb', verbosity=0)
        self._w(self.style.SUCCESS('     [OK] Migraciones aplicadas'))

    # ------------------------------------------------------------------
    # PASO 2 — Hospital de desarrollo
    # ------------------------------------------------------------------
    def _seed_hospital(self):
        from apps.security.models import Hospital
        hospital, created = Hospital.objects.get_or_create(
            codigo='HOSPITAL_DEV',
            defaults={
                'nombre':       'Hospital General de Desarrollo',
                'nombre_corto': 'HospDEV',
                'direccion':    'Zona 1, Ciudad de Guatemala',
                'telefono':     '2222-0000',
                'email':        'dev@healthtech.local',
                'nit':          '000000-0',
                'timezone':     'America/Guatemala',
                'activo':       True,
            },
        )
        tag = 'CREADO' if created else 'ya existe'
        self._w(f'  -> Hospital "{hospital.nombre}" — {self.style.SUCCESS(tag)}')
        return hospital

    # ------------------------------------------------------------------
    # PASO 3 — Roles
    # ------------------------------------------------------------------
    ROLES_DATA = [
        ('SUPER_ADMIN',    'Super Administrador',    1, True,  'Acceso total al sistema multi-hospital.'),
        ('ADMIN_HOSPITAL', 'Administrador Hospital', 2, True,  'Administra un hospital especifico.'),
        ('MEDICO',         'Medico',                 3, False, 'Atencion clinica, prescripciones y diagnosticos.'),
        ('ENFERMERO',      'Enfermero/a',            3, False, 'Cuidados de enfermeria y registros clinicos.'),
        ('FARMACEUTICO',   'Farmaceutico',           3, False, 'Dispensacion y control de medicamentos.'),
        ('LABORATORISTA',  'Laboratorista',          3, False, 'Procesamiento de examenes y resultados.'),
        ('BODEGUERO',      'Bodeguero',              4, False, 'Gestion de inventario y bodega.'),
        ('ADMINISTRATIVO', 'Administrativo',         4, False, 'Registro de pacientes y citas.'),
        ('AUDITOR',        'Auditor',                4, True,  'Acceso de solo lectura a logs HIPAA.'),
        ('PROVEEDOR',      'Proveedor',              5, False, 'Acceso externo limitado a bodega.'),
    ]

    def _seed_roles(self):
        from apps.security.models import Rol
        self._w('  -> Roles...')
        for codigo, nombre, nivel, es_sistema, descripcion in self.ROLES_DATA:
            Rol.objects.update_or_create(
                codigo=codigo,
                defaults={
                    'nombre':      nombre,
                    'nivel':       nivel,
                    'es_sistema':  es_sistema,
                    'descripcion': descripcion,
                    'activo':      True,
                },
            )
        self._w(self.style.SUCCESS(f'     [OK] {len(self.ROLES_DATA)} roles'))

    # ------------------------------------------------------------------
    # PASO 4 — Permisos (8 acciones x 10 modulos)
    # ------------------------------------------------------------------
    MODULOS = [
        'security',        # M01
        'patients',        # M02
        'appointments',    # M03
        'emergency',       # M04
        'hospitalization', # M05
        'surgery',         # M06
        'laboratory',      # M07
        'pharmacy',        # M08
        'warehouse',       # M09
        'nursing',         # M10
    ]
    ACCIONES = ['view', 'create', 'edit', 'delete', 'export', 'approve', 'dispense', 'audit']

    def _seed_permisos(self):
        from apps.security.models import Permiso
        self._w('  -> Permisos...')
        count = 0
        for modulo in self.MODULOS:
            for accion in self.ACCIONES:
                codigo = f'{modulo}.{accion}'
                _, created = Permiso.objects.get_or_create(
                    codigo=codigo,
                    defaults={
                        'modulo':      modulo,
                        'accion':      accion,
                        'descripcion': f'Permiso {accion} en modulo {modulo}',
                    },
                )
                if created:
                    count += 1
        total = len(self.MODULOS) * len(self.ACCIONES)
        self._w(self.style.SUCCESS(f'     [OK] {total} permisos ({count} nuevos)'))

    # ------------------------------------------------------------------
    # PASO 5 — Asignacion de permisos a roles
    # ------------------------------------------------------------------
    ROLES_PERMISOS = {
        'SUPER_ADMIN': '__all__',
        'ADMIN_HOSPITAL': [
            'security.view', 'security.create', 'security.edit', 'security.export',
            'patients.view', 'patients.create', 'patients.edit', 'patients.export',
            'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete',
            'emergency.view', 'emergency.create', 'emergency.edit',
            'hospitalization.view', 'hospitalization.create', 'hospitalization.edit',
            'surgery.view', 'surgery.create', 'surgery.edit', 'surgery.approve',
            'laboratory.view', 'laboratory.create', 'laboratory.edit', 'laboratory.approve',
            'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.dispense',
            'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.approve',
            'nursing.view', 'nursing.create', 'nursing.edit',
        ],
        'MEDICO': [
            'patients.view', 'patients.create', 'patients.edit',
            'appointments.view', 'appointments.create', 'appointments.edit',
            'emergency.view', 'emergency.create', 'emergency.edit', 'emergency.approve',
            'hospitalization.view', 'hospitalization.create', 'hospitalization.edit', 'hospitalization.approve',
            'surgery.view', 'surgery.create', 'surgery.edit', 'surgery.approve',
            'laboratory.view', 'laboratory.create', 'laboratory.approve',
            'pharmacy.view', 'pharmacy.create', 'pharmacy.approve',
            'nursing.view',
        ],
        'ENFERMERO': [
            'patients.view', 'patients.edit',
            'appointments.view',
            'emergency.view', 'emergency.create', 'emergency.edit',
            'hospitalization.view', 'hospitalization.edit',
            'surgery.view',
            'laboratory.view',
            'pharmacy.view', 'pharmacy.dispense',
            'nursing.view', 'nursing.create', 'nursing.edit',
        ],
        'FARMACEUTICO': [
            'patients.view',
            'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.dispense', 'pharmacy.approve',
            'warehouse.view',
        ],
        'LABORATORISTA': [
            'patients.view',
            'laboratory.view', 'laboratory.create', 'laboratory.edit', 'laboratory.approve',
        ],
        'BODEGUERO': [
            'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.approve',
            'pharmacy.view',
        ],
        'ADMINISTRATIVO': [
            'patients.view', 'patients.create', 'patients.edit',
            'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete',
            'hospitalization.view',
            'security.view',
        ],
        'AUDITOR': [
            'security.view', 'security.export', 'security.audit',
            'patients.view', 'patients.export',
            'appointments.view', 'emergency.view', 'hospitalization.view',
            'surgery.view', 'laboratory.view', 'pharmacy.view',
            'warehouse.view', 'nursing.view',
        ],
        'PROVEEDOR': [
            'warehouse.view',
        ],
    }

    def _seed_roles_permisos(self):
        from apps.security.models import Rol, Permiso, RolPermiso
        self._w('  -> Asignando permisos a roles...')

        todos_permisos = {p.codigo: p for p in Permiso.objects.all()}
        total_asignados = 0

        for rol_codigo, permisos_lista in self.ROLES_PERMISOS.items():
            try:
                rol = Rol.objects.get(codigo=rol_codigo)
            except Rol.DoesNotExist:
                self._w(self.style.WARNING(f'     [WARN] Rol {rol_codigo} no encontrado, saltando'))
                continue

            if permisos_lista == '__all__':
                permiso_objs = list(todos_permisos.values())
            else:
                permiso_objs = [todos_permisos[c] for c in permisos_lista if c in todos_permisos]

            for permiso in permiso_objs:
                _, created = RolPermiso.objects.get_or_create(rol=rol, permiso=permiso)
                if created:
                    total_asignados += 1

        self._w(self.style.SUCCESS(f'     [OK] {total_asignados} asignaciones nuevas'))

    # ------------------------------------------------------------------
    # PASO 6 — Superadmin de desarrollo
    # ------------------------------------------------------------------
    ADMIN_USERNAME = 'superadmin'
    ADMIN_PASSWORD = 'HealthTech2024!'

    def _seed_superadmin(self, hospital):
        from apps.security.models import Usuario, Rol
        self._w('  -> Superadmin...')

        try:
            rol_super = Rol.objects.get(codigo='SUPER_ADMIN')
        except Rol.DoesNotExist:
            raise CommandError('Rol SUPER_ADMIN no encontrado.')

        usuario, created = Usuario.objects.get_or_create(
            username=self.ADMIN_USERNAME,
            defaults={
                'hospital':          hospital,
                'rol':               rol_super,
                'primer_nombre':     'Super',
                'primer_apellido':   'Admin',
                'email':             'superadmin@healthtech.local',
                'tipo_personal':     'ADMINISTRATIVO',
                'activo':            True,
                'is_active':         True,
                'is_staff':          True,
                'is_superuser':      True,
                'debe_cambiar_pass': False,
            },
        )

        if created:
            usuario.set_password(self.ADMIN_PASSWORD)
            usuario.save()
            tag = self.style.SUCCESS('CREADO')
        else:
            tag = self.style.WARNING('ya existe')

        self._w(f'     [OK] Usuario "{usuario.username}" — {tag}')

    def _reset_admin(self):
        from apps.security.models import Usuario
        self._w('  -> Reseteando contrasena del superadmin...')
        try:
            usuario = Usuario.objects.get(username=self.ADMIN_USERNAME)
            usuario.set_password(self.ADMIN_PASSWORD)
            usuario.cuenta_bloqueada = False
            usuario.intentos_fallidos = 0
            usuario.save(update_fields=['password', 'cuenta_bloqueada', 'intentos_fallidos'])
            self._w(self.style.SUCCESS(f'     [OK] Contrasena reseteada para "{self.ADMIN_USERNAME}"'))
        except Usuario.DoesNotExist:
            raise CommandError('Superadmin no encontrado. Ejecuta "setup_dev" primero.')
        self._print_credentials()

    def _print_credentials(self):
        sep = '-' * 50
        self._w('\n' + sep)
        self._w(self.style.HTTP_INFO('  Credenciales de desarrollo:'))
        self._w(f'     URL API : http://localhost:8000/api/v1/')
        self._w(f'     URL App : http://localhost:5173/')
        self._w(f'     Usuario : {self.ADMIN_USERNAME}')
        self._w(f'     Password: {self.ADMIN_PASSWORD}')
        self._w(sep + '\n')
