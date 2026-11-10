#dashboards/models.py
import django
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from accounts.models import UsuarioPersonalizado
from django.core.validators import RegexValidator


def _check(condicion):
    """Argumento de CheckConstraint compatible con cualquier versión de Django:
    a partir de 5.1 se llama 'condition' y 'check' quedó deprecado."""
    return {'condition' if django.VERSION >= (5, 1) else 'check': condicion}


# ─────────────────────────────────────────────
# MIXINS DE AUDITORÍA
# Se usan como clases base abstractas (no crean tabla propia) para no
# repetir estos campos en cada modelo. IMPORTANTE: Django no completa
# solo los campos "usuario_creacion" / "usuario_modificacion": hay que
# asignarlos en la vista/serializer con el usuario logueado antes de
# guardar (ej: instancia.usuario_modificacion = request.user).
# ─────────────────────────────────────────────
class ControlCreacion(models.Model):
    """Fecha y usuario de creación del registro."""
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    usuario_creacion = models.ForeignKey(
        UsuarioPersonalizado,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='%(class)s_creados',
    )

    class Meta:
        abstract = True


class ControlModificacion(models.Model):
    """Fecha y usuario de la última modificación del registro."""
    fecha_modificacion = models.DateTimeField(auto_now=True)
    usuario_modificacion = models.ForeignKey(
        UsuarioPersonalizado,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='%(class)s_modificados',
    )

    class Meta:
        abstract = True


class RegistroAuditable(ControlCreacion, ControlModificacion):
    """
    Combina creación + modificación. Usar en los modelos que todavía no
    tienen ningún campo de auditoría (catálogos y tablas de detalle).
    """
    class Meta:
        abstract = True


class Jurisdiccion(RegistroAuditable):
    codigo_jurisd = models.IntegerField(default=0)
    nombre        = models.CharField(max_length=200)
    # Se eliminan 'ejercicio' y 'presupuesto_total': el catálogo ya no tiene
    # un monto ni un año fijo. El presupuesto real por año vive en
    # LineaPresupuestaria y se calcula sumando desde ahí.

    class Meta:
        db_table     = 'jurisdiccion'
        verbose_name = 'Jurisdicción'

    def __str__(self):
        return self.nombre


class Programa(RegistroAuditable):
    jurisdiccion    = models.ForeignKey(Jurisdiccion, on_delete=models.CASCADE, related_name='programas')
    codigo_programa = models.IntegerField(default=0)
    nombre          = models.CharField(max_length=200)
    activo          = models.BooleanField(default=True)
    # Se elimina 'total_programa': se calcula sumando LineaPresupuestaria.

    class Meta:
        db_table     = 'programa'
        verbose_name = 'Programa'

    def __str__(self):
        return self.nombre


class Subprograma(RegistroAuditable):
    programa            = models.ForeignKey(Programa, on_delete=models.CASCADE, related_name='subprogramas')
    codigo_subprograma  = models.IntegerField(default=0)
    nombre              = models.CharField(max_length=200)
    activo              = models.BooleanField(default=True)

    class Meta:
        db_table     = 'subprograma'
        verbose_name = 'Subprograma'

    def __str__(self):
        return self.nombre


class Proyecto(RegistroAuditable):
    programa        = models.ForeignKey(Programa, on_delete=models.CASCADE, related_name='proyectos')
    codigo_proyecto = models.IntegerField()
    nombre          = models.CharField(max_length=200)
    activo          = models.BooleanField(default=True)
    # Se elimina 'total_proyecto': se calcula sumando LineaPresupuestaria.

    class Meta:
        db_table     = 'proyecto'
        verbose_name = 'Proyecto'

    def __str__(self):
        return self.nombre


class ActividadObra(RegistroAuditable):
    proyecto        = models.ForeignKey(Proyecto, on_delete=models.CASCADE, related_name='actividades')
    codigo_act_obra = models.IntegerField()
    nombre          = models.CharField(max_length=300)
    activo          = models.BooleanField(default=True)
    # Se elimina 'monto_presupuestado': se calcula sumando LineaPresupuestaria.

    class Meta:
        db_table     = 'actividad_obra'
        verbose_name = 'Actividad/Obra'

    def __str__(self):
        return self.nombre


class Partida(RegistroAuditable):
    codigo       = models.IntegerField()
    denominacion = models.CharField(max_length=200)

    class Meta:
        db_table     = 'partida'
        verbose_name = 'Partida'

    def __str__(self):
        return f'{self.codigo} - {self.denominacion}'


class FuenteFinanciamiento(RegistroAuditable):
    codigo = models.IntegerField()
    nombre = models.CharField(max_length=200)
    # Se elimina 'monto_total': se calcula sumando LineaPresupuestaria.

    class Meta:
        db_table     = 'fuente_financiamiento'
        verbose_name = 'Fuente de Financiamiento'

    def __str__(self):
        return self.nombre


