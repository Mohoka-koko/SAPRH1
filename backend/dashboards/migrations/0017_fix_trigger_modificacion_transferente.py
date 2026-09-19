from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('dashboards', '0008_triggers_presupuesto'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
-- ============================================================================
-- CORRECCIÓN: trigger de modificacion_transferente
-- En Modo B (imputacion_detalle_id no nulo) NO debe tocar saldo_actual
-- porque el saldo ya fue descontado cuando se creó la imputación.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_modificacion_transferente()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_usuario_id      bigint;
    v_expediente      varchar;
    v_tipo_transf     varchar;
BEGIN
    SELECT usuario_id, nro_expediente, tipo_transferente
    INTO v_usuario_id, v_expediente, v_tipo_transf
    FROM public.modificacion
    WHERE id = NEW.modificacion_id;

    -- Solo descontar saldo_actual en Modo A (presupuesto general).
    -- En Modo B el dinero ya fue descontado cuando se creó la imputación.
    IF v_tipo_transf = 'general' OR NEW.imputacion_detalle_id IS NULL THEN
        UPDATE public.linea_presupuestaria
        SET saldo_actual = saldo_actual - NEW.importe
        WHERE id = NEW.linea_origen_id;
    END IF;

    INSERT INTO public.movimientos_presupuestarios
        (tipo, referencia_id, fecha, monto, descripcion, linea_presupuestaria_id, usuario_id)
    VALUES (
        'MODIFICACION_SALIDA',
        NEW.id,
        now(),
        -NEW.importe,
        'Modificación (salida) exp. ' || COALESCE(v_expediente, 's/n')
            || CASE WHEN v_tipo_transf = 'imputacion'
                    THEN ' — desde Imputación'
                    ELSE ' — Presupuesto General'
               END,
        NEW.linea_origen_id,
        v_usuario_id
    );

    RETURN NEW;
END;
$$;
""",
            reverse_sql=r"""
-- Restaurar trigger original (sin distinción de modo)
CREATE OR REPLACE FUNCTION public.trg_fn_modificacion_transferente()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_usuario_id bigint; v_expediente varchar;
BEGIN
    SELECT usuario_id, nro_expediente INTO v_usuario_id, v_expediente
    FROM public.modificacion WHERE id = NEW.modificacion_id;
    UPDATE public.linea_presupuestaria SET saldo_actual = saldo_actual - NEW.importe
    WHERE id = NEW.linea_origen_id;
    INSERT INTO public.movimientos_presupuestarios
        (tipo, referencia_id, fecha, monto, descripcion, linea_presupuestaria_id, usuario_id)
    VALUES ('MODIFICACION_SALIDA', NEW.id, now(), -NEW.importe,
        'Modificación (salida) exp. ' || COALESCE(v_expediente, 's/n'),
        NEW.linea_origen_id, v_usuario_id);
    RETURN NEW;
END;
$$;
""",
        ),
    ]