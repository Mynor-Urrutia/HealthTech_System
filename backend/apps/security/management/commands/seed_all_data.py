import random
from datetime import timedelta, date, time
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

# Models
from apps.security.models import Hospital, Usuario, Rol
from apps.patients.models import Paciente, Alergia, ContactoEmergencia, HistorialClinico
from apps.appointments.models import Cita
from apps.hospitalization.models import Cama, Encamamiento
from apps.emergency.models import Emergencia
from apps.surgery.models import Cirugia
from apps.laboratory.models import OrdenLab, ResultadoLab
from apps.pharmacy.models import Medicamento, Dispensacion
from apps.warehouse.models import Producto, Movimiento
from apps.nursing.models import SignoVital, NotaEnfermeria
from apps.pacs.models import EstudioImagen

# Curated Realistic Data Pools
ESPECIALIDADES = ['Cardiologia', 'Pediatria', 'Medicina Interna', 'Ginecologia', 'Cirugia General', 'Traumatologia', 'Neurologia', 'Gastroenterologia']

DIAGNOSTICOS = [
    ('I10', 'Hipertension esencial (primaria)'),
    ('E11', 'Diabetes mellitus tipo 2'),
    ('J45', 'Asma'),
    ('K80', 'Colelitiasis'),
    ('K35', 'Apendicitis aguda'),
    ('J15', 'Neumonia bacteriana'),
    ('M54', 'Dorsalgia / Lumbalgia'),
    ('I20', 'Angina de pecho'),
    ('A09', 'Gastroenteritis de presunto origen infeccioso'),
    ('N20', 'Calculo de rinon y del ureter')
]

MEDICAMENTOS = [
    ('Paracetamol', 'Analgesico', 'TABLETA', '500mg', 1000),
    ('Ibuprofeno', 'Antiinflamatorio', 'TABLETA', '400mg', 800),
    ('Amoxicilina', 'Antibiotico', 'CAPSULA', '500mg', 500),
    ('Losartan', 'Antihipertensivo', 'TABLETA', '50mg', 600),
    ('Metformina', 'Antidiabetico', 'TABLETA', '850mg', 700),
    ('Omeprazol', 'Gastrointestinal', 'CAPSULA', '20mg', 900),
    ('Azitromicina', 'Antibiotico', 'TABLETA', '500mg', 300),
    ('Diclofenaco', 'Antiinflamatorio', 'INYECTABLE', '75mg/3ml', 400),
    ('Salbutamol', 'Respiratorio', 'INHALATORIA', '100mcg/dosis', 150),
    ('Loratadina', 'Antihistaminico', 'TABLETA', '10mg', 450)
]

INSUMOS_BODEGA = [
    ('Jeringa 5ml', 'MATERIAL_MEDICO', 'unidad', 5000),
    ('Gasas esteriles', 'MATERIAL_MEDICO', 'paquete', 2000),
    ('Guantes de latex', 'MATERIAL_MEDICO', 'caja', 300),
    ('Solucion Salina 0.9%', 'MATERIAL_MEDICO', 'bolsa 500ml', 1000),
    ('Cateter periferico 18G', 'MATERIAL_MEDICO', 'unidad', 800),
    ('Seda quirurgica 3-0', 'INSUMO_QUIRURGICO', 'sobre', 400),
    ('Bisturi No. 15', 'INSUMO_QUIRURGICO', 'unidad', 500),
    ('Alcohol gel', 'LIMPIEZA', 'litro', 200),
    ('Mascarillas N95', 'MATERIAL_MEDICO', 'caja', 150),
    ('Rollo papel camilla', 'LIMPIEZA', 'rollo', 100)
]

EXAMENES_LAB = [
    ('Hematologia Completa', 'SANGRE', ['Hemoglobina', 'Leucocitos', 'Plaquetas']),
    ('Quimica Sanguinea', 'SANGRE', ['Glucosa', 'Creatinina', 'BUN', 'Acido Urico']),
    ('Perfil Lipidico', 'SANGRE', ['Colesterol Total', 'Trigliceridos', 'HDL', 'LDL']),
    ('Examen General de Orina', 'ORINA', ['pH', 'Densidad', 'Leucocitos (Orina)', 'Nitritos']),
    ('Hemoglobina Glicosilada', 'SANGRE', ['HbA1c'])
]