# ─────────────────────────────────────────────
# LÍNEA PRESUPUESTARIA (núcleo del sistema - sin cambios)
# ─────────────────────────────────────────────
class LineaPresupuestaria(RegistroAuditable):
    jurisdiccion          = models.ForeignKey(Jurisdiccion, on_delete=models.PROTECT, related_name='lineas')
    programa              = models.ForeignKey(Programa, on_delete=models.PROTECT, related_name='lineas')
    proyecto              = models.ForeignKey(Proyecto, on_delete=models.PROTECT, related_name='lineas')
    actividad_obra        = models.ForeignKey(ActividadObra, on_delete=models.PROTECT, related_name='lineas')
    partida               = models.ForeignKey(Partida, on_delete=models.PROTECT, related_name='lineas')
    fuente_financiamiento = models.ForeignKey(FuenteFinanciamiento, on_delete=models.PROTECT, related_name='lineas')
    ejercicio      = models.IntegerField()
    saldo_inicial  = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_actual   = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table        = 'linea_presupuestaria'
        verbose_name    = 'Línea Presupuestaria'
        unique_together = ('actividad_obra', 'partida', 'fuente_financiamiento', 'ejercicio')

    def __str__(self):
        return f'{self.actividad_obra} - {self.partida} ({self.ejercicio})'


# ─────────────────────────────────────────────
# IMPUTACIÓN
# ─────────────────────────────────────────────
class Imputacion(ControlModificacion):
    ORIGEN_CHOICES = [
        ('MANUAL',     'Manual'),
        ('AUTOMATICA', 'Automática'),
    ]

    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente'),
        ('PARCIAL',   'Pagado parcial'),
        ('TOTAL',     'Pagado total'),
    ]

    ESTADO_FORMULARIO_CHOICES = [
        ('REVISAR', 'Revisar'),
        ('LISTO',   'Listo'),
    ]

    nro_expediente  = models.CharField(max_length=50)
    asiento_nro     = models.CharField(max_length=50)
    fecha           = models.DateField()
    origen          = models.CharField(max_length=20, choices=ORIGEN_CHOICES, default='MANUAL')
    observacion     = models.TextField(blank=True)
    usuario         = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='imputaciones')
    fecha_creacion  = models.DateTimeField(auto_now_add=True)
    estado          = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PENDIENTE')
    estado_formulario = models.CharField(
        max_length=10,
        choices=ESTADO_FORMULARIO_CHOICES,
        default='LISTO',
    )
    anulada         = models.BooleanField(default=False)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    # Token de concurrencia (bloqueo optimista). Se incrementa solo cuando un
    # usuario guarda cambios reales o confirma la imputación. El cliente lo envía
    # de vuelta: si no coincide con el de la BD, otro usuario modificó el borrador.
    version         = models.PositiveIntegerField(default=1)

    class Meta:
        db_table     = 'imputacion'
        ordering     = ['-fecha']
        verbose_name = 'Imputación'

    def __str__(self):
        return f'Imputación {self.nro_expediente} - {self.fecha}'
    

class ImputacionBorradorDetalle(models.Model):
    imputacion           = models.ForeignKey(Imputacion, on_delete=models.CASCADE, related_name='borradores_detalle')
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, null=True, blank=True, related_name='borradores_imputacion')
    programa_id          = models.IntegerField(null=True, blank=True)
    proyecto_id          = models.IntegerField(null=True, blank=True)
    actividad_id         = models.IntegerField(null=True, blank=True)
    partida_id           = models.IntegerField(null=True, blank=True)
    fuente_id            = models.IntegerField(null=True, blank=True)
    proveedor_concepto   = models.CharField(max_length=300, blank=True)
    importe              = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden                = models.IntegerField(default=0)

    class Meta:
        db_table     = 'imputacion_borrador_detalle'
        ordering     = ['orden']
        verbose_name = 'Borrador de Detalle de Imputación'

    def __str__(self):
        return f'Borrador {self.imputacion_id} fila {self.orden}'


class ImputacionDetalle(RegistroAuditable):
    imputacion           = models.ForeignKey(Imputacion, on_delete=models.CASCADE, related_name='detalles')
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='imputaciones_detalle')
    proveedor_concepto   = models.CharField(max_length=300)
    importe              = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'imputacion_detalle'
        verbose_name = 'Detalle de Imputación'

    def __str__(self):
        return f'{self.imputacion} - {self.linea_presupuestaria} - {self.importe}'


class ImputacionAuditoria(models.Model):
    """
    Bitácora de solo inserción de quién hizo qué sobre una Imputación.
    NO es un movimiento presupuestario (por eso no usa MovimientoHistorial, que
    alimenta el Home): nunca toca saldos.

    - imputacion_id es un entero sin FK a propósito: el registro de una
      eliminación de borrador debe sobrevivir al borrado de la Imputación.
    - Las ediciones consecutivas del mismo usuario se agrupan en una sola fila
      (cantidad / fecha_ultima) para no generar una fila por cada autoguardado.
    - Nunca se registra nada por consultas, aperturas ni guardados sin cambios.
    """
    TIPO_CHOICES = [
        ('CREACION',     'Creación'),
        ('EDICION',      'Edición'),
        ('CONFIRMACION', 'Confirmación (Listo)'),
        ('ELIMINACION',  'Eliminación de borrador'),
    ]

    imputacion_id = models.IntegerField(db_index=True)
    tipo          = models.CharField(max_length=20, choices=TIPO_CHOICES)
    usuario       = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='auditoria_imputaciones')
    fecha         = models.DateTimeField(auto_now_add=True)
    fecha_ultima  = models.DateTimeField(null=True, blank=True)
    cantidad      = models.PositiveIntegerField(default=1)
    version       = models.PositiveIntegerField(null=True, blank=True)
    detalle       = models.TextField(blank=True)

    class Meta:
        db_table     = 'imputacion_auditoria'
        ordering     = ['id']
        verbose_name = 'Auditoría de Imputación'

    def __str__(self):
        return f'{self.tipo} imputación {self.imputacion_id} - {self.usuario_id}'


