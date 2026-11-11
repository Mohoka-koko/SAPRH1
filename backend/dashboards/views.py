#dashboards/views.py

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from accounts.decorators import rol_requerido
from accounts.models import UsuarioPersonalizado
import json
import uuid
from django.db import transaction, connection, IntegrityError
from django.urls import reverse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from dashboards.models import (
    LineaPresupuestaria, Refuerzo, RefuerzoDetalle, RefuerzoBorradorDetalle, RefuerzoAuditoria,
    Modificacion, ModificacionTransferente, ModificacionReceptora, ModificacionBorradorDetalle,
    Imputacion, ImputacionDetalle, ImputacionBorradorDetalle, ImputacionAuditoria,
    Notificacion,
    OrdenPago, OrdenPagoBeneficiario, OrdenPagoUnidadPresupuestaria,
    OrdenPagoBorradorBeneficiario, OrdenPagoBorradorUP, OrdenPagoAuditoria,
    MovimientoHistorial, Jurisdiccion, Programa, Subprograma, Proyecto,
    ActividadObra, Partida, FuenteFinanciamiento,
    OrdenPagoPersonal, OrdenPagoPersonalBeneficiario, OrdenPagoPersonalPartida,
    OrdenPagoPersonalBorradorPartida,
    ModificacionAuditoria, OrdenPagoPersonalAuditoria,
)
from django.db.models.deletion import ProtectedError
from decimal import Decimal, InvalidOperation
from datetime import date, timedelta
from datetime import datetime as _dt
import logging

Usuario = get_user_model()


def crear_notificaciones_admins(
    titulo, mensaje, tipo, url="", realizado_por=""
):
    """
    Crea una notificación para cada usuario activo
    con rol admin o adminprincipal.
    """

    mensaje = (
        f"{mensaje}\n"
        f"Realizada por: {realizado_por}"
    )

    destinatarios = Usuario.objects.filter(
        rol__in=["admin", "adminprincipal"],
        is_active=True
    )

    for usuario in destinatarios:
        Notificacion.objects.create(
            destinatario=usuario,
            titulo=titulo,
            mensaje=mensaje,
            tipo=tipo,
            url=url
        )

# ==========================================
#  VISTAS PARA ADMIN PRINCIPAL
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def obtener_modificaciones_y_refuerzos(request):
    modificaciones = Modificacion.objects.select_related('usuario').prefetch_related(
        'transferentes__linea_origen',
        'receptoras__linea_destino',
    ).filter(estado_formulario='LISTO')

    refuerzos = Refuerzo.objects.select_related('usuario').filter(estado_formulario='LISTO')

    registros_combinados = []

    for m in modificaciones:
        transferentes = m.transferentes.all()
        receptoras    = m.receptoras.all()
        detalle_str   = (
            f"Origen: {', '.join(str(t.linea_origen_id) for t in transferentes)} → "
            f"Destino: {', '.join(str(r.linea_destino_id) for r in receptoras)}"
        )
        registros_combinados.append({
            'id':                 m.id,
            'tipo':               'Modificación',
            'fecha':              m.fecha.strftime('%d/%m/%Y'),
            'expediente':         m.nro_expediente,
            'decreto_resolucion': m.nro_decreto,
            'importe':            float(m.importe_total),
            'usuario':            m.usuario.nombre,
            'detalle':            detalle_str,
        })

    for r in refuerzos:
        registros_combinados.append({
            'id':                 r.id,
            'tipo':               'Refuerzo',
            'fecha':              r.fecha.strftime('%d/%m/%Y'),
            'expediente':         r.nro_expediente,
            'decreto_resolucion': r.nro_decreto_resolucion,
            'importe':            float(r.importe_total),
            'usuario':            r.usuario.nombre,
            'detalle':            'Inyección de fondos (múltiples líneas)',
        })

    registros_combinados.sort(key=lambda x: x['fecha'], reverse=True)
    return JsonResponse({'success': True, 'data': registros_combinados})

@rol_requerido('adminprincipal')
def adminprincipal_dashboard(request):
    return render(request, 'dashboards/adminprincipal/home.html', {'usuario': request.user})

