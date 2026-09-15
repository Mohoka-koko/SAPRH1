#dashboards/models.py
from django.db import models
from accounts.models import UsuarioPersonalizado


class Jurisdiccion(models.Model):
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


class Programa(models.Model):
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


class Subprograma(models.Model):
    programa            = models.ForeignKey(Programa, on_delete=models.CASCADE, related_name='subprogramas')
    codigo_subprograma  = models.IntegerField(default=0)
    nombre              = models.CharField(max_length=200)
    activo              = models.BooleanField(default=True)

    class Meta:
        db_table     = 'subprograma'
        verbose_name = 'Subprograma'

    def __str__(self):
        return self.nombre


class Proyecto(models.Model):
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


class ActividadObra(models.Model):
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


class Partida(models.Model):
    codigo       = models.IntegerField()
    denominacion = models.CharField(max_length=200)

    class Meta:
        db_table     = 'partida'
        verbose_name = 'Partida'

    def __str__(self):
        return f'{self.codigo} - {self.denominacion}'


class FuenteFinanciamiento(models.Model):
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
class LineaPresupuestaria(models.Model):
    jurisdiccion          = models.ForeignKey(Jurisdiccion, on_delete=models.PROTECT, related_name='lineas')
    programa              = models.ForeignKey(Programa, on_delete=models.PROTECT, related_name='lineas')
    proyecto              = models.ForeignKey(Proyecto, on_delete=models.PROTECT, related_name='lineas')
    actividad_obra        = models.ForeignKey(ActividadObra, on_delete=models.PROTECT, related_name='lineas')
    partida               = models.ForeignKey(Partida, on_delete=models.PROTECT, related_name='lineas')
    fuente_financiamiento = models.ForeignKey(FuenteFinanciamiento, on_delete=models.PROTECT, related_name='lineas')
    ejercicio      = models.IntegerField()
    saldo_inicial  = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_actual   = models.DecimalField(max_digits=18, decimal_places=2)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'linea_presupuestaria'
        verbose_name    = 'Línea Presupuestaria'
        unique_together = ('actividad_obra', 'partida', 'fuente_financiamiento', 'ejercicio')

    def __str__(self):
        return f'{self.actividad_obra} - {self.partida} ({self.ejercicio})'


# ─────────────────────────────────────────────
# IMPUTACIÓN
# ─────────────────────────────────────────────
class Imputacion(models.Model):
    ORIGEN_CHOICES = [
        ('MANUAL',     'Manual'),
        ('AUTOMATICA', 'Automática'),
    ]

    nro_expediente  = models.CharField(max_length=50)
    asiento_nro     = models.CharField(max_length=50)
    fecha           = models.DateField()
    origen          = models.CharField(max_length=20, choices=ORIGEN_CHOICES, default='MANUAL')
    observacion     = models.TextField(blank=True)
    usuario         = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='imputaciones')
    fecha_creacion  = models.DateTimeField(auto_now_add=True)
    anulada         = models.BooleanField(default=False)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table     = 'imputacion'
        ordering     = ['-fecha']
        verbose_name = 'Imputación'

    def __str__(self):
        return f'Imputación {self.nro_expediente} - {self.fecha}'


class ImputacionDetalle(models.Model):
    imputacion           = models.ForeignKey(Imputacion, on_delete=models.CASCADE, related_name='detalles')
    linea_presupuestaria = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='imputaciones_detalle')
    proveedor_concepto   = models.CharField(max_length=300)
    importe              = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'imputacion_detalle'
        verbose_name = 'Detalle de Imputación'

    def __str__(self):
        return f'{self.imputacion} - {self.linea_presupuestaria} - {self.importe}'


# ─────────────────────────────────────────────
# ORDEN DE PAGO (rediseñada: cabecera + detalle)
# Reemplazar la clase OrdenPago existente por esto,
# y agregar la clase OrdenPagoDetalle a continuación.
# ─────────────────────────────────────────────
class OrdenPago(models.Model):
    imputacion                = models.ForeignKey('Imputacion', on_delete=models.PROTECT, related_name='ordenes_pago', null=True, blank=True) 
    nro_orden_pago            = models.CharField(max_length=50)
    fecha                     = models.DateField()
    fecha_vencimiento         = models.DateField(null=True, blank=True)
    codigo_pago               = models.IntegerField()
    descripcion_codigo_pago   = models.CharField(max_length=200)
    concepto                  = models.TextField()
    nro_factura               = models.CharField(max_length=50, blank=True)
    nro_resolucion            = models.CharField(max_length=50, blank=True)
    referencia_administrativa = models.TextField(blank=True)
    codigo_concepto_pago      = models.IntegerField()
    concepto_del_pago         = models.TextField()
    importe_total             = models.DecimalField(max_digits=18, decimal_places=2)
    usuario                   = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='ordenes_pago')
    fecha_creacion            = models.DateTimeField(auto_now_add=True)
    anulada                   = models.BooleanField(default=False)
    fecha_anulacion           = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table     = 'orden_pago'
        ordering     = ['-fecha']
        verbose_name = 'Orden de Pago'

    def __str__(self):
        return f'OP {self.nro_orden_pago} - {self.importe_total}'

class OrdenPagoBeneficiario(models.Model):
    orden_pago          = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='beneficiarios')
    codigo_beneficiario = models.CharField(max_length=20, blank=True)
    beneficiario        = models.CharField(max_length=200)
    importe             = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'orden_pago_beneficiario'
        verbose_name = 'Beneficiarios de Orden de Pago'

    def __str__(self):
        return f'{self.orden_pago} - {self.beneficiario} - {self.importe}'
    