# ─────────────────────────────────────────────
# ORDEN DE PAGO 
# ─────────────────────────────────────────────
class OrdenPago(ControlModificacion):
    ESTADO_FORMULARIO_CHOICES = [
        ('REVISAR', 'Revisar'),
        ('LISTO',   'Listo'),
    ]

    imputacion                = models.ForeignKey('Imputacion', on_delete=models.PROTECT, related_name='ordenes_pago', null=True, blank=True)
    nro_orden_pago            = models.CharField(max_length=50)
    fecha                     = models.DateField()
    fecha_vencimiento         = models.DateField(null=True, blank=True)
    codigo_pago               = models.IntegerField()
    descripcion_codigo_pago   = models.CharField(max_length=200)
    concepto                  = models.TextField()
    nro_factura               = models.CharField(max_length=50, blank=True)
    nro_resolucion            = models.CharField(max_length=50, blank=True)
    nro_resolucion_rectificatoria = models.CharField(
        max_length=50, blank=True, default='',
        validators=[RegexValidator(r'^\d+/\d+$', 'Formato esperado: número/número (ej: 123/2026)')],
    )
    decreto                   = models.CharField(
        max_length=50, blank=True, default='',
        validators=[RegexValidator(r'^\d+/\d+$', 'Formato esperado: número/número (ej: 123/2026)')],
    )
    licitacion                = models.CharField(max_length=100, blank=True, default='')
    referencia_administrativa = models.TextField(blank=True)
    codigo_concepto_pago      = models.IntegerField()
    concepto_del_pago         = models.TextField()
    importe_total             = models.DecimalField(max_digits=18, decimal_places=2)
    usuario                   = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='ordenes_pago')
    fecha_creacion            = models.DateTimeField(auto_now_add=True)
    anulada                   = models.BooleanField(default=False)
    fecha_anulacion           = models.DateTimeField(null=True, blank=True)
    # REVISAR = borrador (autoguardado, sin movimientos presupuestarios).
    # LISTO   = completada. El default protege a las OP ya existentes.
    estado_formulario         = models.CharField(
        max_length=10,
        choices=ESTADO_FORMULARIO_CHOICES,
        default='LISTO',
    )
    # Token de concurrencia (bloqueo optimista). Sube solo con cambios reales o al
    # completar. El cliente lo devuelve en cada guardado.
    version                   = models.PositiveIntegerField(default=1)
    # UUID generado por el navegador para el primer guardado: si la respuesta se pierde
    # y el cliente reintenta, el servidor devuelve el mismo borrador en vez de crear otro.
    clave_idempotencia        = models.UUIDField(null=True, blank=True, unique=True, editable=False)

    class Meta:
        db_table     = 'orden_pago'
        ordering     = ['-fecha']
        verbose_name = 'Orden de Pago'
        constraints  = [
            models.CheckConstraint(
                name='op_estado_formulario_valido',
                **_check(Q(estado_formulario__in=['REVISAR', 'LISTO'])),
            ),
        ]

    def __str__(self):
        return f'OP {self.nro_orden_pago} - {self.importe_total}'

class OrdenPagoBeneficiario(RegistroAuditable):
    orden_pago          = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='beneficiarios')
    codigo_beneficiario = models.CharField(max_length=20, blank=True)
    beneficiario        = models.CharField(max_length=200)
    importe             = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'orden_pago_beneficiario'
        verbose_name = 'Beneficiarios de Orden de Pago'

    def __str__(self):
        return f'{self.orden_pago} - {self.beneficiario} - {self.importe}'
    
class OrdenPagoUnidadPresupuestaria(RegistroAuditable):
    orden_pago         = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='unidades_presupuestarias')
    imputacion_detalle = models.ForeignKey(ImputacionDetalle, on_delete=models.PROTECT, related_name='ordenes_pago_up')
    importe            = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'orden_pago_up'
        verbose_name = 'Unidad Presupuestaria de Orden de Pago'

    def __str__(self):
        return f'{self.orden_pago} - {self.imputacion_detalle} - {self.importe}'

