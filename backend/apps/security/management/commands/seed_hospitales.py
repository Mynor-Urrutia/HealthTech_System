"""
HealthTech Solutions — Management Command: seed_hospitales
Inserta o actualiza los 10 hospitales de la red en la base de datos.
Idempotente: seguro de ejecutar múltiples veces.

Uso:
    python manage.py seed_hospitales
    python manage.py seed_hospitales --reset  (elimina todos y recrea)
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.security.models import Hospital

HOSPITALES = [
    {
        'hospital_id': 1,
        'codigo': 'HOSP-001',
        'nombre': 'Hospital Central HealthTech',
        'nombre_corto': 'H. Central',
        'direccion': '6a Av. 1-65, Zona 1, Ciudad de Guatemala',
        'telefono': '+502 2301-0001',
        'email': 'hosp001@healthtech.gt',
        'nit': '1000001-1',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 2,
        'codigo': 'HOSP-002',
        'nombre': 'Hospital Norte HealthTech',
        'nombre_corto': 'H. Norte',
        'direccion': '4a Calle 15-29, Zona 3, Quetzaltenango',
        'telefono': '+502 2301-0002',
        'email': 'hosp002@healthtech.gt',
        'nit': '1000002-2',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 3,
        'codigo': 'HOSP-003',
        'nombre': 'Hospital Sur HealthTech',
        'nombre_corto': 'H. Sur',
        'direccion': 'Av. El Comercio, Escuintla',
        'telefono': '+502 2301-0003',
        'email': 'hosp003@healthtech.gt',
        'nit': '1000003-3',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 4,
        'codigo': 'HOSP-004',
        'nombre': 'Hospital Oriente HealthTech',
        'nombre_corto': 'H. Oriente',
        'direccion': '3a Av. Norte, Chiquimula',
        'telefono': '+502 2301-0004',
        'email': 'hosp004@healthtech.gt',
        'nit': '1000004-4',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 5,
        'codigo': 'HOSP-005',
        'nombre': 'Hospital Occidente HealthTech',
        'nombre_corto': 'H. Occidente',
        'direccion': '1a Calle 3-58, Zona 1, Huehuetenango',
        'telefono': '+502 2301-0005',
        'email': 'hosp005@healthtech.gt',
        'nit': '1000005-5',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 6,
        'codigo': 'HOSP-006',
        'nombre': 'Hospital Pediátrico HealthTech',
        'nombre_corto': 'H. Pediátrico',
        'direccion': '11 Av. 11-64, Zona 11, Guatemala',
        'telefono': '+502 2301-0006',
        'email': 'hosp006@healthtech.gt',
        'nit': '1000006-6',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 7,
        'codigo': 'HOSP-007',
        'nombre': 'Hospital Maternidad HealthTech',
        'nombre_corto': 'H. Maternidad',
        'direccion': '9a Calle 10-65, Zona 1, Guatemala',
        'telefono': '+502 2301-0007',
        'email': 'hosp007@healthtech.gt',
        'nit': '1000007-7',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 8,
        'codigo': 'HOSP-008',
        'nombre': 'Hospital Alta Verapaz HealthTech',
        'nombre_corto': 'H. Alta Verapaz',
        'direccion': '1a Av. 2-15, Zona 4, Cobán, Alta Verapaz',
        'telefono': '+502 2301-0008',
        'email': 'hosp008@healthtech.gt',
        'nit': '1000008-8',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 9,
        'codigo': 'HOSP-009',
        'nombre': 'Hospital Petén HealthTech',
        'nombre_corto': 'H. Petén',
        'direccion': 'Calle Central, Flores, Petén',
        'telefono': '+502 2301-0009',
        'email': 'hosp009@healthtech.gt',
        'nit': '1000009-9',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
    {
        'hospital_id': 10,
        'codigo': 'HOSP-010',
        'nombre': 'Hospital Pacífico HealthTech',
        'nombre_corto': 'H. Pacífico',
        'direccion': 'Av. Champerico, Retalhuleu',
        'telefono': '+502 2301-0010',
        'email': 'hosp010@healthtech.gt',
        'nit': '1000010-0',
        'timezone': 'America/Guatemala',
        'activo': True,
    },
]


class Command(BaseCommand):
    help = 'Inserta o actualiza los 10 hospitales de la red HealthTech.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Eliminar todos los hospitales y recrearlos (USE WITH CAUTION).',
        )

    def handle(self, *args, **options):
        if options['reset']:
            self.stdout.write(self.style.WARNING('Eliminando hospitales existentes...'))
            Hospital.objects.all().delete()

        created = updated = 0
        with transaction.atomic():
            for data in HOSPITALES:
                hosp, is_new = Hospital.objects.update_or_create(
                    hospital_id=data['hospital_id'],
                    defaults=data,
                )
                if is_new:
                    created += 1
                    self.stdout.write(f'  [+] Creado: [{hosp.codigo}] {hosp.nombre}')
                else:
                    updated += 1
                    self.stdout.write(f'  [~] Actualizado: [{hosp.codigo}] {hosp.nombre}')

        self.stdout.write(self.style.SUCCESS(
            f'\n[OK] Completado: {created} hospitales creados, {updated} actualizados.'
        ))
        self.stdout.write(f'   Total en BD: {Hospital.objects.count()} hospitales.')
