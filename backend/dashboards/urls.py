# dashboards/urls.py — VERSIÓN FUSIONADA
# Base: urls.py (OP Personal con borrador, refuerzo con auditoría/eliminar borrador,
# imputación con eliminar borrador) + rutas de borrador/completar de modificación
# tomadas de "urls (1).py".

from django.urls import path, include
from . import views

urlpatterns = [
    
# ── Panel administrador principal ──────────────────────
    path('adminprincipal-dashboard/',views.adminprincipal_dashboard,name='adminprincipal_dashboard'),
    path('adminprincipal-dashboard/registros/',views.adminprincipal_registros,name='adminprincipal_registros'),
    
    path('adminprincipal-dashboard/configuracion/',views.adminprincipal_configuracion,name='adminprincipal_configuracion'),
    path('adminprincipal-dashboard/registros/refuerzomodificacion/',views.adminprincipal_refuerzomodificacion,name='adminprincipal_refuerzomodificacion'),
    path('adminprincipal-dashboard/registros/imputacion/',views.imputacion,name='adminprincipal_imputacion'),
    
    # ── Panel admin ────────────────────────────────────────────────────────
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-dashboard/home/', views.home, name='home'),

    path('admin-dashboard/registros/imputacion/', views.imputacion, name='imputacion'),
    


    path('admin-dashboard/registros/', views.admin_registros, name='registros'),
    path('admin-dashboard/usuarios/', views.admin_usuarios, name='usuarios'),
    path('admin-dashboard/configuracion/', views.admin_configuracion, name='configuracion'),
    path('admin-dashboard/configuracion/historial-accesos/', views.historial_accesos, name='historial_accesos'),
    path('admin-dashboard/configuracion/cambiar-foto/', views.cambiar_foto_perfil, name='cambiar_foto_perfil'),
    path('admin-dashboard/configuracion/cambiar-contrasena/', views.cambiar_contrasena, name='cambiar_contrasena'),
        path('admin-dashboard/configuracion/usuarios-contrasena/', views.usuarios_para_contrasena, name='usuarios_para_contrasena'),
    path('admin-dashboard/registros/refuerzo', views.admin_refuerzo, name='refuerzo'),
    path('admin-dashboard/registros/modificacion', views.admin_modificacion, name='modificacion'),
    path('admin-dashboard/registros/imputaciones/', views.lista_imputaciones, name='lista_imputaciones'),
    path('admin-dashboard/registros/ordenpago/', views.ordenpago, name='ordenpago'),
    path('admin-dashboard/registros/ordenpagopersonal/', views.ordenpagopersonal, name='ordenpagopersonal'),
    path('admin-dashboard/home/cargarpresupuesto/', views.cargar_presupuesto, name='cargarpresupuesto'),

    path('admin-dashboard/home/carga-catalogos/', views.carga_catalogos, name='carga_catalogos'),
    path('ejercicios-anteriores-prueba/', views.ejerciciosanteriores_prueba, name='ejerciciosanteriores_prueba'),
    path('admin-dashboard/crear-usuario/', views.crear_usuario, name='crear_usuario'),
    path('admin-dashboard/usuarios-baja/<int:usuario_id>/', views.dar_baja_usuario, name='dar_baja_usuario'),
    path('admin-dashboard/usuarios-reactivar/<int:usuario_id>/', views.reactivar_usuario, name='reactivar_usuario'),

    # ── APIs: líneas presupuestarias ───────────────────────────────────────
    path('api/linea-presupuestaria/crear/', views.api_crear_linea_presupuestaria, name='api_crear_linea_presupuestaria'),
    path('api/linea-presupuestaria/listar/', views.api_listar_lineas, name='api_listar_lineas'),
    path('api/linea-presupuestaria/editar-monto/<int:linea_id>/', views.api_editar_monto_linea, name='api_editar_monto_linea'),
    path('api/linea-presupuestaria/eliminar/<int:linea_id>/', views.api_eliminar_linea, name='api_eliminar_linea'),
    path('api/lineas-presupuestarias/', views.api_lineas_presupuestarias, name='api_lineas_presupuestarias'),
    path('api/home/lineas/', views.api_home_lineas, name='api_home_lineas'),
    path('api/home/lineas/<int:linea_id>/movimientos/', views.api_movimientos_linea, name='api_movimientos_linea'),

    # ── APIs: refuerzo ─────────────────────────────────────────────────────
    path('api/refuerzo/crear/', views.api_crear_refuerzo, name='api_crear_refuerzo'),
    path('api/refuerzo/listar/', views.api_listar_refuerzos, name='api_listar_refuerzos'),
    path('api/refuerzo/borrador/crear/', views.api_refuerzo_borrador_crear, name='api_refuerzo_borrador_crear'),
    path('api/refuerzo/borrador/<int:refuerzo_id>/actualizar/', views.api_refuerzo_borrador_actualizar, name='api_refuerzo_borrador_actualizar'),
    path('api/refuerzo/<int:refuerzo_id>/completar/', views.api_refuerzo_completar, name='api_refuerzo_completar'),
    path('api/refuerzo/borrador/<int:refuerzo_id>/eliminar/', views.api_refuerzo_borrador_eliminar, name='api_refuerzo_borrador_eliminar'),
    path('api/refuerzo/<int:refuerzo_id>/auditoria/', views.api_refuerzo_auditoria, name='api_refuerzo_auditoria'),

    # ── Modificación (vistas) ──────────────────────────────────────────────
    path('modificacion/crear/', views.modificacion_crear, name='modificacion_crear'),
    path('modificacion/editar/<int:modificacion_id>/', views.modificacion_editar, name='modificacion_editar'),

    # ── APIs: modificación ─────────────────────────────────────────────────
    path('api/modificacion/crear/', views.api_crear_modificacion, name='api_crear_modificacion'),
    path('api/modificacion/listar/', views.api_listar_modificaciones, name='api_listar_modificaciones'),
    # Guardado automático (borrador "Revisar") y completado — NUEVAS
    path('api/modificacion/borrador/crear/', views.api_modificacion_borrador_crear, name='api_modificacion_borrador_crear'),
    path('api/modificacion/borrador/<int:modificacion_id>/actualizar/', views.api_modificacion_borrador_actualizar, name='api_modificacion_borrador_actualizar'),
    path('api/modificacion/<int:modificacion_id>/completar/', views.api_modificacion_completar, name='api_modificacion_completar'),

    # ── APIs: imputación ───────────────────────────────────────────────────
    path('api/imputacion/crear/', views.api_crear_imputacion, name='api_crear_imputacion'),
    path('api/imputacion/borrador/crear/', views.api_imputacion_borrador_crear, name='api_imputacion_borrador_crear'),
    path('api/imputacion/borrador/<int:imputacion_id>/actualizar/', views.api_imputacion_borrador_actualizar, name='api_imputacion_borrador_actualizar'),
    path('api/imputacion/borrador/<int:imputacion_id>/obtener/', views.api_imputacion_borrador_obtener, name='api_imputacion_borrador_obtener'),
    path('api/imputacion/<int:imputacion_id>/completar/', views.api_imputacion_completar, name='api_imputacion_completar'),
    path('api/imputacion/borrador/<int:imputacion_id>/eliminar/', views.api_imputacion_borrador_eliminar, name='api_imputacion_borrador_eliminar'),
    path('api/imputacion/<int:imputacion_id>/detalle/', views.api_detalle_imputacion, name='api_detalle_imputacion'),
    path('api/imputacion/<int:imputacion_id>/ups/', views.api_ups_imputacion, name='api_ups_imputacion'),
    path('admin-dashboard/imputacion/ver/<int:imputacion_id>/', views.imputacion_ver, name='imputacion_ver'),

    # ── APIs: catálogos auxiliares ─────────────────────────────────────────
    path('api/programas/', views.api_programas, name='api_programas'),
    path('api/proyectos/', views.api_proyectos, name='api_proyectos'),
    path('api/actividades/', views.api_actividades, name='api_actividades'),
    path('api/partidas/', views.api_partidas, name='api_partidas'),
    path('api/fuentes/', views.api_fuentes, name='api_fuentes'),
    path('api/programas-catalogo/', views.api_programas_catalogo, name='api_programas_catalogo'),
    path('api/proyectos-catalogo/', views.api_proyectos_catalogo, name='api_proyectos_catalogo'),
    path('api/actividades-catalogo/', views.api_actividades_catalogo, name='api_actividades_catalogo'),

    # ── APIs: consultas varias ─────────────────────────────────────────────
    path('api/imputaciones-por-linea/', views.api_imputaciones_por_linea, name='api_imputaciones_por_linea'),
    path('api/historial-registros/', views.api_historial_registros, name='api_historial_registros'),
    path('api/buscar-linea/', views.api_buscar_linea, name='api_buscar_linea'),
    path('api/resolver-lineas/', views.api_resolver_lineas, name='api_resolver_lineas'),
    path('api/resolver-lineas-modificacion/', views.api_resolver_lineas_modificacion, name='api_resolver_lineas_modificacion'),
    path('api/proximo-asiento/', views.api_proximo_asiento, name='api_proximo_asiento'),
    path('api/saldo-linea/', views.api_saldo_linea, name='api_saldo_linea'),
    path('api/codigos-pago/', views.api_codigos_pago, name='api_codigos_pago'),

    # ── OP Personal: guardado automático (borrador "Revisar") y completado ──
    # (se retiró api/op-personal/crear/: creaba la OP y sus imputaciones sin pasar por Revisar → Listo)
    path('ordenpagopersonal/editar/<int:opp_id>/', views.ordenpagopersonal_editar, name='ordenpagopersonal_editar'),
    path('ordenpagopersonal/ver/<int:opp_id>/', views.ordenpagopersonal_ver, name='ordenpagopersonal_ver'),
    path('api/op-personal/borrador/crear/', views.api_op_personal_borrador_crear, name='api_op_personal_borrador_crear'),
    path('api/op-personal/borrador/<int:opp_id>/actualizar/', views.api_op_personal_borrador_actualizar, name='api_op_personal_borrador_actualizar'),
    path('api/op-personal/<int:opp_id>/completar/', views.api_op_personal_completar, name='api_op_personal_completar'),

    # ── Orden de pago: guardado automático (borrador "Revisar"), completado y ver ──
    # (se retiró api/orden-pago/crear/: creaba la OP y consumía fondos sin pasar por Revisar → Listo)
    path('ordenpago/editar/<int:op_id>/', views.ordenpago_editar, name='ordenpago_editar'),
    path('ordenpago/ver/<int:op_id>/', views.ordenpago_ver, name='ordenpago_ver'),
    path('api/orden-pago/borrador/crear/', views.api_op_borrador_crear, name='api_op_borrador_crear'),
    path('api/orden-pago/borrador/<int:op_id>/actualizar/', views.api_op_borrador_actualizar, name='api_op_borrador_actualizar'),
    path('api/orden-pago/<int:op_id>/completar/', views.api_op_completar, name='api_op_completar'),
    path('api/orden-pago/borrador/<int:op_id>/eliminar/', views.api_op_borrador_eliminar, name='api_op_borrador_eliminar'),
    path('api/orden-pago/<int:op_id>/auditoria/', views.api_op_auditoria, name='api_op_auditoria'),

    # ── Carga de catálogos (CRUD genérico) ─────────────────────────────────
    path('api/catalogos/listar/', views.api_catalogos_listar, name='api_catalogos_listar'),
    path('api/catalogos/padres/', views.api_catalogos_padres, name='api_catalogos_padres'),
    path('api/catalogos/crear/', views.api_catalogos_crear, name='api_catalogos_crear'),
    path('api/catalogos/editar/<int:item_id>/', views.api_catalogos_editar, name='api_catalogos_editar'),
    path('api/catalogos/eliminar/<int:item_id>/', views.api_catalogos_eliminar, name='api_catalogos_eliminar'),

    # ── Refuerzo / modificación: ver y editar ──────────────────────────────
    path('refuerzo/crear/', views.refuerzo_crear, name='refuerzo_crear'),
    path('refuerzo/editar/<int:refuerzo_id>/', views.refuerzo_editar, name='refuerzo_editar'),
    path('refuerzo/ver/<int:refuerzo_id>/', views.refuerzo_ver, name='refuerzo_ver'),
    path('modificacion/ver/<int:modificacion_id>/', views.modificacion_ver, name='modificacion_ver'),

    # ── Ejercicios anteriores ──────────────────────────────────────────────
    path('api/ejercicios-anteriores/anios/', views.api_ejercicios_anios, name='api_ejercicios_anios'),
    path('api/ejercicios-anteriores/', views.api_ejercicios_datos, name='api_ejercicios_datos'),

    # ── Otros dashboards ───────────────────────────────────────────────────
    path('usuariovip-dashboard/', views.usuariovip_dashboard, name='usuariovip_dashboard'),
    path('usuariocomun-dashboard/', views.usuariocomun_dashboard, name='usuariocomun_dashboard'),
    path('acceso-denegado/', views.acceso_denegado, name='acceso_denegado'),

    path('', include('dashboards.notificaciones_urls')),
    
]