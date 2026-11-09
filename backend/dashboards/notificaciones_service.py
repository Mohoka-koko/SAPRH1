from django.contrib.auth import get_user_model

from .models import Notificacion


def notificar_usuarios(
    usuarios,
    titulo,
    mensaje,
    tipo="sistema",
    url=""
):
    """
    Crea una notificación individual para cada destinatario.
    """

    notificaciones = []
    usuarios_procesados = set()

    for usuario in usuarios:

        if not usuario or not usuario.pk:
            continue

        if usuario.pk in usuarios_procesados:
            continue

        usuarios_procesados.add(usuario.pk)

        notificacion = Notificacion.objects.create(
            destinatario=usuario,
            titulo=titulo,
            mensaje=mensaje,
            tipo=tipo,
            url=url or ""
        )

        notificaciones.append(notificacion)

    return notificaciones


def notificar_usuario(
    usuario,
    titulo,
    mensaje,
    tipo="sistema",
    url=""
):
    """
    Crea una notificación para un único usuario.
    """

    return notificar_usuarios(
        [usuario],
        titulo=titulo,
        mensaje=mensaje,
        tipo=tipo,
        url=url
    )


def notificar_roles(
    roles,
    titulo,
    mensaje,
    tipo="sistema",
    url=""
):
    """
    Busca usuarios por rol y les envía una notificación.

    IMPORTANTE:
    Hay que adaptar los nombres de los campos y los valores
    de los roles al modelo de usuarios de SAPRH1.
    """

    User = get_user_model()

    usuarios = User.objects.filter(is_active=True)

    destinatarios = []

    roles_buscados = {
        str(rol).strip().lower()
        for rol in roles
    }

    for usuario in usuarios:

        rol_usuario = ""

        for campo in (
            "rol",
            "tipo",
            "tipo_usuario",
            "perfil"
        ):
            valor = getattr(usuario, campo, None)

            if valor:
                rol_usuario = str(valor).strip().lower()
                break

        if rol_usuario in roles_buscados:
            destinatarios.append(usuario)

    return notificar_usuarios(
        destinatarios,
        titulo=titulo,
        mensaje=mensaje,
        tipo=tipo,
        url=url
    )