class OrdenPagoBorradorBeneficiario(models.Model):
    # Beneficiarios de una OP en estado REVISAR. Tabla aparte a propósito: los borradores
    # se reemplazan completos en cada guardado y al completar se convierten en
    # OrdenPagoBeneficiario y se borran.
    orden_pago          = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='borradores_beneficiario')
    codigo_beneficiario = models.CharField(max_length=20, blank=True)
    beneficiario        = models.CharField(max_length=200, blank=True)
    importe             = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden               = models.IntegerField(default=0)

    class Meta:
        db_table     = 'orden_pago_borrador_beneficiario'
        ordering     = ['orden']
        verbose_name = 'Borrador de Beneficiario de OP'

    def __str__(self):
        return f'Borrador OP {self.orden_pago_id} beneficiario {self.orden}'


class OrdenPagoBorradorUP(models.Model):
    # Importes por UP de una OP en estado REVISAR. NUNCA se guardan en
    # OrdenPagoUnidadPresupuestaria: esa tabla es la que consume fondos de la Imputación
    # (todas las fórmulas de disponibilidad la suman). Un borrador solo escribe acá.
    orden_pago         = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='borradores_up')
    imputacion_detalle = models.ForeignKey(ImputacionDetalle, on_delete=models.SET_NULL, null=True, blank=True, related_name='borradores_orden_pago')
    importe            = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden              = models.IntegerField(default=0)

    class Meta:
        db_table     = 'orden_pago_borrador_up'
        ordering     = ['orden']
        verbose_name = 'Borrador de UP de OP'

    def __str__(self):
        return f'Borrador OP {self.orden_pago_id} UP {self.orden}'


class OrdenPagoAuditoria(models.Model):
    """
    Historial de INTERVENCIONES sobre una OP (quién hizo qué y cuándo).
    NO es un movimiento presupuestario: nunca toca saldos ni MovimientoHistorial.

    - 'orden_pago_id' es un entero SIN FK a propósito: el rastro de una eliminación
      de borrador sobrevive al borrado de la OP.
    - Ediciones consecutivas del MISMO usuario dentro de una ventana de tiempo se
      agrupan en una fila (el autoguardado dispara muchos guardados).
    - Consultas / aperturas del formulario NO generan filas.
    """
    OPERACION_CHOICES = [
        ('CREAR',     'Creación del borrador'),
        ('EDITAR',    'Edición del borrador'),
        ('COMPLETAR', 'Confirmación como Listo'),
        ('ELIMINAR',  'Eliminación del borrador'),
    ]

    orden_pago_id     = models.IntegerField(db_index=True)
    operacion         = models.CharField(max_length=12, choices=OPERACION_CHOICES)
    usuario           = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='auditoria_ordenes_pago')
    fecha             = models.DateTimeField(default=timezone.now)
    fecha_ultima      = models.DateTimeField(default=timezone.now)
    cantidad          = models.PositiveIntegerField(default=1)
    estado_resultante = models.CharField(max_length=10)
    detalle           = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'orden_pago_auditoria'
        ordering = ['fecha', 'id']
        indexes  = [models.Index(fields=['orden_pago_id', 'fecha'], name='op_aud_op_fecha_idx')]

    def __str__(self):
        return f'OP {self.orden_pago_id} — {self.operacion} por {self.usuario_id}'


# ─────────────────────────────────────────────
# ORDEN DE PAGO PERSONAL
# Se carga ANTES de que exista la imputación. El sistema (app) genera
# después la Imputación + ImputacionDetalle a partir de las líneas de
# orden_pago_personal_partida, y completa 'imputacion' / 'imputacion_detalle'
# una vez creadas.
# Pegar esta sección DESPUÉS de OrdenPagoDetalle y ANTES de "# REFUERZO"
# ─────────────────────────────────────────────
class OrdenPagoPersonal(ControlModificacion):
    ESTADO_FORMULARIO_CHOICES = [
        ('REVISAR', 'Revisar'),
        ('LISTO',   'Listo'),
    ]

    nro_orden_pago  = models.CharField(max_length=50)
    nro_expediente  = models.CharField(max_length=50)
    importe_total   = models.DecimalField(max_digits=18, decimal_places=2)
    codigo          = models.CharField(max_length=20)
    concepto        = models.TextField()
    fecha           = models.DateField(null=True, blank=True)
    observaciones   = models.TextField(blank=True, default='')
    u_presupuestaria = models.CharField(max_length=30, blank=True, default='')
    imputacion      = models.ForeignKey(Imputacion, on_delete=models.PROTECT, null=True, blank=True, related_name='ordenes_pago_personal')
    usuario         = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='ordenes_pago_personal')
    fecha_creacion  = models.DateTimeField(auto_now_add=True)
    anulada         = models.BooleanField(default=False)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    estado_formulario = models.CharField(
        max_length=10,
        choices=ESTADO_FORMULARIO_CHOICES,
        default='LISTO',
    )
    # UUID generado por el navegador para el primer guardado: si la respuesta se pierde
    # y el cliente reintenta, el servidor devuelve el mismo borrador en lugar de crear otro.
    clave_idempotencia = models.UUIDField(null=True, blank=True, unique=True, editable=False)

    class Meta:
        db_table     = 'orden_pago_personal'
        ordering     = ['-fecha']
        verbose_name = 'Orden de Pago Personal'
        constraints  = [
            # Un borrador NUNCA tiene imputación y una OP Personal LISTO SIEMPRE la tiene.
            models.CheckConstraint(
                name='opp_estado_formulario_valido',
                **_check(Q(estado_formulario__in=['REVISAR', 'LISTO'])),
            ),
            models.CheckConstraint(
                name='opp_revisar_sin_imputacion',
                **_check(Q(estado_formulario='LISTO') | Q(imputacion__isnull=True)),
            ),
            models.CheckConstraint(
                name='opp_listo_con_imputacion',
                **_check(Q(estado_formulario='REVISAR') | Q(imputacion__isnull=False)),
            ),
            # Una imputación no puede pertenecer a dos OP Personal.
            models.UniqueConstraint(
                fields=['imputacion'],
                condition=Q(imputacion__isnull=False),
                name='opp_imputacion_unica',
            ),
        ]

    def __str__(self):
        return f'OP Personal {self.nro_orden_pago} - {self.importe_total}'


