# dashboards/urls.py — VERSIÓN ACTUALIZADA
# Se agregan las URLs para dar de baja y reactivar usuarios.

from django.urls import path
from . import views

urlpatterns = [
    path('adminprincipal-dashboard/', views.adminprincipal_dashboard, name='adminprincipal_dashboard'),
    path('adminprincipal-dashboard/registros/', views.adminprincipal_registros, name='registros'),
    path('adminprincipal-dashboard/usuarios/', views.adminprincipal_usuarios, name='usuarios'),
    path('adminprincipal-dashboard/configuracion/', views.adminprincipal_configuracion, name='configuracion'),
    path('adminprincipal-dashboard/registros/refuerzomodificacion/', views.adminprincipal_refuerzomodificacion, name='refuerzomodificacion'),
    path('adminprincipal-dashboard/registros/imputacion/', views.imputacion, name='imputacion'),

    # ── Panel admin ────────────────────────────────────────────────────────
    path('admin-dashboard/', views.admin_dashboard,           name='admin_dashboard'),
    path('admin-dashboard/home/', views.home,                  name='home'),
    path('admin-dashboard/registros/', views.admin_registros, name='registros'),
    path('admin-dashboard/usuarios/', views.admin_usuarios,   name='usuarios'),
    path('admin-dashboard/configuracion/', views.admin_configuracion, name='configuracion'),
    path('admin-dashboard/registros/refuerzo', views.admin_refuerzo, name='refuerzo'),
    path('admin-dashboard/registros/modificacion', views.admin_modificacion, name='modificacion'),
    path('admin-dashboard/registros/imputaciones/', views.lista_imputaciones, name='lista_imputaciones'),
    path('admin-dashboard/registros/ordenpago/', views.ordenpago,                        name='ordenpago'),
    path('admin-dashboard/registros/ordenpagopersonal/',  views.ordenpagopersonal,       name= 'ordenpagopersonal'),
    path('admin-dashboard/home/cargarpresupuesto/', views.cargar_presupuesto,  name='cargarpresupuesto'),
    path(
    'admin-dashboard/home/carga-catalogos/',
    views.carga_catalogos,
    name='carga_catalogos'
),

    path('admin-dashboard/crear-usuario/', views.crear_usuario, name='crear_usuario'),
    path('admin-dashboard/usuarios-baja/<int:usuario_id>/', views.dar_baja_usuario, name='dar_baja_usuario'),
    path('admin-dashboard/usuarios-reactivar/<int:usuario_id>/', views.reactivar_usuario, name='reactivar_usuario'),

    # APIs
    path('api/linea-presupuestaria/crear/',  views.api_crear_linea_presupuestaria, name='api_crear_linea_presupuestaria'),
    path('api/linea-presupuestaria/listar/', views.api_listar_lineas,               name='api_listar_lineas'),
    path('api/lineas-presupuestarias/', views.api_lineas_presupuestarias, name='api_lineas_presupuestarias'),
    path('api/home/lineas/', views.api_home_lineas, name='api_home_lineas'),
    path('api/home/lineas/<int:linea_id>/movimientos/', views.api_movimientos_linea, name='api_movimientos_linea'),
    path('api/refuerzo/crear/',         views.api_crear_refuerzo,         name='api_crear_refuerzo'),
    path('api/refuerzo/listar/', views.api_listar_refuerzos, name='api_listar_refuerzos'),
    path('modificacion/crear/',                        views.modificacion_crear,  name='modificacion_crear'),
    path('modificacion/editar/<int:modificacion_id>/', views.modificacion_editar, name='modificacion_editar'),
    path('api/modificacion/crear/', views.api_crear_modificacion, name='api_crear_modificacion'),
    path('api/modificacion/listar/', views.api_listar_modificaciones, name='api_listar_modificaciones'),
    path('api/imputacion/crear/', views.api_crear_imputacion, name='api_crear_imputacion'),
    path('api/programas/',      views.api_programas,     name='api_programas'),
    path('api/proyectos/',      views.api_proyectos,      name='api_proyectos'),
    path('api/actividades/',    views.api_actividades,    name='api_actividades'),
    path('api/partidas/',       views.api_partidas,       name='api_partidas'),
    path('api/fuentes/',        views.api_fuentes,        name='api_fuentes'),
    path('api/imputaciones-por-linea/', views.api_imputaciones_por_linea, name='api_imputaciones_por_linea'),
    path('api/historial-registros/', views.api_historial_registros, name='api_historial_registros'),

    # ── Carga de catálogos (CRUD genérico) ─────────────────────────────────
    path('api/catalogos/listar/', views.api_catalogos_listar, name='api_catalogos_listar'),
    path('api/catalogos/padres/', views.api_catalogos_padres, name='api_catalogos_padres'),
    path('api/catalogos/crear/', views.api_catalogos_crear, name='api_catalogos_crear'),
    path('api/catalogos/editar/<int:item_id>/', views.api_catalogos_editar, name='api_catalogos_editar'),
    path('api/catalogos/eliminar/<int:item_id>/', views.api_catalogos_eliminar, name='api_catalogos_eliminar'),
    path('api/buscar-linea/',   views.api_buscar_linea,   name='api_buscar_linea'),
    path('api/imputacion/crear/', views.api_crear_imputacion, name='api_crear_imputacion'),
    path('api/resolver-lineas/', views.api_resolver_lineas, name='api_resolver_lineas'),
    path('api/resolver-lineas-modificacion/', views.api_resolver_lineas_modificacion, name='api_resolver_lineas_modificacion'),
    path('api/proximo-asiento/', views.api_proximo_asiento, name='api_proximo_asiento'),
    path('api/imputacion/<int:imputacion_id>/detalle/', views.api_detalle_imputacion, name='api_detalle_imputacion'),
    path('api/saldo-linea/', views.api_saldo_linea, name='api_saldo_linea'),
    path('refuerzo/crear/',                        views.refuerzo_crear,  name='refuerzo_crear'),
    path('refuerzo/editar/<int:refuerzo_id>/',     views.refuerzo_editar, name='refuerzo_editar'),
    path('api/imputacion/<int:imputacion_id>/ups/', views.api_ups_imputacion, name='api_ups_imputacion'),
    path('api/orden-pago/crear/',                   views.api_crear_orden_pago, name='api_crear_orden_pago'),
    path('api/codigos-pago/', views.api_codigos_pago, name='api_codigos_pago'),

    # ── Otros dashboards ───────────────────────────────────────────────────
    path('usuariovip-dashboard/', views.usuariovip_dashboard, name='usuariovip_dashboard'),
    path('usuariocomun-dashboard/', views.usuariocomun_dashboard, name='usuariocomun_dashboard'),
    path('acceso-denegado/', views.acceso_denegado, name='acceso_denegado'),
]