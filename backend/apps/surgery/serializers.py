"""
HealthTech Solutions — Serializers: Módulo Cirugía (M06)
HIPAA Data Minimization:
  - List: campos mínimos para tabla/agenda
  - Detail: campos completos con PHI
  - Create: campos requeridos para programar
  - Actions: validaciones para transiciones de estado
"""

from rest_framework import serializers

from .models import Cirugia, ESTADOS_ACTIVOS


# ============================================================
# 1. CirugiaListSerializer — Vista de agenda / tabla
# ============================================================
class CirugiaListSerializer(serializers.ModelSerializer):
    paciente_nombre     = serializers.SerializerMethodField()
    paciente_expediente = serializers.SerializerMethodField()
    cirujano_nombre     = serializers.SerializerMethodField()
    estado_display      = serializers.CharField(source='get_estado_display',       read_only=True)
    prioridad_display   = serializers.CharField(source='get_prioridad_display',    read_only=True)
    tipo_anestesia_display = serializers.CharField(source='get_tipo_anestesia_display', read_only=True)
    hora_ini_fmt        = serializers.SerializerMethodField()
    hora_fin_fmt        = serializers.SerializerMethodField()

    class Meta:
        model  = Cirugia
        fields = [
            'cir_id',
            'fecha_programada', 'hora_ini_prog', 'hora_ini_fmt',
            'hora_fin_prog',    'hora_fin_fmt',
            'duracion_est_min',
            'quirofano',
            'tipo_cirugia', 'especialidad',
            'prioridad', 'prioridad_display',
            'tipo_anestesia', 'tipo_anestesia_display',
            'estado', 'estado_display',
            'paciente_nombre', 'paciente_expediente',
            'cirujano_nombre',
            'activo', 'hospital_id',
        ]

    def get_paciente_nombre(self, obj):
        p = obj.paciente
        if not p:
            return ''
        return f"{p.primer_nombre} {p.primer_apellido}".strip()

    def get_paciente_expediente(self, obj):
        return obj.paciente.no_expediente if obj.paciente else ''

    def get_cirujano_nombre(self, obj):
        u = obj.cirujano
        if not u:
            return ''
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username

    def get_hora_ini_fmt(self, obj):
        return obj.hora_ini_prog.strftime('%H:%M') if obj.hora_ini_prog else ''

    def get_hora_fin_fmt(self, obj):
        return obj.hora_fin_prog.strftime('%H:%M') if obj.hora_fin_prog else ''


# ============================================================
# 2. CirugiaDetailSerializer — Vista detalle completa
# ============================================================
class CirugiaDetailSerializer(CirugiaListSerializer):
    anestesiologo_nombre  = serializers.SerializerMethodField()
    enfermero_inst_nombre = serializers.SerializerMethodField()
    enfermero_circ_nombre = serializers.SerializerMethodField()
    hora_inicio_real_fmt  = serializers.SerializerMethodField()
    hora_fin_real_fmt     = serializers.SerializerMethodField()

    class Meta(CirugiaListSerializer.Meta):
        fields = CirugiaListSerializer.Meta.fields + [
            # Equipo adicional
            'anestesiologo_nombre', 'enfermero_inst_nombre', 'enfermero_circ_nombre',
            # Pre-operatorio
            'cie10_pre', 'diagnostico_preop', 'notas_preop',
            # Datos intraoperatorios / post-operatorios
            'fecha_inicio_real', 'hora_inicio_real', 'hora_inicio_real_fmt',
            'fecha_fin_real',    'hora_fin_real',    'hora_fin_real_fmt',
            'duracion_real_min',
            'hallazgos', 'complicaciones',
            'notas_postop', 'diagnostico_postop', 'cie10_post',
            # Cancelación / suspensión
            'motivo_cancelacion',
            # Auditoría
            'created_at', 'updated_at',
        ]

    def get_anestesiologo_nombre(self, obj):
        u = obj.anestesiologo
        if not u:
            return 'No asignado'
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username

    def get_enfermero_inst_nombre(self, obj):
        u = obj.enfermero_inst
        if not u:
            return 'No asignado'
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username

    def get_enfermero_circ_nombre(self, obj):
        u = obj.enfermero_circ
        if not u:
            return 'No asignado'
        return f"{u.primer_nombre} {u.primer_apellido}".strip() or u.username

    def get_hora_inicio_real_fmt(self, obj):
        return obj.hora_inicio_real.strftime('%H:%M') if obj.hora_inicio_real else ''

    def get_hora_fin_real_fmt(self, obj):
        return obj.hora_fin_real.strftime('%H:%M') if obj.hora_fin_real else ''


# ============================================================
# 3. CirugiaCreateSerializer — Programar nueva cirugía
# ============================================================
class CirugiaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Cirugia
        fields = [
            'paciente', 'cirujano', 'anestesiologo',
            'enfermero_inst', 'enfermero_circ',
            'emergencia', 'encamamiento',
            'fecha_programada', 'hora_ini_prog', 'hora_fin_prog',
            'duracion_est_min',
            'quirofano', 'tipo_cirugia', 'especialidad',
            'prioridad', 'tipo_anestesia',
            'cie10_pre', 'diagnostico_preop', 'notas_preop',
        ]

    def validate_tipo_cirugia(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                "Debe especificar el nombre completo del procedimiento (mín. 5 caracteres)."
            )
        return value.strip()

    def validate_cirujano(self, value):
        if not value.is_active:
            raise serializers.ValidationError("El cirujano seleccionado no tiene una cuenta activa.")
        return value

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        validated_data['hospital_id'] = getattr(user, 'hospital_id', 1)
        validated_data['estado']      = 'PROGRAMADA'
        validated_data['created_by_id'] = user.pk
        validated_data['updated_by_id'] = user.pk
        return super().create(validated_data)


# ============================================================
# 4. CirugiaIniciarSerializer — PROGRAMADA → EN_CURSO
# ============================================================
class CirugiaIniciarSerializer(serializers.Serializer):
    """Validación mínima: captura el inicio en tiempo real."""
    notas_preop_adicionales = serializers.CharField(
        required=False, allow_blank=True,
        help_text="Notas adicionales de preparación pre-quirúrgica.",
    )


# ============================================================
# 5. CirugiaCompletarSerializer — EN_CURSO → COMPLETADA
# ============================================================
class CirugiaCompletarSerializer(serializers.Serializer):
    hallazgos          = serializers.CharField(required=True,  min_length=5,
                            help_text="Hallazgos intraoperatorios (mín. 5 caracteres).")
    diagnostico_postop = serializers.CharField(required=True,  min_length=5,
                            help_text="Diagnóstico post-operatorio (mín. 5 caracteres).")
    cie10_post         = serializers.CharField(required=False, allow_blank=True, default='')
    complicaciones     = serializers.CharField(required=False, allow_blank=True, default='')
    notas_postop       = serializers.CharField(required=False, allow_blank=True, default='')


# ============================================================
# 6. CirugiaFinalizarSerializer — Cancelar o Suspender
# ============================================================
class CirugiaFinalizarSerializer(serializers.Serializer):
    motivo = serializers.CharField(
        required=True, min_length=5,
        help_text="Motivo de la cancelación o suspensión (mín. 5 caracteres).",
    )