CIRUGIAS = [
    ('Apendicectomia laparoscopica', 'Cirugia General'),
    ('Colecistectomia laparoscopica', 'Cirugia General'),
    ('Cesarea', 'Ginecologia'),
    ('Reduccion abierta de fractura', 'Traumatologia'),
    ('Hernioplastia inguinal', 'Cirugia General')
]


class Command(BaseCommand):
    help = 'Carga registros mock REALISTAS para TODOS los modulos del sistema.'

    def handle(self, *args, **options):
        self.stdout.write("Iniciando generación de datos falsos (Seed Realista)...")
        fake = Faker(['es_ES', 'es_MX'])
        
        # 1. Hospital base
        if not Hospital.objects.exists():
            self.stdout.write(self.style.ERROR("No hay hospitales. Corre setup_dev y seed_hospitales."))
            return
        hospital_main = Hospital.objects.first()
        H_ID = hospital_main.hospital_id
        
        # Roles
        roles_dict = {
            'medico': Rol.objects.filter(codigo='MEDICO').first(),
            'enfermero': Rol.objects.filter(codigo='ENFERMERO').first(),
            'farmaceutico': Rol.objects.filter(codigo='FARMACEUTICO').first(),
            'laboratorista': Rol.objects.filter(codigo='LABORATORISTA').first(),
            'bodeguero': Rol.objects.filter(codigo='BODEGUERO').first(),
        }

        # --- USUARIOS ---
        self.stdout.write("Generando Usuarios (Médicos, Enfermeros, etc)...")
        usuarios = {'medicos': [], 'enfermeros': [], 'farmaceuticos': [], 'laboratoristas': [], 'bodegueros': []}
        
        def dict_to_usr(tipo, rol_k, limit=10):
            for i in range(limit):
                usr = Usuario.objects.create(
                    hospital=hospital_main,
                    rol=roles_dict[rol_k],
                    username=f"{rol_k}_{fake.user_name()}_{i}",
                    primer_nombre=fake.first_name(),
                    primer_apellido=fake.last_name(),
                    email=fake.email(),
                    tipo_personal=tipo,
                    especialidad=random.choice(ESPECIALIDADES) if tipo == 'MEDICO' else '',
                    no_colegiado=str(fake.random_int(min=1000, max=9999)),
                    activo=True
                )
                usr.set_password('HealthTech2024!')
                usr.save()
                usuarios[f"{rol_k}s"].append(usr)

        dict_to_usr('MEDICO', 'medico', 25)
        dict_to_usr('ENFERMERO', 'enfermero', 15)
        dict_to_usr('FARMACEUTICO', 'farmaceutico', 5)
        dict_to_usr('LABORATORISTA', 'laboratorista', 5)
        dict_to_usr('BODEGUERO', 'bodeguero', 5)

        # --- PACIENTES ---
        self.stdout.write("Generando Pacientes...")
        pacientes = []
        for i in range(30):
            pac = Paciente.objects.create(
                hospital_id=H_ID,
                no_expediente=f"EXP-{fake.random_int(min=10000, max=99999)}-{i}",
                primer_nombre=fake.first_name(),
                primer_apellido=fake.last_name(),
                fecha_nacimiento=fake.date_of_birth(minimum_age=5, maximum_age=80),
                sexo=random.choice(['M', 'F']),
                tipo_documento='DPI',
                no_documento=str(fake.random_int(min=1000000000000, max=9999999999999)),
                telefono_principal=fake.phone_number()[:20],
                peso_kg=Decimal(random.uniform(45.0, 110.0)).quantize(Decimal('0.00')),
                talla_cm=Decimal(random.uniform(140.0, 190.0)).quantize(Decimal('0.00')),
                medico=random.choice(usuarios['medicos']),
                activo=True
            )
            pacientes.append(pac)
            
            # Alergias e Historial
            if random.random() > 0.5:
                Alergia.objects.create(
                    hospital_id=H_ID, paciente=pac,
                    tipo_alergia=random.choice(['MEDICAMENTO', 'ALIMENTO']),
                    agente=random.choice(['Penicilina', 'Mariscos', 'Latex', 'Nueces']),
                    severidad=random.choice(['LEVE', 'MODERADA', 'SEVERA'])
                )
            
            ContactoEmergencia.objects.create(
                hospital_id=H_ID, paciente=pac,
                nombre_completo=fake.name(),
                parentesco=random.choice(['Padre', 'Madre', 'Conyuge']),
                telefono=fake.phone_number()[:20],
                es_responsable=True
            )

        # --- FARMACIA ---
        self.stdout.write("Generando Catálogo de Farmacia...")
        medicamentos_bd = []
        for med in MEDICAMENTOS:
            m = Medicamento.objects.create(
                hospital_id=H_ID,
                nombre_generico=med[0],
                categoria=med[1],
                forma_farma=med[2],
                concentracion=med[3],
                stock_actual=med[4],
                stock_minimo=100,
                precio_unitario=Decimal(random.uniform(5.0, 150.0)).quantize(Decimal('0.00')),
                requiere_receta=med[2] in ['Antibiotico', 'Neurologico']
            )
            medicamentos_bd.append(m)

        # --- BODEGA ---
        self.stdout.write("Generando Catálogo de Bodega...")
        productos_bd = []
        for prod in INSUMOS_BODEGA:
            p = Producto.objects.create(
                hospital_id=H_ID,
                nombre=prod[0],
                categoria=prod[1],
                unidad_medida=prod[2],
                stock_actual=prod[3],
                stock_minimo=50,
                precio_unitario=Decimal(random.uniform(1.0, 50.0)).quantize(Decimal('0.00'))
            )
            productos_bd.append(p)
            
            Movimiento.objects.create(
                hospital_id=H_ID, producto=p,
                tipo_movimiento='ENTRADA',
                cantidad=prod[3], cantidad_anterior=0, cantidad_posterior=prod[3],
                motivo='Inventario Inicial',
                created_by=random.choice(usuarios['bodegueros'])
            )

        # --- MÓDULOS OPERACIONALES (Generar ~25 registros cada uno) ---
        self.stdout.write("Generando Citas, Emergencias, Encamamientos...")
        camas = [Cama.objects.create(hospital_id=H_ID, numero_cama=f"C-{i+100}", tipo_cama='GENERAL') for i in range(30)]
        
        for i in range(100):
            pac = random.choice(pacientes)
            med = random.choice(usuarios['medicos'])
            enf = random.choice(usuarios['enfermeros'])
            diag = random.choice(DIAGNOSTICOS)
            fecha_evento = fake.date_between(start_date='-30d', end_date='+15d')
            hora_evento = time(random.randint(8, 20), random.choice([0, 30]))

            # 1. Citas
            c = Cita.objects.create(
                hospital_id=H_ID, paciente=pac, medico=med,
                fecha_cita=fecha_evento, hora_inicio=hora_evento, hora_fin=time(min(hora_evento.hour+1, 23), hora_evento.minute),
                tipo_cita='CONSULTA', motivo=f"Consulta por {diag[1]}",
                estado=random.choice(['PROGRAMADA', 'COMPLETADA', 'CONFIRMADA'])
            )

            # Historial clinico
            HistorialClinico.objects.create(
                hospital_id=H_ID, paciente=pac, tipo_entrada='CONSULTA',
                titulo=f'Consulta por {diag[1]}', diagnostico_cie10=diag[0],
                descripcion=f"Paciente se presenta con sintomas de {diag[1]}. Se indica tratamiento.",
                fecha_evento=fecha_evento, medico=med
            )

            # 2. Emergencias (Si es antes de hoy)
            if fecha_evento < date.today():
                emg = Emergencia.objects.create(
                    hospital_id=H_ID, paciente=pac, medico=med, enfermero=enf,
                    fecha_ingreso=fecha_evento, hora_ingreso=hora_evento,
                    motivo_consulta=f"Dolor agudo compatible con {diag[1]}",
                    nivel_triaje=random.choice(['NARANJA', 'AMARILLO', 'VERDE']),
                    presion_sistolica=random.randint(100, 160),
                    presion_diastolica=random.randint(60, 100),
                    temperatura=Decimal(random.uniform(36.5, 39.5)).quantize(Decimal('0.0')),
                    frecuencia_cardiaca=random.randint(60, 110),
                    estado=random.choice(['ALTA', 'OBSERVACION', 'ESPERA'])
                )

                # 3. Encamamiento asociado a la emergencia
                if emg.estado == 'OBSERVACION':
                    cama = random.choice([c for c in camas if c.estado == 'DISPONIBLE'])
                    cama.estado = 'OCUPADA'
                    cama.save()
                    enc = Encamamiento.objects.create(
                        hospital_id=H_ID, paciente=pac, cama=cama, medico=med, enfermero=enf, emergencia=emg,
                        fecha_ingreso=fecha_evento, hora_ingreso=hora_evento,
                        motivo_ingreso=f"Observacion por {diag[1]}",
                        diagnostico_ingreso=diag[1], cie10_ingreso=diag[0],
                        estado='INGRESADO'
                    )
                    
                    # 4. Enfermería: Signos Vitales y Notas de evolución
                    SignoVital.objects.create(
                        hospital_id=H_ID, paciente=pac, encamamiento=enc,
                        temperatura=Decimal(random.uniform(36.5, 38.5)).quantize(Decimal('0.0')),
                        presion_sistolica=120, presion_diastolica=80, frecuencia_cardiaca=80, saturacion_o2=Decimal('98.00'),
                        created_by=enf
                    )
                    NotaEnfermeria.objects.create(
                        hospital_id=H_ID, paciente=pac, encamamiento=enc, tipo_nota='EVOLUCION',
                        contenido="Paciente estable hemodinamicamente. Tolera via oral.", created_by=enf
                    )

            # 5. Laboratorio
            if random.random() > 0.3:
                exam = random.choice(EXAMENES_LAB)
                lab = OrdenLab.objects.create(
                    hospital_id=H_ID, paciente=pac, medico_solic=med,
                    fecha_solicitud=fecha_evento, hora_solicitud=hora_evento,
                    tipo_muestra=exam[1], grupo_examen=exam[0], examenes_solicitados=', '.join(exam[2]),
                    estado='COMPLETADA' if fecha_evento < date.today() else 'PENDIENTE'
                )
                if lab.estado == 'COMPLETADA':
                    for sub_exam in exam[2]:
                        ResultadoLab.objects.create(
                            hospital_id=H_ID, orden=lab,
                            nombre_examen=sub_exam, valor=str(random.randint(50, 150)),
                            estado_resultado=random.choice(['NORMAL', 'ALTO'])
                        )

            # 6. Farmacia - Dispensaciones
            if random.random() > 0.4:
                med_bd = random.choice(medicamentos_bd)
                Dispensacion.objects.create(
                    hospital_id=H_ID, medicamento=med_bd, paciente=pac, medico_prescribe=med,
                    cantidad=Decimal(random.randint(1, 3)), dosis='1 tableta', frecuencia='Cada 8 horas',
                    duracion_dias=5, estado='DISPENSADA' if fecha_evento < date.today() else 'PENDIENTE',
                    fecha_prescripcion=fecha_evento
                )

            # 7. Cirugías
            if random.random() > 0.7:
                cir = random.choice(CIRUGIAS)
                Cirugia.objects.create(
                    hospital_id=H_ID, paciente=pac, cirujano=med,
                    fecha_programada=fecha_evento, hora_ini_prog=hora_evento,
                    quirofano=random.choice(['Quirofano 1', 'Quirofano 2', 'Quirofano Central']),
                    tipo_cirugia=cir[0], especialidad=cir[1],
                    prioridad=random.choice(['ELECTIVA', 'URGENTE']),
                    estado='COMPLETADA' if fecha_evento < date.today() else 'PROGRAMADA'
                )

            # 8. PACS / Radiología
            if random.random() > 0.6:
                EstudioImagen.objects.create(
                    hospital_id=H_ID, paciente=pac, medico_sol=med,
                    modalidad=random.choice(['XRAY', 'MRI', 'ULTRASONIDO', 'CT']),
                    region_anatomica=random.choice(['TORAX', 'ABDOMEN', 'CRANEO']),
                    descripcion_clinica=f"Descartar anomalias por {diag[1]}",
                    fecha_solicitud=fecha_evento,
                    estado='COMPLETADO' if fecha_evento < date.today() else 'SOLICITADO'
                )

        self.stdout.write(self.style.SUCCESS('\n[OK] Generación de registros MOCK (Realistas y Completos) finalizada exitosamente.\n'))