class OrdenPagoPersonalBeneficiario(RegistroAuditable):
    orden_pago_personal    = models.ForeignKey(OrdenPagoPersonal, on_delete=models.CASCADE, related_name='beneficiarios')
    codigo                 = models.CharField(max_length=20)
    nomina_beneficiarios   = models.TextField()
    importe_parcial        = models.DecimalField(max_digits=18, decimal_places=2)
    importe_total          = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'orden_pago_personal_beneficiario'
        verbose_name = 'Beneficiario de OP Personal'

    def __str__(self):
        return f'{self.orden_pago_personal} - {self.nomina_beneficiarios}'


class OrdenPagoPersonalPartida(RegistroAuditable):
    orden_pago_personal   = models.ForeignKey(OrdenPagoPersonal, on_delete=models.CASCADE, related_name='partidas')
    linea_presupuestaria  = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='ordenes_pago_personal_partida')
    descripcion           = models.CharField(max_length=300)
    importe               = models.DecimalField(max_digits=18, decimal_places=2)
    # Se completa cuando el sistema genera la ImputacionDetalle correspondiente
    imputacion_detalle    = models.ForeignKey(ImputacionDetalle, on_delete=models.PROTECT, null=True, blank=True, related_name='origen_op_personal')

    class Meta:
        db_table     = 'orden_pago_personal_partida'
        verbose_name = 'Partida de OP Personal'

    def __str__(self):
        return f'{self.orden_pago_personal} - {self.descripcion} - {self.importe}'


class OrdenPagoPersonalBorradorPartida(models.Model):
    # Filas de erogación de una OP Personal en estado REVISAR. Es una tabla aparte de
    # OrdenPagoPersonalPartida a propósito: las partidas reales se crean junto con la
    # ImputacionDetalle (cuyo trigger descuenta saldo y registra movimientos), así que un
    # borrador, que solo escribe acá, nunca mueve el presupuesto.
    # Al completar la OP Personal estas filas se convierten en partidas reales y se borran.
    orden_pago_personal  = models.ForeignKey(OrdenPagoPersonal, on_delete=models.CASCADE, related_name='borradores_partida')
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, null=True, blank=True, related_name='borradores_op_personal')
    programa_id          = models.IntegerField(null=True, blank=True)
    proyecto_id          = models.IntegerField(null=True, blank=True)
    actividad_id         = models.IntegerField(null=True, blank=True)
    partida_id           = models.IntegerField(null=True, blank=True)
    fuente_id            = models.IntegerField(null=True, blank=True)
    importe              = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden                = models.IntegerField(default=0)

    class Meta:
        db_table     = 'orden_pago_personal_borrador_partida'
        ordering     = ['orden']
        verbose_name = 'Borrador de Partida de OP Personal'

    def __str__(self):
        return f'Borrador {self.orden_pago_personal_id} fila {self.orden}'

class OrdenPagoPersonalAuditoria(models.Model):
    """
    Historial de INTERVENCIONES sobre una OP Personal (quién hizo qué y cuándo).
    NO es un movimiento presupuestario: nunca toca saldos ni MovimientoHistorial.

    - 'orden_pago_personal_id' es un entero SIN FK a propósito: el rastro de una
      eliminación de borrador sobrevive al borrado de la OP Personal.
    - Ediciones consecutivas del MISMO usuario dentro de una ventana de tiempo se agrupan.
    - Consultas / aperturas del formulario NO generan filas.
    """
    OPERACION_CHOICES = [
        ('CREAR',     'Creación del borrador'),
        ('EDITAR',    'Edición del borrador'),
        ('COMPLETAR', 'Confirmación como Listo'),
        ('ELIMINAR',  'Eliminación del borrador'),
    ]

    orden_pago_personal_id = models.IntegerField(db_index=True)
    operacion              = models.CharField(max_length=12, choices=OPERACION_CHOICES)
    usuario                = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='auditoria_ordenes_pago_personal')
    fecha                  = models.DateTimeField(default=timezone.now)
    fecha_ultima           = models.DateTimeField(default=timezone.now)
    cantidad               = models.PositiveIntegerField(default=1)
    estado_resultante      = models.CharField(max_length=10)
    detalle                = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'orden_pago_personal_auditoria'
        ordering = ['fecha', 'id']
        indexes  = [models.Index(fields=['orden_pago_personal_id', 'fecha'], name='opp_aud_opp_fecha_idx')]

    def __str__(self):
        return f'OP Personal {self.orden_pago_personal_id} — {self.operacion} por {self.usuario_id}'