class OrdenPagoUnidadPresupuestaria(models.Model):
    orden_pago         = models.ForeignKey(OrdenPago, on_delete=models.CASCADE, related_name='unidades_presupuestarias')
    imputacion_detalle = models.ForeignKey(ImputacionDetalle, on_delete=models.PROTECT, related_name='ordenes_pago_up')
    importe            = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'orden_pago_up'
        verbose_name = 'Unidad Presupuestaria de Orden de Pago'

    def __str__(self):
        return f'{self.orden_pago} - {self.imputacion_detalle} - {self.importe}'

# ─────────────────────────────────────────────
# ORDEN DE PAGO PERSONAL
# Se carga ANTES de que exista la imputación. El sistema (app) genera
# después la Imputación + ImputacionDetalle a partir de las líneas de
# orden_pago_personal_partida, y completa 'imputacion' / 'imputacion_detalle'
# una vez creadas.
# Pegar esta sección DESPUÉS de OrdenPagoDetalle y ANTES de "# REFUERZO"
# ─────────────────────────────────────────────
class OrdenPagoPersonal(models.Model):
    nro_orden_pago  = models.CharField(max_length=50)
    nro_expediente  = models.CharField(max_length=50)
    importe_total   = models.DecimalField(max_digits=18, decimal_places=2)
    codigo          = models.CharField(max_length=20)
    concepto        = models.TextField()
    fecha           = models.DateField()
    # Se completa una vez que el sistema genera la imputación automáticamente
    imputacion      = models.ForeignKey(Imputacion, on_delete=models.PROTECT, null=True, blank=True, related_name='ordenes_pago_personal')
    usuario         = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='ordenes_pago_personal')
    fecha_creacion  = models.DateTimeField(auto_now_add=True)
    anulada         = models.BooleanField(default=False)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table     = 'orden_pago_personal'
        ordering     = ['-fecha']
        verbose_name = 'Orden de Pago Personal'

    def __str__(self):
        return f'OP Personal {self.nro_orden_pago} - {self.importe_total}'


class OrdenPagoPersonalBeneficiario(models.Model):
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


class OrdenPagoPersonalPartida(models.Model):
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

# ─────────────────────────────────────────────
# REFUERZO
# ─────────────────────────────────────────────
class Refuerzo(models.Model):
    fecha                  = models.DateField()
    nro_expediente         = models.CharField(max_length=50)
    nro_decreto_resolucion = models.CharField(max_length=255)
    importe_total          = models.DecimalField(max_digits=18, decimal_places=2)
    usuario                = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='refuerzos')
    fecha_creacion         = models.DateTimeField(auto_now_add=True)
    anulada                = models.BooleanField(default=False)
    fecha_anulacion        = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table     = 'refuerzo'
        ordering     = ['-fecha']
        verbose_name = 'Refuerzo'

    def __str__(self):
        return f'Refuerzo {self.nro_expediente} - {self.fecha}'


class RefuerzoDetalle(models.Model):
    refuerzo      = models.ForeignKey(Refuerzo, on_delete=models.CASCADE, related_name='detalles')
    linea_destino = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='refuerzos_recibidos')
    importe       = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'refuerzo_detalle'
        verbose_name = 'Detalle de Refuerzo'

    def __str__(self):
        return f'{self.refuerzo} → {self.linea_destino} - {self.importe}'


# ─────────────────────────────────────────────
# MODIFICACIÓN
# ─────────────────────────────────────────────
class Modificacion(models.Model):
    fecha           = models.DateField()
    nro_expediente  = models.CharField(max_length=50)
    nro_decreto     = models.CharField(max_length=255)
    importe_total   = models.DecimalField(max_digits=18, decimal_places=2)
    usuario         = models.ForeignKey(UsuarioPersonalizado, on_delete=models.PROTECT, related_name='modificaciones')
    fecha_creacion  = models.DateTimeField(auto_now_add=True)
    anulada         = models.BooleanField(default=False)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table     = 'modificacion'
        ordering     = ['-fecha_creacion']
        verbose_name = 'Modificación'

    def __str__(self):
        return f'Modificación {self.nro_expediente} - {self.fecha}'


class ModificacionTransferente(models.Model):
    modificacion = models.ForeignKey(Modificacion, on_delete=models.CASCADE, related_name='transferentes')
    linea_origen = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='modificaciones_origen')
    importe      = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'modificacion_transferente'
        verbose_name = 'Transferente de Modificación'


class ModificacionReceptora(models.Model):
    modificacion  = models.ForeignKey(Modificacion, on_delete=models.CASCADE, related_name='receptoras')
    linea_destino = models.ForeignKey(LineaPresupuestaria, on_delete=models.PROTECT, related_name='modificaciones_destino')
    importe       = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table     = 'modificacion_receptora'
        verbose_name = 'Receptora de Modificación'


# ─────────────────────────────────────────────
# HISTORIAL DE MOVIMIENTOS
# ─────────────────────────────────────────────
class MovimientoHistorial(models.Model):
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
class CodigoPago(models.Model):
    codigo      = models.IntegerField(unique=True)
    descripcion = models.CharField(max_length=200)
    activo      = models.BooleanField(default=True)

    class Meta:
        db_table     = 'codigo_pago'
        ordering     = ['codigo']
        verbose_name = 'Código de Pago'

    def __str__(self):
        return f'{self.codigo} - {self.descripcion}'