# accounts/admin.py
# Permite gestionar usuarios desde el panel /admin/ de Django

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import UsuarioPersonalizado


@admin.register(UsuarioPersonalizado)
class UsuarioAdmin(UserAdmin):
    model = UsuarioPersonalizado

    # Columnas visibles en la lista de usuarios
    list_display  = ('email', 'nombre', 'rol', 'is_active', 'fecha_creacion', 'ultimo_acceso')
    list_filter   = ('rol', 'is_active', 'is_staff')
    search_fields = ('email', 'nombre')
    ordering      = ('email',)

    # Campos al editar un usuario existente
    fieldsets = (
        ('Credenciales',  {'fields': ('email', 'password')}),
        ('Información',   {'fields': ('nombre', 'rol')}),
        ('Permisos',      {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Fechas',        {'fields': ('fecha_creacion', 'ultimo_acceso')}),
    )
    readonly_fields = ('fecha_creacion', 'ultimo_acceso')

    # Campos al crear un nuevo usuario desde el panel admin
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields':  ('email', 'nombre', 'rol', 'password1', 'password2', 'is_active', 'is_staff'),
        }),
    )
