#dashboards/views.py

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from accounts.decorators import rol_requerido
from accounts.models import UsuarioPersonalizado
import json
from django.db import transaction
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from dashboards.models import (
    LineaPresupuestaria, Refuerzo, RefuerzoDetalle, Modificacion, ModificacionReceptora, ModificacionTransferente, MovimientoHistorial, Imputacion, ImputacionDetalle,
    Programa, Proyecto, Partida, FuenteFinanciamiento, ActividadObra, OrdenPago
)
from decimal import Decimal
from datetime import date

Usuario = get_user_model()

# ==========================================
#  VISTAS PARA ADMIN PRINCIPAL
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def obtener_modificaciones_y_refuerzos(request):
    modificaciones = Modificacion.objects.select_related('usuario').prefetch_related(
        'transferentes__linea_origen',
        'receptoras__linea_destino',
    ).all()

    refuerzos = Refuerzo.objects.select_related('usuario').all()

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
    return render(request, 'dashboards/adminprincipal/adminprincipal_dashboard.html', {'usuario': request.user})

@rol_requerido('adminprincipal')
def adminprincipal_registros(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/adminprincipal/registros.html', context)

@rol_requerido('adminprincipal')
def adminprincipal_refuerzomodificacion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/adminprincipal/refuerzomodificacion.html', context)

@rol_requerido('adminprincipal')
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

@rol_requerido('admin')
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

@rol_requerido('admin')
def admin_configuracion(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/configuracion.html', context)

@rol_requerido('admin','adminprincipal')
def cargar_presupuesto(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/cargarpresupuesto.html', context)

# ==========================================
#  ACCIONES COMUNES DE GESTIÓN DE USUARIOS
# ==========================================
@rol_requerido('admin', 'adminprincipal')
def ordenpago(request):
    context = {'usuario': request.user}
    return render(request, 'dashboards/admin/ordenpago.html',context)

@rol_requerido('admin', 'adminprincipal')
def ordenpagopersonal(request):
    context = {'usuario': request.user}
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

    if not all([programa_id, proyecto_id, actividad_id, partida_id, fuente_id, presupuesto]):
        return JsonResponse({'error': 'Faltan campos obligatorios'}, status=400)

    try:
        presupuesto = Decimal(str(presupuesto))
        if presupuesto <= 0:
            raise ValueError()
    except Exception:
        return JsonResponse({'error': 'El presupuesto inicial debe ser mayor a cero'}, status=400)

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
    # de MovimientoHistorial más reciente entre las líneas del ejercicio
    # (se crea automáticamente cada vez que un refuerzo, modificación o
    # imputación cambia el saldo_actual de una línea).
    ultima_modificacion = MovimientoHistorial.objects.filter(
        linea_presupuestaria__ejercicio=ejercicio
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
    from collections import defaultdict

    linea = get_object_or_404(LineaPresupuestaria, id=linea_id)

    historial = MovimientoHistorial.objects.filter(
        linea_presupuestaria=linea
    ).select_related('usuario').order_by('-fecha')

    # Agrupamos los referencia_id por documento de origen para resolver
    # expediente/decreto en bloque y evitar una consulta por movimiento.
    ids_por_tipo = defaultdict(set)
    for h in historial:
        if h.tipo.startswith('IMPUTACION'):
            ids_por_tipo['IMPUTACION'].add(h.referencia_id)
        elif h.tipo.startswith('REFUERZO'):
            ids_por_tipo['REFUERZO'].add(h.referencia_id)
        elif h.tipo.startswith('MODIFICACION'):
            ids_por_tipo['MODIFICACION'].add(h.referencia_id)
        elif h.tipo.startswith('ORDEN_PAGO'):
            ids_por_tipo['ORDEN_PAGO'].add(h.referencia_id)

    imputaciones   = Imputacion.objects.in_bulk(ids_por_tipo['IMPUTACION'])
    refuerzos      = Refuerzo.objects.in_bulk(ids_por_tipo['REFUERZO'])
    modificaciones = Modificacion.objects.in_bulk(ids_por_tipo['MODIFICACION'])
    ordenes_pago   = OrdenPago.objects.in_bulk(ids_por_tipo['ORDEN_PAGO'])

    # Nota: todavía no existe una forma de distinguir "O. P." de
    # "O. P. Personal" en el modelo OrdenPago (no hay campo ni API de
    # creación implementada aún), así que por ahora todas las órdenes
    # de pago se etiquetan simplemente como "O. P.".
    TIPO_LABELS = {
        'IMPUTACION':            'Imputación',
        'IMPUTACION_EDICION':    'Imputación (edición)',
        'IMPUTACION_ANULACION':  'Imputación (anulada)',
        'ORDEN_PAGO':            'O. P.',
        'ORDEN_PAGO_ANULACION':  'O. P. (anulada)',
        'REFUERZO':              'Refuerzo',
        'REFUERZO_EDICION':      'Refuerzo (edición)',
        'REFUERZO_ANULACION':    'Refuerzo (anulado)',
        'MODIFICACION_SALIDA':   'Modificación',
        'MODIFICACION_ENTRADA':  'Modificación',
        'MODIFICACION':          'Modificación',
        'MODIFICACION_EDICION':  'Modificación (edición)',
        'MODIFICACION_ANULACION': 'Modificación (anulada)',
    }

    data = []
    for h in historial:
        expediente = ''
        decreto    = ''

        if h.tipo.startswith('IMPUTACION'):
            origen = imputaciones.get(h.referencia_id)
            if origen:
                expediente = origen.nro_expediente
        elif h.tipo.startswith('REFUERZO'):
            origen = refuerzos.get(h.referencia_id)
            if origen:
                expediente = origen.nro_expediente
                decreto    = origen.nro_decreto_resolucion
        elif h.tipo.startswith('MODIFICACION'):
            origen = modificaciones.get(h.referencia_id)
            if origen:
                expediente = origen.nro_expediente
                decreto    = origen.nro_decreto
        elif h.tipo.startswith('ORDEN_PAGO'):
            origen = ordenes_pago.get(h.referencia_id)
            if origen:
                expediente = origen.nro_orden_pago
                decreto    = origen.nro_resolucion

        data.append({
            'tipo':              TIPO_LABELS.get(h.tipo, h.tipo),
            'fechaCreacion':     h.fecha.strftime('%d/%m/%Y'),
            'numeroExpediente':  expediente,
            'usuario':           h.usuario.nombre if h.usuario else '',
            'importe':           str(h.monto),
            'decretoResolucion': decreto,
        })

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

                MovimientoHistorial.objects.create(
                    linea_presupuestaria = linea,
                    tipo                 = 'REFUERZO',
                    referencia_id        = refuerzo.id,
                    usuario              = request.user,
                    monto                = importe,
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
    ).order_by('-fecha_creacion')

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



# ==========================================
#  API — CREAR MODIFICACIÓN
# ==========================================
@rol_requerido('admin', 'adminprincipal')
@require_POST
def api_crear_modificacion(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    fecha          = body.get('fecha')
    nro_expediente = body.get('nro_expediente', '').strip()
    nro_decreto    = body.get('nro_decreto', '').strip()
    transferentes  = body.get('transferentes', [])
    receptoras     = body.get('receptoras', [])

    if not fecha or not nro_expediente or not nro_decreto:
        return JsonResponse({'error': 'Faltan campos obligatorios'}, status=400)

    if not transferentes:
        return JsonResponse({'error': 'Debe incluir al menos una línea transferente'}, status=400)

    if not receptoras:
        return JsonResponse({'error': 'Debe incluir al menos una línea receptora'}, status=400)

    try:
        with transaction.atomic():
            total_transferente = Decimal('0')
            total_receptora    = Decimal('0')

            lineas_transferentes = []
            for t in transferentes:
                linea_id = t.get('linea_id')
                importe  = t.get('importe')
                if not linea_id or not importe:
                    raise ValueError('Cada transferente debe tener linea_id e importe')
                try:
                    linea   = LineaPresupuestaria.objects.select_for_update().get(id=linea_id)
                    importe = Decimal(str(importe))
                    if importe <= 0:
                        raise ValueError('El importe debe ser mayor a cero')
                    if linea.saldo_actual < importe:
                        raise ValueError(f'Saldo insuficiente en línea {linea_id}. Disponible: {linea.saldo_actual}')
                except LineaPresupuestaria.DoesNotExist:
                    raise ValueError(f'Línea transferente {linea_id} no encontrada')
                lineas_transferentes.append((linea, importe))
                total_transferente += importe

            lineas_receptoras = []
            for r in receptoras:
                linea_id = r.get('linea_id')
                importe  = r.get('importe')
                if not linea_id or not importe:
                    raise ValueError('Cada receptora debe tener linea_id e importe')
                try:
                    linea   = LineaPresupuestaria.objects.select_for_update().get(id=linea_id)
                    importe = Decimal(str(importe))
                    if importe <= 0:
                        raise ValueError('El importe debe ser mayor a cero')
                except LineaPresupuestaria.DoesNotExist:
                    raise ValueError(f'Línea receptora {linea_id} no encontrada')
                lineas_receptoras.append((linea, importe))
                total_receptora += importe

            if total_receptora > total_transferente:
                raise ValueError('El total receptora no puede superar el total transferente')

            # Crear cabecera
            modificacion = Modificacion.objects.create(
                fecha          = fecha,
                nro_expediente = nro_expediente,
                nro_decreto    = nro_decreto,
                importe_total  = total_transferente,
                usuario        = request.user,
            )

            # Crear detalles y actualizar saldos transferentes
            for linea, importe in lineas_transferentes:
                ModificacionTransferente.objects.create(
                    modificacion = modificacion,
                    linea_origen = linea,
                    importe      = importe,
                )
                linea.saldo_actual -= importe
                linea.save()
                MovimientoHistorial.objects.create(
                    linea_presupuestaria = linea,
                    tipo                 = 'MODIFICACION',
                    referencia_id        = modificacion.id,
                    usuario              = request.user,
                    monto                = -importe,
                    descripcion          = f'Modificación origen — decreto {nro_decreto} — expediente {nro_expediente}',
                )

            # Crear detalles y actualizar saldos receptoras
            for linea, importe in lineas_receptoras:
                ModificacionReceptora.objects.create(
                    modificacion  = modificacion,
                    linea_destino = linea,
                    importe       = importe,
                )
                linea.saldo_actual += importe
                linea.save()
                MovimientoHistorial.objects.create(
                    linea_presupuestaria = linea,
                    tipo                 = 'MODIFICACION',
                    referencia_id        = modificacion.id,
                    usuario              = request.user,
                    monto                = importe,
                    descripcion          = f'Modificación destino — decreto {nro_decreto} — expediente {nro_expediente}',
                )

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
    ).order_by('-fecha_creacion')

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
@rol_requerido('admin', 'adminprincipal')
def modificacion_editar(request, modificacion_id):
    import json as _json
    modificacion  = get_object_or_404(Modificacion, id=modificacion_id)
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
        'id':             modificacion.id,
        'fecha':          modificacion.fecha.strftime('%Y-%m-%d'),
        'nro_expediente': modificacion.nro_expediente,
        'nro_decreto':    modificacion.nro_decreto,
        'importe_total':  str(modificacion.importe_total),
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
        'modo':         'editar',
        'modificacion': _json.dumps(datos),
    }
    return render(request, 'dashboards/admin/modificacion_form.html', context)

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

@rol_requerido('admin', 'adminprincipal')
def refuerzo_editar(request, refuerzo_id):
    import json as _json
    from dashboards.models import Refuerzo, RefuerzoDetalle
    refuerzo  = get_object_or_404(Refuerzo, id=refuerzo_id)
    detalles  = RefuerzoDetalle.objects.filter(refuerzo=refuerzo).select_related(
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
        'modo':     'editar',
        'refuerzo': _json.dumps(datos),
    }
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

            # ── Crear detalles, descontar saldo y registrar historial ─────
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

                MovimientoHistorial.objects.create(
                    linea_presupuestaria = linea,
                    tipo                 = 'IMPUTACION',
                    referencia_id        = imputacion.id,
                    usuario              = request.user,
                    monto                = -d['importe'],
                    descripcion          = (
                        f'Imputación exp. {nro_expediente} '
                        f'asiento {asiento_nro} — {d["proveedor_concepto"]}'
                    ),
                )

                importe_total += d['importe']

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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

    imputaciones = Imputacion.objects.select_related('usuario').prefetch_related(
        'detalles__ordenes_pago_detalle',
        'detalles__linea_presupuestaria',
    ).order_by('-fecha')

    lista = []
    for imp in imputaciones:

        importe_total = imp.detalles.aggregate(
            total=Sum('importe')
        )['total'] or Decimal('0')

        total_pagado = Decimal('0')
        for detalle in imp.detalles.all():
            pagado = detalle.ordenes_pago_detalle.aggregate(
                total=Sum('importe')
            )['total'] or Decimal('0')
            total_pagado += pagado

        if total_pagado == 0:
            estado = 'Pendiente'
        elif total_pagado < importe_total:
            estado = 'Pagada parcial'
        else:
            estado = 'Pagada total'

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