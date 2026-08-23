# accounts/models.py

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


# ─────────────────────────────────────────────
# MANAGER PERSONALIZADO
# Controla cómo se crean los usuarios (create_user y create_superuser)
# ─────────────────────────────────────────────
class UsuarioManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        """Crea y guarda un usuario normal con email y contraseña."""
        if not email:
            raise ValueError('El correo electrónico es obligatorio.')
        email = self.normalize_email(email)  # normaliza a minúsculas
        user = self.model(email=email, **extra_fields)
        user.set_password(password)          # hashea la contraseña con bcrypt
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Crea un superusuario (acceso al panel /admin/ de Django)."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('rol', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('El superusuario debe tener is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('El superusuario debe tener is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


# ─────────────────────────────────────────────
# MODELO DE USUARIO PERSONALIZADO
# ─────────────────────────────────────────────
class UsuarioPersonalizado(AbstractBaseUser, PermissionsMixin):
    """
    Usuario del sistema. Se identifica por EMAIL (no por username).
    Tiene un campo ROL que define su nivel de acceso.
    """

    # Roles disponibles en el sistema
    ROL_CHOICES = [
        ('adminprincipal', 'Administrador Principal'),
        ('admin',         'Administrador'),
        ('usuariovip',    'Usuario VIP'),
        ('usuariocomun',  'Usuario Común'),
    ]

    email         = models.EmailField(unique=True, verbose_name='Correo electrónico')
    nombre        = models.CharField(max_length=100, verbose_name='Nombre completo')
    rol           = models.CharField(
                        max_length=20,
                        choices=ROL_CHOICES,
                        default='usuariocomun',
                        verbose_name='Rol del usuario'
                    )
    
    AREA_CHOICES = [
        ('construccion',  'Construcción'),
        ('planificacion', 'Planificación'),
        ('mantenimiento', 'Mantenimiento'),
        ('todas',         'Todas'),
    ]

    area = models.CharField(
        max_length=20,
        choices=AREA_CHOICES,
        default='todas',
        verbose_name='Área',
        blank=True
)

    # Campos requeridos por Django
    is_active     = models.BooleanField(default=True,  verbose_name='Activo')
    is_staff      = models.BooleanField(default=False, verbose_name='Staff (panel admin)')
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de registro')
    ultimo_acceso  = models.DateTimeField(null=True, blank=True, verbose_name='Último acceso')

    # ── NUEVO ────────────────────────────────────────────────────────────────
    fecha_baja     = models.DateTimeField(
                         null=True,
                         blank=True,
                         verbose_name='Fecha de baja',
                         help_text='Se registra al dar de baja al usuario.'
                     )
    # ─────────────────────────────────────────────────────────────────────────

    objects = UsuarioManager()

    # Django usará el EMAIL como campo de login (en vez del username)
    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['nombre']  # Campos extra requeridos al crear superusuario

    class Meta:
        verbose_name        = 'Usuario'
        verbose_name_plural = 'Usuarios'
        db_table            = 'usuarios'  # Nombre de la tabla en MySQL

    def __str__(self):
        return f'{self.nombre} <{self.email}>'

    def get_dashboard_url(self):
        """Devuelve la URL del dashboard según el rol del usuario."""
        rutas = {
            'adminprincipal': 'adminprincipal_dashboard',
            'admin':        'admin_dashboard',
            'usuariovip':   'usuariovip_dashboard',
            'usuariocomun': 'usuariocomun_dashboard',
        }
        from django.urls import reverse
        return reverse(rutas.get(self.rol, 'login'))