# ─────────────────────────────────────────────
# REFUERZO
# ─────────────────────────────────────────────
class Refuerzo(ControlModificacion):
    ESTADO_FORMULARIO_CHOICES = [
        ('REVISAR', 'Revisar'),
        ('LISTO',   'Listo'),
    ]

    fecha                  = models.DateField()
    nro_expediente         = models.CharField(max_length=50)
    nro_decreto_resolucion = models.CharField(max_length=255)
    importe_total          = models.DecimalField(max_digits=18, decimal_places=2)
    usuario                = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='refuerzos')
    fecha_creacion         = models.DateTimeField(auto_now_add=True)
    anulada                = models.BooleanField(default=False)
    fecha_anulacion        = models.DateTimeField(null=True, blank=True)
    # REVISAR = borrador (guardado automático, sin movimientos presupuestarios).
    # LISTO   = completado. El default protege a los registros ya existentes.
    estado_formulario      = models.CharField(
        max_length=10,
        choices=ESTADO_FORMULARIO_CHOICES,
        default='LISTO',
    )

    class Meta:
        db_table     = 'refuerzo'
        ordering     = ['-fecha']
        verbose_name = 'Refuerzo'

    def __str__(self):
        return f'Refuerzo {self.nro_expediente} - {self.fecha}'


class RefuerzoDetalle(RegistroAuditable):
    refuerzo      = models.ForeignKey(Refuerzo, on_delete=models.CASCADE, related_name='detalles')
    linea_destino = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='refuerzos_recibidos')
    importe       = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'refuerzo_detalle'
        verbose_name = 'Detalle de Refuerzo'

    def __str__(self):
        return f'{self.refuerzo} → {self.linea_destino} - {self.importe}'


class RefuerzoBorradorDetalle(models.Model):
    # Filas de un Refuerzo en estado REVISAR. Es una tabla aparte de RefuerzoDetalle
    # a propósito: los triggers de refuerzo_detalle (saldo y movimientos) solo se
    # disparan con INSERT en esa tabla, así que un borrador nunca mueve el presupuesto.
    # Al completar el Refuerzo estas filas se convierten en RefuerzoDetalle y se borran.
    refuerzo             = models.ForeignKey(Refuerzo, on_delete=models.CASCADE, related_name='borradores_detalle')
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, null=True, blank=True, related_name='borradores_refuerzo')
    programa_id          = models.IntegerField(null=True, blank=True)
    proyecto_id          = models.IntegerField(null=True, blank=True)
    actividad_id         = models.IntegerField(null=True, blank=True)
    partida_id           = models.IntegerField(null=True, blank=True)
    fuente_id            = models.IntegerField(null=True, blank=True)
    importe              = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden                = models.IntegerField(default=0)

    class Meta:
        db_table     = 'refuerzo_borrador_detalle'
        ordering     = ['orden']
        verbose_name = 'Borrador de Detalle de Refuerzo'

    def __str__(self):
        return f'Borrador {self.refuerzo_id} fila {self.orden}'


class RefuerzoAuditoria(models.Model):
    """
    Historial de INTERVENCIONES sobre un Refuerzo (quién hizo qué y cuándo).

    NO es un movimiento presupuestario: no toca saldos ni se mezcla con
    MovimientoHistorial (que el Home usa para la "última modificación del presupuesto").

    - 'refuerzo_id' es un entero SIN FK a propósito: así el rastro de una eliminación
      sobrevive al borrado del borrador.
    - Las ediciones consecutivas del MISMO usuario dentro de una ventana de tiempo se
      agrupan en una sola fila (el autosave guarda cada pocos segundos): 'fecha' es el
      inicio, 'fecha_ultima' el último guardado y 'cantidad' cuántos guardados hubo.
    - Las consultas / aperturas del formulario NO generan filas.
    """
    OPERACION_CHOICES = [
        ('CREAR',     'Creación del borrador'),
        ('EDITAR',    'Edición del borrador'),
        ('COMPLETAR', 'Confirmación como Listo'),
        ('ELIMINAR',  'Eliminación del borrador'),
    ]

    refuerzo_id       = models.IntegerField(db_index=True)
    operacion         = models.CharField(max_length=12, choices=OPERACION_CHOICES)
    usuario           = models.ForeignKey(
                            UsuarioPersonalizado,
                            on_delete=models.PROTECT,
                            related_name='auditoria_refuerzos',
                        )
    fecha             = models.DateTimeField(default=timezone.now)
    fecha_ultima      = models.DateTimeField(default=timezone.now)
    cantidad          = models.PositiveIntegerField(default=1)
    estado_resultante = models.CharField(max_length=10)
    detalle           = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'refuerzo_auditoria'
        ordering = ['fecha', 'id']
        indexes  = [models.Index(fields=['refuerzo_id', 'fecha'], name='refuerzo_aud_ref_fecha_idx')]

    def __str__(self):
        return f'Refuerzo {self.refuerzo_id} — {self.operacion} por {self.usuario_id}'


