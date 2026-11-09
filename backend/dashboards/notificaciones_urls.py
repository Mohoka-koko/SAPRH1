from django.urls import path, include

from . import notificaciones_views


urlpatterns = [

    path(
        "notificaciones/",
        notificaciones_views.lista_notificaciones,
        name="lista_notificaciones"
    ),

    path(
        "notificaciones/api/",
        notificaciones_views.api_notificaciones,
        name="api_notificaciones"
    ),

    path(
        "notificaciones/<int:pk>/leida/",
        notificaciones_views.marcar_notificacion_leida,
        name="marcar_notificacion_leida"
    ),

    path(
        "notificaciones/marcar-todas-leidas/",
        notificaciones_views.marcar_todas_leidas,
        name="marcar_todas_notificaciones_leidas"
    ),

 
]