@rol_requerido('adminprincipal')
def adminprincipal_registros(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/adminprincipal/registros.html', context)

@rol_requerido('adminprincipal')
def adminprincipal_refuerzomodificacion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/adminprincipal/refuerzomodificacion.html', context)

@rol_requerido('admin')
def adminprincipal_usuarios(request):
    todos = Usuario.objects.exclude(id=request.user.id).order_by('is_active', 'nombre')
    context = {
        'usuario': request.user,
        'usuarios': todos,
    }
    return render(request, 'dashboards/adminprincipal/usuarios.html', context)

@rol_requerido('adminprincipal')
def adminprincipal_configuracion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/adminprincipal/configuracion.html', context)


# ==========================================
#  VISTAS PARA ADMIN ESTÁNDAR
# ==========================================

@rol_requerido('admin')
def admin_dashboard(request):
    context = {
        'usuario': request.user,
        'titulo':  'Panel de Administración',
    }
    # Apunta al archivo correcto que estuvimos editando
    return render(request, 'dashboards/admin/home.html', context)

@rol_requerido('admin', 'adminprincipal')
def home(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/home.html', context)

@rol_requerido('admin', 'adminprincipal')
def admin_registros(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/registros.html', context)

@rol_requerido('admin','adminprincipal')
def admin_refuerzo(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/refuerzo.html', context)

@rol_requerido('admin', 'adminprincipal')
def admin_modificacion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/modificacion.html', context)

@rol_requerido('admin', 'adminprincipal')
def imputacion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/imputacion.html', context)

@rol_requerido('admin')
def admin_usuarios(request):
    todos = Usuario.objects.exclude(id=request.user.id).order_by('is_active', 'nombre')
    context = {
        'usuario': request.user,
        'usuarios': todos,
    }
    return render(request, 'dashboards/admin/usuarios.html', context)

@rol_requerido('admin', 'adminprincipal')
def admin_configuracion(request):
    context = {'usuario': request.user}
    if request.user.rol == 'adminprincipal':
        return render(request, 'dashboards/adminprincipal/configuracion.html', context)
    return render(request, 'dashboards/admin/configuracion.html', context)

@rol_requerido('admin','adminprincipal')
def cargar_presupuesto(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/cargarpresupuesto.html', context)

@rol_requerido('admin', 'adminprincipal')
def carga_catalogos(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/crear_partida.html', context)
# ==========================================
# ==========================================
#  ACCIONES COMUNES DE GESTIÓN DE USUARIOS
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def ordenpago(request):
    # Formulario en blanco: abrirlo NO crea nada (solo lectura). No se puede iniciar una OP sobre
    # una Imputación anulada; el backend lo vuelve a validar al crear y al completar el borrador.
    imp_id = _entero_o_none(request.GET.get('imputacion_id'))
    if imp_id is not None:
        anulada = Imputacion.objects.filter(id=imp_id, anulada=True).exists()
        if anulada:
            messages.warning(request, 'La Imputación está anulada: no se puede generar una Orden de Pago.')
            return redirect('lista_imputaciones')
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/ordenpago.html',context)

@rol_requerido('admin', 'adminprincipal')
def ordenpagopersonal(request):
    # Formulario en blanco: abrirlo NO crea nada. El borrador se crea recién con la primera
    # edición real (api_op_personal_borrador_crear).
    context = {
        'usuario':    request.user,
        'modo':       'crear',
        'opp_datos':  'null',
        'inicial_cr': _inicial_usuario(request.user),
    }
    return render(request, 'dashboards/admin/ordenpagopersonal.html', context)

@rol_requerido('admin', 'adminprincipal')
def crear_usuario(request):
    # Definimos a dónde irá cada rol según tus NAMES reales de urls.py
    # El 'admin' usa name='usuarios' (línea 13 de tu urls.py)
    # El 'adminprincipal' usa name='adminprincipal_usuarios' (¡Ojo! En tu urls.py le pusiste name='usuarios' también en la línea 6)
    
    # Para solucionar el conflicto de nombres repetidos, lo ideal es usar esto:
    url_redireccion = 'usuarios' if request.user.rol == 'admin' else 'usuarios' 
    
    if request.method == 'POST':
        email    = request.POST.get('email', '').strip()
        nombre   = request.POST.get('nombre', '').strip()
        password = request.POST.get('password', '')
        rol      = request.POST.get('rol', '')
        area     = request.POST.get('area', '')

        if not email or not nombre or not password or not rol or not area:
            messages.error(request, 'Todos los campos son obligatorios.')
            return redirect(url_redireccion)

        if UsuarioPersonalizado.objects.filter(email=email).exists():
            messages.error(request, 'Ya existe un usuario con ese correo.')
            return redirect(url_redireccion)

        UsuarioPersonalizado.objects.create_user(
            email=email,
            password=password,
            nombre=nombre,
            rol=rol,
            area=area,
        )
        messages.success(request, f'Usuario {nombre} creado correctamente.')
        return redirect(url_redireccion)

    return redirect(url_redireccion)

@rol_requerido('admin', 'adminprincipal')
def dar_baja_usuario(request, usuario_id):
    if request.method == 'POST':
        try:
            usuario = UsuarioPersonalizado.objects.get(id=usuario_id)
            usuario.is_active = False
            usuario.fecha_baja = timezone.now()
            usuario.save()
            return JsonResponse({
                'ok': True,
                'nombre': usuario.nombre,
                'fecha_baja': usuario.fecha_baja.strftime('%d/%m/%Y')
            })
        except UsuarioPersonalizado.DoesNotExist:
            return JsonResponse({'error': 'No encontrado'}, status=404)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@rol_requerido('admin', 'adminprincipal')
def reactivar_usuario(request, usuario_id):
    if request.method == 'POST':
        try:
            usuario = UsuarioPersonalizado.objects.get(id=usuario_id)
            usuario.is_active = True
            usuario.fecha_baja = None
            usuario.save()
            return JsonResponse({
                'ok': True,
                'nombre': usuario.nombre,
            })
        except UsuarioPersonalizado.DoesNotExist:
            return JsonResponse({'error': 'No encontrado'}, status=404)
    return JsonResponse({'error': 'Método no permitido'}, status=405)


# ==========================================
#  OTROS DASHBOARDS Y ACCESO DENEGADO
# ==========================================

@rol_requerido('usuariovip')
def usuariovip_dashboard(request):
    context = {
        'usuario': request.user,
        'titulo':  'Panel Usuario VIP',
    }
    return render(request, 'dashboards/vip/usuariovip_dashboard.html', context)

@rol_requerido('usuariocomun')
def usuariocomun_dashboard(request):
    context = {
        'usuario': request.user,
        'titulo':  'Panel Usuario',
    }
    return render(request, 'dashboards/comun/usuariocomun_dashboard.html', context)

def acceso_denegado(request):
    return render(request, 'acceso_denegado.html', status=403)

# ==========================================
#  API — CREAR LÍNEA PRESUPUESTARIA
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_crear_linea_presupuestaria(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    programa_id  = body.get('programa_id')
    proyecto_id  = body.get('proyecto_id')
    actividad_id = body.get('actividad_id')
    partida_id   = body.get('partida_id')
    fuente_id    = body.get('fuente_id')
    presupuesto  = body.get('presupuesto_inicial')

    # 1. Verificar presencia sin que el número 0 sea considerado "vacio"
    campos_requeridos = [programa_id, proyecto_id, actividad_id, partida_id, fuente_id]
    if any(x is None or x == '' for x in campos_requeridos) or presupuesto is None or presupuesto == '':
        return JsonResponse({'error': 'Faltan campos obligatorios'}, status=400)

    try:
        # 2. Formatear reemplazando coma por punto si viene como string
        presupuesto_str = str(presupuesto).replace(',', '.')
        presupuesto = Decimal(presupuesto_str)
        
        # 3. Permitir 0 y bloquear únicamente valores negativos
        if presupuesto < 0:
            return JsonResponse({'error': 'El presupuesto inicial no puede ser negativo'}, status=400)
    except Exception:
        return JsonResponse({'error': 'El formato del presupuesto inicial es inválido'}, status=400)

    ejercicio = timezone.now().year

    try:
        programa  = Programa.objects.get(id=programa_id)
        proyecto  = Proyecto.objects.get(id=proyecto_id)
        actividad = ActividadObra.objects.get(id=actividad_id)
        partida   = Partida.objects.get(id=partida_id)
        fuente    = FuenteFinanciamiento.objects.get(id=fuente_id)
        jurisdiccion = programa.jurisdiccion
    except Exception as e:
        return JsonResponse({'error': f'Referencia inválida: {str(e)}'}, status=400)

    # Verificar duplicado
    if LineaPresupuestaria.objects.filter(
        programa=programa,
        proyecto=proyecto,
        actividad_obra=actividad,
        partida=partida,
        fuente_financiamiento=fuente,
        ejercicio=ejercicio,
    ).exists():
        return JsonResponse(
            {'error': 'Ya existe una línea presupuestaria con esa combinación para el ejercicio actual'},
            status=400
        )

    linea = LineaPresupuestaria.objects.create(
        jurisdiccion          = jurisdiccion,
        programa              = programa,
        proyecto              = proyecto,
        actividad_obra        = actividad,
        partida               = partida,
        fuente_financiamiento = fuente,
        ejercicio             = ejercicio,
        saldo_inicial         = presupuesto,
        saldo_actual          = presupuesto,
    )

    return JsonResponse({
        'ok':      True,
        'linea_id': linea.id,
        'mensaje': f'Línea presupuestaria creada correctamente para el ejercicio {ejercicio}',
    })


# ==========================================
#  API — LISTAR LÍNEAS PRESUPUESTARIAS
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_listar_lineas(request):
    ejercicio = timezone.now().year
    lineas = LineaPresupuestaria.objects.filter(
        ejercicio=ejercicio
    ).select_related(
        'programa', 'proyecto', 'actividad_obra', 'partida', 'fuente_financiamiento'
    ).order_by('programa__codigo_programa', 'proyecto__codigo_proyecto', 'actividad_obra__codigo_act_obra')

    data = []
    for l in lineas:
        data.append({
            'id':             l.id,
            'prog':           l.programa.codigo_programa,
            'subp':           '00',
            'py':             l.proyecto.codigo_proyecto,
            'ao':             l.actividad_obra.codigo_act_obra,
            'partida':        l.partida.codigo,
            'denominacion':   l.partida.denominacion,
            'fuente':         l.fuente_financiamiento.codigo,
            'saldo_inicial':  str(l.saldo_inicial),
            'saldo_actual':   str(l.saldo_actual),
        })

    return JsonResponse({'lineas': data})

# ==========================================
#  API — LÍNEAS PRESUPUESTARIAS
#  Devuelve las líneas disponibles para
#  poblar el selector del formulario
# ==========================================
@rol_requerido('admin','adminprincipal')
def api_lineas_presupuestarias(request):
    lineas = LineaPresupuestaria.objects.select_related(
        'actividad_obra', 'partida', 'fuente_financiamiento'
    ).filter(ejercicio=2026)

    data = [
        {
            'id':          l.id,
            'descripcion': f'{l.actividad_obra.nombre} — {l.partida.denominacion} ({l.fuente_financiamiento.nombre})',
            'saldo_actual': str(l.saldo_actual),
        }
        for l in lineas
    ]
    return JsonResponse({'lineas': data})


# ==========================================
#  API — LÍNEAS PRESUPUESTARIAS PARA EL DASHBOARD (HOME)
#  Alimenta la tabla "Detalle de Movimientos" del home con
#  las unidades presupuestarias (líneas) reales de la BD.
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_home_lineas(request):
    ejercicio_raw = request.GET.get('ejercicio')
    try:
        ejercicio = int(ejercicio_raw) if ejercicio_raw else timezone.now().year
    except ValueError:
        ejercicio = timezone.now().year

    lineas = LineaPresupuestaria.objects.filter(
        ejercicio=ejercicio
    ).select_related(
        'jurisdiccion', 'programa', 'proyecto', 'actividad_obra',
        'partida', 'fuente_financiamiento',
    ).order_by(
        'programa__codigo_programa', 'proyecto__codigo_proyecto',
        'actividad_obra__codigo_act_obra', 'partida__codigo',
    )

    data = []
    for l in lineas:
        data.append({
            'id':              l.id,
            'jurisdiccion':    str(l.jurisdiccion.codigo_jurisd).zfill(2),
            'programa':        str(l.programa.codigo_programa).zfill(2),
            # No existe un modelo Subprograma todavía: se mantiene fijo en '00'
            'subprograma':     '00',
            'proyecto':        str(l.proyecto.codigo_proyecto).zfill(3),
            'ao':              str(l.actividad_obra.codigo_act_obra).zfill(3),
            'partida':         str(l.partida.codigo).zfill(3),
            'ff':              str(l.fuente_financiamiento.codigo).zfill(2),
            'denominacion':    l.partida.denominacion,
            'saldoInicial':    str(l.saldo_inicial),
            'saldoModificado': str(l.saldo_actual),
        })

    # ── Resumen general: SUM(saldo_inicial) y SUM(saldo_actual) ───────────
    from django.db.models import Sum

    agregados = LineaPresupuestaria.objects.filter(ejercicio=ejercicio).aggregate(
        total_inicial=Sum('saldo_inicial'),
        total_actual=Sum('saldo_actual'),
    )
    presupuesto_inicial    = agregados['total_inicial'] or Decimal('0')
    presupuesto_modificado = agregados['total_actual'] or Decimal('0')

    aumento_pct = 0
    if presupuesto_inicial:
        aumento_pct = round(
            float((presupuesto_modificado - presupuesto_inicial) / presupuesto_inicial * 100), 1
        )

    # Fecha exacta de la última modificación del presupuesto: el registro
    # de MovimientoHistorial más reciente que afecta a este ejercicio.
    # Imputación, Refuerzo y Modificación ahora registran un único
    # movimiento por operación con linea_presupuestaria=None, así que se
    # identifican por el año de la propia operación en lugar de la línea.
    # Órdenes de Pago siguen atadas a una línea (se filtran por
    # línea__ejercicio) — ver nota en api_movimientos_linea.
    from django.db.models import Q

    imputacion_ids_ejercicio   = Imputacion.objects.filter(fecha__year=ejercicio).values_list('id', flat=True)
    refuerzo_ids_ejercicio     = Refuerzo.objects.filter(fecha__year=ejercicio).values_list('id', flat=True)
    modificacion_ids_ejercicio = Modificacion.objects.filter(fecha__year=ejercicio).values_list('id', flat=True)

    ultima_modificacion = MovimientoHistorial.objects.filter(
        Q(linea_presupuestaria__ejercicio=ejercicio) |
        Q(tipo__startswith='IMPUTACION', referencia_id__in=imputacion_ids_ejercicio) |
        Q(tipo__startswith='REFUERZO', referencia_id__in=refuerzo_ids_ejercicio) |
        Q(tipo__startswith='MODIFICACION', referencia_id__in=modificacion_ids_ejercicio)
    ).order_by('-fecha').values_list('fecha', flat=True).first()

    fecha_ultima_modificacion = (
        ultima_modificacion.strftime('%d/%m/%Y') if ultima_modificacion else None
    )

    # ── Por programa: SUM(saldo_actual) filtrando por codigo_programa ─────
    # Solo se incluyen los programas que tienen al menos una línea en el
    # ejercicio (mismo criterio que ya usa api_programas).
    programa_ids = LineaPresupuestaria.objects.filter(
        ejercicio=ejercicio
    ).values_list('programa_id', flat=True).distinct()

    programas_data = []
    for programa in Programa.objects.filter(id__in=programa_ids).order_by('codigo_programa'):
        agregados_prog = LineaPresupuestaria.objects.filter(
            programa=programa, ejercicio=ejercicio
        ).aggregate(
            total_actual=Sum('saldo_actual'),
        )
        monto_actual = agregados_prog['total_actual'] or Decimal('0')

        porcentaje = 0
        if presupuesto_modificado:
            porcentaje = round(float(monto_actual / presupuesto_modificado * 100), 1)

        programas_data.append({
            'codigo':     str(programa.codigo_programa).zfill(2),
            'nombre':     programa.nombre,
            'monto':      str(monto_actual),
            'porcentaje': porcentaje,
        })

    return JsonResponse({
        'lineas':    data,
        'ejercicio': ejercicio,
        'resumen': {
            'presupuestoInicial':    str(presupuesto_inicial),
            'presupuestoModificado': str(presupuesto_modificado),
            'aumentoPct':            aumento_pct,
            'fechaUltimaModificacion': fecha_ultima_modificacion,
        },
        'programas': programas_data,
    })


# ==========================================
#  API — MOVIMIENTOS DE UNA LÍNEA PRESUPUESTARIA
#  Alimenta el desplegable de detalle de la tabla "Detalle de
#  Movimientos" del home: junta imputaciones, refuerzos,
#  modificaciones y órdenes de pago asociados a la línea,
#  usando el historial unificado (MovimientoHistorial).
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_movimientos_linea(request, linea_id):
    linea = get_object_or_404(LineaPresupuestaria, id=linea_id)

    items_ordenables = []  # (fecha_datetime, item) -> se ordena al final

    # ── Imputaciones: se leen directamente de ImputacionDetalle, NO de
    #    MovimientoHistorial (que ahora guarda un único registro por toda
    #    la Imputación, sin línea asociada). Así el importe mostrado es
    #    siempre el exacto imputado a ESTA línea, sin riesgo de duplicados.
    imputacion_items = {}  # imputacion_id -> item (para anidar las OP)

    detalles_imputacion = ImputacionDetalle.objects.filter(
        linea_presupuestaria=linea
    ).select_related('imputacion', 'imputacion__usuario')

    for det in detalles_imputacion:
        imp = det.imputacion
        item = {
            'tipo':              'Imputación',
            'fechaCreacion':     imp.fecha_creacion.strftime('%d/%m/%Y'),
            'numeroExpediente':  imp.nro_expediente,
            'usuario':           imp.usuario.nombre if imp.usuario else '',
            'importe':           str(-det.importe),
            'decretoResolucion': '',
            'ordenesPago':       [],
            'modificacionesModoB': [],
        }
        imputacion_items[imp.id] = item
        items_ordenables.append((imp.fecha_creacion, item))

    # ── Órdenes de Pago: se anidan dentro de su Imputación de origen usando
    #    la FK real de la línea de detalle (imputacion_detalle.imputacion_id),
    #    con el importe que ESA OP usó específicamente de ESTA línea.
    ups_op = OrdenPagoUnidadPresupuestaria.objects.filter(
        imputacion_detalle__linea_presupuestaria=linea
    ).select_related('orden_pago', 'orden_pago__usuario', 'imputacion_detalle__imputacion')

    for up in ups_op:
        op = up.orden_pago
        op_item = {
            'tipo':              'O. P.',
            'fechaCreacion':     op.fecha_creacion.strftime('%d/%m/%Y'),
            'numeroExpediente':  op.nro_orden_pago,
            'usuario':           op.usuario.nombre if op.usuario else '',
            'importe':           str(-up.importe),
            'decretoResolucion': op.nro_resolucion,
        }
        padre = imputacion_items.get(up.imputacion_detalle.imputacion_id)
        if padre is not None:
            padre['ordenesPago'].append(op_item)
        else:
            # Caso borde (no debería pasar dado el filtro de arriba):
            # se muestra suelta para no perder la información.
            items_ordenables.append((op.fecha_creacion, op_item))

    # ── Órdenes de Pago Personal: se anidan dentro de su Imputación automática
    #    usando OrdenPagoPersonalPartida que tiene FK a ImputacionDetalle.
    partidas_opp = OrdenPagoPersonalPartida.objects.filter(
        linea_presupuestaria=linea,
        imputacion_detalle__isnull=False,
    ).select_related(
        'orden_pago_personal',
        'orden_pago_personal__usuario',
        'imputacion_detalle__imputacion',
    )

    for partida in partidas_opp:
        opp  = partida.orden_pago_personal
        opp_item = {
            'tipo':              'O. P. Personal',
            'fechaCreacion':     opp.fecha_creacion.strftime('%d/%m/%Y') if opp.fecha_creacion else '',
            'numeroExpediente':  opp.nro_orden_pago,
            'usuario':           opp.usuario.nombre if opp.usuario else '',
            'importe':           str(-partida.importe),
            'decretoResolucion': '',
        }
        padre = imputacion_items.get(partida.imputacion_detalle.imputacion_id)
        if padre is not None:
            padre['ordenesPago'].append(opp_item)
        else:
            items_ordenables.append((opp.fecha_creacion, opp_item))

    # ── Refuerzos: se leen directamente de RefuerzoDetalle, NO de
    #    MovimientoHistorial (que ahora guarda un único registro por todo
    #    el Refuerzo, sin línea asociada).
    detalles_refuerzo = RefuerzoDetalle.objects.filter(
        linea_destino=linea
    ).select_related('refuerzo', 'refuerzo__usuario')

    for det in detalles_refuerzo:
        ref = det.refuerzo
        item = {
            'tipo':              'Refuerzo',
            'fechaCreacion':     ref.fecha_creacion.strftime('%d/%m/%Y'),
            'numeroExpediente':  ref.nro_expediente,
            'usuario':           ref.usuario.nombre if ref.usuario else '',
            'importe':           str(det.importe),
            'decretoResolucion': ref.nro_decreto_resolucion,
        }
        items_ordenables.append((ref.fecha_creacion, item))

    # ── Modificaciones: se leen directamente de ModificacionTransferente
    #    (líneas de origen, importe negativo) y ModificacionReceptora
    #    (líneas de destino, importe positivo), NO de MovimientoHistorial.
    # ── Modificaciones Transferentes ──────────────────────────────────────────
    transferentes = ModificacionTransferente.objects.filter(
        linea_origen=linea
    ).select_related(
        'modificacion', 'modificacion__usuario',
        'imputacion_detalle__imputacion'
    )

    for det in transferentes:
        mod  = det.modificacion
        item = {
            'tipo':                  'Modificación Transferente',
            'fechaCreacion':         mod.fecha_creacion.strftime('%d/%m/%Y'),
            'numeroExpediente':      mod.nro_expediente,
            'usuario':               mod.usuario.nombre if mod.usuario else '',
            'importe':               str(-det.importe),
            'decretoResolucion':     mod.nro_decreto,
            'tipo_transferente':     mod.tipo_transferente,
            'imputacion_detalle_id': det.imputacion_detalle_id,
            'imputacion_id':         det.imputacion_detalle.imputacion_id if det.imputacion_detalle else None,
        }

        if mod.tipo_transferente == 'imputacion' and det.imputacion_detalle_id:
            # Modo B: anidar dentro de la imputación correspondiente
            padre = imputacion_items.get(det.imputacion_detalle.imputacion_id)
            if padre is not None:
                padre.setdefault('modificacionesModoB', []).append(item)
            else:
                # La imputación no es de esta línea pero la mod sí — caso borde
                items_ordenables.append((mod.fecha_creacion, item))
        else:
            # Modo A: nivel principal de la UP
            items_ordenables.append((mod.fecha_creacion, item))

    # ── Modificaciones Receptoras ─────────────────────────────────────────────
    receptoras = ModificacionReceptora.objects.filter(
        linea_destino=linea
    ).select_related('modificacion', 'modificacion__usuario')

    for det in receptoras:
        mod  = det.modificacion
        item = {
            'tipo':              'Modificación Receptora',
            'fechaCreacion':     mod.fecha_creacion.strftime('%d/%m/%Y'),
            'numeroExpediente':  mod.nro_expediente,
            'usuario':           mod.usuario.nombre if mod.usuario else '',
            'importe':           str(det.importe),
            'decretoResolucion': mod.nro_decreto,
        }
        items_ordenables.append((mod.fecha_creacion, item))

    # ── Orden final: más reciente primero ──────────────────────────────
    items_ordenables.sort(key=lambda par: par[0], reverse=True)
    data = [item for _, item in items_ordenables]

    return JsonResponse({'movimientos': data})


# ==========================================
#  API — CREAR REFUERZO
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_crear_refuerzo(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    fecha          = body.get('fecha')
    nro_expediente = body.get('nro_expediente', '').strip()
    nro_decreto    = body.get('nro_decreto', '').strip()
    detalles       = body.get('detalles', [])

    if not fecha or not nro_expediente or not nro_decreto:
        return JsonResponse({'error': 'Faltan campos obligatorios'}, status=400)

    if not detalles:
        return JsonResponse({'error': 'Debe incluir al menos una línea presupuestaria'}, status=400)

    try:
        with transaction.atomic():
            # Validar y bloquear líneas dentro de la transacción
            lineas_a_actualizar = []
            importe_total = 0

            for d in detalles:
                linea_id = d.get('linea_id')
                importe  = d.get('importe')

                if not linea_id or not importe:
                    raise ValueError('Cada detalle debe tener linea_id e importe')

                try:
                    linea   = LineaPresupuestaria.objects.select_for_update().get(id=linea_id)
                    importe = Decimal(str(importe))
                    if importe <= 0:
                        raise ValueError('El importe debe ser mayor a cero')
                except LineaPresupuestaria.DoesNotExist:
                    raise ValueError(f'Línea {linea_id} no encontrada')

                lineas_a_actualizar.append((linea, importe))
                importe_total += importe

            # Crear cabecera
            refuerzo = Refuerzo.objects.create(
                fecha                  = fecha,
                nro_expediente         = nro_expediente,
                nro_decreto_resolucion = nro_decreto,
                importe_total          = importe_total,
                usuario                = request.user,
            )

            for linea, importe in lineas_a_actualizar:
                RefuerzoDetalle.objects.create(
                    refuerzo      = refuerzo,
                    linea_destino = linea,
                    importe       = importe,
                )
                linea.saldo_actual += importe
                linea.save()

            # ── Un único registro de historial para TODO el Refuerzo ──────
            # (antes se creaba uno por cada línea afectada, dentro del loop
            # de arriba, lo que hacía que el mismo Refuerzo apareciera
            # duplicado en el Home). El detalle por línea sigue disponible
            # en RefuerzoDetalle, que es de ahí de donde lo lee el Home.
            MovimientoHistorial.objects.create(
                linea_presupuestaria = None,
                tipo                 = 'REFUERZO',
                referencia_id        = refuerzo.id,
                usuario              = request.user,
                monto                = importe_total,
                descripcion          = f'Refuerzo por decreto {nro_decreto} — expediente {nro_expediente}',
            )

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({
        'ok':            True,
        'refuerzo_id':   refuerzo.id,
        'importe_total': importe_total,
    })

# ==========================================
#  API — LISTAR REFUERZOS
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_listar_refuerzos(request):
    refuerzos = Refuerzo.objects.select_related('usuario').prefetch_related(
        'detalles__linea_destino',
    ).filter(estado_formulario='LISTO').order_by('-fecha_creacion')

    data = []
    for r in refuerzos:
        data.append({
            'id':            r.id,
            'fecha':         r.fecha.strftime('%Y-%m-%d'),
            'nro_expediente': r.nro_expediente,
            'nro_decreto':   r.nro_decreto_resolucion,
            'importe_total': str(r.importe_total),
            'usuario':       r.usuario.nombre,
            'receptoras': [
                {'linea_id': d.linea_destino.id, 'importe': str(d.importe)}
                for d in r.detalles.all()
            ],
        })

    return JsonResponse({'refuerzos': data})

@rol_requerido('admin', 'adminprincipal')
def refuerzo_ver(request, refuerzo_id):
    import json as _json
    refuerzo = get_object_or_404(Refuerzo, id=refuerzo_id)
    if refuerzo.estado_formulario == 'REVISAR':
        return redirect('refuerzo_editar', refuerzo_id=refuerzo.id)
    detalles = RefuerzoDetalle.objects.filter(refuerzo=refuerzo).select_related(
        'linea_destino__programa', 'linea_destino__proyecto',
        'linea_destino__actividad_obra', 'linea_destino__partida',
        'linea_destino__fuente_financiamiento'
    )
    datos = {
        'id':             refuerzo.id,
        'fecha':          refuerzo.fecha.strftime('%Y-%m-%d'),
        'nro_expediente': refuerzo.nro_expediente,
        'nro_decreto':    refuerzo.nro_decreto_resolucion,
        'importe_total':  str(refuerzo.importe_total),
        'receptoras': [
            {
                'linea_id':     d.linea_destino.id,
                'importe':      str(d.importe),
                'programa_id':  d.linea_destino.programa.id,
                'proyecto_id':  d.linea_destino.proyecto.id,
                'actividad_id': d.linea_destino.actividad_obra.id,
                'partida_id':   d.linea_destino.partida.id,
                'fuente_id':    d.linea_destino.fuente_financiamiento.id,
            }
            for d in detalles
        ],
    }
    context = {
        'usuario':  request.user,
        'modo':     'ver',
        'refuerzo': _json.dumps(datos),
    }
    return render(request, 'dashboards/admin/refuerzo_form.html', context)


# ==========================================
#  REFUERZO — GUARDADO AUTOMÁTICO (BORRADOR "REVISAR") Y COMPLETADO
# ==========================================
# Un Refuerzo en estado REVISAR es solo información guardada: sus filas viven en
# RefuerzoBorradorDetalle, una tabla sin triggers, por lo que NUNCA modifica
# saldos ni genera movimientos. Los movimientos presupuestarios los producen los
# triggers de PostgreSQL al hacer INSERT en refuerzo_detalle, y eso solo ocurre
# en api_refuerzo_completar (REVISAR → LISTO).

_logger = logging.getLogger(__name__)

REFUERZO_EXPEDIENTE_PLACEHOLDER = 'BORRADOR'   # valor de relleno de la cabecera mientras es borrador
REFUERZO_MAX_FILAS_BORRADOR     = 200


class _RefuerzoError(Exception):
    """Error de validación o de estado controlado: se responde con su status."""
    def __init__(self, mensaje, status=400, extra=None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status  = status
        self.extra   = extra or {}


def _respuesta_error(e):
    data = {'error': e.mensaje}
    data.update(e.extra)
    return JsonResponse(data, status=e.status)


def _json_body(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise _RefuerzoError('JSON inválido')
    if not isinstance(body, dict):
        raise _RefuerzoError('JSON inválido')
    return body


def _decimal_o_none(valor, etiqueta):
    """Vacío → None. Número válido → Decimal con 2 decimales (cabe en NUMERIC(18,2)).
    Cualquier otra cosa → error claro, en lugar de perder el dato en silencio."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    try:
        num = Decimal(str(valor))
        if not num.is_finite():
            raise InvalidOperation
        num = num.quantize(Decimal('0.01'))
    except InvalidOperation:
        raise _RefuerzoError(f'{etiqueta}: el importe no es un número válido')
    if abs(num) >= Decimal(10) ** 16:
        raise _RefuerzoError(f'{etiqueta}: el importe es demasiado grande')
    return num


def _entero_o_none(valor):
    try:
        return int(valor) if valor not in (None, '') else None
    except (TypeError, ValueError):
        return None


def _cabecera_borrador(body):
    """Cabecera tal como llega: acepta datos parciales. fecha None = no informada."""
    fecha = None
    valor = body.get('fecha')
    if valor:
        try:
            fecha = date.fromisoformat(str(valor))
        except ValueError:
            fecha = None

    expediente = str(body.get('nro_expediente') or '').strip()
    decreto    = str(body.get('nro_decreto') or '').strip()
    if len(expediente) > 50:
        raise _RefuerzoError('El número de expediente supera los 50 caracteres permitidos')
    if len(decreto) > 255:
        raise _RefuerzoError('El nombre del decreto/resolución supera los 255 caracteres permitidos')

    importe_total = _decimal_o_none(body.get('importe_total'), 'Importe total del refuerzo')

    return {
        'fecha':          fecha,
        'nro_expediente': expediente,
        'nro_decreto':    decreto,
        'importe_total':  importe_total if importe_total is not None else Decimal('0.00'),
    }


def _filas_borrador(body):
    """Filas del borrador: acepta filas incompletas (líneas sin resolver, sin importe)."""
    detalles = body.get('detalles', [])
    if not isinstance(detalles, list):
        raise _RefuerzoError('El detalle del refuerzo es inválido')
    if len(detalles) > REFUERZO_MAX_FILAS_BORRADOR:
        raise _RefuerzoError(f'Un refuerzo no puede tener más de {REFUERZO_MAX_FILAS_BORRADOR} filas')

    filas = []
    for i, d in enumerate(detalles):
        if not isinstance(d, dict):
            raise _RefuerzoError('El detalle del refuerzo es inválido')
        filas.append({
            'linea_id':     _entero_o_none(d.get('linea_id')),
            'programa_id':  _entero_o_none(d.get('programa_id')),
            'proyecto_id':  _entero_o_none(d.get('proyecto_id')),
            'actividad_id': _entero_o_none(d.get('actividad_id')),
            'partida_id':   _entero_o_none(d.get('partida_id')),
            'fuente_id':    _entero_o_none(d.get('fuente_id')),
            'importe':      _decimal_o_none(d.get('importe'), f'Fila {i + 1}'),
            'orden':        i,
        })

    # Un linea_id que ya no existe no debe romper el guardado parcial: se descarta.
    ids = {f['linea_id'] for f in filas if f['linea_id']}
    if ids:
        existentes = set(LineaPresupuestaria.objects.filter(id__in=ids).values_list('id', flat=True))
        for f in filas:
            if f['linea_id'] and f['linea_id'] not in existentes:
                f['linea_id'] = None
    return filas


def _reemplazar_borradores(refuerzo, filas):
    """Reemplaza por completo las filas del borrador (dentro de una transacción)."""
    refuerzo.borradores_detalle.all().delete()
    RefuerzoBorradorDetalle.objects.bulk_create([
        RefuerzoBorradorDetalle(
            refuerzo               = refuerzo,
            linea_presupuestaria_id = f['linea_id'],
            programa_id            = f['programa_id'],
            proyecto_id            = f['proyecto_id'],
            actividad_id           = f['actividad_id'],
            partida_id             = f['partida_id'],
            fuente_id              = f['fuente_id'],
            importe                = f['importe'],
            orden                  = f['orden'],
        )
        for f in filas
    ])


# Roles que pueden consultar, editar, completar y eliminar borradores de CUALQUIER usuario.
# Se valida en el backend (además del decorador de cada vista): no depende del frontend.
REFUERZO_ROLES_EDICION = ('admin', 'adminprincipal')

# Ediciones consecutivas del mismo usuario dentro de esta ventana se agrupan en una fila de auditoría.
REFUERZO_AUDITORIA_VENTANA = timedelta(minutes=30)


def _puede_gestionar_refuerzo(user):
    return bool(user and user.is_authenticated and getattr(user, 'rol', None) in REFUERZO_ROLES_EDICION)


def _obtener_refuerzo_bloqueado(refuerzo_id, user=None, accion='modificar'):
    """Bloquea la fila del Refuerzo (debe llamarse dentro de transaction.atomic())
    y exige que siga siendo un borrador. El bloqueo serializa guardados simultáneos
    y evita que dos pedidos completen el mismo Refuerzo a la vez.
    Si se pasa 'user', además se valida su rol (defensa en profundidad)."""
    if user is not None and not _puede_gestionar_refuerzo(user):
        raise _RefuerzoError('No tenés permiso para modificar este Refuerzo', 403)
    try:
        refuerzo = Refuerzo.objects.select_for_update().get(id=refuerzo_id)
    except Refuerzo.DoesNotExist:
        raise _RefuerzoError('Refuerzo no encontrado', 404)
    if refuerzo.estado_formulario != 'REVISAR':
        if accion == 'eliminar':
            mensaje = 'Este Refuerzo ya fue completado: solo se pueden eliminar borradores en estado Revisar'
        else:
            mensaje = 'Este Refuerzo ya fue completado y no se puede modificar desde el formulario'
        raise _RefuerzoError(mensaje, 409, {'completado': True})
    return refuerzo


def _version(refuerzo):
    """Token de versión del borrador: su fecha_modificacion. El cliente lo devuelve en
    cada guardado; si cambió (otra persona u otra pestaña guardó), se rechaza con 409
    en lugar de pisar los cambios ajenos."""
    return refuerzo.fecha_modificacion.isoformat()


def _verificar_version(refuerzo, enviada):
    if not enviada:
        raise _RefuerzoError('Falta la versión del borrador. Recargá la página.', 400)
    try:
        enviada_dt = _dt.fromisoformat(str(enviada))
    except ValueError:
        raise _RefuerzoError('La versión del borrador es inválida. Recargá la página.', 400)
    if enviada_dt != refuerzo.fecha_modificacion:
        raise _RefuerzoError(
            'Otro usuario (u otra pestaña) modificó este borrador mientras lo editabas. '
            'Recargá la página para ver los cambios antes de seguir.',
            409, {'conflicto': True},
        )


def _json_para_script(datos):
    """JSON seguro para incrustar dentro de un <script> (escapa < > & para que un texto
    como "</script>" escrito por el usuario no pueda cerrar la etiqueta)."""
    return (json.dumps(datos)
            .replace('<', '\\u003c')
            .replace('>', '\\u003e')
            .replace('&', '\\u0026'))


def _datos_borrador(refuerzo):
    """Datos del borrador para volver a poblar el formulario (misma forma que usa el JS)."""
    filas = refuerzo.borradores_detalle.order_by('orden')
    return {
        'id':             refuerzo.id,
        'estado':         refuerzo.estado_formulario,
        'version':        _version(refuerzo),
        'fecha':          refuerzo.fecha.strftime('%Y-%m-%d'),
        'nro_expediente': '' if refuerzo.nro_expediente == REFUERZO_EXPEDIENTE_PLACEHOLDER else refuerzo.nro_expediente,
        'nro_decreto':    refuerzo.nro_decreto_resolucion,
        'importe_total':  str(refuerzo.importe_total) if refuerzo.importe_total else None,
        'receptoras': [
            {
                'linea_id':     b.linea_presupuestaria_id,
                'importe':      str(b.importe) if b.importe is not None else None,
                'programa_id':  b.programa_id,
                'proyecto_id':  b.proyecto_id,
                'actividad_id': b.actividad_id,
                'partida_id':   b.partida_id,
                'fuente_id':    b.fuente_id,
            }
            for b in filas
        ],
    }


def _verificar_version_refuerzo(refuerzo, enviada):
    """Igual que _verificar_version, pero si hay conflicto informa QUIÉN y CUÁNDO
    guardó por última vez. (No se toca _verificar_version: lo comparten otros formularios.)"""
    try:
        _verificar_version(refuerzo, enviada)
    except _RefuerzoError as e:
        if e.extra.get('conflicto') and refuerzo.usuario_modificacion_id:
            editor = refuerzo.usuario_modificacion
            cuando = timezone.localtime(refuerzo.fecha_modificacion).strftime('%d/%m/%Y - %H:%M')
            e.extra['modificado_por'] = editor.nombre
            e.extra['modificado_en']  = cuando
            e.mensaje = f'{e.mensaje} Última edición: {editor.nombre}, {cuando}.'
        raise


def _clave_fila_refuerzo(linea_id, programa_id, proyecto_id, actividad_id, partida_id,
                         fuente_id, importe, orden):
    return (linea_id, programa_id, proyecto_id, actividad_id, partida_id, fuente_id, importe, orden)


def _refuerzo_campos_modificados(refuerzo, cabecera, filas):
    """Lista de campos que REALMENTE cambiarían al aplicar lo recibido. Vacía = nada que
    guardar: no se escribe nada, así que 'editado por' y la fecha quedan como estaban."""
    campos = []
    if cabecera['fecha'] and cabecera['fecha'] != refuerzo.fecha:
        campos.append('fecha')
    if (cabecera['nro_expediente'] or REFUERZO_EXPEDIENTE_PLACEHOLDER) != refuerzo.nro_expediente:
        campos.append('nro_expediente')
    if cabecera['nro_decreto'] != refuerzo.nro_decreto_resolucion:
        campos.append('nro_decreto')
    if cabecera['importe_total'] != refuerzo.importe_total:
        campos.append('importe_total')

    guardadas = [
        _clave_fila_refuerzo(b.linea_presupuestaria_id, b.programa_id, b.proyecto_id, b.actividad_id,
                             b.partida_id, b.fuente_id, b.importe, b.orden)
        for b in refuerzo.borradores_detalle.order_by('orden')
    ]
    nuevas = [
        _clave_fila_refuerzo(f['linea_id'], f['programa_id'], f['proyecto_id'], f['actividad_id'],
                             f['partida_id'], f['fuente_id'], f['importe'], f['orden'])
        for f in sorted(filas, key=lambda f: f['orden'])
    ]
    if guardadas != nuevas:
        campos.append('detalle')
    return campos


def _registrar_auditoria_refuerzo(refuerzo, operacion, usuario, detalle=None, agrupar=False, estado=None):
    """Registra una intervención real sobre el Refuerzo. Debe llamarse DENTRO de la transacción
    y con la fila del Refuerzo bloqueada (así el agrupado no tiene carreras).
    Solo escribe en refuerzo_auditoria: no toca la tabla refuerzo ni el presupuesto."""
    ahora   = timezone.now()
    detalle = detalle or {}

    if agrupar:
        ultima = RefuerzoAuditoria.objects.filter(refuerzo_id=refuerzo.id).order_by('-id').first()
        if (ultima is not None and ultima.operacion == 'EDITAR'
                and ultima.usuario_id == usuario.id
                and ahora - ultima.fecha_ultima <= REFUERZO_AUDITORIA_VENTANA):
            campos = sorted(set(ultima.detalle.get('campos', [])) | set(detalle.get('campos', [])))
            ultima.detalle      = {'campos': campos}
            ultima.fecha_ultima = ahora
            ultima.cantidad    += 1
            ultima.save(update_fields=['detalle', 'fecha_ultima', 'cantidad'])
            return ultima

    return RefuerzoAuditoria.objects.create(
        refuerzo_id       = refuerzo.id,
        operacion         = operacion,
        usuario           = usuario,
        fecha             = ahora,
        fecha_ultima      = ahora,
        estado_resultante = estado or refuerzo.estado_formulario,
        detalle           = detalle,
    )


# ==========================================
#  PÁGINA — RETOMAR / EDITAR UN BORRADOR DE REFUERZO
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def refuerzo_editar(request, refuerzo_id):
    refuerzo = get_object_or_404(Refuerzo, id=refuerzo_id)

    # La edición de Refuerzos ya completados está fuera de alcance: se muestran solo lectura.
    if refuerzo.estado_formulario != 'REVISAR':
        return redirect('refuerzo_ver', refuerzo_id=refuerzo.id)

    context = {
        'usuario':  request.user,
        'modo':     'editar',
        'refuerzo': _json_para_script(_datos_borrador(refuerzo)),
    }
    return render(request, 'dashboards/admin/refuerzo_form.html', context)


# ==========================================
#  API — CREAR BORRADOR DE REFUERZO (primer guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_refuerzo_borrador_crear(request):
    try:
        body     = _json_body(request)
        cabecera = _cabecera_borrador(body)
        filas    = _filas_borrador(body)

        with transaction.atomic():
            refuerzo = Refuerzo.objects.create(
                fecha                  = cabecera['fecha'] or date.today(),
                nro_expediente         = cabecera['nro_expediente'] or REFUERZO_EXPEDIENTE_PLACEHOLDER,
                nro_decreto_resolucion = cabecera['nro_decreto'],
                importe_total          = cabecera['importe_total'],
                usuario                = request.user,
                usuario_modificacion   = request.user,
                estado_formulario      = 'REVISAR',
            )
            _reemplazar_borradores(refuerzo, filas)
            _registrar_auditoria_refuerzo(refuerzo, 'CREAR', request.user)

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al crear el borrador de Refuerzo')
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({'ok': True, 'refuerzo_id': refuerzo.id, 'version': _version(refuerzo)})


# ==========================================
#  API — ACTUALIZAR BORRADOR DE REFUERZO (guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_refuerzo_borrador_actualizar(request, refuerzo_id):
    sin_cambios = False
    try:
        body     = _json_body(request)
        cabecera = _cabecera_borrador(body)
        filas    = _filas_borrador(body)

        with transaction.atomic():
            refuerzo = _obtener_refuerzo_bloqueado(refuerzo_id, request.user)

            campos = _refuerzo_campos_modificados(refuerzo, cabecera, filas)
            if not campos:
                # Nada que guardar: no se escribe nada (ni "editado por", ni fecha, ni auditoría).
                # Si la versión del cliente era vieja pero el contenido coincide con lo guardado,
                # tampoco hay nada que pisar: se le devuelve la versión actual (evita falsos
                # conflictos tras un reintento cuyo primer intento sí se había guardado).
                sin_cambios = True
            else:
                _verificar_version_refuerzo(refuerzo, body.get('version'))

                if cabecera['fecha']:
                    refuerzo.fecha = cabecera['fecha']
                refuerzo.nro_expediente         = cabecera['nro_expediente'] or REFUERZO_EXPEDIENTE_PLACEHOLDER
                refuerzo.nro_decreto_resolucion = cabecera['nro_decreto']
                refuerzo.importe_total          = cabecera['importe_total']
                refuerzo.usuario_modificacion   = request.user   # siempre el usuario autenticado
                refuerzo.save()                                  # (refuerzo.usuario NO se toca)

                _reemplazar_borradores(refuerzo, filas)
                _registrar_auditoria_refuerzo(refuerzo, 'EDITAR', request.user,
                                     {'campos': campos}, agrupar=True)

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al actualizar el borrador de Refuerzo %s', refuerzo_id)
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    respuesta = {'ok': True, 'version': _version(refuerzo)}
    if sin_cambios:
        respuesta['sin_cambios'] = True
    return JsonResponse(respuesta)


# ==========================================
#  API — COMPLETAR REFUERZO (REVISAR → LISTO)
# ==========================================
# ÚNICO punto donde un Refuerzo mueve el presupuesto. Los saldos y los movimientos
# por línea los resuelven los triggers de PostgreSQL al insertar en refuerzo_detalle
# (trg_refuerzo_detalle_movimiento), por eso acá NO se toca saldo_actual.
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_refuerzo_completar(request, refuerzo_id):
    try:
        body = _json_body(request)

        with transaction.atomic():
            refuerzo = _obtener_refuerzo_bloqueado(refuerzo_id, request.user)
            _verificar_version_refuerzo(refuerzo, body.get('version'))

            borradores = list(refuerzo.borradores_detalle.order_by('orden'))

            # ── Validación definitiva ─────────────────────────────────────
            if refuerzo.nro_expediente in ('', REFUERZO_EXPEDIENTE_PLACEHOLDER):
                raise _RefuerzoError('El número de expediente es obligatorio')
            if not refuerzo.nro_decreto_resolucion.strip():
                raise _RefuerzoError('El decreto/resolución es obligatorio')
            if not refuerzo.importe_total or refuerzo.importe_total <= 0:
                raise _RefuerzoError('El importe total del refuerzo es obligatorio y debe ser mayor a cero')
            if not borradores:
                raise _RefuerzoError('Debe incluir al menos una línea presupuestaria')

            fila_de_linea = {}
            total = Decimal('0')
            for n, b in enumerate(borradores, start=1):
                if not b.linea_presupuestaria_id:
                    raise _RefuerzoError(
                        f'Fila {n}: falta completar la línea presupuestaria '
                        f'(programa, proyecto, actividad, partida y fuente)'
                    )
                if b.importe is None or b.importe <= 0:
                    raise _RefuerzoError(f'Fila {n}: el importe debe ser mayor a cero')
                if b.linea_presupuestaria_id in fila_de_linea:
                    raise _RefuerzoError(
                        f'Fila {n}: la línea presupuestaria está repetida (ya figura en la fila '
                        f'{fila_de_linea[b.linea_presupuestaria_id]}). Cada línea solo puede aparecer una vez'
                    )
                fila_de_linea[b.linea_presupuestaria_id] = n
                total += b.importe

            if total > refuerzo.importe_total:
                raise _RefuerzoError(
                    f'El total asignado (${total}) supera el importe total del refuerzo (${refuerzo.importe_total})'
                )

            # Bloquear las líneas (siempre ordenadas por id para no generar interbloqueos)
            ids_lineas = sorted(fila_de_linea)
            bloqueadas = list(
                LineaPresupuestaria.objects.select_for_update()
                .filter(id__in=ids_lineas).order_by('id').values_list('id', flat=True)
            )
            if len(bloqueadas) != len(ids_lineas):
                raise _RefuerzoError('Alguna de las líneas presupuestarias ya no existe')

            # ── Cabecera definitiva ANTES de insertar los detalles: el trigger lee el
            #    expediente y el usuario de la fila refuerzo al momento del INSERT. ──
            refuerzo.importe_total        = total
            refuerzo.estado_formulario    = 'LISTO'
            refuerzo.usuario_modificacion = request.user
            refuerzo.save()

            # ── Detalles reales: acá los triggers actualizan saldo_actual y movimientos ──
            for b in borradores:
                RefuerzoDetalle.objects.create(
                    refuerzo         = refuerzo,
                    linea_destino_id = b.linea_presupuestaria_id,
                    importe          = b.importe,
                )

            # ── Un único registro de historial para TODO el Refuerzo (como siempre) ──
            MovimientoHistorial.objects.create(
                linea_presupuestaria = None,
                tipo                 = 'REFUERZO',
                referencia_id        = refuerzo.id,
                usuario              = request.user,
                monto                = total,
                descripcion          = (
                    f'Refuerzo por decreto {refuerzo.nro_decreto_resolucion} — '
                    f'expediente {refuerzo.nro_expediente}'
                ),
            )

            # Auditoría: quién lo confirmó. Va DESPUÉS de los detalles y solo escribe en
            # refuerzo_auditoria (no se vuelve a guardar la fila refuerzo con detalles cargados).
            _registrar_auditoria_refuerzo(refuerzo, 'COMPLETAR', request.user,
                                 {'importe_total': str(total), 'lineas': len(borradores)})

            # El borrador ya no hace falta
            refuerzo.borradores_detalle.all().delete()

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al completar el Refuerzo %s', refuerzo_id)
        return JsonResponse({'error': 'Error interno: el Refuerzo NO se completó'}, status=500)

    return JsonResponse({
        'ok':            True,
        'refuerzo_id':   refuerzo.id,
        'importe_total': str(total),
        'version':       _version(refuerzo),
    })


# ==========================================
#  API — ELIMINAR BORRADOR DE REFUERZO (solo estado REVISAR)
# ==========================================
# Eliminación FÍSICA del borrador: un borrador no tiene detalles definitivos, ni movimientos,
# ni trigger de DELETE de por medio, así que NO modifica saldos ni genera movimientos.
# Un Refuerzo LISTO jamás se elimina por acá (borrarlo arrastraría refuerzo_detalle en cascada
# sin devolver el saldo; la vía correcta para un LISTO es la anulación).
# Queda una fila de auditoría con quién lo eliminó, cuándo y una copia del contenido.
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_refuerzo_borrador_eliminar(request, refuerzo_id):
    try:
        body = _json_body(request)

        with transaction.atomic():
            refuerzo = _obtener_refuerzo_bloqueado(refuerzo_id, request.user, accion='eliminar')
            # La versión es opcional (igual que en la eliminación de borradores de Imputación, para
            # que un cliente genérico que solo conoce 'url_eliminar' funcione). Si el cliente la envía
            # (el listado de registros lo hace), se valida: no se borra un borrador que alguien
            # acaba de modificar. En cualquier caso queda una copia del contenido en la auditoría.
            if body.get('version'):
                _verificar_version_refuerzo(refuerzo, body.get('version'))

            # Defensa extra: un borrador nunca debería tener detalles presupuestarios reales.
            if RefuerzoDetalle.objects.filter(refuerzo=refuerzo).exists():
                raise _RefuerzoError(
                    'Este Refuerzo ya tiene detalles presupuestarios y no se puede eliminar como borrador', 409)

            instantanea = _datos_borrador(refuerzo)
            instantanea.pop('version', None)
            instantanea['creado_por'] = refuerzo.usuario.nombre if refuerzo.usuario_id else None
            instantanea['creado_en']  = refuerzo.fecha_creacion.isoformat()
            if refuerzo.usuario_modificacion_id:
                instantanea['editado_por'] = refuerzo.usuario_modificacion.nombre

            _registrar_auditoria_refuerzo(refuerzo, 'ELIMINAR', request.user,
                                 {'instantanea': instantanea}, estado='ELIMINADO')

            refuerzo.borradores_detalle.all().delete()
            refuerzo.delete()

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al eliminar el borrador de Refuerzo %s', refuerzo_id)
        return JsonResponse({'error': 'Error interno: el borrador NO se eliminó'}, status=500)

    return JsonResponse({'ok': True})


# ==========================================
#  API — HISTORIAL DE INTERVENCIONES DE UN REFUERZO (solo lectura)
# ==========================================
_REFUERZO_AUDITORIA_TEXTOS = {
    'CREAR':     'Creó el borrador',
    'EDITAR':    'Editó el borrador',
    'COMPLETAR': 'Confirmó como Listo',
    'ELIMINAR':  'Eliminó el borrador',
}
_REFUERZO_CAMPOS_TEXTOS = {
    'fecha':          'Fecha',
    'nro_expediente': 'N° de expediente',
    'nro_decreto':    'Decreto / Resolución',
    'importe_total':  'Importe total',
    'detalle':        'Receptoras e importes',
}


@rol_requerido('admin', 'adminprincipal')
def api_refuerzo_auditoria(request, refuerzo_id):
    """Solo lectura (GET): consultar el historial NO genera ningún registro."""
    eventos  = list(RefuerzoAuditoria.objects.filter(refuerzo_id=refuerzo_id)
                    .select_related('usuario').order_by('fecha', 'id'))
    refuerzo = Refuerzo.objects.select_related('usuario').filter(id=refuerzo_id).first()
    if refuerzo is None and not eventos:
        return JsonResponse({'error': 'Refuerzo no encontrado'}, status=404)

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M')

    data = []
    # Refuerzos anteriores a la auditoría: se reconstruye la creación desde la propia cabecera
    if refuerzo is not None and not any(e.operacion == 'CREAR' for e in eventos):
        data.append({
            'operacion': 'CREAR',
            'texto':     _REFUERZO_AUDITORIA_TEXTOS['CREAR'] + ' (anterior al registro de auditoría)',
            'usuario':   refuerzo.usuario.nombre,
            'fecha':     _fmt(refuerzo.fecha_creacion),
            'fecha_ultima': None,
            'cantidad':  1,
            'estado':    None,
            'campos':    [],
        })

    for e in eventos:
        campos = [_REFUERZO_CAMPOS_TEXTOS.get(c, c) for c in e.detalle.get('campos', [])]
        data.append({
            'operacion':    e.operacion,
            'texto':        _REFUERZO_AUDITORIA_TEXTOS.get(e.operacion, e.operacion),
            'usuario':      e.usuario.nombre,
            'fecha':        _fmt(e.fecha),
            'fecha_ultima': _fmt(e.fecha_ultima) if e.cantidad > 1 else None,
            'cantidad':     e.cantidad,
            'estado':       e.estado_resultante,
            'campos':       campos,
        })

    return JsonResponse({'refuerzo_id': refuerzo_id, 'eventos': data})


import json
from decimal import Decimal
from datetime import date
from django.db import transaction
from django.db.models import Sum
from django.http import JsonResponse

# ==========================================
#  API — CREAR MODIFICACIÓN (UNIFICADA)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_crear_modificacion(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    fecha             = body.get('fecha')
    nro_expediente    = body.get('nro_expediente', '').strip()
    nro_decreto       = body.get('nro_decreto', '').strip()
    tipo_transferente = body.get('tipo_transferente', 'general')
    transferentes     = body.get('transferentes', [])
    receptoras        = body.get('receptoras', [])

    # ── Validaciones de presencia y formato ───────────────────────────────
    if not fecha or not nro_expediente or not nro_decreto:
        return JsonResponse({'error': 'Faltan campos obligatorios (fecha, nro_expediente, nro_decreto)'}, status=400)

    if tipo_transferente not in ('general', 'imputacion'):
        return JsonResponse({'error': 'tipo_transferente inválido'}, status=400)

    if not transferentes:
        return JsonResponse({'error': 'Debe incluir al menos una unidad transferente'}, status=400)

    if not receptoras:
        return JsonResponse({'error': 'Debe incluir al menos una unidad receptora'}, status=400)

    try:
        fecha_obj = date.fromisoformat(fecha)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Fecha inválida (debe ser formato YYYY-MM-DD)'}, status=400)

    try:
        with transaction.atomic():

            # ── 1. Validar y procesar transferentes ─────────────────────
            transferentes_validos = []
            total_transferente    = Decimal('0')

            for t in transferentes:
                linea_id = t.get('linea_id')
                importe  = t.get('importe')

                if not linea_id or not importe:
                    raise ValueError('Cada transferente debe tener linea_id e importe')

                try:
                    importe = Decimal(str(importe))
                except Exception:
                    raise ValueError('Importe inválido en transferente')

                if importe <= 0:
                    raise ValueError('El importe de cada transferente debe ser mayor a cero')

                try:
                    linea = LineaPresupuestaria.objects.select_for_update().get(id=linea_id)
                except LineaPresupuestaria.DoesNotExist:
                    raise ValueError(f'Línea transferente {linea_id} no encontrada')

                if tipo_transferente == 'general':
                    # Modo A: Validar contra saldo_actual de la línea
                    if importe > linea.saldo_actual:
                        raise ValueError(
                            f'Saldo insuficiente en línea {linea_id}. '
                            f'Disponible: ${linea.saldo_actual}, solicitado: ${importe}'
                        )
                    transferentes_validos.append({
                        'linea':               linea,
                        'imputacion_detalle': None,
                        'importe':            importe,
                    })

                else:
                    # Modo B: Validar contra saldo disponible del ImputacionDetalle
                    det_id = t.get('imputacion_detalle_id')
                    if not det_id:
                        raise ValueError('En Modo B cada transferente debe incluir imputacion_detalle_id')

                    try:
                        detalle = ImputacionDetalle.objects.select_for_update().get(
                            id=det_id,
                            linea_presupuestaria=linea,
                            imputacion__anulada=False,
                        )
                    except ImputacionDetalle.DoesNotExist:
                        raise ValueError(
                            f'ImputacionDetalle {det_id} no encontrado o no pertenece a la línea {linea_id}'
                        )

                    ya_pagado_op = OrdenPagoUnidadPresupuestaria.objects.filter(
                        imputacion_detalle=detalle
                    ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

                    ya_trasladado_mod = ModificacionTransferente.objects.filter(
                        imputacion_detalle=detalle
                    ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

                    saldo_disponible = detalle.importe - ya_pagado_op - ya_trasladado_mod

                    if importe > saldo_disponible:
                        raise ValueError(
                            f'Saldo insuficiente en UP+Imputación {det_id}. '
                            f'Disponible: ${saldo_disponible}, solicitado: ${importe}'
                        )

                    transferentes_validos.append({
                        'linea':               linea,
                        'imputacion_detalle': detalle,
                        'importe':            importe,
                    })

                total_transferente += importe

            # ── 2. Validar y procesar receptoras ────────────────────────
            receptoras_validas = []
            total_receptora    = Decimal('0')

            for r in receptoras:
                linea_id = r.get('linea_id')
                importe  = r.get('importe')

                if not linea_id or not importe:
                    raise ValueError('Cada receptora debe tener linea_id e importe')

                try:
                    importe = Decimal(str(importe))
                except Exception:
                    raise ValueError('Importe inválido en receptora')

                if importe <= 0:
                    raise ValueError('El importe de cada receptora debe ser mayor a cero')

                try:
                    linea = LineaPresupuestaria.objects.select_for_update().get(id=linea_id)
                except LineaPresupuestaria.DoesNotExist:
                    raise ValueError(f'Línea receptora {linea_id} no encontrada')

                receptoras_validas.append({'linea': linea, 'importe': importe})
                total_receptora += importe

            # ── 3. Balance de montos ────────────────────────────────────
            if total_transferente != total_receptora:
                raise ValueError(
                    f'El total transferente (${total_transferente}) '
                    f'no coincide con el total receptora (${total_receptora})'
                )

            # ── 4. Cabecera de la modificación ──────────────────────────
            modificacion = Modificacion.objects.create(
                fecha             = fecha_obj,
                nro_expediente    = nro_expediente,
                nro_decreto       = nro_decreto,
                importe_total     = total_transferente,
                tipo_transferente = tipo_transferente,
                usuario           = request.user,
            )

            # ── 5. Guardar transferentes ──────────────────────────────────────────────
            for t in transferentes_validos:
                ModificacionTransferente.objects.create(
                    modificacion       = modificacion,
                    linea_origen       = t['linea'],
                    imputacion_detalle = t['imputacion_detalle'],
                    importe            = t['importe'],
                )
                # El trigger de PostgreSQL maneja saldo_actual y MovimientoHistorial

            # ── 6. Guardar receptoras ─────────────────────────────────────────────────
            for r in receptoras_validas:
                ModificacionReceptora.objects.create(
                    modificacion  = modificacion,
                    linea_destino = r['linea'],
                    importe       = r['importe'],
                )
                # El trigger de PostgreSQL maneja saldo_actual y MovimientoHistorial

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({
        'ok':              True,
        'modificacion_id': modificacion.id,
        'importe_total':   str(total_transferente),
    })

# ==========================================
#  API — LISTAR MODIFICACIONES
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_listar_modificaciones(request):
    modificaciones = Modificacion.objects.select_related('usuario').prefetch_related(
        'transferentes__linea_origen__programa',
        'transferentes__linea_origen__proyecto',
        'transferentes__linea_origen__actividad_obra',
        'transferentes__linea_origen__partida',
        'transferentes__linea_origen__fuente_financiamiento',
        'receptoras__linea_destino__programa',
        'receptoras__linea_destino__proyecto',
        'receptoras__linea_destino__actividad_obra',
        'receptoras__linea_destino__partida',
        'receptoras__linea_destino__fuente_financiamiento',
    ).filter(estado_formulario='LISTO').order_by('-fecha_creacion')

    data = []
    for m in modificaciones:
        data.append({
            'id':             m.id,
            'fecha':          m.fecha.strftime('%Y-%m-%d'),
            'nro_expediente': m.nro_expediente,
            'nro_decreto':    m.nro_decreto,
            'importe_total':  str(m.importe_total),
            'usuario':        m.usuario.nombre,
            'transferentes': [
                {
                    'linea_id':     t.linea_origen.id,
                    'importe':      str(t.importe),
                    'programa_id':  t.linea_origen.programa.id,
                    'proyecto_id':  t.linea_origen.proyecto.id,
                    'actividad_id': t.linea_origen.actividad_obra.id,
                    'partida_id':   t.linea_origen.partida.id,
                    'fuente_id':    t.linea_origen.fuente_financiamiento.id,
                }
                for t in m.transferentes.all()
            ],
            'receptoras': [
                {
                    'linea_id':     r.linea_destino.id,
                    'importe':      str(r.importe),
                    'programa_id':  r.linea_destino.programa.id,
                    'proyecto_id':  r.linea_destino.proyecto.id,
                    'actividad_id': r.linea_destino.actividad_obra.id,
                    'partida_id':   r.linea_destino.partida.id,
                    'fuente_id':    r.linea_destino.fuente_financiamiento.id,
                }
                for r in m.receptoras.all()
            ],
        })

    return JsonResponse({'modificaciones': data})

# ==========================================
#  VISTAS — FORMULARIO MODIFICACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def modificacion_crear(request):
    context = {'usuario': request.user, 'modo': 'crear', 'modificacion': None}
    return render(request, 'dashboards/admin/modificacion_form.html', context)

@rol_requerido('admin', 'adminprincipal')
def modificacion_ver(request, modificacion_id):
    import json as _json
    modificacion  = get_object_or_404(Modificacion, id=modificacion_id)
    if modificacion.estado_formulario == 'REVISAR':
        return redirect('modificacion_editar', modificacion_id=modificacion.id)
    transferentes = ModificacionTransferente.objects.filter(
        modificacion=modificacion
    ).select_related(
        'linea_origen__programa', 'linea_origen__proyecto',
        'linea_origen__actividad_obra', 'linea_origen__partida',
        'linea_origen__fuente_financiamiento'
    )
    receptoras = ModificacionReceptora.objects.filter(
        modificacion=modificacion
    ).select_related(
        'linea_destino__programa', 'linea_destino__proyecto',
        'linea_destino__actividad_obra', 'linea_destino__partida',
        'linea_destino__fuente_financiamiento'
    )
    datos = {
        'id':               modificacion.id,
        'fecha':            modificacion.fecha.strftime('%Y-%m-%d'),
        'nro_expediente':   modificacion.nro_expediente,
        'nro_decreto':      modificacion.nro_decreto,
        'importe_total':    str(modificacion.importe_total),
        'tipo_transferente': modificacion.tipo_transferente,
        'transferentes': [
            {
                'linea_id':     t.linea_origen.id,
                'importe':      str(t.importe),
                'programa_id':  t.linea_origen.programa.id,
                'proyecto_id':  t.linea_origen.proyecto.id,
                'actividad_id': t.linea_origen.actividad_obra.id,
                'partida_id':   t.linea_origen.partida.id,
                'fuente_id':    t.linea_origen.fuente_financiamiento.id,
                'imputacion_detalle_id': t.imputacion_detalle_id,
            }
            for t in transferentes
        ],
        'receptoras': [
            {
                'linea_id':     r.linea_destino.id,
                'importe':      str(r.importe),
                'programa_id':  r.linea_destino.programa.id,
                'proyecto_id':  r.linea_destino.proyecto.id,
                'actividad_id': r.linea_destino.actividad_obra.id,
                'partida_id':   r.linea_destino.partida.id,
                'fuente_id':    r.linea_destino.fuente_financiamiento.id,
            }
            for r in receptoras
        ],
    }
    context = {
        'usuario':      request.user,
        'modo':         'ver',
        'modificacion': _json.dumps(datos),
    }
    return render(request, 'dashboards/admin/modificacion_form.html', context)

# ==========================================
#  MODIFICACIÓN — GUARDADO AUTOMÁTICO (BORRADOR "REVISAR") Y COMPLETADO
# ==========================================
# Una Modificación en estado REVISAR es solo información guardada: sus filas viven en
# ModificacionBorradorDetalle, una tabla sin triggers, por lo que NUNCA modifica saldos
# ni genera movimientos. Los saldos y los movimientos los producen los triggers de
# PostgreSQL al hacer INSERT en modificacion_transferente / modificacion_receptora, y eso
# solo ocurre en api_modificacion_completar (REVISAR → LISTO).
#
# Regla de los triggers que hay que respetar (trg_fn_modificacion_transferente):
#   · Modalidad A ('general'):    el transferente descuenta saldo_actual de la línea origen
#                                 → imputacion_detalle debe ser NULL.
#   · Modalidad B ('imputacion'): NO descuenta saldo_actual (ya se descontó al imputar)
#                                 → imputacion_detalle es obligatorio. Un transferente de B
#                                 sin detalle SÍ descontaría el saldo general.
# Por eso la coherencia modalidad ↔ detalle se limpia en cada guardado y se exige al completar.
# Los triggers leen tipo_transferente, expediente y usuario de la cabecera en el momento del
# INSERT: la cabecera definitiva se guarda ANTES de insertar las filas.

MODIFICACION_EXPEDIENTE_PLACEHOLDER = 'BORRADOR'   # valor de relleno de la cabecera mientras es borrador
MODIFICACION_MAX_FILAS_BORRADOR     = 200          # por cada rol (transferentes / receptoras)
_ModificacionError = _RefuerzoError                # mismo manejo de errores controlados que Refuerzo


def _cabecera_modificacion(body):
    """Cabecera tal como llega: acepta datos parciales. fecha None = no informada."""
    fecha = None
    valor = body.get('fecha')
    if valor:
        try:
            fecha = date.fromisoformat(str(valor))
        except ValueError:
            fecha = None

    expediente = str(body.get('nro_expediente') or '').strip()
    decreto    = str(body.get('nro_decreto') or '').strip()
    if len(expediente) > 50:
        raise _ModificacionError('El número de expediente supera los 50 caracteres permitidos')
    if len(decreto) > 255:
        raise _ModificacionError('El nombre del decreto/resolución supera los 255 caracteres permitidos')

    tipo = body.get('tipo_transferente') or 'general'
    if tipo not in ('general', 'imputacion'):
        raise _ModificacionError('tipo_transferente inválido')

    return {
        'fecha':             fecha,
        'nro_expediente':    expediente,
        'nro_decreto':       decreto,
        'tipo_transferente': tipo,
    }


def _filas_modificacion(body, tipo):
    """Filas del borrador (transferentes y receptoras). Acepta filas incompletas.
    En modalidad A se descarta cualquier imputacion_detalle: no corresponde y, si llegara a
    la tabla definitiva, el trigger lo trataría como consumo del remanente de esa imputación."""
    filas = []
    for clave, rol, etiqueta in (('transferentes', 'TRANSFERENTE', 'Transferente'),
                                 ('receptoras',    'RECEPTORA',    'Receptora')):
        lista = body.get(clave, [])
        if not isinstance(lista, list):
            raise _ModificacionError('El detalle de la modificación es inválido')
        if len(lista) > MODIFICACION_MAX_FILAS_BORRADOR:
            raise _ModificacionError(
                f'Una modificación no puede tener más de {MODIFICACION_MAX_FILAS_BORRADOR} filas de {etiqueta.lower()}s'
            )

        nuevas = []
        for i, d in enumerate(lista):
            if not isinstance(d, dict):
                raise _ModificacionError('El detalle de la modificación es inválido')
            usa_detalle = (rol == 'TRANSFERENTE' and tipo == 'imputacion')
            f = {
                'rol':                   rol,
                'linea_id':              _entero_o_none(d.get('linea_id')),
                'programa_id':           _entero_o_none(d.get('programa_id')),
                'proyecto_id':           _entero_o_none(d.get('proyecto_id')),
                'actividad_id':          _entero_o_none(d.get('actividad_id')),
                'partida_id':            _entero_o_none(d.get('partida_id')),
                'fuente_id':             _entero_o_none(d.get('fuente_id')),
                'imputacion_detalle_id': _entero_o_none(d.get('imputacion_detalle_id')) if usa_detalle else None,
                'importe':               _decimal_o_none(d.get('importe'), f'{etiqueta} fila {i + 1}'),
            }
            vacia = all(f[k] is None for k in (
                'linea_id', 'programa_id', 'proyecto_id', 'actividad_id', 'partida_id',
                'fuente_id', 'imputacion_detalle_id', 'importe',
            ))
            if not vacia:     # una fila totalmente vacía (un "+" sin usar) no se guarda
                nuevas.append(f)
        for orden, f in enumerate(nuevas):
            f['orden'] = orden
        filas.extend(nuevas)

    # Una referencia que ya no existe no debe romper el guardado parcial: se descarta.
    ids_linea = {f['linea_id'] for f in filas if f['linea_id']}
    if ids_linea:
        existentes = set(LineaPresupuestaria.objects.filter(id__in=ids_linea).values_list('id', flat=True))
        for f in filas:
            if f['linea_id'] and f['linea_id'] not in existentes:
                f['linea_id'] = None
    ids_detalle = {f['imputacion_detalle_id'] for f in filas if f['imputacion_detalle_id']}
    if ids_detalle:
        existentes = set(ImputacionDetalle.objects.filter(id__in=ids_detalle).values_list('id', flat=True))
        for f in filas:
            if f['imputacion_detalle_id'] and f['imputacion_detalle_id'] not in existentes:
                f['imputacion_detalle_id'] = None
    return filas


def _total_transferente_borrador(filas):
    total = sum((f['importe'] for f in filas if f['rol'] == 'TRANSFERENTE' and f['importe'] is not None),
                Decimal('0.00'))
    if total >= Decimal(10) ** 16:
        raise _ModificacionError('La suma de los importes es demasiado grande')
    return total


def _clave_fila(rol, linea_id, programa_id, proyecto_id, actividad_id, partida_id,
                fuente_id, imputacion_detalle_id, importe, orden):
    return (rol, linea_id, programa_id, proyecto_id, actividad_id, partida_id,
            fuente_id, imputacion_detalle_id, importe, orden)


# ── Auditoría de Modificación (historial de intervenciones) ──────────────────
MODIFICACION_AUDITORIA_VENTANA = REFUERZO_AUDITORIA_VENTANA


def _registrar_auditoria_modificacion(modificacion, operacion, usuario, detalle=None, agrupar=False, estado=None):
    """Registra una intervención real sobre la Modificación. Se llama DENTRO de la transacción
    y con la fila bloqueada. Solo escribe en modificacion_auditoria: no toca el presupuesto."""
    ahora   = timezone.now()
    detalle = detalle or {}

    if agrupar:
        ultima = ModificacionAuditoria.objects.filter(modificacion_id=modificacion.id).order_by('-id').first()
        if (ultima is not None and ultima.operacion == 'EDITAR'
                and ultima.usuario_id == usuario.id
                and ahora - ultima.fecha_ultima <= MODIFICACION_AUDITORIA_VENTANA):
            campos = sorted(set(ultima.detalle.get('campos', [])) | set(detalle.get('campos', [])))
            ultima.detalle      = {'campos': campos}
            ultima.fecha_ultima = ahora
            ultima.cantidad    += 1
            ultima.save(update_fields=['detalle', 'fecha_ultima', 'cantidad'])
            return ultima

    return ModificacionAuditoria.objects.create(
        modificacion_id   = modificacion.id,
        operacion         = operacion,
        usuario           = usuario,
        fecha             = ahora,
        fecha_ultima      = ahora,
        estado_resultante = estado or modificacion.estado_formulario,
        detalle           = detalle,
    )


def _modificacion_campos_modificados(modificacion, cabecera, filas):
    """Lista de campos que REALMENTE cambiarían al aplicar lo recibido. Vacía = nada que
    guardar (reemplaza a _modificacion_sin_cambios y además dice QUÉ cambió)."""
    campos = []
    if cabecera['fecha'] and cabecera['fecha'] != modificacion.fecha:
        campos.append('fecha')
    if (cabecera['nro_expediente'] or MODIFICACION_EXPEDIENTE_PLACEHOLDER) != modificacion.nro_expediente:
        campos.append('nro_expediente')
    if cabecera['nro_decreto'] != modificacion.nro_decreto:
        campos.append('nro_decreto')
    if cabecera['tipo_transferente'] != modificacion.tipo_transferente:
        campos.append('tipo_transferente')

    guardadas = list(modificacion.borradores_detalle.order_by('rol', 'orden'))
    for rol, nombre in (('TRANSFERENTE', 'transferentes'), ('RECEPTORA', 'receptoras')):
        viejas = [
            _clave_fila(b.rol, b.linea_presupuestaria_id, b.programa_id, b.proyecto_id, b.actividad_id,
                        b.partida_id, b.fuente_id, b.imputacion_detalle_id, b.importe, b.orden)
            for b in guardadas if b.rol == rol
        ]
        nuevas = [
            _clave_fila(f['rol'], f['linea_id'], f['programa_id'], f['proyecto_id'], f['actividad_id'],
                        f['partida_id'], f['fuente_id'], f['imputacion_detalle_id'], f['importe'], f['orden'])
            for f in sorted((f for f in filas if f['rol'] == rol), key=lambda f: f['orden'])
        ]
        if viejas != nuevas:
            campos.append(nombre)
    return campos


def _modificacion_sin_cambios(modificacion, cabecera, filas):
    """True si lo recibido es idéntico a lo ya guardado. En ese caso NO se escribe nada:
    así un guardado sin cambios reales no altera 'editado por' ni la fecha de modificación."""
    if cabecera['fecha'] and cabecera['fecha'] != modificacion.fecha:
        return False
    if (cabecera['nro_expediente'] or MODIFICACION_EXPEDIENTE_PLACEHOLDER) != modificacion.nro_expediente:
        return False
    if cabecera['nro_decreto'] != modificacion.nro_decreto:
        return False
    if cabecera['tipo_transferente'] != modificacion.tipo_transferente:
        return False

    guardadas = [
        _clave_fila(b.rol, b.linea_presupuestaria_id, b.programa_id, b.proyecto_id, b.actividad_id,
                    b.partida_id, b.fuente_id, b.imputacion_detalle_id, b.importe, b.orden)
        for b in modificacion.borradores_detalle.order_by('rol', 'orden')
    ]
    nuevas = [
        _clave_fila(f['rol'], f['linea_id'], f['programa_id'], f['proyecto_id'], f['actividad_id'],
                    f['partida_id'], f['fuente_id'], f['imputacion_detalle_id'], f['importe'], f['orden'])
        for f in sorted(filas, key=lambda f: (f['rol'], f['orden']))
    ]
    return guardadas == nuevas


def _reemplazar_borradores_modificacion(modificacion, filas):
    """Reemplaza por completo las filas del borrador (dentro de una transacción)."""
    modificacion.borradores_detalle.all().delete()
    ModificacionBorradorDetalle.objects.bulk_create([
        ModificacionBorradorDetalle(
            modificacion            = modificacion,
            rol                     = f['rol'],
            linea_presupuestaria_id = f['linea_id'],
            programa_id             = f['programa_id'],
            proyecto_id             = f['proyecto_id'],
            actividad_id            = f['actividad_id'],
            partida_id              = f['partida_id'],
            fuente_id               = f['fuente_id'],
            imputacion_detalle_id   = f['imputacion_detalle_id'],
            importe                 = f['importe'],
            orden                   = f['orden'],
        )
        for f in filas
    ])


def _obtener_modificacion_bloqueada(modificacion_id):
    """Bloquea la fila de la Modificación (debe llamarse dentro de transaction.atomic())
    y exige que siga siendo un borrador. El bloqueo serializa guardados simultáneos y evita
    que dos pedidos completen la misma Modificación a la vez."""
    try:
        modificacion = Modificacion.objects.select_for_update().get(id=modificacion_id)
    except Modificacion.DoesNotExist:
        raise _ModificacionError('Modificación no encontrada', 404)
    if modificacion.estado_formulario != 'REVISAR':
        raise _ModificacionError(
            'Esta Modificación ya fue completada y no se puede modificar desde el formulario',
            409, {'completado': True},
        )
    return modificacion


def _datos_borrador_modificacion(modificacion):
    """Datos del borrador para volver a poblar el formulario (misma forma que usa el JS)."""
    def _fila(b, con_detalle):
        d = {
            'linea_id':     b.linea_presupuestaria_id,
            'importe':      str(b.importe) if b.importe is not None else None,
            'programa_id':  b.programa_id,
            'proyecto_id':  b.proyecto_id,
            'actividad_id': b.actividad_id,
            'partida_id':   b.partida_id,
            'fuente_id':    b.fuente_id,
        }
        if con_detalle:
            d['imputacion_detalle_id'] = b.imputacion_detalle_id
        return d

    filas = list(modificacion.borradores_detalle.order_by('rol', 'orden'))
    return {
        'id':                modificacion.id,
        'estado':            modificacion.estado_formulario,
        'version':           _version(modificacion),
        'fecha':             modificacion.fecha.strftime('%Y-%m-%d'),
        'nro_expediente':    '' if modificacion.nro_expediente == MODIFICACION_EXPEDIENTE_PLACEHOLDER else modificacion.nro_expediente,
        'nro_decreto':       modificacion.nro_decreto,
        'tipo_transferente': modificacion.tipo_transferente,
        'transferentes':     [_fila(b, True)  for b in filas if b.rol == 'TRANSFERENTE'],
        'receptoras':        [_fila(b, False) for b in filas if b.rol == 'RECEPTORA'],
    }


# ==========================================
#  PÁGINA — RETOMAR / EDITAR UN BORRADOR DE MODIFICACIÓN
#  Abrirla solo LEE: no modifica ningún dato (tampoco "editado por").
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def modificacion_editar(request, modificacion_id):
    modificacion = get_object_or_404(Modificacion, id=modificacion_id)

    # La edición de Modificaciones ya completadas está fuera de alcance: se muestran solo lectura.
    if modificacion.estado_formulario != 'REVISAR':
        return redirect('modificacion_ver', modificacion_id=modificacion.id)

    context = {
        'usuario':      request.user,
        'modo':         'editar',
        'modificacion': _json_para_script(_datos_borrador_modificacion(modificacion)),
    }
    return render(request, 'dashboards/admin/modificacion_form.html', context)


# ==========================================
#  API — CREAR BORRADOR DE MODIFICACIÓN (primer guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_modificacion_borrador_crear(request):
    try:
        body     = _json_body(request)
        cabecera = _cabecera_modificacion(body)
        filas    = _filas_modificacion(body, cabecera['tipo_transferente'])
        total    = _total_transferente_borrador(filas)

        with transaction.atomic():
            modificacion = Modificacion.objects.create(
                fecha                = cabecera['fecha'] or date.today(),
                nro_expediente       = cabecera['nro_expediente'] or MODIFICACION_EXPEDIENTE_PLACEHOLDER,
                nro_decreto          = cabecera['nro_decreto'],
                importe_total        = total,
                tipo_transferente    = cabecera['tipo_transferente'],
                usuario              = request.user,   # creador: no se vuelve a asignar jamás
                usuario_modificacion = request.user,   # "editado por"
                estado_formulario    = 'REVISAR',
            )
            _reemplazar_borradores_modificacion(modificacion, filas)
            _registrar_auditoria_modificacion(modificacion, 'CREAR', request.user)

    except _ModificacionError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al crear el borrador de Modificación')
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({'ok': True, 'modificacion_id': modificacion.id, 'version': _version(modificacion)})


# ==========================================
#  API — ACTUALIZAR BORRADOR DE MODIFICACIÓN (guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_modificacion_borrador_actualizar(request, modificacion_id):
    try:
        body     = _json_body(request)
        cabecera = _cabecera_modificacion(body)
        filas    = _filas_modificacion(body, cabecera['tipo_transferente'])
        total    = _total_transferente_borrador(filas)

        with transaction.atomic():
            modificacion = _obtener_modificacion_bloqueada(modificacion_id)
            _verificar_version(modificacion, body.get('version'))

            # Sin cambios reales no se escribe nada: "editado por" y la fecha quedan como estaban
            campos = _modificacion_campos_modificados(modificacion, cabecera, filas)
            if not campos:
                return JsonResponse({'ok': True, 'version': _version(modificacion), 'sin_cambios': True})

            if cabecera['fecha']:
                modificacion.fecha = cabecera['fecha']
            modificacion.nro_expediente       = cabecera['nro_expediente'] or MODIFICACION_EXPEDIENTE_PLACEHOLDER
            modificacion.nro_decreto          = cabecera['nro_decreto']
            modificacion.tipo_transferente    = cabecera['tipo_transferente']
            modificacion.importe_total        = total
            modificacion.usuario_modificacion = request.user   # siempre el usuario autenticado
            modificacion.save()                                # (modificacion.usuario NO se toca)

            _reemplazar_borradores_modificacion(modificacion, filas)
            _registrar_auditoria_modificacion(modificacion, 'EDITAR', request.user,
                                              {'campos': campos}, agrupar=True)

    except _ModificacionError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al actualizar el borrador de Modificación %s', modificacion_id)
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({'ok': True, 'version': _version(modificacion)})


# ==========================================
#  API — COMPLETAR MODIFICACIÓN (REVISAR → LISTO)
# ==========================================
# ÚNICO punto donde una Modificación mueve el presupuesto. Los saldos y los movimientos por
# fila los resuelven los triggers de PostgreSQL al insertar en modificacion_transferente /
# modificacion_receptora, por eso acá NO se toca saldo_actual ni se crea MovimientoHistorial
# (igual que en api_crear_modificacion).
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_modificacion_completar(request, modificacion_id):
    try:
        body = _json_body(request)

        with transaction.atomic():
            modificacion = _obtener_modificacion_bloqueada(modificacion_id)
            _verificar_version(modificacion, body.get('version'))

            borradores    = list(modificacion.borradores_detalle.order_by('rol', 'orden'))
            transferentes = [b for b in borradores if b.rol == 'TRANSFERENTE']
            receptoras    = [b for b in borradores if b.rol == 'RECEPTORA']
            tipo          = modificacion.tipo_transferente

            # ── Validación definitiva: presencia y formato ───────────────────
            if modificacion.nro_expediente in ('', MODIFICACION_EXPEDIENTE_PLACEHOLDER):
                raise _ModificacionError('El número de expediente es obligatorio')
            if not modificacion.nro_decreto.strip():
                raise _ModificacionError('El decreto/resolución es obligatorio')
            if tipo not in ('general', 'imputacion'):
                raise _ModificacionError('tipo_transferente inválido')
            if not transferentes:
                raise _ModificacionError('Debe incluir al menos una unidad transferente')
            if not receptoras:
                raise _ModificacionError('Debe incluir al menos una unidad receptora')

            def _revisar(filas, etiqueta, es_transferente):
                total = Decimal('0')
                for n, b in enumerate(filas, start=1):
                    if not b.linea_presupuestaria_id:
                        raise _ModificacionError(
                            f'{etiqueta} fila {n}: falta completar la línea presupuestaria '
                            f'(programa, proyecto, actividad, partida y fuente)'
                        )
                    if b.importe is None or b.importe <= 0:
                        raise _ModificacionError(f'{etiqueta} fila {n}: el importe debe ser mayor a cero')
                    if es_transferente and tipo == 'imputacion' and not b.imputacion_detalle_id:
                        raise _ModificacionError(
                            f'{etiqueta} fila {n}: en la modalidad "UP de una Imputación" hay que elegir la imputación'
                        )
                    total += b.importe
                return total

            total_transferente = _revisar(transferentes, 'Transferente', True)
            total_receptora    = _revisar(receptoras, 'Receptora', False)

            if total_transferente != total_receptora:
                raise _ModificacionError(
                    f'El total transferente (${total_transferente}) '
                    f'no coincide con el total receptora (${total_receptora})'
                )

            # ── Bloqueo de líneas (siempre ordenadas por id para no generar interbloqueos) ──
            ids_lineas = sorted({b.linea_presupuestaria_id for b in transferentes + receptoras})
            lineas = {
                l.id: l for l in
                LineaPresupuestaria.objects.select_for_update().filter(id__in=ids_lineas).order_by('id')
            }
            if len(lineas) != len(ids_lineas):
                raise _ModificacionError('Alguna de las líneas presupuestarias ya no existe')

            # ── Saldos: se valida la SUMA por línea (A) o por detalle de imputación (B),
            #    no fila por fila, para que filas repetidas no superen el saldo ──────────
            if tipo == 'general':
                pedido_por_linea = {}
                for b in transferentes:
                    pedido_por_linea[b.linea_presupuestaria_id] = (
                        pedido_por_linea.get(b.linea_presupuestaria_id, Decimal('0')) + b.importe
                    )
                for linea_id in sorted(pedido_por_linea):
                    disponible = lineas[linea_id].saldo_actual
                    if pedido_por_linea[linea_id] > disponible:
                        raise _ModificacionError(
                            f'Saldo insuficiente en línea {linea_id}. '
                            f'Disponible: ${disponible}, solicitado: ${pedido_por_linea[linea_id]}'
                        )
            else:
                ids_detalle = sorted({b.imputacion_detalle_id for b in transferentes})
                detalles = {
                    d.id: d for d in
                    ImputacionDetalle.objects.select_for_update()
                    .filter(id__in=ids_detalle, imputacion__anulada=False).order_by('id')
                }
                pedido_por_detalle = {}
                for n, b in enumerate(transferentes, start=1):
                    detalle = detalles.get(b.imputacion_detalle_id)
                    if detalle is None or detalle.linea_presupuestaria_id != b.linea_presupuestaria_id:
                        raise _ModificacionError(
                            f'Transferente fila {n}: la imputación elegida ya no existe, está anulada '
                            f'o no pertenece a la línea seleccionada'
                        )
                    pedido_por_detalle[detalle.id] = pedido_por_detalle.get(detalle.id, Decimal('0')) + b.importe
                for detalle_id in sorted(pedido_por_detalle):
                    detalle = detalles[detalle_id]
                    ya_pagado_op = OrdenPagoUnidadPresupuestaria.objects.filter(
                        imputacion_detalle=detalle
                    ).aggregate(total=Sum('importe'))['total'] or Decimal('0')
                    ya_trasladado_mod = ModificacionTransferente.objects.filter(
                        imputacion_detalle=detalle
                    ).aggregate(total=Sum('importe'))['total'] or Decimal('0')
                    disponible = detalle.importe - ya_pagado_op - ya_trasladado_mod
                    if pedido_por_detalle[detalle_id] > disponible:
                        raise _ModificacionError(
                            f'Saldo insuficiente en UP+Imputación {detalle_id}. '
                            f'Disponible: ${disponible}, solicitado: ${pedido_por_detalle[detalle_id]}'
                        )

            # ── Cabecera definitiva ANTES de insertar las filas: los triggers leen de acá
            #    el tipo de modalidad, el expediente y el usuario al momento del INSERT. ──
            modificacion.importe_total        = total_transferente
            modificacion.estado_formulario    = 'LISTO'
            modificacion.usuario_modificacion = request.user   # quien confirma queda como "editado por"
            modificacion.save()                                # (modificacion.usuario NO se toca)

            # ── Filas reales: acá los triggers actualizan saldo_actual y movimientos ──────
            for b in transferentes:
                ModificacionTransferente.objects.create(
                    modificacion          = modificacion,
                    linea_origen_id       = b.linea_presupuestaria_id,
                    imputacion_detalle_id = b.imputacion_detalle_id if tipo == 'imputacion' else None,
                    importe               = b.importe,
                )
            for b in receptoras:
                ModificacionReceptora.objects.create(
                    modificacion     = modificacion,
                    linea_destino_id = b.linea_presupuestaria_id,
                    importe          = b.importe,
                )

            # El borrador ya no hace falta
            modificacion.borradores_detalle.all().delete()

            _registrar_auditoria_modificacion(modificacion, 'COMPLETAR', request.user,
                                              {'importe_total': str(total_transferente)}, estado='LISTO')

    except _ModificacionError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al completar la Modificación %s', modificacion_id)
        return JsonResponse({'error': 'Error interno: la Modificación NO se completó'}, status=500)

    return JsonResponse({
        'ok':              True,
        'modificacion_id': modificacion.id,
        'importe_total':   str(total_transferente),
        'version':         _version(modificacion),
    })


# ==========================================
#  API — ELIMINAR BORRADOR DE MODIFICACIÓN (solo estado REVISAR)
# ==========================================
# Eliminación FÍSICA del borrador: no tiene transferentes/receptoras reales (los triggers de
# saldo solo se disparan al insertar en esas tablas), así que NO modifica saldos ni genera
# movimientos. Queda una fila en modificacion_auditoria (sin FK) con quién y cuándo lo eliminó.
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_modificacion_borrador_eliminar(request, modificacion_id):
    try:
        body = _json_body(request) if request.body else {}

        with transaction.atomic():
            modificacion = _obtener_modificacion_bloqueada(modificacion_id)   # 404 / 409 si ya es LISTO

            # La versión es opcional; si el listado la envía no se borra un borrador que
            # alguien modificó después de cargarlo.
            if body.get('version'):
                _verificar_version(modificacion, body.get('version'))

            # Defensa: un borrador nunca debería tener filas definitivas.
            if modificacion.transferentes.exists() or modificacion.receptoras.exists():
                raise _ModificacionError(
                    'Esta Modificación ya tiene detalles presupuestarios y no se puede eliminar como borrador', 409)

            filas = list(modificacion.borradores_detalle.all())
            instantanea = {
                'fecha':             modificacion.fecha.isoformat(),
                'nro_expediente':    '' if modificacion.nro_expediente == MODIFICACION_EXPEDIENTE_PLACEHOLDER
                                        else modificacion.nro_expediente,
                'nro_decreto':       modificacion.nro_decreto,
                'tipo_transferente': modificacion.tipo_transferente,
                'importe_total':     str(modificacion.importe_total),
                'transferentes':     sum(1 for b in filas if b.rol == 'TRANSFERENTE'),
                'receptoras':        sum(1 for b in filas if b.rol == 'RECEPTORA'),
                'creado_por':        modificacion.usuario.nombre if modificacion.usuario_id else None,
                'creado_en':         modificacion.fecha_creacion.isoformat(),
            }
            if modificacion.usuario_modificacion_id:
                instantanea['editado_por'] = modificacion.usuario_modificacion.nombre

            _registrar_auditoria_modificacion(modificacion, 'ELIMINAR', request.user,
                                              {'instantanea': instantanea}, estado='ELIMINADO')
            modificacion.delete()   # borra en cascada ModificacionBorradorDetalle

    except _ModificacionError as e:
        return _respuesta_error(e)
    except ProtectedError:
        return JsonResponse(
            {'error': 'La Modificación tiene registros relacionados y no se puede eliminar.'}, status=409)
    except Exception:
        _logger.exception('Error al eliminar el borrador de Modificación %s', modificacion_id)
        return JsonResponse({'error': 'Error interno: el borrador NO se eliminó'}, status=500)

    return JsonResponse({'ok': True})


# ==========================================
#  API — HISTORIAL DE INTERVENCIONES DE UNA MODIFICACIÓN (solo lectura)
# ==========================================
_MODIFICACION_AUDITORIA_TEXTOS = {
    'CREAR':     'Creó el borrador',
    'EDITAR':    'Editó el borrador',
    'COMPLETAR': 'Confirmó como Listo',
    'ELIMINAR':  'Eliminó el borrador',
}
_MODIFICACION_CAMPOS_TEXTOS = {
    'fecha':             'Fecha',
    'nro_expediente':    'N° de expediente',
    'nro_decreto':       'Decreto / Resolución',
    'tipo_transferente': 'Modalidad del transferente',
    'transferentes':     'Transferentes',
    'receptoras':        'Receptoras',
}


@rol_requerido('admin', 'adminprincipal')
def api_modificacion_auditoria(request, modificacion_id):
    """Solo lectura (GET): consultar el historial NO genera ningún registro."""
    eventos      = list(ModificacionAuditoria.objects.filter(modificacion_id=modificacion_id)
                        .select_related('usuario').order_by('fecha', 'id'))
    modificacion = Modificacion.objects.select_related('usuario').filter(id=modificacion_id).first()
    if modificacion is None and not eventos:
        return JsonResponse({'error': 'Modificación no encontrada'}, status=404)

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M')

    data = []
    # Modificaciones anteriores a la auditoría: se reconstruye la creación desde la cabecera
    if modificacion is not None and not any(e.operacion == 'CREAR' for e in eventos):
        data.append({
            'operacion':    'CREAR',
            'texto':        'Creó la Modificación (anterior al registro de auditoría)',
            'usuario':      modificacion.usuario.nombre,
            'fecha':        _fmt(modificacion.fecha_creacion),
            'fecha_ultima': None,
            'cantidad':     1,
            'estado':       None,
            'campos':       [],
        })

    for e in eventos:
        campos = [_MODIFICACION_CAMPOS_TEXTOS.get(c, c) for c in e.detalle.get('campos', [])]
        data.append({
            'operacion':    e.operacion,
            'texto':        _MODIFICACION_AUDITORIA_TEXTOS.get(e.operacion, e.operacion),
            'usuario':      e.usuario.nombre,
            'fecha':        _fmt(e.fecha),
            'fecha_ultima': _fmt(e.fecha_ultima) if e.cantidad > 1 else None,
            'cantidad':     e.cantidad,
            'estado':       e.estado_resultante,
            'campos':       campos,
        })

    return JsonResponse({'modificacion_id': modificacion_id, 'eventos': data})


# ==========================================
#  API — RESOLVER LÍNEAS PARA MODIFICACIÓN
#  Devuelve todas las líneas sin filtrar por saldo
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_resolver_lineas_modificacion(request):
    programa_id  = request.GET.get('programa_id')
    proyecto_id  = request.GET.get('proyecto_id')
    actividad_id = request.GET.get('actividad_id')
    partida_id   = request.GET.get('partida_id')
    ejercicio    = request.GET.get('ejercicio', str(timezone.now().year))

    if not all([programa_id, proyecto_id, actividad_id, partida_id]):
        return JsonResponse({'error': 'Faltan parámetros'}, status=400)

    lineas = LineaPresupuestaria.objects.filter(
        programa_id       = programa_id,
        proyecto_id       = proyecto_id,
        actividad_obra_id = actividad_id,
        partida_id        = partida_id,
        ejercicio         = ejercicio,
    ).select_related('fuente_financiamiento')

    if not lineas.exists():
        return JsonResponse({'error': 'No existe línea para esa combinación'}, status=404)

    resultado = []
    for linea in lineas:
        resultado.append({
            'linea_id':     linea.id,
            'fuente_id':    linea.fuente_financiamiento.id,
            'fuente_nombre': f"{linea.fuente_financiamiento.codigo} - {linea.fuente_financiamiento.nombre}",
            'saldo_actual': str(linea.saldo_actual),
        })

    return JsonResponse({'lineas': resultado})

#===============================
#  API - CREAR REFUERZO
#===============================

@rol_requerido('admin', 'adminprincipal')
def refuerzo_crear(request):
    context = {'usuario': request.user, 'modo': 'crear', 'refuerzo': 'null'}
    return render(request, 'dashboards/admin/refuerzo_form.html', context)


# ==========================================
#  API — SALDO DE LÍNEA PRESUPUESTARIA
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_saldo_linea(request):
    linea_id = request.GET.get('linea_id')
    if not linea_id:
        return JsonResponse({'error': 'Falta linea_id'}, status=400)
    try:
        linea = LineaPresupuestaria.objects.get(id=linea_id)
        return JsonResponse({'saldo_actual': str(linea.saldo_actual)})
    except LineaPresupuestaria.DoesNotExist:
        return JsonResponse({'error': 'Línea no encontrada'}, status=404)

# ==========================================
#  API — CREAR IMPUTACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_crear_imputacion(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    fecha          = body.get('fecha')
    nro_expediente = body.get('nro_expediente', '').strip()
    observacion    = body.get('observacion', '').strip()
    origen         = body.get('origen', 'MANUAL')
    detalles       = body.get('detalles', [])
    # detalles es una lista de:
    # {
    #   programa_id, proyecto_id, actividad_id, partida_id, fuente_id,
    #   proveedor_concepto, importe
    # }
    if not all([fecha, nro_expediente]) or not detalles:
        return JsonResponse({'error': 'Faltan campos obligatorios'}, status=400)

    try:
        fecha_obj = date.fromisoformat(fecha)
    except ValueError:
        return JsonResponse({'error': 'Fecha inválida'}, status=400)

    try:
        with transaction.atomic():

            # ── Asiento automático ────────────────────────────────────────
            from django.db.models import Max
            ultimo = Imputacion.objects.filter(
                fecha__year=fecha_obj.year
            ).aggregate(Max('asiento_nro'))['asiento_nro__max']

            if ultimo:
                try:
                    asiento_nro = str(int(ultimo) + 1).zfill(4)
                except ValueError:
                    asiento_nro = '0001'
            else:
                asiento_nro = '0001'

            # ── Resolver líneas y validar saldo por detalle ───────────────
            detalles_expandidos = []  # lista final con linea_id e importe real

            for d in detalles:
                programa_id  = d.get('programa_id')
                proyecto_id  = d.get('proyecto_id')
                actividad_id = d.get('actividad_id')
                partida_id   = d.get('partida_id')
                fuente_id    = d.get('fuente_id')
                proveedor    = (d.get('proveedor_concepto') or '').strip()

                try:
                    importe_fila = Decimal(str(d.get('importe', 0)))
                except Exception:
                    return JsonResponse({'error': 'Importe inválido en un detalle'}, status=400)

                if not all([programa_id, proyecto_id, actividad_id, partida_id, fuente_id, proveedor]):
                    return JsonResponse({'error': 'Detalle incompleto'}, status=400)

                if importe_fila <= 0:
                    return JsonResponse({'error': 'El importe debe ser mayor a cero'}, status=400)

                # Buscar la línea puntual: combinación + fuente elegida por el usuario
                try:
                    linea = LineaPresupuestaria.objects.select_for_update().get(
                        programa_id              = programa_id,
                        proyecto_id              = proyecto_id,
                        actividad_obra_id        = actividad_id,
                        partida_id               = partida_id,
                        fuente_financiamiento_id = fuente_id,
                        ejercicio                = fecha_obj.year,
                    )
                except LineaPresupuestaria.DoesNotExist:
                    return JsonResponse(
                        {'error': 'No existe línea presupuestaria para la combinación y fuente seleccionadas'},
                        status=404
                    )

                if importe_fila > linea.saldo_actual:
                    return JsonResponse(
                        {
                            'error': (
                                f'Saldo insuficiente en la fuente seleccionada. '
                                f'Disponible: {linea.saldo_actual}, '
                                f'requerido: {importe_fila}'
                            )
                        },
                        status=400
                    )

                detalles_expandidos.append({
                    'linea':             linea,
                    'proveedor_concepto': proveedor,
                    'importe':           importe_fila,
                })

            # ── Crear cabecera de imputación ──────────────────────────────
            imputacion = Imputacion.objects.create(
                fecha          = fecha_obj,
                nro_expediente = nro_expediente,
                asiento_nro    = asiento_nro,
                origen         = origen,
                observacion    = observacion,
                usuario        = request.user,
            )

            # ── Crear detalles y descontar saldo (sin cambios) ────────────
            importe_total = Decimal('0')
            for d in detalles_expandidos:
                linea = d['linea']

                ImputacionDetalle.objects.create(
                    imputacion           = imputacion,
                    linea_presupuestaria = linea,
                    proveedor_concepto   = d['proveedor_concepto'],
                    importe              = d['importe'],
                )

                linea.saldo_actual -= d['importe']
                linea.save()

                importe_total += d['importe']

            # ── Un único registro de historial para TODA la Imputación ────
            # (antes se creaba uno por cada línea afectada, dentro del loop
            # de arriba, lo que hacía que la misma Imputación apareciera
            # duplicada en el Home). El detalle por línea sigue disponible
            # en ImputacionDetalle, que es de ahí de donde lo lee el Home.
            MovimientoHistorial.objects.create(
                linea_presupuestaria = None,
                tipo                 = 'IMPUTACION',
                referencia_id        = imputacion.id,
                usuario              = request.user,
                monto                = -importe_total,
                descripcion          = f'Imputación exp. {nro_expediente} asiento {asiento_nro}',
            )

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

        # ── NOTIFICACIÓN DE IMPUTACIÓN ─────────────────────────────

    crear_notificaciones_admins(
    titulo="Nueva imputación registrada",
    mensaje=f"Expediente: {nro_expediente}",
    tipo="imputacion",
    url=f"/admin-dashboard/imputacion/ver/{imputacion.id}/",
    realizado_por=request.user.nombre
)
    return JsonResponse({
        'ok':            True,
        'imputacion_id': imputacion.id,
        'asiento_nro':   asiento_nro,
        'importe_total': str(importe_total),
    })

# ==========================================
#  API — RESOLVER LÍNEAS (reparto proporcional)
#  Dado programa + proyecto + a/o + partida + ejercicio,
#  devuelve todas las líneas disponibles
#  con su saldo y el peso proporcional.
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_resolver_lineas(request):
    programa_id  = request.GET.get('programa_id')
    proyecto_id  = request.GET.get('proyecto_id')
    actividad_id = request.GET.get('actividad_id')
    partida_id   = request.GET.get('partida_id')
    ejercicio    = request.GET.get('ejercicio', str(timezone.now().year))

    if not all([programa_id, proyecto_id, actividad_id, partida_id]):
        return JsonResponse(
            {'error': 'Faltan parámetros: programa_id, proyecto_id, actividad_id, partida_id'},
            status=400
        )

    lineas = LineaPresupuestaria.objects.filter(
        programa_id       = programa_id,
        proyecto_id       = proyecto_id,
        actividad_obra_id = actividad_id,
        partida_id        = partida_id,
        ejercicio         = ejercicio,
    ).select_related('fuente_financiamiento')

    if not lineas.exists():
        return JsonResponse(
            {'error': 'No existe línea presupuestaria para esa combinación en el ejercicio actual'},
            status=404
        )

    saldo_total = sum(l.saldo_actual for l in lineas)

    if saldo_total <= 0:
        return JsonResponse(
            {'error': 'Sin saldo disponible en ninguna línea para esa combinación'},
            status=400
        )

    resultado = []
    for linea in lineas:
        peso = linea.saldo_actual / saldo_total if saldo_total > 0 else Decimal('0')
        resultado.append({
            'linea_id':      linea.id,
            'fuente':        linea.fuente_financiamiento.nombre,
            'fuente_id':     linea.fuente_financiamiento.id,
            'fuente_codigo': linea.fuente_financiamiento.codigo,   # ← nuevo
            'saldo_actual':  str(linea.saldo_actual),
            'peso':          str(round(peso, 6)),
            'denominacion':  linea.partida.denominacion,
        })

    return JsonResponse({
        'saldo_total': str(saldo_total),
        'lineas':      resultado,
    })


# ==========================================
#  APIs AUXILIARES — CASCADA IMPUTACIÓN
# ==========================================

@rol_requerido('admin', 'adminprincipal')
def api_programas(request):
    ejercicio = timezone.now().year
    ids = LineaPresupuestaria.objects.filter(
        ejercicio=ejercicio
    ).values_list('programa_id', flat=True).distinct()

    programas = Programa.objects.filter(
        id__in=ids
    ).values('id', 'codigo_programa', 'nombre').order_by('codigo_programa')
    return JsonResponse({'programas': list(programas)})

# ==========================================
#  IMPUTACIÓN — PERMISOS, AUDITORÍA Y CONCURRENCIA DE BORRADORES
#  Reglas:
#   · Quién edita se toma SIEMPRE de request.user (nunca del JS).
#   · "Editado por" (usuario_modificacion) y la auditoría solo se actualizan
#     al guardar cambios reales o al confirmar. Los GET no escriben nada.
#   · Bloqueo optimista: Imputacion.version + select_for_update().
# ==========================================
ROLES_ADMIN_IMPUTACION = ('admin', 'adminprincipal')


def puede_editar_imputacion(user, imputacion):
    """Creador original, o rol Administrador / Administrador principal.
    El estado (REVISAR/LISTO) se valida aparte en cada vista."""
    if not user.is_authenticated:
        return False
    return (
        imputacion.usuario_id == user.id
        or getattr(user, 'rol', None) in ROLES_ADMIN_IMPUTACION
    )


def puede_eliminar_imputacion(user, imputacion):
    """Mismo criterio que editar: creador o cualquiera de los dos roles admin."""
    return puede_editar_imputacion(user, imputacion)


def _a_int(v):
    if v in (None, ''):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _a_importe(v):
    # Mismo criterio que antes: vacío / 0 → None
    return Decimal(str(v)) if v else None


def _normalizar_filas(detalles):
    """Filas del borrador en forma canónica (sirve para guardar y para comparar)."""
    filas = []
    for d in detalles:
        linea_id = _a_int(d.get('linea_id'))
        if linea_id is not None and not LineaPresupuestaria.objects.filter(id=linea_id).exists():
            linea_id = None
        importe = _a_importe(d.get('importe'))
        filas.append({
            'linea_id':           linea_id,
            'programa_id':        _a_int(d.get('programa_id')),
            'proyecto_id':        _a_int(d.get('proyecto_id')),
            'actividad_id':       _a_int(d.get('actividad_id')),
            'partida_id':         _a_int(d.get('partida_id')),
            'fuente_id':          _a_int(d.get('fuente_id')),
            'proveedor_concepto': d.get('proveedor_concepto') or '',
            'importe':            importe.quantize(Decimal('0.01')) if importe is not None else None,
        })
    return filas


def _filas_guardadas(imputacion):
    return [
        {
            'linea_id':           b['linea_presupuestaria_id'],
            'programa_id':        b['programa_id'],
            'proyecto_id':        b['proyecto_id'],
            'actividad_id':       b['actividad_id'],
            'partida_id':         b['partida_id'],
            'fuente_id':          b['fuente_id'],
            'proveedor_concepto': b['proveedor_concepto'],
            'importe':            b['importe'],
        }
        for b in imputacion.borradores_detalle.order_by('orden').values(
            'linea_presupuestaria_id', 'programa_id', 'proyecto_id', 'actividad_id',
            'partida_id', 'fuente_id', 'proveedor_concepto', 'importe',
        )
    ]


def _crear_filas_borrador(imputacion, filas):
    for i, f in enumerate(filas):
        ImputacionBorradorDetalle.objects.create(
            imputacion           = imputacion,
            linea_presupuestaria_id = f['linea_id'],
            programa_id          = f['programa_id'],
            proyecto_id          = f['proyecto_id'],
            actividad_id         = f['actividad_id'],
            partida_id           = f['partida_id'],
            fuente_id            = f['fuente_id'],
            proveedor_concepto   = f['proveedor_concepto'],
            importe              = f['importe'],
            orden                = i,
        )


def _cambios_borrador(imputacion, fecha_obj, expediente, observacion, filas):
    """Devuelve qué partes cambiaron de verdad ([] = guardado sin cambios reales)."""
    cambios = []
    if imputacion.fecha != fecha_obj:
        cambios.append('fecha')
    if imputacion.nro_expediente != expediente:
        cambios.append('expediente')
    if (imputacion.observacion or '') != observacion:
        cambios.append('observación')
    if _filas_guardadas(imputacion) != filas:
        cambios.append('filas')
    return cambios


def _registrar_auditoria_imputacion(imputacion_id, tipo, usuario, version=None, detalle=''):
    """Inserta en la bitácora. Las ediciones consecutivas del mismo usuario se
    agrupan en una sola fila. Se llama siempre con la fila de Imputacion bloqueada."""
    ahora = timezone.now()
    if tipo == 'EDICION':
        ultimo = ImputacionAuditoria.objects.filter(
            imputacion_id=imputacion_id
        ).order_by('-id').first()
        if ultimo and ultimo.tipo == 'EDICION' and ultimo.usuario_id == usuario.id:
            partes = [x for x in ultimo.detalle.split(', ') if x]
            for x in detalle.split(', '):
                if x and x not in partes:
                    partes.append(x)
            ultimo.detalle      = ', '.join(partes)
            ultimo.cantidad    += 1
            ultimo.fecha_ultima = ahora
            ultimo.version      = version
            ultimo.save(update_fields=['detalle', 'cantidad', 'fecha_ultima', 'version'])
            return ultimo
    return ImputacionAuditoria.objects.create(
        imputacion_id = imputacion_id,
        tipo          = tipo,
        usuario       = usuario,
        fecha_ultima  = ahora,
        version       = version,
        detalle       = detalle,
    )


def _version_cliente(body):
    try:
        return int(body.get('version'))
    except (TypeError, ValueError):
        return None


def _respuesta_conflicto_imputacion(imputacion, version_cliente):
    if version_cliente is None:
        msg = ('Tu pantalla está desactualizada. Recargá la página antes de seguir '
               'editando; no se guardó ningún cambio.')
    else:
        editor = imputacion.usuario_modificacion or imputacion.usuario
        cuando = (
            timezone.localtime(imputacion.fecha_modificacion).strftime('%d/%m/%Y %H:%M')
            if imputacion.fecha_modificacion else ''
        )
        msg = (
            f'Esta imputación fue modificada por {editor.nombre if editor else "otro usuario"}'
            f'{" el " + cuando if cuando else ""}. Recargá la página para ver la versión actual. '
            f'Tus últimos cambios NO se guardaron, para no sobrescribir los suyos.'
        )
    return JsonResponse(
        {'error': msg, 'conflicto': True, 'version_actual': imputacion.version},
        status=409,
    )


# ==========================================
#  API — CREAR BORRADOR DE IMPUTACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_imputacion_borrador_crear(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    fecha          = body.get('fecha', '')
    nro_expediente = (body.get('nro_expediente') or '').strip()
    observacion    = (body.get('observacion') or '').strip()
    detalles       = body.get('detalles', [])

    try:
        fecha_obj = date.fromisoformat(fecha) if fecha else date.today()
    except ValueError:
        fecha_obj = date.today()

    with transaction.atomic():
        imputacion = Imputacion.objects.create(
            nro_expediente    = nro_expediente or 'BORRADOR',
            asiento_nro       = '',
            fecha             = fecha_obj,
            origen            = 'MANUAL',
            observacion       = observacion,
            usuario           = request.user,            # Creado por (nunca se reemplaza)
            usuario_modificacion = request.user,         # Editado por (inicial = creador)
            estado_formulario = 'REVISAR',
        )

        _crear_filas_borrador(imputacion, _normalizar_filas(detalles))

        _registrar_auditoria_imputacion(
            imputacion.id, 'CREACION', request.user, version=imputacion.version,
        )

    return JsonResponse({
        'ok':            True,
        'imputacion_id': imputacion.id,
        'version':       imputacion.version,
    })



# ==========================================
#  API — ACTUALIZAR BORRADOR DE IMPUTACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_imputacion_borrador_actualizar(request, imputacion_id):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    with transaction.atomic():
        # Bloqueo de la fila: serializa a los editores concurrentes
        try:
            imputacion = Imputacion.objects.select_for_update().get(id=imputacion_id)
        except Imputacion.DoesNotExist:
            return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

        if not puede_editar_imputacion(request.user, imputacion):
            return JsonResponse({'error': 'No tenés permiso para editar esta imputación'}, status=403)

        if imputacion.estado_formulario != 'REVISAR':
            return JsonResponse({'error': 'Solo se pueden actualizar borradores en estado REVISAR'}, status=400)

        version_cliente = _version_cliente(body)
        if version_cliente != imputacion.version:
            return _respuesta_conflicto_imputacion(imputacion, version_cliente)

        fecha          = body.get('fecha', '')
        nro_expediente = (body.get('nro_expediente') or '').strip() or 'BORRADOR'
        observacion    = (body.get('observacion') or '').strip()
        detalles       = body.get('detalles', [])

        try:
            fecha_obj = date.fromisoformat(fecha) if fecha else imputacion.fecha
        except ValueError:
            fecha_obj = imputacion.fecha

        filas   = _normalizar_filas(detalles)
        cambios = _cambios_borrador(imputacion, fecha_obj, nro_expediente, observacion, filas)

        # Guardado sin cambios reales: no se escribe nada (ni editor, ni versión, ni auditoría)
        if not cambios:
            return JsonResponse({'ok': True, 'sin_cambios': True, 'version': imputacion.version})

        imputacion.fecha                = fecha_obj
        imputacion.nro_expediente       = nro_expediente
        imputacion.observacion          = observacion
        imputacion.usuario_modificacion = request.user
        imputacion.version             += 1
        imputacion.save()

        # Reemplazar detalles del borrador completamente
        imputacion.borradores_detalle.all().delete()
        _crear_filas_borrador(imputacion, filas)

        _registrar_auditoria_imputacion(
            imputacion.id, 'EDICION', request.user,
            version=imputacion.version, detalle=', '.join(cambios),
        )

    return JsonResponse({'ok': True, 'version': imputacion.version})


# ==========================================
#  API — COMPLETAR IMPUTACIÓN (REVISAR → LISTO)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_imputacion_completar(request, imputacion_id):
    from django.db.models import Max

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        body = {}

    try:
        with transaction.atomic():
            # Bloqueo de la cabecera ANTES de validar: evita doble confirmación
            # y confirmar una versión desactualizada.
            try:
                imputacion = Imputacion.objects.select_for_update().get(id=imputacion_id)
            except Imputacion.DoesNotExist:
                return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

            if not puede_editar_imputacion(request.user, imputacion):
                return JsonResponse({'error': 'No tenés permiso para completar esta imputación'}, status=403)

            if imputacion.estado_formulario != 'REVISAR':
                return JsonResponse({'error': 'Esta imputación ya fue completada'}, status=400)

            version_cliente = _version_cliente(body)
            if version_cliente != imputacion.version:
                return _respuesta_conflicto_imputacion(imputacion, version_cliente)

            borradores = imputacion.borradores_detalle.all()

            if not borradores.exists():
                return JsonResponse({'error': 'No hay filas de detalle cargadas'}, status=400)

            # Validar que todos los borradores estén completos
            for b in borradores:
                if not b.linea_presupuestaria:
                    return JsonResponse({'error': 'Hay filas con línea presupuestaria incompleta'}, status=400)
                if b.linea_presupuestaria.ejercicio != imputacion.fecha.year:
                    return JsonResponse({'error': (
                        f'La línea {b.linea_presupuestaria_id} es del ejercicio '
                        f'{b.linea_presupuestaria.ejercicio}, distinto del año de la fecha.'
                    )}, status=400)
                if not b.proveedor_concepto.strip():
                    return JsonResponse({'error': 'Hay filas sin concepto/proveedor'}, status=400)
                if not b.importe or b.importe <= 0:
                    return JsonResponse({'error': 'Hay filas con importe inválido o cero'}, status=400)

            if not imputacion.nro_expediente or imputacion.nro_expediente == 'BORRADOR':
                return JsonResponse({'error': 'El número de expediente es obligatorio'}, status=400)

            if not imputacion.fecha:
                return JsonResponse({'error': 'La fecha es obligatoria'}, status=400)

            # Recalcular asiento definitivo (lógica sin cambios)
            ultimo = Imputacion.objects.filter(
                fecha__year=imputacion.fecha.year,
                estado_formulario='LISTO',
            ).exclude(id=imputacion.id).aggregate(Max('asiento_nro'))['asiento_nro__max']
            try:
                asiento_nro = str(int(ultimo) + 1).zfill(4) if ultimo else '0001'
            except (ValueError, TypeError):
                asiento_nro = '0001'

            imputacion.asiento_nro       = asiento_nro
            imputacion.estado_formulario = 'LISTO'
            imputacion.usuario_modificacion = request.user   # quien confirma = último editor
            imputacion.version          += 1
            imputacion.save()

            importe_total = Decimal('0')

            for b in borradores:
                linea = LineaPresupuestaria.objects.select_for_update().get(
                    id=b.linea_presupuestaria_id
                )

                if b.importe > linea.saldo_actual:
                    raise ValueError(
                        f'Saldo insuficiente en línea {linea.id}. '
                        f'Disponible: ${linea.saldo_actual}, requerido: ${b.importe}'
                    )

                # Crear ImputacionDetalle real (trigger descuenta saldo_actual)
                ImputacionDetalle.objects.create(
                    imputacion           = imputacion,
                    linea_presupuestaria = linea,
                    proveedor_concepto   = b.proveedor_concepto,
                    importe              = b.importe,
                )

                importe_total += b.importe

            # Eliminar borradores — ya no se necesitan
            borradores.delete()

            _registrar_auditoria_imputacion(
                imputacion.id, 'CONFIRMACION', request.user,
                version=imputacion.version, detalle=f'asiento {asiento_nro}',
            )

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

    # ── NOTIFICACIÓN DE IMPUTACIÓN ─────────────────────────────
    crear_notificaciones_admins(
        titulo="Nueva imputación registrada",
        mensaje=f"Expediente: {imputacion.nro_expediente}",
        tipo="imputacion",
        url=f"/admin-dashboard/imputacion/ver/{imputacion.id}/",
        realizado_por=request.user.nombre
    )

    return JsonResponse({
        'ok':            True,
        'imputacion_id': imputacion.id,
        'asiento_nro':   asiento_nro,
        'importe_total': str(importe_total),
        'version':       imputacion.version,
    })


# ==========================================
#  API — OBTENER BORRADOR (para retomar)
#  Solo lectura: NO modifica auditoría ni versión.
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_imputacion_borrador_obtener(request, imputacion_id):
    try:
        imputacion = Imputacion.objects.get(id=imputacion_id)
    except Imputacion.DoesNotExist:
        return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

    if not puede_editar_imputacion(request.user, imputacion):
        return JsonResponse({'error': 'No tenés permiso para ver esta imputación'}, status=403)

    borradores = imputacion.borradores_detalle.select_related(
        'linea_presupuestaria__programa',
        'linea_presupuestaria__proyecto',
        'linea_presupuestaria__actividad_obra',
        'linea_presupuestaria__partida',
        'linea_presupuestaria__fuente_financiamiento',
    ).order_by('orden')

    detalles = []
    for b in borradores:
        detalles.append({
            'programa_id':      b.programa_id,
            'proyecto_id':      b.proyecto_id,
            'actividad_id':     b.actividad_id,
            'partida_id':       b.partida_id,
            'fuente_id':        b.fuente_id,
            'linea_id':         b.linea_presupuestaria_id,
            'proveedor_concepto': b.proveedor_concepto,
            'importe':          str(b.importe) if b.importe else '',
        })

    return JsonResponse({
        'imputacion_id':   imputacion.id,
        'fecha':           imputacion.fecha.strftime('%Y-%m-%d'),
        'nro_expediente':  imputacion.nro_expediente if imputacion.nro_expediente != 'BORRADOR' else '',
        'observacion':     imputacion.observacion,
        'estado_formulario': imputacion.estado_formulario,
        'version':         imputacion.version,
        'detalles':        detalles,
    })


# ==========================================
#  API — ELIMINAR BORRADOR DE IMPUTACIÓN
#  Solo estado REVISAR. Eliminación física: un borrador no tiene asiento,
#  ni ImputacionDetalle, ni movimientos, ni saldos. NO genera
#  MovimientoHistorial. Queda constancia en ImputacionAuditoria.
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_imputacion_borrador_eliminar(request, imputacion_id):
    try:
        with transaction.atomic():
            try:
                imputacion = Imputacion.objects.select_for_update().get(id=imputacion_id)
            except Imputacion.DoesNotExist:
                return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

            if not puede_eliminar_imputacion(request.user, imputacion):
                return JsonResponse({'error': 'No tenés permiso para eliminar esta imputación'}, status=403)

            if imputacion.estado_formulario != 'REVISAR':
                return JsonResponse(
                    {'error': 'Solo se pueden eliminar borradores en estado Revisar. '
                              'Una imputación en estado Listo no se puede eliminar.'},
                    status=400,
                )

            # Defensa: un borrador no debería tener ninguna de estas consecuencias
            if (
                imputacion.detalles.exists()
                or imputacion.ordenes_pago.exists()
                or imputacion.ordenes_pago_personal.exists()
                or MovimientoHistorial.objects.filter(
                    tipo__startswith='IMPUTACION', referencia_id=imputacion.id
                ).exists()
            ):
                return JsonResponse(
                    {'error': 'Esta imputación tiene registros asociados (detalle definitivo, '
                              'órdenes de pago o movimientos) y no se puede eliminar.'},
                    status=409,
                )

            filas = list(imputacion.borradores_detalle.all())
            total = sum((b.importe or Decimal('0')) for b in filas)
            instantanea = (
                f'exp. {imputacion.nro_expediente} | fecha {imputacion.fecha.strftime("%d/%m/%Y")} | '
                f'creado por {imputacion.usuario.nombre} | {len(filas)} fila(s) | total ${total}'
            )

            _registrar_auditoria_imputacion(
                imputacion.id, 'ELIMINACION', request.user,
                version=imputacion.version, detalle=instantanea,
            )
            imputacion.delete()   # borra en cascada ImputacionBorradorDetalle

    except ProtectedError:
        return JsonResponse(
            {'error': 'La imputación tiene registros relacionados y no se puede eliminar.'},
            status=409,
        )

    return JsonResponse({'ok': True})

# ==========================================
#  API — HISTORIAL DE INTERVENCIONES DE UNA IMPUTACIÓN (solo lectura)
#  Lee ImputacionAuditoria (que ya se escribe en cada borrador/confirmación/eliminación) y
#  lo adapta al formato que espera el modal del listado (mismo que Refuerzo y OP).
# ==========================================
_IMPUTACION_AUDITORIA_OPERACION = {
    'CREACION':     'CREAR',
    'EDICION':      'EDITAR',
    'CONFIRMACION': 'COMPLETAR',
    'ELIMINACION':  'ELIMINAR',
}
_IMPUTACION_AUDITORIA_TEXTOS = {
    'CREAR':     'Creó el borrador',
    'EDITAR':    'Editó el borrador',
    'COMPLETAR': 'Confirmó como Listo',
    'ELIMINAR':  'Eliminó el borrador',
}


@rol_requerido('admin', 'adminprincipal')
def api_imputacion_auditoria(request, imputacion_id):
    """Solo lectura (GET): consultar el historial NO genera ningún registro."""
    eventos    = list(ImputacionAuditoria.objects.filter(imputacion_id=imputacion_id)
                      .select_related('usuario').order_by('fecha', 'id'))
    imputacion = Imputacion.objects.select_related('usuario').filter(id=imputacion_id).first()
    if imputacion is None and not eventos:
        return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M')

    data = []
    # Imputaciones anteriores a la auditoría: se reconstruye la creación desde la cabecera
    if imputacion is not None and not any(e.tipo == 'CREACION' for e in eventos):
        data.append({
            'operacion':    'CREAR',
            'texto':        'Creó la Imputación (anterior al registro de auditoría)',
            'usuario':      imputacion.usuario.nombre if imputacion.usuario_id else 'S/N',
            'fecha':        _fmt(imputacion.fecha_creacion),
            'fecha_ultima': None,
            'cantidad':     1,
            'estado':       None,
            'campos':       [],
        })

    for e in eventos:
        operacion = _IMPUTACION_AUDITORIA_OPERACION.get(e.tipo, e.tipo)
        # En EDICION 'detalle' es la lista de campos tocados separada por comas
        campos = [c for c in e.detalle.split(', ') if c] if e.tipo == 'EDICION' else []
        data.append({
            'operacion':    operacion,
            'texto':        _IMPUTACION_AUDITORIA_TEXTOS.get(operacion, operacion),
            'usuario':      e.usuario.nombre,
            'fecha':        _fmt(e.fecha),
            'fecha_ultima': _fmt(e.fecha_ultima) if e.cantidad > 1 and e.fecha_ultima else None,
            'cantidad':     e.cantidad,
            'estado':       None,
            'campos':       campos,
        })

    return JsonResponse({'imputacion_id': imputacion_id, 'eventos': data})


# ── Variantes SIN filtrar por líneas ya cargadas ──────────────────────────
# Las de arriba (api_programas / api_proyectos / api_actividades) sólo
# muestran lo que YA tiene una UP cargada — están pensadas para la cascada
# de Imputación, donde hace falta que exista una línea previa para poder
# imputar contra ella.
# Estas devuelven el catálogo completo, para usarse en formularios donde
# se está creando una UP nueva (ej: Cargar Presupuesto).
@rol_requerido('admin', 'adminprincipal')
def api_programas_catalogo(request):
    programas = Programa.objects.all().values(
        'id', 'codigo_programa', 'nombre'
    ).order_by('codigo_programa')
    return JsonResponse({'programas': list(programas)})

@rol_requerido('admin', 'adminprincipal')
def api_proyectos_catalogo(request):
    programa_id = request.GET.get('programa_id')
    if not programa_id:
        return JsonResponse({'error': 'Falta programa_id'}, status=400)

    proyectos = Proyecto.objects.filter(
        programa_id=programa_id
    ).values('id', 'nombre', 'codigo_proyecto').order_by('codigo_proyecto')
    return JsonResponse({'proyectos': list(proyectos)})

@rol_requerido('admin', 'adminprincipal')
def api_actividades_catalogo(request):
    proyecto_id = request.GET.get('proyecto_id')
    if not proyecto_id:
        return JsonResponse({'error': 'Falta proyecto_id'}, status=400)

    actividades = ActividadObra.objects.filter(
        proyecto_id=proyecto_id
    ).values('id', 'nombre', 'codigo_act_obra').order_by('codigo_act_obra')
    return JsonResponse({'actividades': list(actividades)})

@rol_requerido('admin', 'adminprincipal')
def api_proyectos(request):
    programa_id = request.GET.get('programa_id')
    if not programa_id:
        return JsonResponse({'error': 'Falta programa_id'}, status=400)
    ejercicio = timezone.now().year

    ids = LineaPresupuestaria.objects.filter(
        programa_id=programa_id,
        ejercicio=ejercicio
    ).values_list('proyecto_id', flat=True).distinct()

    proyectos = Proyecto.objects.filter(
        id__in=ids
    ).values('id', 'nombre', 'codigo_proyecto').order_by('codigo_proyecto')
    return JsonResponse({'proyectos': list(proyectos)})

@rol_requerido('admin', 'adminprincipal')
def api_actividades(request):
    proyecto_id = request.GET.get('proyecto_id')
    if not proyecto_id:
        return JsonResponse({'error': 'Falta proyecto_id'}, status=400)
    ejercicio = timezone.now().year

    ids = LineaPresupuestaria.objects.filter(
        proyecto_id=proyecto_id,
        ejercicio=ejercicio
    ).values_list('actividad_obra_id', flat=True).distinct()

    actividades = ActividadObra.objects.filter(
        id__in=ids
    ).values('id', 'nombre', 'codigo_act_obra').order_by('codigo_act_obra')
    return JsonResponse({'actividades': list(actividades)})

@rol_requerido('admin', 'adminprincipal')
def api_partidas(request):
    partidas = Partida.objects.all().values('id', 'codigo', 'denominacion')
    return JsonResponse({'partidas': list(partidas)})


@rol_requerido('admin', 'adminprincipal')
def api_fuentes(request):
    fuentes = FuenteFinanciamiento.objects.all().values('id', 'codigo', 'nombre')
    return JsonResponse({'fuentes': list(fuentes)})


# ==========================================
#  CARGA DE CATÁLOGOS — CRUD genérico
# ==========================================
# Configuración por tipo: qué modelo, cómo se llaman sus campos de
# código/denominación, y (si aplica) su padre obligatorio.
CATALOGO_CONFIG = {
    'Programa': {
        'model': Programa, 'campo_codigo': 'codigo_programa', 'campo_denom': 'nombre',
        'padre_field': 'jurisdiccion', 'padre_model': Jurisdiccion,
        'padre_codigo': 'codigo_jurisd', 'padre_denom': 'nombre',
    },
    'Subprograma': {
        'model': Subprograma, 'campo_codigo': 'codigo_subprograma', 'campo_denom': 'nombre',
        'padre_field': 'programa', 'padre_model': Programa,
        'padre_codigo': 'codigo_programa', 'padre_denom': 'nombre',
    },
    'Proyecto': {
        'model': Proyecto, 'campo_codigo': 'codigo_proyecto', 'campo_denom': 'nombre',
        'padre_field': 'programa', 'padre_model': Programa,
        'padre_codigo': 'codigo_programa', 'padre_denom': 'nombre',
    },
    'Actividad / Obra': {
        'model': ActividadObra, 'campo_codigo': 'codigo_act_obra', 'campo_denom': 'nombre',
        'padre_field': 'proyecto', 'padre_model': Proyecto,
        'padre_codigo': 'codigo_proyecto', 'padre_denom': 'nombre',
    },
    'Partida': {
        'model': Partida, 'campo_codigo': 'codigo', 'campo_denom': 'denominacion',
        'padre_field': None,
    },
    'Fuente de Financiamiento': {
        'model': FuenteFinanciamiento, 'campo_codigo': 'codigo', 'campo_denom': 'nombre',
        'padre_field': None,
    },
}


def _padre_label(padre, config):
    return f"{str(getattr(padre, config['padre_codigo'])).zfill(2)} - {getattr(padre, config['padre_denom'])}"


@rol_requerido('admin', 'adminprincipal')
def api_catalogos_listar(request):
    tipo = request.GET.get('tipo')
    config = CATALOGO_CONFIG.get(tipo)
    if not config:
        return JsonResponse({'error': 'Tipo de catálogo inválido'}, status=400)

    qs = config['model'].objects.all().order_by(config['campo_codigo'])
    if config['padre_field']:
        qs = qs.select_related(config['padre_field'])

    data = []
    for obj in qs:
        item = {
            'id':           obj.id,
            'codigo':       str(getattr(obj, config['campo_codigo'])).zfill(2),
            'denominacion': getattr(obj, config['campo_denom']),
        }
        if config['padre_field']:
            padre = getattr(obj, config['padre_field'])
            item['padre_id']     = padre.id
            item['padre_nombre'] = _padre_label(padre, config)
        data.append(item)

    return JsonResponse({'items': data, 'requiere_padre': bool(config['padre_field'])})


@rol_requerido('admin', 'adminprincipal')
def api_catalogos_padres(request):
    tipo = request.GET.get('tipo')
    config = CATALOGO_CONFIG.get(tipo)
    if not config or not config['padre_field']:
        return JsonResponse({'padres': []})

    qs = config['padre_model'].objects.all().order_by(config['padre_codigo'])
    padres = [{'id': p.id, 'label': _padre_label(p, config)} for p in qs]
    return JsonResponse({'padres': padres})


@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_catalogos_crear(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    tipo = body.get('tipo')
    config = CATALOGO_CONFIG.get(tipo)
    if not config:
        return JsonResponse({'error': 'Tipo de catálogo inválido'}, status=400)

    codigo_raw   = body.get('codigo')
    denominacion = (body.get('denominacion') or '').strip()
    if not codigo_raw or not denominacion:
        return JsonResponse({'error': 'Faltan código o denominación'}, status=400)

    try:
        codigo = int(codigo_raw)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'El código debe ser numérico'}, status=400)

    kwargs = {config['campo_codigo']: codigo, config['campo_denom']: denominacion}

    if config['padre_field']:
        padre_id = body.get('padre_id')
        if not padre_id:
            return JsonResponse({'error': f'Falta seleccionar el padre para {tipo}'}, status=400)
        try:
            padre = config['padre_model'].objects.get(id=padre_id)
        except config['padre_model'].DoesNotExist:
            return JsonResponse({'error': 'Padre no encontrado'}, status=404)
        kwargs[config['padre_field']] = padre

    obj = config['model'].objects.create(**kwargs)

    return JsonResponse({
        'ok': True,
        'item': {
            'id':           obj.id,
            'codigo':       str(getattr(obj, config['campo_codigo'])).zfill(2),
            'denominacion': getattr(obj, config['campo_denom']),
        },
    })


@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_catalogos_editar(request, item_id):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    tipo = body.get('tipo')
    config = CATALOGO_CONFIG.get(tipo)
    if not config:
        return JsonResponse({'error': 'Tipo de catálogo inválido'}, status=400)

    try:
        obj = config['model'].objects.get(id=item_id)
    except config['model'].DoesNotExist:
        return JsonResponse({'error': 'No encontrado'}, status=404)

    codigo_raw   = body.get('codigo')
    denominacion = (body.get('denominacion') or '').strip()
    if not codigo_raw or not denominacion:
        return JsonResponse({'error': 'Faltan código o denominación'}, status=400)

    try:
        codigo = int(codigo_raw)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'El código debe ser numérico'}, status=400)

    setattr(obj, config['campo_codigo'], codigo)
    setattr(obj, config['campo_denom'], denominacion)

    if config['padre_field']:
        padre_id = body.get('padre_id')
        if not padre_id:
            return JsonResponse({'error': f'Falta seleccionar el padre para {tipo}'}, status=400)
        try:
            padre = config['padre_model'].objects.get(id=padre_id)
        except config['padre_model'].DoesNotExist:
            return JsonResponse({'error': 'Padre no encontrado'}, status=404)
        setattr(obj, config['padre_field'], padre)

    obj.save()
    return JsonResponse({'ok': True})


@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_catalogos_eliminar(request, item_id):
    tipo = request.GET.get('tipo')
    config = CATALOGO_CONFIG.get(tipo)
    if not config:
        return JsonResponse({'error': 'Tipo de catálogo inválido'}, status=400)

    try:
        obj = config['model'].objects.get(id=item_id)
    except config['model'].DoesNotExist:
        return JsonResponse({'error': 'No encontrado'}, status=404)

    try:
        obj.delete()
    except ProtectedError:
        return JsonResponse(
            {'error': 'No se puede eliminar: está siendo usado en una línea presupuestaria.'},
            status=400,
        )

    return JsonResponse({'ok': True})


@rol_requerido('admin', 'adminprincipal')
def api_buscar_linea(request):
    """Dado programa+proyecto+actividad+partida+fuente+ejercicio devuelve el linea_id."""
    actividad_id = request.GET.get('actividad_id')
    partida_id   = request.GET.get('partida_id')
    fuente_id    = request.GET.get('fuente_id')
    ejercicio    = request.GET.get('ejercicio')

    if not all([actividad_id, partida_id, fuente_id, ejercicio]):
        return JsonResponse({'error': 'Faltan parámetros'}, status=400)

    try:
        linea = LineaPresupuestaria.objects.get(
            actividad_obra_id     = actividad_id,
            partida_id            = partida_id,
            fuente_financiamiento_id = fuente_id,
            ejercicio             = ejercicio,
        )
        return JsonResponse({
            'linea_id':     linea.id,
            'saldo_actual': str(linea.saldo_actual),
        })
    except LineaPresupuestaria.DoesNotExist:
        return JsonResponse({'error': 'Línea presupuestaria no encontrada'}, status=404)
    

# ==========================================
#  API — PRÓXIMO N° DE ASIENTO (preview)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_proximo_asiento(request):
    ejercicio_raw = request.GET.get('ejercicio')
    try:
        ejercicio = int(ejercicio_raw) if ejercicio_raw else date.today().year
    except ValueError:
        return JsonResponse({'error': 'Ejercicio inválido'}, status=400)

    from django.db.models import Max
    ultimo = Imputacion.objects.filter(
        fecha__year=ejercicio
    ).aggregate(Max('asiento_nro'))['asiento_nro__max']

    if ultimo:
        try:
            proximo = str(int(ultimo) + 1).zfill(4)
        except ValueError:
            proximo = '0001'
    else:
        proximo = '0001'

    return JsonResponse({'proximo_asiento': proximo})

# ==========================================
#  LISTA DE IMPUTACIONES
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def lista_imputaciones(request):
    from django.db.models import Sum

    imputaciones = Imputacion.objects.filter(estado_formulario='LISTO').select_related('usuario'
    ).prefetch_related(
        'detalles__ordenes_pago_up',
        'detalles__linea_presupuestaria',
    ).order_by('-fecha')

    lista = []
    for imp in imputaciones:

        importe_total = imp.detalles.aggregate(
            total=Sum('importe')
        )['total'] or Decimal('0')

        total_pagado = Decimal('0')
        for detalle in imp.detalles.all():
            pagado = detalle.ordenes_pago_up.aggregate(
                total=Sum('importe')
            )['total'] or Decimal('0')
            total_pagado += pagado

        if total_pagado == 0:
            estado = 'Pendiente'
        elif total_pagado < importe_total:
            estado = 'Pagada parcial'
        else:
            estado = 'Pagada total'

        # Una Imputación anulada no admite más Órdenes de Pago: se muestra como tal
        if imp.anulada:
            estado = 'Anulada'

        primera_linea = imp.detalles.first()
        ejercicio = primera_linea.linea_presupuestaria.ejercicio if primera_linea else '—'

        lista.append({
            'id':             imp.id,
            'ejercicio':      ejercicio,
            'asiento_nro':    imp.asiento_nro,
            'nro_expediente': imp.nro_expediente,
            'fecha':          imp.fecha.strftime('%d/%m/%Y'),
            'usuario':        imp.usuario.nombre,
            'importe_total':  importe_total,
            'total_pagado':   total_pagado,
            'estado':         estado,
            'anulada':        imp.anulada,
        })

    context = {
        'usuario':      request.user,
        'imputaciones': lista,
    }
    return render(request, 'dashboards/admin/lista_imputaciones.html', context)

# ==========================================
#  API — DETALLE DE IMPUTACIÓN (para autocompletar OP)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_detalle_imputacion(request, imputacion_id):
    try:
        imp = Imputacion.objects.prefetch_related(
            'detalles__linea_presupuestaria__jurisdiccion',
            'detalles__linea_presupuestaria__programa',
            'detalles__linea_presupuestaria__proyecto',
            'detalles__linea_presupuestaria__actividad_obra',
            'detalles__linea_presupuestaria__partida',
        ).get(id=imputacion_id)
    except Imputacion.DoesNotExist:
        return JsonResponse({'error': 'Imputación no encontrada'}, status=404)

    detalles = []
    for d in imp.detalles.all():
        linea = d.linea_presupuestaria
        detalles.append({
            'jur':          linea.jurisdiccion.codigo_jurisd,
            'prog':         linea.programa.codigo_programa,
            'pry':          linea.proyecto.codigo_proyecto,
            'ao':           linea.actividad_obra.codigo_act_obra,
            'part':         linea.partida.codigo,
            'denominacion': linea.partida.denominacion,
            'ejercicio':    linea.ejercicio,
            'importe':      str(d.importe),
        })

    return JsonResponse({
        'expediente':   imp.nro_expediente,
        'asiento_nro':  imp.asiento_nro,
        'fecha':        imp.fecha.strftime('%d/%m/%Y'),
        'jurisdiccion': f"{imp.detalles.first().linea_presupuestaria.jurisdiccion.codigo_jurisd} - {imp.detalles.first().linea_presupuestaria.jurisdiccion.nombre}" if imp.detalles.exists() else '',
        'detalles':     detalles,
    })


# ==========================================
#  API — UNIDADES PRESUPUESTARIAS DE UNA IMPUTACIÓN
#  Devuelve las UPs de la imputación con saldo disponible
#  (importe original menos lo ya pagado en OPs anteriores)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_ups_imputacion(request, imputacion_id):
    try:
        imputacion = Imputacion.objects.get(id=imputacion_id)
    except Imputacion.DoesNotExist:
        return JsonResponse({'error': 'Imputacion no encontrada'}, status= 400)
    
    from django.db.models import Sum

    detalles = ImputacionDetalle.objects.filter(
        imputacion=imputacion
    ).select_related(
        'linea_presupuestaria__programa',
        'linea_presupuestaria__proyecto',
        'linea_presupuestaria__actividad_obra',
        'linea_presupuestaria__partida',
        'linea_presupuestaria__fuente_financiamiento',
    )

    resultado = []
    for d in detalles:
        ya_pagado_op = OrdenPagoUnidadPresupuestaria.objects.filter(
            imputacion_detalle=d
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        ya_trasladado_mod = ModificacionTransferente.objects.filter(
            imputacion_detalle=d
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        saldo_disponible = d.importe - ya_pagado_op - ya_trasladado_mod
        if saldo_disponible <= 0:
            continue

        linea = d.linea_presupuestaria
        # En api_ups_imputacion, dentro del append:
        resultado.append({
            'imputacion_detalle_id': d.id,
            'prog':                  linea.programa.codigo_programa,
            'pry':                   linea.proyecto.codigo_proyecto,
            'ao':                    linea.actividad_obra.codigo_act_obra,
            'part':                  linea.partida.codigo,
            'fuente_id':             linea.fuente_financiamiento_id,
            'fuente_codigo':         linea.fuente_financiamiento.codigo,
            'denominacion':          linea.partida.denominacion,
            'fuente':                linea.fuente_financiamiento.nombre,
            'importe_imputado':      str(d.importe),
            'ya_pagado_op':          str(ya_pagado_op),          # ← renombrado
            'ya_trasladado_mod':     str(ya_trasladado_mod),     # ← nuevo
            'saldo_disponible':      str(saldo_disponible),
        })

    return JsonResponse({
        'imputacion_id': imputacion_id,
        'expediente':    imputacion.nro_expediente,
        'ups':           resultado,
    })


# =============================
#   (RETIRADA) api_crear_orden_pago
# =============================
# La OP ya no se crea de un solo golpe: se crea como borrador (api_op_borrador_crear), se
# autoguarda (api_op_borrador_actualizar) y pasa a Listo únicamente por api_op_completar, que
# concentra las validaciones y el único punto donde la OP consume fondos de la Imputación.

# ==========================================
#  ORDEN DE PAGO — BORRADORES (guardado automático, estado REVISAR)
# ==========================================
# Un borrador solo escribe en orden_pago (cabecera con estado REVISAR) y en las tablas
# orden_pago_borrador_*. NUNCA crea OrdenPagoUnidadPresupuestaria ni MovimientoHistorial:
# esa es la única vía por la que una OP consume fondos de la Imputación, y solo se ejecuta
# al completar. Abrir o consultar una OP no escribe nada (ni "Editado por" ni versión).
OP_ROLES_EDICION         = ('admin', 'adminprincipal')
OP_AUDITORIA_VENTANA     = timedelta(minutes=30)
OP_MAX_FILAS_BORRADOR    = 200
OP_MAX_LINEAS_CONCEPTO   = 100
_AUSENTE                 = object()   # "el cliente no envió este campo": no se toca

# (campo del modelo, largo máximo, etiqueta para el mensaje de error)
_OP_TEXTOS = [
    ('nro_orden_pago',                50,  'Número de orden de pago'),
    ('descripcion_codigo_pago',       200, 'Descripción del código de pago'),
    ('nro_factura',                   50,  'Factura'),
    ('nro_resolucion',                50,  'Resolución'),
    ('nro_resolucion_rectificatoria', 50,  'Resolución rectificatoria'),
    ('decreto',                       50,  'Decreto'),
    ('licitacion',                    100, 'Licitación'),
]
_OP_ENTEROS = [
    ('codigo_pago',          'Código de pago'),
    ('codigo_concepto_pago', 'Código del concepto del pago'),
]
_OP_ETIQUETAS = {
    'nro_orden_pago':                'número de orden',
    'fecha':                         'fecha de elaboración',
    'fecha_vencimiento':             'fecha de vencimiento',
    'codigo_pago':                   'código de pago',
    'descripcion_codigo_pago':       'descripción del código de pago',
    'concepto':                      'concepto',
    'nro_factura':                   'factura',
    'nro_resolucion':                'resolución',
    'nro_resolucion_rectificatoria': 'resolución rectificatoria',
    'decreto':                       'decreto',
    'licitacion':                    'licitación',
    'codigo_concepto_pago':          'código del concepto del pago',
    'concepto_del_pago':             'concepto del pago',
}


def puede_editar_op(user, op):
    """Creador original, o rol Administrador / Administrador principal.
    El estado (REVISAR/LISTO) se valida aparte en cada vista."""
    if not user or not user.is_authenticated:
        return False
    return op.usuario_id == user.id or getattr(user, 'rol', None) in OP_ROLES_EDICION


def _op_txt(valor, maximo, etiqueta):
    valor = '' if valor is None else str(valor).strip()
    if len(valor) > maximo:
        raise _RefuerzoError(f'{etiqueta}: máximo {maximo} caracteres')
    return valor


def _op_entero(valor, etiqueta):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return 0
    try:
        n = int(str(valor).strip())
    except ValueError:
        raise _RefuerzoError(f'{etiqueta}: debe ser un número entero')
    if n < 0 or n > 2147483647:
        raise _RefuerzoError(f'{etiqueta}: el número no es válido')
    return n


def _op_fecha(valor, etiqueta):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    try:
        return date.fromisoformat(str(valor).strip())
    except ValueError:
        raise _RefuerzoError(f'{etiqueta}: la fecha no es válida')


def _op_clave(body):
    valor = body.get('clave_idempotencia')
    if not valor:
        return None
    try:
        return uuid.UUID(str(valor))
    except ValueError:
        raise _RefuerzoError('La clave de guardado no es válida')


def _op_cabecera(body):
    """Solo los campos que el cliente envió, ya validados y normalizados.
    Un borrador admite campos vacíos: la exigencia de obligatorios es al completar."""
    cab = {}
    for attr, maximo, etiqueta in _OP_TEXTOS:
        if attr in body:
            cab[attr] = _op_txt(body.get(attr), maximo, etiqueta)
    for attr, etiqueta in _OP_ENTEROS:
        if attr in body:
            cab[attr] = _op_entero(body.get(attr), etiqueta)
    if 'concepto_del_pago' in body:
        cab['concepto_del_pago'] = _op_txt(body.get('concepto_del_pago'), 10 ** 6, 'Concepto del pago')
    if 'concepto_lineas' in body:
        lineas = body.get('concepto_lineas') or []
        if not isinstance(lineas, list) or len(lineas) > OP_MAX_LINEAS_CONCEPTO:
            raise _RefuerzoError('La descripción del concepto no es válida')
        textos = (str(x).strip() for x in lineas if x is not None)
        # Líneas separadas por salto de línea (se recuperan sin ambigüedad).
        cab['concepto'] = '\n'.join(t for t in textos if t)
    if 'fecha' in body:
        fecha = _op_fecha(body.get('fecha'), 'Fecha de elaboración')
        if fecha is not None:          # la fecha nunca queda vacía: conserva la que tenía
            cab['fecha'] = fecha
    if 'fecha_vencimiento' in body:
        cab['fecha_vencimiento'] = _op_fecha(body.get('fecha_vencimiento'), 'Fecha de vencimiento')
    return cab


def _op_beneficiarios(body):
    """None si el cliente no envió la lista (no se toca). Descarta filas totalmente vacías."""
    if 'beneficiarios' not in body:
        return None
    filas = body.get('beneficiarios')
    if not isinstance(filas, list) or len(filas) > OP_MAX_FILAS_BORRADOR:
        raise _RefuerzoError('La lista de beneficiarios no es válida')
    salida = []
    for n, f in enumerate(filas, start=1):
        if not isinstance(f, dict):
            raise _RefuerzoError('La lista de beneficiarios no es válida')
        codigo  = _op_txt(f.get('codigo_beneficiario'), 20,  f'Beneficiario {n}: código')
        nombre  = _op_txt(f.get('beneficiario'),        200, f'Beneficiario {n}: nombre')
        importe = _decimal_o_none(f.get('importe'), f'Beneficiario {n}')
        if not codigo and not nombre and importe is None:
            continue
        salida.append({'codigo_beneficiario': codigo, 'beneficiario': nombre, 'importe': importe})
    return salida


def _op_ups(body, imputacion):
    """None si el cliente no envió la lista (no se toca). Solo se guardan las UP con importe
    asignado, y todas deben pertenecer a la Imputación de esta OP."""
    if 'ups' not in body:
        return None
    filas = body.get('ups')
    if not isinstance(filas, list) or len(filas) > OP_MAX_FILAS_BORRADOR:
        raise _RefuerzoError('La lista de unidades presupuestarias no es válida')
    salida = []
    for n, f in enumerate(filas, start=1):
        if not isinstance(f, dict):
            raise _RefuerzoError('La lista de unidades presupuestarias no es válida')
        det_id  = _entero_o_none(f.get('imputacion_detalle_id'))
        importe = _decimal_o_none(f.get('importe'), f'Unidad presupuestaria {n}')
        if det_id is None:
            raise _RefuerzoError(f'Unidad presupuestaria {n}: falta identificar la UP')
        if importe is None or importe == 0:
            continue
        salida.append({'imputacion_detalle_id': det_id, 'importe': importe})
    if salida:
        if imputacion is None:
            raise _RefuerzoError('La OP no tiene una Imputación asociada')
        pedidos = {u['imputacion_detalle_id'] for u in salida}
        validos = set(
            ImputacionDetalle.objects.filter(imputacion=imputacion, id__in=pedidos)
            .values_list('id', flat=True)
        )
        if pedidos - validos:
            raise _RefuerzoError('Una de las unidades presupuestarias no pertenece a la Imputación de esta OP')
    return salida


def _op_beneficiarios_guardados(op):
    return [
        {'codigo_beneficiario': b.codigo_beneficiario, 'beneficiario': b.beneficiario, 'importe': b.importe}
        for b in op.borradores_beneficiario.order_by('orden')
    ]


def _op_ups_guardadas(op):
    return [
        {'imputacion_detalle_id': u.imputacion_detalle_id, 'importe': u.importe}
        for u in op.borradores_up.order_by('orden')
    ]


def _op_reemplazar_filas(op, beneficiarios, ups):
    """Reemplaza por completo las filas del borrador (None = no se toca esa lista).
    Escribe solo en las tablas de borrador: no mueve el presupuesto."""
    if beneficiarios is not None:
        op.borradores_beneficiario.all().delete()
        OrdenPagoBorradorBeneficiario.objects.bulk_create([
            OrdenPagoBorradorBeneficiario(
                orden_pago=op, orden=i,
                codigo_beneficiario=b['codigo_beneficiario'],
                beneficiario=b['beneficiario'],
                importe=b['importe'],
            ) for i, b in enumerate(beneficiarios)
        ])
    if ups is not None:
        op.borradores_up.all().delete()
        OrdenPagoBorradorUP.objects.bulk_create([
            OrdenPagoBorradorUP(
                orden_pago=op, orden=i,
                imputacion_detalle_id=u['imputacion_detalle_id'],
                importe=u['importe'],
            ) for i, u in enumerate(ups)
        ])


def _op_cambios(op, cab, beneficiarios, ups):
    """Qué cambió de verdad respecto de lo guardado ([] = guardado sin cambios reales)."""
    cambios = [_OP_ETIQUETAS.get(a, a) for a, v in cab.items() if getattr(op, a) != v]
    if beneficiarios is not None and _op_beneficiarios_guardados(op) != beneficiarios:
        cambios.append('beneficiarios')
    if ups is not None and _op_ups_guardadas(op) != ups:
        cambios.append('unidades presupuestarias')
    return cambios


def _op_registrar_auditoria(op, operacion, usuario, detalle=None, agrupar=False, estado=None):
    """Registra una intervención real sobre la OP. Se llama DENTRO de la transacción y con la
    fila de la OP bloqueada. Solo escribe en orden_pago_auditoria: no toca el presupuesto."""
    ahora   = timezone.now()
    detalle = detalle or {}

    if agrupar:
        ultima = OrdenPagoAuditoria.objects.filter(orden_pago_id=op.id).order_by('-id').first()
        if (ultima is not None and ultima.operacion == 'EDITAR'
                and ultima.usuario_id == usuario.id
                and ahora - ultima.fecha_ultima <= OP_AUDITORIA_VENTANA):
            campos = sorted(set(ultima.detalle.get('campos', [])) | set(detalle.get('campos', [])))
            ultima.detalle      = {'campos': campos}
            ultima.fecha_ultima = ahora
            ultima.cantidad    += 1
            ultima.save(update_fields=['detalle', 'fecha_ultima', 'cantidad'])
            return ultima

    return OrdenPagoAuditoria.objects.create(
        orden_pago_id     = op.id,
        operacion         = operacion,
        usuario           = usuario,
        fecha             = ahora,
        fecha_ultima      = ahora,
        estado_resultante = estado or op.estado_formulario,
        detalle           = detalle,
    )


def _op_respuesta_conflicto(op, version_cliente):
    if version_cliente is None:
        msg = ('Tu pantalla está desactualizada. Recargá la página antes de seguir '
               'editando; no se guardó ningún cambio.')
    else:
        editor = op.usuario_modificacion or op.usuario
        cuando = (
            timezone.localtime(op.fecha_modificacion).strftime('%d/%m/%Y %H:%M')
            if op.fecha_modificacion else ''
        )
        msg = (
            f'Esta Orden de Pago fue modificada por {editor.nombre if editor else "otro usuario"}'
            f'{" el " + cuando if cuando else ""}. Recargá la página para ver la versión actual. '
            f'Tus últimos cambios NO se guardaron, para no sobrescribir los suyos.'
        )
    return JsonResponse({'error': msg, 'conflicto': True, 'version_actual': op.version}, status=409)


def _op_respuesta_existente(op, user):
    """Reintento de un primer guardado cuya respuesta se perdió: devuelve el mismo borrador."""
    if op.usuario_id != user.id:
        raise _RefuerzoError('La clave de guardado ya fue utilizada', 409)
    if op.estado_formulario != 'REVISAR':
        raise _RefuerzoError(
            'Esta Orden de Pago ya fue completada y no se puede modificar desde el formulario',
            409, {'completado': True},
        )
    return JsonResponse({
        'ok':            True,
        'orden_pago_id': op.id,
        'version':       op.version,
        'existente':     True,   # el cliente debe reenviar su contenido como actualización
        'url_editar':    reverse('ordenpago_editar', args=[op.id]),
    })


def _op_datos(op, user):
    """Contenido del borrador para restaurar el formulario. Solo lectura."""
    def _iso(d):
        return d.isoformat() if d else ''

    def _imp(x):
        return str(x) if x is not None else ''

    es_borrador = op.estado_formulario == 'REVISAR'
    ups_detalle = []
    if es_borrador:
        beneficiarios = _op_beneficiarios_guardados(op)
        ups           = _op_ups_guardadas(op)
        lineas        = [l for l in op.concepto.split('\n') if l] if op.concepto else []
    else:
        # OP completada: se leen las filas DEFINITIVAS (las de borrador ya no existen).
        beneficiarios = [
            {'codigo_beneficiario': b.codigo_beneficiario, 'beneficiario': b.beneficiario, 'importe': b.importe}
            for b in op.beneficiarios.order_by('id')
        ]
        filas_up = list(
            op.unidades_presupuestarias.select_related(
                'imputacion_detalle__linea_presupuestaria__programa',
                'imputacion_detalle__linea_presupuestaria__proyecto',
                'imputacion_detalle__linea_presupuestaria__actividad_obra',
                'imputacion_detalle__linea_presupuestaria__partida',
                'imputacion_detalle__linea_presupuestaria__fuente_financiamiento',
            ).order_by('id')
        )
        ups = [{'imputacion_detalle_id': u.imputacion_detalle_id, 'importe': u.importe} for u in filas_up]
        for u in filas_up:
            linea = u.imputacion_detalle.linea_presupuestaria
            ups_detalle.append({
                'imputacion_detalle_id': u.imputacion_detalle_id,
                'prog':          linea.programa.codigo_programa,
                'pry':           linea.proyecto.codigo_proyecto,
                'ao':            linea.actividad_obra.codigo_act_obra,
                'part':          linea.partida.codigo,
                'fuente_id':     linea.fuente_financiamiento_id,
                'fuente_codigo': linea.fuente_financiamiento.codigo,
                'fuente':        linea.fuente_financiamiento.nombre,
                'denominacion':  linea.partida.denominacion,
                'importe':       str(u.importe),
            })
        # Al completar, las líneas del concepto se guardaron unidas con ' / '
        lineas = [l.strip() for l in op.concepto.split(' / ') if l.strip()] if op.concepto else []

    editor = op.usuario_modificacion or op.usuario
    return {
        'id':                 op.id,
        'version':            op.version,
        'estado_formulario':  op.estado_formulario,
        'imputacion_id':      op.imputacion_id,
        'nro_orden_pago':     op.nro_orden_pago,
        'fecha':              _iso(op.fecha),
        'fecha_vencimiento':  _iso(op.fecha_vencimiento),
        # 0 es el valor de relleno de un borrador sin código elegido
        'codigo_pago':        str(op.codigo_pago) if (op.codigo_pago or op.descripcion_codigo_pago) else '',
        'descripcion_codigo_pago': op.descripcion_codigo_pago,
        'concepto_lineas':    lineas,
        'nro_factura':        op.nro_factura,
        'nro_resolucion':     op.nro_resolucion,
        'nro_resolucion_rectificatoria': op.nro_resolucion_rectificatoria,
        'decreto':            op.decreto,
        'licitacion':         op.licitacion,
        'codigo_concepto_pago': str(op.codigo_concepto_pago) if (op.codigo_concepto_pago or op.concepto_del_pago) else '',
        'concepto_del_pago':  op.concepto_del_pago,
        'beneficiarios': [
            {'codigo_beneficiario': b['codigo_beneficiario'], 'beneficiario': b['beneficiario'],
             'importe': _imp(b['importe'])}
            for b in beneficiarios
        ],
        'ups': [
            {'imputacion_detalle_id': u['imputacion_detalle_id'], 'importe': _imp(u['importe'])}
            for u in ups
        ],
        'ups_detalle':        ups_detalle,
        'creado_por':         op.usuario.nombre if op.usuario else '',
        'editado_por':        editor.nombre if editor else '',
        'puede_editar':       es_borrador and puede_editar_op(user, op),
    }


# ==========================================
#  PÁGINA — RETOMAR UN BORRADOR DE OP
# ==========================================
# Solo lectura sobre la base: abrir un borrador nunca escribe nada (ni "Editado por").
@rol_requerido('admin', 'adminprincipal')
def ordenpago_editar(request, op_id):
    op = get_object_or_404(OrdenPago.objects.select_related('usuario', 'usuario_modificacion'), id=op_id)

    if op.estado_formulario != 'REVISAR':
        return redirect('ordenpago_ver', op_id=op.id)

    if not puede_editar_op(request.user, op):
        messages.warning(request, 'No tenés permiso para editar esta Orden de Pago.')
        return redirect('registros')

    context = {
        'usuario':       request.user,
        'modo':          'editar',
        'op_datos':      _json_para_script(_op_datos(op, request.user)),
        'imputacion_id': op.imputacion_id,
    }
    return render(request, 'dashboards/admin/ordenpago.html', context)


# ==========================================
#  PÁGINA — VER UNA OP COMPLETADA (solo lectura)
# ==========================================
# No escribe nada en la base: consultar una OP nunca modifica "Editado por" ni la auditoría.
@rol_requerido('admin', 'adminprincipal')
def ordenpago_ver(request, op_id):
    op = get_object_or_404(OrdenPago.objects.select_related('usuario', 'usuario_modificacion'), id=op_id)

    # Un borrador se retoma desde el formulario de edición (que valida permisos)
    if op.estado_formulario == 'REVISAR':
        return redirect('ordenpago_editar', op_id=op.id)

    context = {
        'usuario':       request.user,
        'modo':          'ver',
        'op_datos':      _json_para_script(_op_datos(op, request.user)),
        'imputacion_id': op.imputacion_id,
    }
    return render(request, 'dashboards/admin/ordenpago.html', context)


# ==========================================
#  API — CREAR BORRADOR DE OP (primer guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_borrador_crear(request):
    try:
        body  = _json_body(request)
        clave = _op_clave(body)

        # Reintento de un primer guardado cuya respuesta se perdió: mismo borrador, sin duplicar.
        if clave:
            existente = OrdenPago.objects.filter(clave_idempotencia=clave).first()
            if existente:
                return _op_respuesta_existente(existente, request.user)

        imp_id = _entero_o_none(body.get('imputacion_id'))
        if imp_id is None:
            raise _RefuerzoError('Falta la Imputación de la Orden de Pago')
        try:
            imputacion = Imputacion.objects.get(id=imp_id)
        except Imputacion.DoesNotExist:
            raise _RefuerzoError('Imputación no encontrada', 404)
        if imputacion.estado_formulario != 'LISTO':
            raise _RefuerzoError('La Imputación todavía no fue completada')
        if imputacion.anulada:
            raise _RefuerzoError('La Imputación está anulada: no se puede crear una Orden de Pago sobre ella')

        cab           = _op_cabecera(body)
        beneficiarios = _op_beneficiarios(body) or []
        ups           = _op_ups(body, imputacion) or []

        valores = {
            'nro_orden_pago': '', 'fecha': timezone.localdate(), 'fecha_vencimiento': None,
            'codigo_pago': 0, 'descripcion_codigo_pago': '', 'concepto': '',
            'nro_factura': '', 'nro_resolucion': '', 'nro_resolucion_rectificatoria': '',
            'decreto': '', 'licitacion': '', 'codigo_concepto_pago': 0, 'concepto_del_pago': '',
        }
        valores.update(cab)
        total = sum((u['importe'] for u in ups), Decimal('0'))

        try:
            with transaction.atomic():
                op = OrdenPago.objects.create(
                    imputacion           = imputacion,
                    importe_total        = total,
                    usuario              = request.user,   # creador: no se reasigna nunca
                    usuario_modificacion = request.user,   # editado por (inicial = creador)
                    estado_formulario    = 'REVISAR',
                    version              = 1,
                    clave_idempotencia   = clave,
                    **valores,
                )
                _op_reemplazar_filas(op, beneficiarios, ups)
                _op_registrar_auditoria(op, 'CREAR', request.user)
        except IntegrityError:
            # Dos pedidos simultáneos con la misma clave: gana el primero.
            existente = OrdenPago.objects.filter(clave_idempotencia=clave).first() if clave else None
            if existente:
                return _op_respuesta_existente(existente, request.user)
            raise

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al crear el borrador de Orden de Pago')
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({
        'ok':            True,
        'orden_pago_id': op.id,
        'version':       op.version,
        'url_editar':    reverse('ordenpago_editar', args=[op.id]),
    })


# ==========================================
#  API — ACTUALIZAR BORRADOR DE OP (guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_borrador_actualizar(request, op_id):
    try:
        body = _json_body(request)

        with transaction.atomic():
            # Bloqueo de la fila: serializa a los editores concurrentes.
            try:
                op = OrdenPago.objects.select_for_update().get(id=op_id)
            except OrdenPago.DoesNotExist:
                raise _RefuerzoError('Orden de Pago no encontrada', 404)

            if not puede_editar_op(request.user, op):
                raise _RefuerzoError('No tenés permiso para editar esta Orden de Pago', 403)

            if op.estado_formulario != 'REVISAR':
                raise _RefuerzoError(
                    'Esta Orden de Pago ya fue completada y no se puede modificar desde el formulario',
                    409, {'completado': True},
                )

            version_cliente = _version_cliente(body)
            if version_cliente != op.version:
                return _op_respuesta_conflicto(op, version_cliente)

            cab           = _op_cabecera(body)
            beneficiarios = _op_beneficiarios(body)
            ups           = _op_ups(body, op.imputacion)

            cambios = _op_cambios(op, cab, beneficiarios, ups)

            # Guardado sin cambios reales: no se escribe nada (ni editor, ni versión, ni auditoría).
            if not cambios:
                return JsonResponse({'ok': True, 'sin_cambios': True, 'version': op.version})

            for attr, valor in cab.items():
                setattr(op, attr, valor)
            if ups is not None:
                op.importe_total = sum((u['importe'] for u in ups), Decimal('0'))
            op.usuario_modificacion = request.user
            op.version             += 1
            op.save()

            _op_reemplazar_filas(op, beneficiarios, ups)
            _op_registrar_auditoria(
                op, 'EDITAR', request.user, detalle={'campos': cambios}, agrupar=True,
            )

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al actualizar el borrador de Orden de Pago %s', op_id)
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({'ok': True, 'version': op.version})


# ==========================================
#  API — COMPLETAR OP (REVISAR → LISTO)
# ==========================================
# ÚNICO camino a LISTO y ÚNICO punto donde la OP consume fondos de la Imputación (crea las
# OrdenPagoUnidadPresupuestaria y los MovimientoHistorial, igual que el flujo anterior).
# El servidor confirma lo que está GUARDADO en la base (el cliente solo envía la versión que
# vio, después de vaciar su autoguardado). La OP no modifica saldo_actual de la línea.
# La fecha de elaboración se conserva tal como la dejó el usuario: nunca se pisa.
def _op_errores_completar(op, beneficiarios, ups):
    """Validación de campos obligatorios y de importes (sin tocar la base). Devuelve la lista
    de mensajes; vacía = la OP puede completarse a nivel de datos."""
    e = []

    nro = op.nro_orden_pago.strip()
    partes = nro.split('-')
    if not nro:
        e.append('El número de Orden de Pago es obligatorio.')
    elif (len(partes) != 3 or tuple(map(len, partes)) != (2, 2, 4)
          or not all(p.isascii() and p.isdigit() for p in partes)):
        e.append('El número de orden debe tener el formato 00-00-0000 (8 dígitos).')

    if not op.fecha:
        e.append('La fecha de elaboración es obligatoria.')
    if not op.fecha_vencimiento:
        e.append('La fecha de vencimiento es obligatoria.')
    if not (op.codigo_pago or op.descripcion_codigo_pago.strip()):
        e.append('El código de pago es obligatorio.')
    if not op.concepto.strip():
        e.append('La descripción del concepto es obligatoria.')
    if not op.codigo_concepto_pago:
        e.append('Falta el código en Concepto del Pago.')
    if not op.concepto_del_pago.strip():
        e.append('Falta la descripción en Concepto del Pago.')
    if not op.nro_factura.strip():
        e.append('El número de factura es obligatorio.')
    if not op.nro_resolucion.strip():
        e.append('El número de resolución es obligatorio.')
    if not op.licitacion.strip():
        e.append('La licitación es obligatoria.')
    if not op.decreto.strip():
        e.append('El decreto es obligatorio.')

    # Beneficiarios = importe concepto del pago
    if not beneficiarios:
        e.append('Agregá al menos un beneficiario con importe.')
    falta_codigo = falta_nombre = importe_malo = False
    for b in beneficiarios:
        falta_codigo = falta_codigo or not b['codigo_beneficiario']
        falta_nombre = falta_nombre or not b['beneficiario']
        importe_malo = importe_malo or b['importe'] is None or b['importe'] <= 0
    if falta_codigo:
        e.append('Falta el código en uno o más beneficiarios.')
    if falta_nombre:
        e.append('Falta el nombre en uno o más beneficiarios.')
    if importe_malo:
        e.append('El importe de cada beneficiario debe ser mayor a cero.')

    # Unidades presupuestarias = importe del Señor Tesorero
    if not ups:
        e.append('Asigná importe a al menos una Unidad Presupuestaria.')
    if any(u['imputacion_detalle_id'] is None for u in ups):
        e.append('Una unidad presupuestaria asignada ya no existe en la Imputación: volvé a asignarla.')
    if any(u['importe'] is None or u['importe'] <= 0 for u in ups):
        e.append('El importe de cada Unidad Presupuestaria debe ser mayor a cero.')

    # La suma de los beneficiarios debe ser EXACTAMENTE el importe del Señor Tesorero
    if beneficiarios and ups and not (falta_codigo or importe_malo):
        total_benef = sum((b['importe'] or Decimal('0')) for b in beneficiarios)
        total_tesor = sum((u['importe'] or Decimal('0')) for u in ups)
        if total_benef != total_tesor:
            e.append(
                f'La suma de los importes de los beneficiarios (${total_benef}) debe ser '
                f'exactamente igual al importe del Señor Tesorero (${total_tesor}).'
            )
    return e


@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_completar(request, op_id):
    try:
        body = _json_body(request) if request.body else {}

        with transaction.atomic():
            # Orden de bloqueo: OP → Imputación → detalles por id (el mismo orden por id que
            # usa Modificación Modo B, para evitar interbloqueos).
            try:
                op = OrdenPago.objects.select_for_update().get(id=op_id)
            except OrdenPago.DoesNotExist:
                raise _RefuerzoError('Orden de Pago no encontrada', 404)

            if not puede_editar_op(request.user, op):
                raise _RefuerzoError('No tenés permiso para completar esta Orden de Pago', 403)

            if op.estado_formulario != 'REVISAR':
                raise _RefuerzoError('Esta Orden de Pago ya fue completada', 409, {'completado': True})

            version_cliente = _version_cliente(body)
            if version_cliente != op.version:
                return _op_respuesta_conflicto(op, version_cliente)

            if op.imputacion_id is None:
                raise _RefuerzoError('La Orden de Pago no tiene una Imputación asociada')
            imputacion = Imputacion.objects.select_for_update().get(id=op.imputacion_id)
            if imputacion.estado_formulario != 'LISTO':
                raise _RefuerzoError('La Imputación todavía no fue completada')
            if imputacion.anulada:
                raise _RefuerzoError('La Imputación está anulada: no se puede completar esta Orden de Pago')

            beneficiarios = _op_beneficiarios_guardados(op)
            ups_guardadas = _op_ups_guardadas(op)

            errores = _op_errores_completar(op, beneficiarios, ups_guardadas)
            if errores:
                raise _RefuerzoError(
                    errores[0] if len(errores) == 1
                    else 'No se pudo completar la Orden de Pago: corregí los datos indicados.',
                    400, {'errores': errores},
                )

            # Una UP repetida se agrupa: se valida y se consume una sola vez por el total pedido.
            pedido = {}
            for u in ups_guardadas:
                pedido[u['imputacion_detalle_id']] = pedido.get(u['imputacion_detalle_id'], Decimal('0')) + u['importe']

            detalles = {
                d.id: d for d in
                ImputacionDetalle.objects.select_for_update(of=('self',))
                .select_related('linea_presupuestaria')
                .filter(id__in=list(pedido), imputacion=imputacion).order_by('id')
            }
            if set(pedido) - set(detalles):
                raise _RefuerzoError('Una unidad presupuestaria no pertenece a la Imputación de esta Orden de Pago')

            # Disponibilidad REAL: la misma fórmula que ve el usuario (api_ups_imputacion) y que usa
            # Modificación Modo B → importe imputado − OP ya consumidas − trasladado por Modo B.
            errores = []
            for det_id in sorted(pedido):
                d = detalles[det_id]
                ya_pagado_op = OrdenPagoUnidadPresupuestaria.objects.filter(
                    imputacion_detalle=d
                ).aggregate(total=Sum('importe'))['total'] or Decimal('0')
                ya_trasladado_mod = ModificacionTransferente.objects.filter(
                    imputacion_detalle=d
                ).aggregate(total=Sum('importe'))['total'] or Decimal('0')
                disponible = d.importe - ya_pagado_op - ya_trasladado_mod
                if pedido[det_id] > disponible:
                    errores.append(
                        f'Saldo insuficiente en la UP {d.linea_presupuestaria}. '
                        f'Disponible: ${disponible}, asignado: ${pedido[det_id]}.'
                    )
            if errores:
                raise _RefuerzoError(
                    errores[0] if len(errores) == 1
                    else 'Hay unidades presupuestarias sin saldo suficiente.',
                    400, {'errores': errores},
                )

            importe_total = sum(pedido.values(), Decimal('0'))
            concepto = ' / '.join(l for l in op.concepto.split('\n') if l.strip())

            # ── Cabecera definitiva (la fecha NO se toca) ────────────────────────────
            op.concepto             = concepto          # mismo formato que las OP ya guardadas
            op.importe_total        = importe_total
            op.estado_formulario    = 'LISTO'
            op.usuario_modificacion = request.user      # quien confirma = último editor
            op.version             += 1
            op.save()

            # ── Filas reales: acá recién se consumen los fondos de la Imputación ─────
            for b in beneficiarios:
                OrdenPagoBeneficiario.objects.create(
                    orden_pago           = op,
                    codigo_beneficiario  = b['codigo_beneficiario'],
                    beneficiario         = b['beneficiario'],
                    importe              = b['importe'],
                    usuario_creacion     = request.user,
                    usuario_modificacion = request.user,
                )
            for det_id in sorted(pedido):
                d = detalles[det_id]
                OrdenPagoUnidadPresupuestaria.objects.create(
                    orden_pago           = op,
                    imputacion_detalle   = d,
                    importe              = pedido[det_id],
                    usuario_creacion     = request.user,
                    usuario_modificacion = request.user,
                )
                MovimientoHistorial.objects.create(
                    linea_presupuestaria = d.linea_presupuestaria,
                    tipo                 = 'ORDEN_PAGO',
                    referencia_id        = op.id,
                    usuario              = request.user,
                    monto                = -pedido[det_id],
                    descripcion          = (
                        f'OP {op.nro_orden_pago} — exp. {imputacion.nro_expediente} '
                        f'— {concepto[:80]}'
                    ),
                )

            # Los borradores ya no se necesitan
            op.borradores_beneficiario.all().delete()
            op.borradores_up.all().delete()

            _op_registrar_auditoria(
                op, 'COMPLETAR', request.user,
                detalle={'nro_orden_pago': op.nro_orden_pago, 'importe_total': str(importe_total)},
            )

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al completar la Orden de Pago %s', op_id)
        return JsonResponse({'error': 'Error interno al completar la Orden de Pago'}, status=500)

    # ── NOTIFICACIÓN DE ORDEN DE PAGO ─────────────────────────────────────
    # Se envía recién cuando la OP quedó completada y confirmada en la base (antes se enviaba al
    # crearla de un solo golpe). Un fallo al notificar no deshace ni oculta una OP ya completada.
    try:
        crear_notificaciones_admins(
            titulo="Nueva orden de pago registrada",
            mensaje=f"Expediente: {imputacion.nro_expediente}",
            tipo="orden_pago",
            url=reverse('ordenpago_ver', args=[op.id]),
            realizado_por=request.user.nombre,
        )
    except Exception:
        _logger.exception('No se pudo enviar la notificación de la Orden de Pago %s', op_id)

    return JsonResponse({
        'ok':                True,
        'orden_pago_id':     op.id,
        'importe_total':     str(importe_total),
        'estado_formulario': op.estado_formulario,
        'version':           op.version,
    })


# ==========================================
#  API — ELIMINAR BORRADOR DE OP
# ==========================================
# Solo estado REVISAR. Eliminación FÍSICA: un borrador no tiene OrdenPagoUnidadPresupuestaria,
# ni MovimientoHistorial, ni consume fondos; sus filas de borrador caen en cascada. NO genera
# descuentos, devoluciones ni movimientos. Queda constancia (con una copia del contenido) en
# orden_pago_auditoria, que no tiene FK a la OP justamente para sobrevivir a este borrado.
# Una OP en LISTO nunca se elimina por acá (la vía correcta es la anulación).
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_borrador_eliminar(request, op_id):
    try:
        body = _json_body(request) if request.body else {}

        with transaction.atomic():
            try:
                op = OrdenPago.objects.select_for_update().get(id=op_id)
            except OrdenPago.DoesNotExist:
                raise _RefuerzoError('Orden de Pago no encontrada', 404)

            # Mismo criterio que editar: creador, Administrador o Administrador principal.
            if not puede_editar_op(request.user, op):
                raise _RefuerzoError('No tenés permiso para eliminar esta Orden de Pago', 403)

            if op.estado_formulario != 'REVISAR':
                raise _RefuerzoError(
                    'Solo se pueden eliminar borradores en estado Revisar. '
                    'Una Orden de Pago en estado Listo no se puede eliminar.',
                    409, {'completado': True},
                )

            # La versión es opcional; si el listado la envía, no se borra un borrador que
            # alguien modificó después de cargarlo.
            version_cliente = _version_cliente(body)
            if body.get('version') and version_cliente != op.version:
                editor = op.usuario_modificacion or op.usuario
                raise _RefuerzoError(
                    f'Esta Orden de Pago fue modificada por {editor.nombre if editor else "otro usuario"} '
                    f'después de que cargaste el listado. Actualizá el listado antes de eliminarla; '
                    f'no se eliminó.',
                    409, {'conflicto': True},
                )

            # Defensa: un borrador no debería tener ninguna de estas consecuencias.
            # (Se listan los tipos de OP normal: 'ORDEN_PAGO_PERSONAL*' usa ids de otra tabla.)
            if (
                op.unidades_presupuestarias.exists()
                or op.beneficiarios.exists()
                or MovimientoHistorial.objects.filter(
                    tipo__in=['ORDEN_PAGO', 'ORDEN_PAGO_UP', 'ORDEN_PAGO_ANULACION'],
                    referencia_id=op.id,
                ).exists()
            ):
                raise _RefuerzoError(
                    'Esta Orden de Pago tiene registros presupuestarios asociados y no se puede '
                    'eliminar como borrador.', 409,
                )

            instantanea = _op_datos(op, request.user)
            for clave in ('version', 'puede_editar'):
                instantanea.pop(clave, None)
            instantanea['creado_en'] = op.fecha_creacion.isoformat()
            if op.imputacion_id:
                instantanea['expediente_imputacion'] = op.imputacion.nro_expediente

            _op_registrar_auditoria(
                op, 'ELIMINAR', request.user, {'instantanea': instantanea}, estado='ELIMINADO',
            )
            op.delete()   # borra en cascada los borradores de beneficiarios y de UP

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except ProtectedError:
        return JsonResponse(
            {'error': 'La Orden de Pago tiene registros relacionados y no se puede eliminar.'},
            status=409,
        )
    except Exception:
        _logger.exception('Error al eliminar el borrador de Orden de Pago %s', op_id)
        return JsonResponse({'error': 'Error interno: el borrador NO se eliminó'}, status=500)

    return JsonResponse({'ok': True})


# ==========================================
#  API — HISTORIAL DE INTERVENCIONES DE UNA OP (solo lectura)
# ==========================================
_OP_AUDITORIA_TEXTOS = {
    'CREAR':     'Creó el borrador',
    'EDITAR':    'Editó el borrador',
    'COMPLETAR': 'Confirmó como Listo',
    'ELIMINAR':  'Eliminó el borrador',
}


@rol_requerido('admin', 'adminprincipal')
def api_op_auditoria(request, op_id):
    """Solo lectura (GET): consultar el historial NO genera ningún registro."""
    eventos = list(OrdenPagoAuditoria.objects.filter(orden_pago_id=op_id)
                   .select_related('usuario').order_by('fecha', 'id'))
    op = OrdenPago.objects.select_related('usuario').filter(id=op_id).first()
    if op is None and not eventos:
        return JsonResponse({'error': 'Orden de Pago no encontrada'}, status=404)

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M')

    data = []
    # OP anteriores a la auditoría: se reconstruye la creación desde la propia cabecera
    if op is not None and not any(e.operacion == 'CREAR' for e in eventos):
        data.append({
            'operacion':    'CREAR',
            'texto':        'Creó la Orden de Pago (anterior al registro de auditoría)',
            'usuario':      op.usuario.nombre,
            'fecha':        _fmt(op.fecha_creacion),
            'fecha_ultima': None,
            'cantidad':     1,
            'estado':       None,
            'campos':       [],
        })

    for e in eventos:
        data.append({
            'operacion':    e.operacion,
            'texto':        _OP_AUDITORIA_TEXTOS.get(e.operacion, e.operacion),
            'usuario':      e.usuario.nombre,
            'fecha':        _fmt(e.fecha),
            'fecha_ultima': _fmt(e.fecha_ultima) if e.cantidad > 1 else None,
            'cantidad':     e.cantidad,
            'estado':       e.estado_resultante,
            'campos':       list(e.detalle.get('campos', [])),
        })

    return JsonResponse({'orden_pago_id': op_id, 'eventos': data})


# ==========================================
#  API — IMPUTACIONES CON SALDO POR LÍNEA
#  Para Modo B: dado un linea_id devuelve los
#  ImputacionDetalle con saldo disponible
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_imputaciones_por_linea(request):
    from django.db.models import Sum

    linea_id = request.GET.get('linea_id')
    if not linea_id:
        return JsonResponse({'error': 'Falta linea_id'}, status=400)

    try:
        linea = LineaPresupuestaria.objects.get(id=linea_id)
    except LineaPresupuestaria.DoesNotExist:
        return JsonResponse({'error': 'Línea no encontrada'}, status=404)

    detalles = ImputacionDetalle.objects.filter(
        linea_presupuestaria=linea,
        imputacion__anulada=False,
    ).select_related('imputacion')

    resultado = []
    for d in detalles:
        # Ya pagado en OPs
        ya_pagado_op = OrdenPagoUnidadPresupuestaria.objects.filter(
            imputacion_detalle=d
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        # Ya trasladado en modificaciones anteriores
        ya_trasladado_mod = ModificacionTransferente.objects.filter(
            imputacion_detalle=d
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        saldo_disponible = d.importe - ya_pagado_op - ya_trasladado_mod

        if saldo_disponible <= 0:
            continue

        resultado.append({
            'imputacion_detalle_id': d.id,
            'imputacion_id':         d.imputacion.id,
            'nro_expediente':        d.imputacion.nro_expediente,
            'asiento_nro':           d.imputacion.asiento_nro,
            'fecha':                 d.imputacion.fecha.strftime('%d/%m/%Y'),
            'importe_original':      str(d.importe),
            'ya_pagado':             str(ya_pagado_op),
            'ya_trasladado':         str(ya_trasladado_mod),
            'saldo_disponible':      str(saldo_disponible),
        })

    return JsonResponse({
        'linea_id': linea_id,
        'detalles': resultado,
    })


from .models import CodigoPago  # agregá al bloque de imports

@login_required
def api_codigos_pago(request):
    codigos = CodigoPago.objects.filter(activo=True).values('codigo', 'descripcion')
    return JsonResponse(list(codigos), safe=False)

# ==========================================
#  VISTA — VER IMPUTACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def imputacion_ver(request, imputacion_id):
    import json as _json
    imputacion = get_object_or_404(Imputacion, id=imputacion_id)
    detalles = ImputacionDetalle.objects.filter(imputacion=imputacion).select_related(
        'linea_presupuestaria__programa', 'linea_presupuestaria__proyecto',
        'linea_presupuestaria__actividad_obra', 'linea_presupuestaria__partida',
        'linea_presupuestaria__fuente_financiamiento'
    )
    datos = {
        'id':             imputacion.id,
        'fecha':          imputacion.fecha.strftime('%Y-%m-%d'),
        'nro_expediente': imputacion.nro_expediente,
        'asiento_nro':    imputacion.asiento_nro,
        'detalles': [
            {
                'importe':      str(d.importe),
                'proveedor':    d.proveedor_concepto,
                'programa_id':  d.linea_presupuestaria.programa.id,
                'proyecto_id':  d.linea_presupuestaria.proyecto.id,
                'actividad_id': d.linea_presupuestaria.actividad_obra.id,
                'partida_id':   d.linea_presupuestaria.partida.id,
                'fuente_id':    d.linea_presupuestaria.fuente_financiamiento.id,
            }
            for d in detalles
        ],
    }
    context = {
        'usuario':    request.user,
        'modo':       'ver',
        'imputacion': _json.dumps(datos),
    }
    return render(request, 'dashboards/admin/imputacion.html', context)

# ==========================================
#  API — HISTORIAL DE REGISTROS (auditoría)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_historial_registros(request):
    from django.db.models import Q
    from django.urls import reverse

    registros = []

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M') if dt else ''

    # ── Imputaciones ──────────────────────────────────────────────────────
    imputaciones = Imputacion.objects.select_related(
        'usuario', 'usuario_modificacion'
    ).order_by('-fecha_creacion')

    for imp in imputaciones:
        es_borrador = imp.estado_formulario == 'REVISAR'

        item = {
            'id':                 f'imp-{imp.id}',
            'tipo':               'Imputación',
            'fecha_creacion':     _fmt(imp.fecha_creacion),
            'creado_por':         imp.usuario.nombre if imp.usuario else 'S/N',
            # Solo se actualiza con cambios reales o al confirmar (ver vistas de borrador).
            # Registros antiguos sin usuario_modificacion: se muestra el creador.
            'fecha_modificacion': _fmt(imp.fecha_modificacion or imp.fecha_creacion),
            'modificado_por':     (
                (imp.usuario_modificacion or imp.usuario).nombre
                if (imp.usuario_modificacion or imp.usuario) else 'S/N'
            ),
            'estado':             'Revisar' if es_borrador else 'Listo',
            'referencia_id':      imp.id,
            'nro_expediente':     '' if imp.nro_expediente == 'BORRADOR' else imp.nro_expediente,
            # Clave interna solo para ordenar (se elimina antes de responder)
            '_orden':             imp.fecha_creacion,
        }

        item['url_auditoria'] = reverse('api_imputacion_auditoria', args=[imp.id])

        if es_borrador:
            # Creador, Administrador y Administrador principal pueden retomar y eliminar
            # (los permisos reales se vuelven a verificar en el backend de cada API).
            if puede_editar_imputacion(request.user, imp):
                item['url_editar'] = f"{reverse('imputacion')}?borrador={imp.id}"
            if puede_eliminar_imputacion(request.user, imp):
                item['url_eliminar'] = reverse('api_imputacion_borrador_eliminar', args=[imp.id])
        else:
            item['url_ver'] = f'/admin-dashboard/imputacion/ver/{imp.id}/'

        registros.append(item)

    # ── Órdenes de Pago ───────────────────────────────────────────────────
    ordenes = OrdenPago.objects.select_related(
        'usuario', 'usuario_modificacion', 'imputacion'
    ).order_by('-fecha_creacion')

    for op in ordenes:
        es_borrador = op.estado_formulario == 'REVISAR'

        # "Editado por": último usuario que guardó cambios reales o confirmó el estado Listo.
        # Las OP anteriores al guardado automático no lo tienen cargado y conservan el
        # comportamiento de siempre (creación = última edición).
        if op.usuario_modificacion_id:
            fecha_mod      = _fmt(op.fecha_modificacion)
            modificado_por = op.usuario_modificacion.nombre
        else:
            fecha_mod      = _fmt(op.fecha_creacion)
            modificado_por = op.usuario.nombre if op.usuario else 'S/N'

        item = {
            'id':                    f'op-{op.id}',
            'tipo':                  'Orden de Pago',
            'fecha_creacion':        _fmt(op.fecha_creacion),
            'creado_por':            op.usuario.nombre if op.usuario else 'S/N',
            'fecha_modificacion':    fecha_mod,
            'modificado_por':        modificado_por,
            'estado':                'Revisar' if es_borrador else 'Listo',
            'referencia_id':         op.id,
            'nro_expediente':        op.imputacion.nro_expediente if op.imputacion else 'S/N',
            'url_auditoria':         reverse('api_op_auditoria', args=[op.id]),
            '_orden':                op.fecha_creacion,
        }

        if es_borrador and puede_editar_op(request.user, op):
            # Los permisos reales se vuelven a verificar en el backend de cada API.
            item['url_editar']   = reverse('ordenpago_editar', args=[op.id])
            item['url_eliminar'] = reverse('api_op_borrador_eliminar', args=[op.id])
            item['version']      = op.version

        # Un borrador no tiene detalle definitivo para "ver": se retoma con editar
        if not es_borrador:
            item['url_ver'] = reverse('ordenpago_ver', args=[op.id])

        registros.append(item)

    # ── Órdenes de Pago Personal ──────────────────────────────────────────
    ops_personal = OrdenPagoPersonal.objects.select_related(
        'usuario', 'usuario_modificacion'
    ).order_by('-fecha_creacion')

    for op in ops_personal:
        es_borrador = op.estado_formulario == 'REVISAR'

        # Si fue editada desde el formulario (borrador o completada) se informa quién y cuándo
        # fue la última edición. Las OP Personal anteriores al guardado automático no tienen
        # usuario_modificacion y conservan el comportamiento de siempre.
        if op.usuario_modificacion_id:
            fecha_mod      = _fmt(op.fecha_modificacion) or '--'
            modificado_por = op.usuario_modificacion.nombre
        else:
            fecha_mod      = _fmt(op.fecha_creacion) or '--'
            modificado_por = op.usuario.nombre if op.usuario else 'S/N'

        item = {
            'id':                 f'opp-{op.id}',
            'tipo':               'Orden de Pago Personal',
            'fecha_creacion':     _fmt(op.fecha_creacion) or '--',
            'creado_por':         op.usuario.nombre if op.usuario else 'S/N',
            'fecha_modificacion': fecha_mod,
            'modificado_por':     modificado_por,
            'estado':             'Revisar' if es_borrador else 'Listo',
            'referencia_id':      op.id,
            'nro_expediente':     op.nro_expediente,
            'url_auditoria':      reverse('api_op_personal_auditoria', args=[op.id]),
            '_orden':             op.fecha_creacion,
        }

        if es_borrador:
            # Cualquier admin / adminprincipal puede retomar y eliminar el borrador
            # (el endpoint vuelve a validar rol y estado)
            item['url_editar']   = reverse('ordenpagopersonal_editar', args=[op.id])
            item['url_eliminar'] = reverse('api_op_personal_borrador_eliminar', args=[op.id])
            item['version']      = _version(op)
        else:
            item['url_ver'] = reverse('ordenpagopersonal_ver', args=[op.id])

        registros.append(item)

    # ── Modificaciones ────────────────────────────────────────────────────
    modificaciones = Modificacion.objects.select_related(
        'usuario', 'usuario_modificacion'
    ).order_by('-fecha_creacion')

    for mod in modificaciones:
        es_borrador = mod.estado_formulario == 'REVISAR'

        # "Editado por" es el último usuario que guardó cambios reales o confirmó el estado
        # Listo (usuario_modificacion). Las modificaciones anteriores al guardado automático no
        # lo tienen cargado y conservan el comportamiento de siempre (creación = última edición).
        # "Creado por" es siempre el usuario original.
        if mod.usuario_modificacion_id:
            fecha_mod      = _fmt(mod.fecha_modificacion)
            modificado_por = mod.usuario_modificacion.nombre
        else:
            fecha_mod      = _fmt(mod.fecha_creacion)
            modificado_por = mod.usuario.nombre if mod.usuario else 'S/N'

        item = {
            'id':                 f'mod-{mod.id}',
            'tipo':               'Modificación',
            'fecha_creacion':     _fmt(mod.fecha_creacion),
            'creado_por':         mod.usuario.nombre if mod.usuario else 'S/N',
            'fecha_modificacion': fecha_mod,
            'modificado_por':     modificado_por,
            'estado':             'Revisar' if es_borrador else 'Listo',
            'referencia_id':      mod.id,
            'nro_expediente':     '' if mod.nro_expediente == MODIFICACION_EXPEDIENTE_PLACEHOLDER else mod.nro_expediente,
            '_orden':             mod.fecha_creacion,
        }

        item['url_auditoria'] = reverse('api_modificacion_auditoria', args=[mod.id])
        if es_borrador:
            # Cualquier admin / adminprincipal puede retomar y eliminar el borrador
            # (el endpoint vuelve a validar rol y estado)
            item['url_editar']   = reverse('modificacion_editar', args=[mod.id])
            item['url_eliminar'] = reverse('api_modificacion_borrador_eliminar', args=[mod.id])
            item['version']      = _version(mod)
        else:
            item['url_ver'] = f'/modificacion/ver/{mod.id}/'

        registros.append(item)

    # ── Refuerzos ─────────────────────────────────────────────────────────
    refuerzos = Refuerzo.objects.select_related(
        'usuario', 'usuario_modificacion'
    ).order_by('-fecha_creacion')

    for ref in refuerzos:
        es_borrador = ref.estado_formulario == 'REVISAR'

        # Si el registro fue editado desde el formulario (borrador o completado) se informa
        # quién y cuándo fue la última edición. Los Refuerzos anteriores al guardado
        # automático no tienen usuario_modificacion y conservan el comportamiento de siempre.
        if ref.usuario_modificacion_id:
            fecha_mod      = _fmt(ref.fecha_modificacion)
            modificado_por = ref.usuario_modificacion.nombre
        else:
            fecha_mod      = _fmt(ref.fecha_creacion)
            modificado_por = ref.usuario.nombre if ref.usuario else 'S/N'

        item = {
            'id':                 f'ref-{ref.id}',
            'tipo':               'Refuerzo',
            'fecha_creacion':     _fmt(ref.fecha_creacion),
            'creado_por':         ref.usuario.nombre if ref.usuario else 'S/N',
            'fecha_modificacion': fecha_mod,
            'modificado_por':     modificado_por,
            'estado':             'Revisar' if es_borrador else 'Listo',
            'referencia_id':      ref.id,
            'nro_expediente':     '' if ref.nro_expediente == REFUERZO_EXPEDIENTE_PLACEHOLDER else ref.nro_expediente,
            '_orden':             ref.fecha_creacion,
        }

        item['url_auditoria'] = reverse('api_refuerzo_auditoria', args=[ref.id])
        if es_borrador:
            # Cualquier admin / adminprincipal puede retomar el borrador
            item['url_editar'] = reverse('refuerzo_editar', args=[ref.id])
            # Eliminar: solo borradores y solo roles autorizados (el endpoint lo vuelve a validar)
            if _puede_gestionar_refuerzo(request.user):
                item['url_eliminar'] = reverse('api_refuerzo_borrador_eliminar', args=[ref.id])
                item['version']      = _version(ref)
        else:
            item['url_ver'] = f'/refuerzo/ver/{ref.id}/'

        registros.append(item)

    # ── Orden final ───────────────────────────────────────────────────────
    # Se ordena por la fecha REAL (datetime), no por el texto formateado
    # 'dd/mm/YYYY - HH:MM', que comparado como string ordena por día primero
    # y mezcla meses (ej: 24/10 quedaba "más nuevo" que 11/11).
    # Los registros sin fecha (None) quedan al final.
    registros.sort(
        key=lambda x: x['_orden'].timestamp() if x['_orden'] else 0,
        reverse=True,
    )

    # La clave interna no se envía al frontend
    for r in registros:
        r.pop('_orden', None)

    return JsonResponse({'registros': registros})

def ejerciciosanteriores_prueba(request):
    return render(
        request,
        'dashboards/admin/ejerciciosanteriores.html'
    )
    import json

from django.http import JsonResponse
from django.views.decorators.http import require_POST


@require_POST
def api_editar_monto_linea(request, linea_id):
    try:
        body = json.loads(request.body)
        monto = float(body.get('saldo_inicial'))
        if monto < 0:
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Monto inválido.'}, status=400)

    try:
        linea = LineaPresupuestaria.objects.get(id=linea_id)
    except LineaPresupuestaria.DoesNotExist:
        return JsonResponse({'error': 'Línea no encontrada.'}, status=404)

    linea.saldo_inicial = monto
    linea.save()
    return JsonResponse({'mensaje': 'Monto actualizado.'})


@require_POST
def api_eliminar_linea(request, linea_id):
    try:
        linea = LineaPresupuestaria.objects.get(id=linea_id)
    except LineaPresupuestaria.DoesNotExist:
        return JsonResponse({'error': 'Línea no encontrada.'}, status=404)

    try:
        linea.delete()
    except Exception:
        return JsonResponse(
            {'error': 'No se puede eliminar: tiene movimientos asociados.'},
            status=400
        )
    return JsonResponse({'mensaje': 'Partida eliminada.'})


# ==========================================
#  ORDEN DE PAGO PERSONAL — GUARDADO AUTOMÁTICO (BORRADOR "REVISAR") Y COMPLETADO
# ==========================================
# Una OP Personal en estado REVISAR es solo información guardada: su cabecera vive en
# orden_pago_personal, sus beneficiarios en orden_pago_personal_beneficiario (sin efecto
# presupuestario) y sus erogaciones en OrdenPagoPersonalBorradorPartida, una tabla sin
# triggers. Por eso un borrador NUNCA genera imputaciones, movimientos ni descuenta saldos.
#
# Todo lo presupuestario ocurre en api_op_personal_completar (REVISAR → LISTO), dentro de
# una única transacción: se crean la Imputación y sus detalles; el trigger
# trg_imputacion_detalle_movimiento descuenta saldo_actual y registra el movimiento por línea
# al insertar cada ImputacionDetalle, por eso acá NO se toca saldo_actual (igual que en
# api_imputacion_completar). Si algo falla, el rollback deja la OP Personal en REVISAR y sin
# imputación. Además, los CHECK de PostgreSQL impiden que un borrador tenga imputación o que
# una OP Personal LISTO no la tenga.

OPP_ROLES_EDICION       = ('admin', 'adminprincipal')
OPP_MAX_FILAS_BORRADOR  = 200
OPP_LOCK_ASIENTO        = 7410021   # clave del advisory lock que serializa el N° de asiento


# ── Permisos ──────────────────────────────────────────────────────────────────
def _puede_editar_opp(user, opp):
    """Editar = rol autorizado Y OP Personal en REVISAR. Se comprueba en el servidor en
    cada API de escritura; los botones del frontend son solo comodidad visual."""
    return (
        user.is_authenticated
        and getattr(user, 'rol', None) in OPP_ROLES_EDICION
        and opp.estado_formulario == 'REVISAR'
    )


def _obtener_opp_bloqueada(user, opp_id):
    """Bloquea la fila (debe llamarse dentro de transaction.atomic()). El bloqueo serializa
    guardados simultáneos y evita que dos pedidos completen la misma OP Personal a la vez."""
    try:
        opp = OrdenPagoPersonal.objects.select_for_update().get(id=opp_id)
    except OrdenPagoPersonal.DoesNotExist:
        raise _RefuerzoError('OP Personal no encontrada', 404)
    if getattr(user, 'rol', None) not in OPP_ROLES_EDICION:
        raise _RefuerzoError('No tenés permiso para editar esta OP Personal', 403)
    if not _puede_editar_opp(user, opp):
        raise _RefuerzoError(
            'Esta OP Personal ya fue completada y no se puede modificar desde el formulario',
            409, {'completado': True},
        )
    return opp


# ── Lectura / validación parcial del cuerpo (acepta datos incompletos) ───────
def _opp_importe(valor, etiqueta):
    num = _decimal_o_none(valor, etiqueta)
    if num is not None and num < 0:
        raise _RefuerzoError(f'{etiqueta}: el importe no puede ser negativo')
    return num


def _opp_cabecera(body):
    def texto(clave, maximo, etiqueta):
        valor = str(body.get(clave) or '').strip()
        if len(valor) > maximo:
            raise _RefuerzoError(f'{etiqueta} supera los {maximo} caracteres permitidos')
        return valor

    fecha = None
    valor = body.get('fecha')
    if valor:
        try:
            fecha = date.fromisoformat(str(valor))
        except ValueError:
            fecha = None

    importe_op = _opp_importe(body.get('importe_op'), 'Importe O.P.')
    return {
        'nro_orden_pago':   texto('nro_orden_pago', 50, 'El número de orden de pago'),
        'nro_expediente':   texto('nro_expediente', 50, 'El número de expediente'),
        'u_presupuestaria': texto('u_presupuestaria', 30, 'La unidad presupuestaria'),
        'codigo':           texto('codigo', 20, 'El código del concepto'),
        'concepto':         texto('concepto', 2000, 'El concepto'),
        'observaciones':    texto('observaciones', 20000, 'Las observaciones'),
        'fecha':            fecha,
        'importe_total':    importe_op if importe_op is not None else Decimal('0.00'),
    }


def _opp_beneficiarios(body):
    lista = body.get('beneficiarios', [])
    if not isinstance(lista, list):
        raise _RefuerzoError('La nómina de beneficiarios es inválida')
    if len(lista) > OPP_MAX_FILAS_BORRADOR:
        raise _RefuerzoError(f'No puede haber más de {OPP_MAX_FILAS_BORRADOR} beneficiarios')

    filas = []
    for i, b in enumerate(lista):
        if not isinstance(b, dict):
            raise _RefuerzoError('La nómina de beneficiarios es inválida')
        codigo = str(b.get('codigo') or '').strip()
        nomina = str(b.get('nomina') or '').strip()
        if len(codigo) > 20:
            raise _RefuerzoError(f'Beneficiario {i + 1}: el código supera los 20 caracteres permitidos')
        if len(nomina) > 1000:
            raise _RefuerzoError(f'Beneficiario {i + 1}: el nombre supera los 1000 caracteres permitidos')
        parcial = _opp_importe(b.get('importe_parcial'), f'Beneficiario {i + 1}')
        if not codigo and not nomina and parcial is None:
            continue   # fila vacía: no se guarda
        filas.append({'codigo': codigo, 'nomina': nomina, 'importe_parcial': parcial})
    return filas


def _opp_erogaciones(body):
    lista = body.get('erogaciones', [])
    if not isinstance(lista, list):
        raise _RefuerzoError('El detalle de erogaciones es inválido')
    if len(lista) > OPP_MAX_FILAS_BORRADOR:
        raise _RefuerzoError(f'No puede haber más de {OPP_MAX_FILAS_BORRADOR} erogaciones')

    filas = []
    for i, d in enumerate(lista):
        if not isinstance(d, dict):
            raise _RefuerzoError('El detalle de erogaciones es inválido')
        filas.append({
            'linea_id':     _entero_o_none(d.get('linea_id')),
            'programa_id':  _entero_o_none(d.get('programa_id')),
            'proyecto_id':  _entero_o_none(d.get('proyecto_id')),
            'actividad_id': _entero_o_none(d.get('actividad_id')),
            'partida_id':   _entero_o_none(d.get('partida_id')),
            'fuente_id':    _entero_o_none(d.get('fuente_id')),
            'importe':      _opp_importe(d.get('importe'), f'Erogación {i + 1}'),
            'orden':        i,
        })

    # Un linea_id que ya no existe no debe romper el guardado parcial: se descarta.
    ids = {f['linea_id'] for f in filas if f['linea_id']}
    if ids:
        existentes = set(LineaPresupuestaria.objects.filter(id__in=ids).values_list('id', flat=True))
        for f in filas:
            if f['linea_id'] and f['linea_id'] not in existentes:
                f['linea_id'] = None
    return filas


def _opp_clave(body):
    valor = body.get('clave_idempotencia')
    if not valor:
        return None
    try:
        return uuid.UUID(str(valor))
    except ValueError:
        raise _RefuerzoError('La clave de idempotencia es inválida')


# ── Escritura del borrador ────────────────────────────────────────────────────
def _opp_asignar_cabecera(opp, cab):
    opp.nro_orden_pago    = cab['nro_orden_pago']
    opp.nro_expediente    = cab['nro_expediente']
    opp.u_presupuestaria  = cab['u_presupuestaria']
    opp.codigo            = cab['codigo']
    opp.concepto          = cab['concepto']
    opp.observaciones     = cab['observaciones']
    opp.fecha             = cab['fecha']
    opp.importe_total     = cab['importe_total']


def _opp_reemplazar_filas(opp, beneficiarios, erogaciones, user):
    """Reemplaza por completo beneficiarios y erogaciones del borrador (dentro de una
    transacción). Ninguna de estas dos tablas tiene triggers presupuestarios."""
    opp.beneficiarios.all().delete()
    OrdenPagoPersonalBeneficiario.objects.bulk_create([
        OrdenPagoPersonalBeneficiario(
            orden_pago_personal  = opp,
            codigo               = f['codigo'],
            nomina_beneficiarios = f['nomina'],
            importe_parcial      = f['importe_parcial'] if f['importe_parcial'] is not None else Decimal('0.00'),
            importe_total        = f['importe_parcial'] if f['importe_parcial'] is not None else Decimal('0.00'),
            usuario_creacion     = user,
            usuario_modificacion = user,
        )
        for f in beneficiarios
    ])

    opp.borradores_partida.all().delete()
    OrdenPagoPersonalBorradorPartida.objects.bulk_create([
        OrdenPagoPersonalBorradorPartida(
            orden_pago_personal     = opp,
            linea_presupuestaria_id = f['linea_id'],
            programa_id             = f['programa_id'],
            proyecto_id             = f['proyecto_id'],
            actividad_id            = f['actividad_id'],
            partida_id              = f['partida_id'],
            fuente_id               = f['fuente_id'],
            importe                 = f['importe'],
            orden                   = f['orden'],
        )
        for f in erogaciones
    ])


def _opp_contenido_igual(opp, cab, beneficiarios, erogaciones):
    """True si lo recibido es idéntico a lo ya guardado. Así un guardado sin cambios reales
    no toca la fila: no cambia 'Editado por' ni la fecha de modificación."""
    actual_cab = (
        opp.nro_orden_pago, opp.nro_expediente, opp.u_presupuestaria, opp.codigo,
        opp.concepto, opp.observaciones, opp.fecha, opp.importe_total,
    )
    nueva_cab = (
        cab['nro_orden_pago'], cab['nro_expediente'], cab['u_presupuestaria'], cab['codigo'],
        cab['concepto'], cab['observaciones'], cab['fecha'], cab['importe_total'],
    )
    if actual_cab != nueva_cab:
        return False

    cero = Decimal('0.00')
    actual_ben = [
        (b.codigo, b.nomina_beneficiarios, b.importe_parcial)
        for b in opp.beneficiarios.order_by('id')
    ]
    nueva_ben = [
        (f['codigo'], f['nomina'], f['importe_parcial'] if f['importe_parcial'] is not None else cero)
        for f in beneficiarios
    ]
    if actual_ben != nueva_ben:
        return False

    actual_ero = [
        (b.linea_presupuestaria_id, b.programa_id, b.proyecto_id, b.actividad_id,
         b.partida_id, b.fuente_id, b.importe)
        for b in opp.borradores_partida.order_by('orden')
    ]
    nueva_ero = [
        (f['linea_id'], f['programa_id'], f['proyecto_id'], f['actividad_id'],
         f['partida_id'], f['fuente_id'], f['importe'])
        for f in erogaciones
    ]
    return actual_ero == nueva_ero


# ── Auditoría de OP Personal (historial de intervenciones) ────────────────────
OPP_AUDITORIA_VENTANA = REFUERZO_AUDITORIA_VENTANA


def _registrar_auditoria_opp(opp, operacion, usuario, detalle=None, agrupar=False, estado=None):
    """Registra una intervención real sobre la OP Personal. Se llama DENTRO de la transacción
    y con la fila bloqueada. Solo escribe en orden_pago_personal_auditoria: no toca el presupuesto."""
    ahora   = timezone.now()
    detalle = detalle or {}

    if agrupar:
        ultima = OrdenPagoPersonalAuditoria.objects.filter(
            orden_pago_personal_id=opp.id).order_by('-id').first()
        if (ultima is not None and ultima.operacion == 'EDITAR'
                and ultima.usuario_id == usuario.id
                and ahora - ultima.fecha_ultima <= OPP_AUDITORIA_VENTANA):
            campos = sorted(set(ultima.detalle.get('campos', [])) | set(detalle.get('campos', [])))
            ultima.detalle      = {'campos': campos}
            ultima.fecha_ultima = ahora
            ultima.cantidad    += 1
            ultima.save(update_fields=['detalle', 'fecha_ultima', 'cantidad'])
            return ultima

    return OrdenPagoPersonalAuditoria.objects.create(
        orden_pago_personal_id = opp.id,
        operacion              = operacion,
        usuario                = usuario,
        fecha                  = ahora,
        fecha_ultima           = ahora,
        estado_resultante      = estado or opp.estado_formulario,
        detalle                = detalle,
    )


def _opp_campos_modificados(opp, cab, beneficiarios, erogaciones):
    """Lista de campos que REALMENTE cambiarían al aplicar lo recibido. Vacía = nada que
    guardar (equivale a _opp_contenido_igual, pero además dice QUÉ cambió)."""
    campos = []
    for nombre in ('nro_orden_pago', 'nro_expediente', 'u_presupuestaria', 'codigo',
                   'concepto', 'observaciones', 'fecha', 'importe_total'):
        if getattr(opp, nombre) != cab[nombre]:
            campos.append(nombre)

    cero = Decimal('0.00')
    actual_ben = [
        (b.codigo, b.nomina_beneficiarios, b.importe_parcial)
        for b in opp.beneficiarios.order_by('id')
    ]
    nueva_ben = [
        (f['codigo'], f['nomina'], f['importe_parcial'] if f['importe_parcial'] is not None else cero)
        for f in beneficiarios
    ]
    if actual_ben != nueva_ben:
        campos.append('beneficiarios')

    actual_ero = [
        (b.linea_presupuestaria_id, b.programa_id, b.proyecto_id, b.actividad_id,
         b.partida_id, b.fuente_id, b.importe)
        for b in opp.borradores_partida.order_by('orden')
    ]
    nueva_ero = [
        (f['linea_id'], f['programa_id'], f['proyecto_id'], f['actividad_id'],
         f['partida_id'], f['fuente_id'], f['importe'])
        for f in erogaciones
    ]
    if actual_ero != nueva_ero:
        campos.append('erogaciones')
    return campos


# ── Datos para repoblar el formulario (misma forma que arma el JS al guardar) ─
def _opp_datos(opp):
    beneficiarios = [
        {
            'codigo':          b.codigo,
            'nomina':          b.nomina_beneficiarios,
            'importe_parcial': str(b.importe_parcial) if b.importe_parcial else None,
        }
        for b in opp.beneficiarios.order_by('id')
    ]

    if opp.estado_formulario == 'REVISAR':
        erogaciones = [
            {
                'linea_id':     b.linea_presupuestaria_id,
                'programa_id':  b.programa_id,
                'proyecto_id':  b.proyecto_id,
                'actividad_id': b.actividad_id,
                'partida_id':   b.partida_id,
                'fuente_id':    b.fuente_id,
                'importe':      str(b.importe) if b.importe is not None else None,
            }
            for b in opp.borradores_partida.order_by('orden')
        ]
    else:
        partidas = opp.partidas.select_related('linea_presupuestaria__fuente_financiamiento').order_by('id')
        erogaciones = [
            {
                'linea_id':     p.linea_presupuestaria_id,
                'programa_id':  p.linea_presupuestaria.programa_id,
                'proyecto_id':  p.linea_presupuestaria.proyecto_id,
                'actividad_id': p.linea_presupuestaria.actividad_obra_id,
                'partida_id':   p.linea_presupuestaria.partida_id,
                'fuente_id':    p.linea_presupuestaria.fuente_financiamiento_id,
                'importe':      str(p.importe),
                'descripcion':  p.descripcion,
                'fuente':       (
                    f'{p.linea_presupuestaria.fuente_financiamiento.codigo} - '
                    f'{p.linea_presupuestaria.fuente_financiamiento.nombre}'
                ),
            }
            for p in partidas
        ]

    return {
        'id':               opp.id,
        'estado':           opp.estado_formulario,
        'version':          _version(opp),
        'nro_orden_pago':   opp.nro_orden_pago,
        'nro_expediente':   opp.nro_expediente,
        'u_presupuestaria': opp.u_presupuestaria,
        'fecha':            opp.fecha.strftime('%Y-%m-%d') if opp.fecha else None,
        'importe_op':       str(opp.importe_total) if opp.importe_total else None,
        'codigo':           opp.codigo,
        'concepto':         opp.concepto,
        'observaciones':    opp.observaciones,
        'asiento_nro':      opp.imputacion.asiento_nro if opp.imputacion_id else None,
        'beneficiarios':    beneficiarios,
        'erogaciones':      erogaciones,
    }


def _inicial_usuario(usuario):
    nombre = (getattr(usuario, 'nombre', '') or '').strip()
    return nombre[:1].upper()


# ==========================================
#  PÁGINAS — RETOMAR (EDITAR) Y CONSULTAR (VER) UNA OP PERSONAL
# ==========================================
# Son solo lectura sobre la base: abrir una OP Personal nunca escribe nada (ni "Editado por").
@rol_requerido('admin', 'adminprincipal')
def ordenpagopersonal_editar(request, opp_id):
    opp = get_object_or_404(OrdenPagoPersonal.objects.select_related('usuario', 'imputacion'), id=opp_id)

    if not _puede_editar_opp(request.user, opp):
        return redirect('ordenpagopersonal_ver', opp_id=opp.id)

    context = {
        'usuario':    request.user,
        'modo':       'editar',
        'opp_datos':  _json_para_script(_opp_datos(opp)),
        'inicial_cr': _inicial_usuario(opp.usuario),
    }
    return render(request, 'dashboards/admin/ordenpagopersonal.html', context)


@rol_requerido('admin', 'adminprincipal')
def ordenpagopersonal_ver(request, opp_id):
    opp = get_object_or_404(OrdenPagoPersonal.objects.select_related('usuario', 'imputacion'), id=opp_id)

    if opp.estado_formulario == 'REVISAR':
        return redirect('ordenpagopersonal_editar', opp_id=opp.id)

    context = {
        'usuario':    request.user,
        'modo':       'ver',
        'opp_datos':  _json_para_script(_opp_datos(opp)),
        'inicial_cr': _inicial_usuario(opp.usuario),
    }
    return render(request, 'dashboards/admin/ordenpagopersonal.html', context)


# ==========================================
#  API — CREAR BORRADOR DE OP PERSONAL (primer guardado automático)
# ==========================================
def _opp_respuesta_existente(opp):
    if opp.estado_formulario != 'REVISAR':
        raise _RefuerzoError(
            'Esta OP Personal ya fue completada y no se puede modificar desde el formulario',
            409, {'completado': True},
        )
    return JsonResponse({
        'ok':         True,
        'opp_id':     opp.id,
        'version':    _version(opp),
        'existente':  True,   # el cliente debe reenviar su contenido como actualización
        'url_editar': reverse('ordenpagopersonal_editar', args=[opp.id]),
    })


@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_personal_borrador_crear(request):
    try:
        body          = _json_body(request)
        clave         = _opp_clave(body)
        cab           = _opp_cabecera(body)
        beneficiarios = _opp_beneficiarios(body)
        erogaciones   = _opp_erogaciones(body)

        # Reintento de un primer guardado cuya respuesta se perdió: mismo borrador, sin duplicar.
        if clave:
            existente = OrdenPagoPersonal.objects.filter(clave_idempotencia=clave).first()
            if existente:
                return _opp_respuesta_existente(existente)

        try:
            with transaction.atomic():
                opp = OrdenPagoPersonal(
                    usuario              = request.user,   # creador: no se reasigna nunca
                    usuario_modificacion = request.user,
                    estado_formulario    = 'REVISAR',
                    imputacion           = None,
                    clave_idempotencia   = clave,
                )
                _opp_asignar_cabecera(opp, cab)
                opp.save()
                _opp_reemplazar_filas(opp, beneficiarios, erogaciones, request.user)
                _registrar_auditoria_opp(opp, 'CREAR', request.user)
        except IntegrityError:
            # Dos pedidos simultáneos con la misma clave: gana el primero.
            existente = (
                OrdenPagoPersonal.objects.filter(clave_idempotencia=clave).first() if clave else None
            )
            if existente:
                return _opp_respuesta_existente(existente)
            raise

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al crear el borrador de OP Personal')
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({
        'ok':         True,
        'opp_id':     opp.id,
        'version':    _version(opp),
        'url_editar': reverse('ordenpagopersonal_editar', args=[opp.id]),
    })


# ==========================================
#  API — ACTUALIZAR BORRADOR DE OP PERSONAL (guardado automático)
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_personal_borrador_actualizar(request, opp_id):
    try:
        body          = _json_body(request)
        cab           = _opp_cabecera(body)
        beneficiarios = _opp_beneficiarios(body)
        erogaciones   = _opp_erogaciones(body)

        with transaction.atomic():
            opp = _obtener_opp_bloqueada(request.user, opp_id)

            # Sin cambios reales: no se escribe nada, así "Editado por" no se altera.
            campos = _opp_campos_modificados(opp, cab, beneficiarios, erogaciones)
            if not campos:
                return JsonResponse({'ok': True, 'version': _version(opp), 'sin_cambios': True})

            _verificar_version(opp, body.get('version'))

            _opp_asignar_cabecera(opp, cab)
            opp.usuario_modificacion = request.user
            # auto_now solo se aplica a los campos incluidos en update_fields.
            opp.save(update_fields=[
                'nro_orden_pago', 'nro_expediente', 'u_presupuestaria', 'codigo', 'concepto',
                'observaciones', 'fecha', 'importe_total',
                'usuario_modificacion', 'fecha_modificacion',
            ])
            _opp_reemplazar_filas(opp, beneficiarios, erogaciones, request.user)
            _registrar_auditoria_opp(opp, 'EDITAR', request.user, {'campos': campos}, agrupar=True)

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al actualizar el borrador de OP Personal %s', opp_id)
        return JsonResponse({'error': 'Error interno al guardar el borrador'}, status=500)

    return JsonResponse({'ok': True, 'version': _version(opp)})


# ==========================================
#  API — COMPLETAR OP PERSONAL (REVISAR → LISTO)
# ==========================================
# ÚNICO camino a LISTO y ÚNICO punto donde se generan las imputaciones. El servidor
# confirma lo que está guardado en la base (no lo que llegue en el cuerpo): el cliente solo
# envía la versión que vio. Los saldos y movimientos por línea los resuelve el trigger de
# imputacion_detalle, por eso acá NO se modifica saldo_actual.
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_personal_completar(request, opp_id):
    from django.db.models import Max

    try:
        body = _json_body(request)

        with transaction.atomic():
            # Una segunda confirmación (doble clic, reintento) espera este bloqueo, ve
            # estado LISTO y recibe 409: no puede generar imputaciones duplicadas.
            opp = _obtener_opp_bloqueada(request.user, opp_id)
            _verificar_version(opp, body.get('version'))

            beneficiarios = list(opp.beneficiarios.order_by('id'))
            borradores    = list(opp.borradores_partida.order_by('orden'))

            # ── Validación definitiva ─────────────────────────────────────
            faltan = []
            if not opp.nro_orden_pago.strip(): faltan.append('el número de orden de pago')
            if not opp.nro_expediente.strip(): faltan.append('el expediente')
            if not opp.fecha:                  faltan.append('la fecha')
            if not opp.concepto.strip():       faltan.append('el concepto')
            if faltan:
                raise _RefuerzoError('Falta completar: ' + ', '.join(faltan))

            if not beneficiarios:
                raise _RefuerzoError('Debe incluir al menos un beneficiario')
            if not borradores:
                raise _RefuerzoError('Debe incluir al menos una erogación')

            total_beneficiarios = sum(
                (b.importe_parcial or Decimal('0')) for b in beneficiarios
            )

            fila_de_linea = {}
            total_erogaciones = Decimal('0')
            for n, b in enumerate(borradores, start=1):
                if not b.linea_presupuestaria_id:
                    raise _RefuerzoError(
                        f'Erogación {n}: falta completar la línea presupuestaria (programa, '
                        f'proyecto, actividad, partida y, si corresponde, la fuente de financiamiento)'
                    )
                if b.importe is None or b.importe <= 0:
                    raise _RefuerzoError(f'Erogación {n}: el importe debe ser mayor a cero')
                if b.linea_presupuestaria_id in fila_de_linea:
                    raise _RefuerzoError(
                        f'Erogación {n}: la línea presupuestaria está repetida (ya figura en la '
                        f'erogación {fila_de_linea[b.linea_presupuestaria_id]}). Cada línea solo '
                        f'puede aparecer una vez'
                    )
                fila_de_linea[b.linea_presupuestaria_id] = n
                total_erogaciones += b.importe

            if total_beneficiarios != total_erogaciones:
                raise _RefuerzoError(
                    f'El total de beneficiarios (${total_beneficiarios}) no coincide con el '
                    f'total de erogaciones (${total_erogaciones})'
                )
            if not opp.importe_total or opp.importe_total <= 0:
                raise _RefuerzoError('El Importe O.P. es obligatorio y debe ser mayor a cero')
            if opp.importe_total != total_erogaciones:
                raise _RefuerzoError(
                    f'El Importe O.P. (${opp.importe_total}) no coincide con el total de '
                    f'erogaciones (${total_erogaciones})'
                )

            # Bloquear las líneas (siempre ordenadas por id para no generar interbloqueos)
            ids_lineas = sorted(fila_de_linea)
            lineas = {
                l.id: l for l in
                LineaPresupuestaria.objects.select_for_update(of=('self',))
                .select_related('partida')
                .filter(id__in=ids_lineas).order_by('id')
            }
            if len(lineas) != len(ids_lineas):
                raise _RefuerzoError('Alguna de las líneas presupuestarias ya no existe')

            for n, b in enumerate(borradores, start=1):
                linea = lineas[b.linea_presupuestaria_id]
                elegida  = (b.programa_id, b.proyecto_id, b.actividad_id, b.partida_id, b.fuente_id)
                esperada = (linea.programa_id, linea.proyecto_id, linea.actividad_obra_id,
                            linea.partida_id, linea.fuente_financiamiento_id)
                if elegida != esperada:
                    raise _RefuerzoError(
                        f'Erogación {n}: la línea presupuestaria no coincide con el programa, '
                        f'proyecto, actividad, partida y fuente seleccionados. Volvé a elegirlos'
                    )
                if linea.saldo_actual < b.importe:
                    raise _RefuerzoError(
                        f'Saldo insuficiente en línea {linea.id}. '
                        f'Disponible: ${linea.saldo_actual}, requerido: ${b.importe}'
                    )

            # ── Número de asiento: el advisory lock evita que dos confirmaciones
            #    simultáneas calculen el mismo número ────────────────────────────
            with connection.cursor() as cur:
                cur.execute('SELECT pg_advisory_xact_lock(%s, %s)', [OPP_LOCK_ASIENTO, opp.fecha.year])

            ultimo = Imputacion.objects.filter(
                fecha__year=opp.fecha.year,
                estado_formulario='LISTO',
            ).aggregate(Max('asiento_nro'))['asiento_nro__max']
            try:
                asiento_nro = str(int(ultimo) + 1).zfill(4) if ultimo else '0001'
            except (ValueError, TypeError):
                asiento_nro = '0001'

            # ── Imputación automática ─────────────────────────────────────
            imputacion = Imputacion.objects.create(
                nro_expediente       = opp.nro_expediente,
                asiento_nro          = asiento_nro,
                fecha                = opp.fecha,
                origen               = 'AUTOMATICA',
                observacion          = f'Generada automáticamente por OP Personal {opp.nro_orden_pago}',
                usuario              = request.user,
                usuario_modificacion = request.user,
                estado_formulario    = 'LISTO',
            )

            # ── Detalles de imputación (el trigger descuenta saldo y registra el movimiento
            #    IMPUTACION) y partidas reales de la OP Personal ────────────────────────
            for b in borradores:
                linea       = lineas[b.linea_presupuestaria_id]
                descripcion = linea.partida.denominacion[:300]

                det = ImputacionDetalle.objects.create(
                    imputacion           = imputacion,
                    linea_presupuestaria = linea,
                    proveedor_concepto   = descripcion,
                    importe              = b.importe,
                    usuario_creacion     = request.user,
                    usuario_modificacion = request.user,
                )

                OrdenPagoPersonalPartida.objects.create(
                    orden_pago_personal  = opp,
                    linea_presupuestaria = linea,
                    descripcion          = descripcion,
                    importe              = b.importe,
                    imputacion_detalle   = det,
                    usuario_creacion     = request.user,
                    usuario_modificacion = request.user,
                )

                MovimientoHistorial.objects.create(
                    linea_presupuestaria = linea,
                    tipo                 = 'ORDEN_PAGO_PERSONAL',
                    referencia_id        = opp.id,
                    usuario              = request.user,
                    monto                = -b.importe,
                    descripcion          = (
                        f'OP Personal {opp.nro_orden_pago} — '
                        f'exp. {opp.nro_expediente} — '
                        f'{descripcion[:80]}'
                    ),
                )

            # ── Pasa a LISTO: imputación y estado en un solo UPDATE (lo exigen los CHECK) ──
            opp.importe_total         = total_erogaciones
            opp.imputacion            = imputacion
            opp.estado_formulario     = 'LISTO'
            opp.usuario_modificacion  = request.user
            opp.save()

            # El borrador de erogaciones ya no hace falta
            opp.borradores_partida.all().delete()

            _registrar_auditoria_opp(opp, 'COMPLETAR', request.user,
                                     {'imputacion_id': imputacion.id}, estado='LISTO')

            # ── NOTIFICACIÓN DE ORDEN DE PAGO PERSONAL ─────────────────
            crear_notificaciones_admins(
                titulo="Nueva orden de pago personal registrada",
                mensaje=(
                    f"Expediente: {opp.nro_expediente}"
                ),
                tipo="orden_pago_personal",
                url="/admin-dashboard/",
                realizado_por=request.user.nombre
            )

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except Exception:
        _logger.exception('Error al completar la OP Personal %s', opp_id)
        return JsonResponse({'error': 'Error interno: la OP Personal NO se completó'}, status=500)

    return JsonResponse({
        'ok':            True,
        'opp_id':        opp.id,
        'imputacion_id': imputacion.id,
        'asiento_nro':   asiento_nro,
        'importe_total': str(total_erogaciones),
        'version':       _version(opp),
        'url_ver':       reverse('ordenpagopersonal_ver', args=[opp.id]),
    })


# ==========================================
#  API — ELIMINAR BORRADOR DE OP PERSONAL (solo estado REVISAR)
# ==========================================
# Eliminación FÍSICA: un borrador nunca tiene imputación (CHECK opp_revisar_sin_imputacion),
# ni partidas reales, ni movimientos; sus beneficiarios y borradores de partida caen en
# cascada. NO modifica saldos. Queda una fila en orden_pago_personal_auditoria (sin FK).
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_op_personal_borrador_eliminar(request, opp_id):
    try:
        body = _json_body(request) if request.body else {}

        with transaction.atomic():
            opp = _obtener_opp_bloqueada(request.user, opp_id)   # 404 / 403 / 409 si ya es LISTO

            # La versión es opcional; si el listado la envía no se borra un borrador que
            # alguien modificó después de cargarlo.
            if body.get('version'):
                _verificar_version(opp, body.get('version'))

            # Defensa: un borrador no debería tener ninguna de estas consecuencias.
            if opp.imputacion_id or OrdenPagoPersonalPartida.objects.filter(orden_pago_personal=opp).exists():
                raise _RefuerzoError(
                    'Esta OP Personal tiene registros presupuestarios asociados y no se puede '
                    'eliminar como borrador', 409)

            instantanea = {
                'nro_orden_pago': opp.nro_orden_pago,
                'nro_expediente': opp.nro_expediente,
                'concepto':       opp.concepto,
                'fecha':          opp.fecha.isoformat() if opp.fecha else None,
                'importe_total':  str(opp.importe_total) if opp.importe_total is not None else None,
                'beneficiarios':  opp.beneficiarios.count(),
                'erogaciones':    opp.borradores_partida.count(),
                'creado_por':     opp.usuario.nombre if opp.usuario_id else None,
                'creado_en':      opp.fecha_creacion.isoformat(),
            }
            if opp.usuario_modificacion_id:
                instantanea['editado_por'] = opp.usuario_modificacion.nombre

            _registrar_auditoria_opp(opp, 'ELIMINAR', request.user,
                                     {'instantanea': instantanea}, estado='ELIMINADO')
            opp.delete()   # borra en cascada beneficiarios y borradores de partida

    except _RefuerzoError as e:
        return _respuesta_error(e)
    except ProtectedError:
        return JsonResponse(
            {'error': 'La OP Personal tiene registros relacionados y no se puede eliminar.'}, status=409)
    except Exception:
        _logger.exception('Error al eliminar el borrador de OP Personal %s', opp_id)
        return JsonResponse({'error': 'Error interno: el borrador NO se eliminó'}, status=500)

    return JsonResponse({'ok': True})


# ==========================================
#  API — HISTORIAL DE INTERVENCIONES DE UNA OP PERSONAL (solo lectura)
# ==========================================
_OPP_AUDITORIA_TEXTOS = {
    'CREAR':     'Creó el borrador',
    'EDITAR':    'Editó el borrador',
    'COMPLETAR': 'Confirmó como Listo',
    'ELIMINAR':  'Eliminó el borrador',
}
_OPP_CAMPOS_TEXTOS = {
    'nro_orden_pago':   'N° de orden de pago',
    'nro_expediente':   'N° de expediente',
    'u_presupuestaria': 'Unidad presupuestaria',
    'codigo':           'Código',
    'concepto':         'Concepto',
    'observaciones':    'Observaciones',
    'fecha':            'Fecha',
    'importe_total':    'Importe O.P.',
    'beneficiarios':    'Beneficiarios',
    'erogaciones':      'Erogaciones',
}


@rol_requerido('admin', 'adminprincipal')
def api_op_personal_auditoria(request, opp_id):
    """Solo lectura (GET): consultar el historial NO genera ningún registro."""
    eventos = list(OrdenPagoPersonalAuditoria.objects.filter(orden_pago_personal_id=opp_id)
                   .select_related('usuario').order_by('fecha', 'id'))
    opp = OrdenPagoPersonal.objects.select_related('usuario').filter(id=opp_id).first()
    if opp is None and not eventos:
        return JsonResponse({'error': 'OP Personal no encontrada'}, status=404)

    def _fmt(dt):
        return timezone.localtime(dt).strftime('%d/%m/%Y - %H:%M')

    data = []
    # OP Personal anteriores a la auditoría: se reconstruye la creación desde la cabecera
    if opp is not None and not any(e.operacion == 'CREAR' for e in eventos):
        data.append({
            'operacion':    'CREAR',
            'texto':        'Creó la OP Personal (anterior al registro de auditoría)',
            'usuario':      opp.usuario.nombre,
            'fecha':        _fmt(opp.fecha_creacion),
            'fecha_ultima': None,
            'cantidad':     1,
            'estado':       None,
            'campos':       [],
        })

    for e in eventos:
        campos = [_OPP_CAMPOS_TEXTOS.get(c, c) for c in e.detalle.get('campos', [])]
        data.append({
            'operacion':    e.operacion,
            'texto':        _OPP_AUDITORIA_TEXTOS.get(e.operacion, e.operacion),
            'usuario':      e.usuario.nombre,
            'fecha':        _fmt(e.fecha),
            'fecha_ultima': _fmt(e.fecha_ultima) if e.cantidad > 1 else None,
            'cantidad':     e.cantidad,
            'estado':       e.estado_resultante,
            'campos':       campos,
        })

    return JsonResponse({'opp_id': opp_id, 'eventos': data})


# ==========================================
#  API — EJERCICIOS ANTERIORES: AÑOS
#  Devuelve los ejercicios disponibles
#  distintos al año actual
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_ejercicios_anios(request):
    anio_actual = timezone.now().year
    anios = LineaPresupuestaria.objects.filter(
        ejercicio__lt=anio_actual
    ).values_list('ejercicio', flat=True).distinct().order_by('-ejercicio')

    return JsonResponse({'anios': list(anios)})


# ==========================================
#  API — EJERCICIOS ANTERIORES: DATOS
#  Devuelve las líneas presupuestarias
#  de un ejercicio anterior con sus movimientos
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def api_ejercicios_datos(request):
    from django.db.models import Sum

    ejercicio = request.GET.get('ejercicio')
    if not ejercicio:
        return JsonResponse({'error': 'Falta parámetro ejercicio'}, status=400)

    try:
        ejercicio = int(ejercicio)
    except ValueError:
        return JsonResponse({'error': 'Ejercicio inválido'}, status=400)

    anio_actual = timezone.now().year
    if ejercicio >= anio_actual:
        return JsonResponse({'error': 'Solo se permiten ejercicios anteriores'}, status=400)

    lineas = LineaPresupuestaria.objects.filter(
        ejercicio=ejercicio
    ).select_related(
        'programa', 'proyecto', 'actividad_obra', 'partida', 'fuente_financiamiento'
    )

    resultado = []

    for linea in lineas:
        # ── Código de la UP ───────────────────────────────────────────────
        codigo_up = (
            f"{linea.programa.codigo_programa}-"
            f"00-"
            f"{linea.proyecto.codigo_proyecto}-"
            f"{linea.actividad_obra.codigo_act_obra}-"
            f"{linea.partida.codigo}-"
            f"{linea.fuente_financiamiento.codigo}"
        )

        # ── Modificaciones: receptoras + refuerzos − transferentes Modo A ─────
        total_refuerzos = RefuerzoDetalle.objects.filter(
            linea_destino=linea
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        total_receptoras = ModificacionReceptora.objects.filter(
            linea_destino=linea
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        total_transferentes = ModificacionTransferente.objects.filter(
            linea_origen=linea,
            modificacion__tipo_transferente='general'
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        total_modificaciones = total_refuerzos + total_receptoras - total_transferentes

        # ── Ejecutado: suma de OPs pagadas (OrdenPagoUnidadPresupuestaria) ────
        total_ejecutado = OrdenPagoUnidadPresupuestaria.objects.filter(
            imputacion_detalle__linea_presupuestaria=linea
        ).aggregate(total=Sum('importe'))['total'] or Decimal('0')

        # ── Saldo final: saldo_actual ya tiene todo descontado ────────────────
        saldo_final = linea.saldo_actual

        # ── Movimientos históricos ────────────────────────────────────────
        movimientos = []

        # Imputaciones
        for det in ImputacionDetalle.objects.filter(
            linea_presupuestaria=linea
        ).select_related('imputacion').order_by('imputacion__fecha'):
            imp = det.imputacion
            movimientos.append({
                'fecha':      imp.fecha.strftime('%d/%m/%Y'),
                'tipo':       'Imputación',
                'referencia': imp.nro_expediente,
                'importe':    float(-det.importe),
            })

        # Órdenes de Pago
        for up in OrdenPagoUnidadPresupuestaria.objects.filter(
            imputacion_detalle__linea_presupuestaria=linea
        ).select_related('orden_pago').order_by('orden_pago__fecha'):
            op = up.orden_pago
            movimientos.append({
                'fecha':      op.fecha.strftime('%d/%m/%Y'),
                'tipo':       'Orden de pago',
                'referencia': op.nro_orden_pago,
                'importe':    float(-up.importe),
            })

        # Refuerzos
        for det in RefuerzoDetalle.objects.filter(
            linea_destino=linea
        ).select_related('refuerzo').order_by('refuerzo__fecha'):
            ref = det.refuerzo
            movimientos.append({
                'fecha':      ref.fecha.strftime('%d/%m/%Y'),
                'tipo':       'Refuerzo',
                'referencia': ref.nro_expediente,
                'importe':    float(det.importe),
            })

        # Modificaciones transferentes Modo A
        for det in ModificacionTransferente.objects.filter(
            linea_origen=linea,
            modificacion__tipo_transferente='general'
        ).select_related('modificacion').order_by('modificacion__fecha'):
            mod = det.modificacion
            movimientos.append({
                'fecha':      mod.fecha.strftime('%d/%m/%Y'),
                'tipo':       'Modificación',
                'referencia': mod.nro_expediente,
                'importe':    float(-det.importe),
            })

        # Modificaciones receptoras
        for det in ModificacionReceptora.objects.filter(
            linea_destino=linea
        ).select_related('modificacion').order_by('modificacion__fecha'):
            mod = det.modificacion
            movimientos.append({
                'fecha':      mod.fecha.strftime('%d/%m/%Y'),
                'tipo':       'Modificación',
                'referencia': mod.nro_expediente,
                'importe':    float(det.importe),
            })

        # Ordenar movimientos por fecha
        movimientos.sort(key=lambda m: m['fecha'])

        resultado.append({
            'up':             codigo_up,
            'denominacion':   linea.partida.denominacion,
            'inicial':        float(linea.saldo_inicial),
            'modificaciones': float(total_modificaciones),
            'ejecutado':      float(total_ejecutado),
            'saldo_final':    float(saldo_final),      # ← float, no str
            'movimientos':    movimientos,
        })

    return JsonResponse({
        'ejercicio': ejercicio,
        'lineas':    resultado,
    })
@rol_requerido('admin')
def historial_accesos(request):

    usuarios = Usuario.objects.all().order_by('nombre')

    datos = []

    ahora = timezone.now()

    for usuario in usuarios:

        if usuario.ultimo_acceso:
            ultimo_acceso = timezone.localtime(
            usuario.ultimo_acceso).strftime('%d/%m/%Y %H:%M')
        else:
            ultimo_acceso = 'Nunca ingresó'

        if usuario.ultima_actividad:
            activo = ahora - usuario.ultima_actividad < timedelta(minutes=5)
        else:
            activo = False

        datos.append({
            'nombre': usuario.nombre,
            'activo': activo,
            'ultimo_acceso': ultimo_acceso,
        })

    return JsonResponse({
        'ok': True,
        'usuarios': datos,
    })

@rol_requerido('admin')
def usuarios_para_contrasena(request):
    """Lista de usuarios a los que el admin puede cambiar la contraseña."""
    usuarios = Usuario.objects.exclude(rol='adminprincipal').order_by('nombre')

    return JsonResponse({
        'ok': True,
        'usuarios': [
            {
                'id': u.id,
                'nombre': u.nombre,
                'email': u.email,
                'rol': u.get_rol_display(),
                'activo': u.is_active,
            }
            for u in usuarios
        ],
    })


@rol_requerido('admin')
def cambiar_contrasena(request):
    if request.method != 'POST':
        return JsonResponse({
            'ok': False,
            'mensaje': 'Método no permitido.'
        }, status=405)

    usuario_id = request.POST.get('usuario_id', '')
    contrasena_admin = request.POST.get('contrasena_admin', '')
    nueva_contrasena = request.POST.get('nueva_contrasena', '')
    confirmar_contrasena = request.POST.get('confirmar_contrasena', '')

    # Todos los campos son obligatorios
    if not usuario_id or not contrasena_admin or not nueva_contrasena or not confirmar_contrasena:
        return JsonResponse({
            'ok': False,
            'mensaje': 'Todos los campos son obligatorios.'
        }, status=400)

    # El admin confirma su propia contraseña antes de cambiar la de otro
    if not request.user.check_password(contrasena_admin):
        return JsonResponse({
            'ok': False,
            'mensaje': 'Tu contraseña de administrador es incorrecta.'
        }, status=400)

    # Buscar el usuario al que se le cambia la contraseña
    try:
        objetivo = Usuario.objects.get(id=int(usuario_id))
    except (Usuario.DoesNotExist, ValueError):
        return JsonResponse({
            'ok': False,
            'mensaje': 'El usuario seleccionado no existe.'
        }, status=404)

    # Un admin no puede tocar la cuenta del Administrador Principal
    if objetivo.rol == 'adminprincipal':
        return JsonResponse({
            'ok': False,
            'mensaje': 'No tenés permiso para cambiar la contraseña de ese usuario.'
        }, status=403)

    if nueva_contrasena != confirmar_contrasena:
        return JsonResponse({
            'ok': False,
            'mensaje': 'Las nuevas contraseñas no coinciden.'
        }, status=400)

    if len(nueva_contrasena) < 8:
        return JsonResponse({
            'ok': False,
            'mensaje': 'La nueva contraseña debe tener al menos 8 caracteres.'
        }, status=400)

    objetivo.set_password(nueva_contrasena)
    objetivo.save(update_fields=['password'])

    # Si el admin se cambió la suya, mantenerlo conectado
    if objetivo.pk == request.user.pk:
        from django.contrib.auth import update_session_auth_hash
        update_session_auth_hash(request, request.user)

    return JsonResponse({
        'ok': True,
        'mensaje': f'Contraseña de {objetivo.nombre} cambiada correctamente.'
    })

@rol_requerido('admin', 'adminprincipal')
def cambiar_foto_perfil(request):
    if request.method != 'POST':
        return JsonResponse({
            'ok': False,
            'mensaje': 'Método no permitido.'
        }, status=405)

    foto = request.FILES.get('foto_perfil')

    if not foto:
        return JsonResponse({
            'ok': False,
            'mensaje': 'No se seleccionó ninguna foto.'
        }, status=400)

    # Validar que sea una imagen
    if not foto.content_type.startswith('image/'):
        return JsonResponse({
            'ok': False,
            'mensaje': 'El archivo seleccionado no es una imagen válida.'
        }, status=400)

    # Limitar el tamaño a 5 MB
    if foto.size > 5 * 1024 * 1024:
        return JsonResponse({
            'ok': False,
            'mensaje': 'La foto no puede superar los 5 MB.'
        }, status=400)

    request.user.foto_perfil = foto
    request.user.save(update_fields=['foto_perfil'])

    return JsonResponse({
        'ok': True,
        'mensaje': 'Foto de perfil actualizada correctamente.',
        'foto_url': request.user.foto_perfil.url
    })