# ─────────────────────────────────────────────
# MODIFICACIÓN
# ─────────────────────────────────────────────
class Modificacion(ControlModificacion):
    TIPO_TRANSFERENTE_CHOICES = [
        ('general',    'UP Presupuesto General'),
        ('imputacion', 'UP de una Imputación'),
    ]

    ESTADO_FORMULARIO_CHOICES = [
        ('REVISAR', 'Revisar'),
        ('LISTO',   'Listo'),
    ]

    fecha                = models.DateField()
    nro_expediente       = models.CharField(max_length=50)
    nro_decreto          = models.CharField(max_length=255)
    importe_total        = models.DecimalField(max_digits=18, decimal_places=2)
    tipo_transferente    = models.CharField(          # ← NUEVO
        max_length=20,
        choices=TIPO_TRANSFERENTE_CHOICES,
        default='general',
    )
    usuario              = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='modificaciones')
    fecha_creacion       = models.DateTimeField(auto_now_add=True)
    anulada              = models.BooleanField(default=False)
    fecha_anulacion      = models.DateTimeField(null=True, blank=True)
    estado_formulario    = models.CharField(
        max_length=10,
        choices=ESTADO_FORMULARIO_CHOICES,
        default='LISTO',
    )

    class Meta:
        db_table     = 'modificacion'
        ordering     = ['-fecha_creacion']
        verbose_name = 'Modificación'

    def __str__(self):
        return f'Modificación {self.nro_expediente} - {self.fecha}'


class ModificacionTransferente(RegistroAuditable):
    modificacion        = models.ForeignKey(Modificacion, on_delete=models.CASCADE, related_name='transferentes')
    linea_origen        = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='modificaciones_origen')
    imputacion_detalle  = models.ForeignKey(          # ← NUEVO
        ImputacionDetalle,
        on_delete=models.PROTECT,
        related_name='modificaciones_transferente',
        null=True,
        blank=True,
    )
    importe             = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'modificacion_transferente'
        verbose_name = 'Transferente de Modificación'

class ModificacionReceptora(RegistroAuditable):
    modificacion  = models.ForeignKey(Modificacion, on_delete=models.CASCADE, related_name='receptoras')
    linea_destino = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='modificaciones_destino')
    importe       = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'modificacion_receptora'
        verbose_name = 'Receptora de Modificación'


class ModificacionBorradorDetalle(models.Model):
    # Filas de una Modificación en estado REVISAR. Es una tabla aparte de
    # ModificacionTransferente / ModificacionReceptora a propósito: los triggers de
    # PostgreSQL (saldo_actual y movimientos) solo se disparan con INSERT en esas dos
    # tablas, así que un borrador nunca mueve el presupuesto.
    # Al completar la Modificación estas filas se convierten en transferentes y
    # receptoras reales y se borran.
    ROL_CHOICES = [
        ('TRANSFERENTE', 'Transferente'),
        ('RECEPTORA',    'Receptora'),
    ]

    modificacion         = models.ForeignKey(Modificacion, on_delete=models.CASCADE, related_name='borradores_detalle')
    rol                  = models.CharField(max_length=12, choices=ROL_CHOICES)
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, null=True, blank=True, related_name='borradores_modificacion')
    programa_id          = models.IntegerField(null=True, blank=True)
    proyecto_id          = models.IntegerField(null=True, blank=True)
    actividad_id         = models.IntegerField(null=True, blank=True)
    partida_id           = models.IntegerField(null=True, blank=True)
    fuente_id            = models.IntegerField(null=True, blank=True)
    # Solo se usa en transferentes de modalidad B. Si el detalle de imputación se borra,
    # la referencia queda vacía y al completar se pide volver a elegirla.
    imputacion_detalle   = models.ForeignKey(ImputacionDetalle, on_delete=models.SET_NULL, null=True, blank=True, related_name='borradores_modificacion')
    importe              = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    orden                = models.IntegerField(default=0)

    class Meta:
        db_table     = 'modificacion_borrador_detalle'
        ordering     = ['rol', 'orden']
        verbose_name = 'Borrador de Detalle de Modificación'

    def __str__(self):
        return f'Borrador {self.modificacion_id} {self.rol} fila {self.orden}'


class ModificacionAuditoria(models.Model):
    """
    Historial de INTERVENCIONES sobre una Modificación (quién hizo qué y cuándo).
    NO es un movimiento presupuestario: nunca toca saldos ni MovimientoHistorial.

    - 'modificacion_id' es un entero SIN FK a propósito: el rastro de una eliminación
      de borrador sobrevive al borrado de la Modificación.
    - Ediciones consecutivas del MISMO usuario dentro de una ventana de tiempo se
      agrupan en una fila (el autoguardado dispara muchos guardados).
    - Consultas / aperturas del formulario NO generan filas.
    """
    OPERACION_CHOICES = [
        ('CREAR',     'Creación del borrador'),
        ('EDITAR',    'Edición del borrador'),
        ('COMPLETAR', 'Confirmación como Listo'),
        ('ELIMINAR',  'Eliminación del borrador'),
    ]

    modificacion_id   = models.IntegerField(db_index=True)
    operacion         = models.CharField(max_length=12, choices=OPERACION_CHOICES)
    usuario           = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='auditoria_modificaciones')
    fecha             = models.DateTimeField(default=timezone.now)
    fecha_ultima      = models.DateTimeField(default=timezone.now)
    cantidad          = models.PositiveIntegerField(default=1)
    estado_resultante = models.CharField(max_length=10)
    detalle           = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'modificacion_auditoria'
        ordering = ['fecha', 'id']
        indexes  = [models.Index(fields=['modificacion_id', 'fecha'], name='mod_aud_mod_fecha_idx')]

    def __str__(self):
        return f'Modificación {self.modificacion_id} — {self.operacion} por {self.usuario_id}'


# ─────────────────────────────────────────────
# HISTORIAL DE MOVIMIENTOS
# ─────────────────────────────────────────────
class MovimientoHistorial(models.Model):
    # Nota: esta tabla es un log de solo-lectura (no se edita un movimiento
    # ya registrado), por eso NO lleva usuario_modificacion/fecha_modificacion:
    # "usuario" + "fecha" ya cumplen el rol de autor y momento del evento.
    TIPO_CHOICES = [
        ('IMPUTACION',          'Imputación'),
        ('IMPUTACION_EDICION',  'Imputación - Edición'),
        ('IMPUTACION_ANULACION','Imputación - Anulación'),
        ('ORDEN_PAGO',          'Orden de Pago'),
        ('ORDEN_PAGO_UP', 'Orden Pago - Unidad Presupuestaria'),
        ('REFUERZO',            'Refuerzo'),
        ('REFUERZO_EDICION',    'Refuerzo - Edición'),
        ('REFUERZO_ANULACION',  'Refuerzo - Anulación'),
        ('MODIFICACION_SALIDA', 'Modificación - Salida'),
        ('MODIFICACION_ENTRADA','Modificación - Entrada'),
        ('MODIFICACION_EDICION','Modificación - Edición'),
        ('MODIFICACION_ANULACION', 'Modificación - Anulación'),
        ('ORDEN_PAGO_ANULACION', 'Orden de Pago - Anulación'),
        ('ORDEN_PAGO_PERSONAL',           'Orden de Pago Personal'),
        ('ORDEN_PAGO_PERSONAL_ANULACION', 'Orden de Pago Personal - Anulación'),
    ]

    # Opcional: una operación (p. ej. una Imputación) puede afectar varias
    # líneas a la vez y registrarse como UN SOLO movimiento histórico, sin
    # atarse a una línea en particular. El detalle por línea se consulta
    # directamente en la tabla de detalle de cada operación (ImputacionDetalle,
    # RefuerzoDetalle, etc.), no acá.
    linea_presupuestaria = models.ForeignKey(
        LineaPresupuestaria, on_delete=models.PROTECT, related_name='historial',
        null=True, blank=True,
    )
    tipo           = models.CharField(max_length=40, choices=TIPO_CHOICES)
    referencia_id  = models.IntegerField()
    fecha          = models.DateTimeField(auto_now_add=True)
    usuario        = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='movimientos')
    monto          = models.DecimalField(max_digits=18, decimal_places=2)
    descripcion    = models.TextField(blank=True)

    class Meta:
        db_table     = 'movimientos_presupuestarios'
        ordering     = ['-fecha']
        verbose_name = 'Movimiento Presupuestario'

    def __str__(self):
        return f'{self.tipo} - {self.linea_presupuestaria} - {self.monto}'
    
# ─────────────────────────────────────────────
# CÓDIGO DE PAGO
# ─────────────────────────────────────────────
class CodigoPago(RegistroAuditable):
    codigo      = models.IntegerField(unique=True)
    descripcion = models.CharField(max_length=200)
    activo      = models.BooleanField(default=True)

    class Meta:
        db_table     = 'codigo_pago'
        ordering     = ['codigo']
        verbose_name = 'Código de Pago'

    def __str__(self):
        return f'{self.codigo} - {self.descripcion}'

class Notificacion(models.Model):

    TIPOS = [
        ("imputacion", "Imputación"),
        ("orden_pago", "Orden de pago"),
        ("orden_pago_personal", "Orden de pago personal"),
        ("sistema", "Sistema"),
    ]

    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificaciones_saprh1"
    )

    titulo = models.CharField(max_length=180)

    mensaje = models.TextField()

    tipo = models.CharField(
        max_length=40,
        choices=TIPOS,
        default="sistema"
    )

    url = models.CharField(
        max_length=500,
        blank=True,
        default=""
    )

    creada_en = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    leida = models.BooleanField(
        default=False,
        db_index=True
    )

    leida_en = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = ["-creada_en"]
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"

    def __str__(self):
        return f"{self.titulo} — {self.destinatario}"