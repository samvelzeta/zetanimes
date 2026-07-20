## Diagnóstico verificado

- La base sí tiene contenido: `approved_animes` tiene 752 aprobados, `hidden_pending_animes` tiene 121 ocultos activos y `video_cache` tiene 826 animes distintos con enlace madre Seeke.
- El panel de Pendientes se alimenta principalmente desde llamadas del navegador a AniList y de memoria de sesión. Eso no crea una reserva persistente en la base; si el navegador cachea, rate-limitea o ya filtró mucho contenido, parece que “no actualiza”.
- El contador de Aprobados dentro de Pendientes está usando el conteo del pool visible, no el total real de la base; por eso no refleja los 752 aprobados.
- El Dashboard ya tiene un acceso a Pendientes, pero la alerta muestra el total de aprobados como si fuera pendientes/reserva, lo cual confunde.
- La gestión de enlaces Seeke está dividida entre Pendientes, Videos, Bloques y guardados; funciona, pero está desordenada para trabajar rápido.

## Plan de implementación

### 1. Crear una reserva persistente para Pendientes

Agregar una tabla de backend `pending_anime_reserve` para guardar candidatos detectados para Home/Pendientes, con campos de dominio como:

- `anilist_id`
- `title`
- `cover_image`
- `status`
- `format`
- `episodes`
- `average_score`
- `source`
- `priority`
- `last_seen_at`

Reglas:

- Solo admin/owner puede gestionar la reserva.
- La app no dependerá solo de lo que cargue el navegador en ese momento.
- Los ocultos 7 días y aprobados se respetan al mostrar la bandeja.

### 2. Mejorar el refresh de Pendientes

Actualizar `PendingApproval.tsx` para que:

- Lea primero desde `pending_anime_reserve`.
- Tenga un botón claro tipo “Buscar nuevos para reserva”.
- Al refrescar, consulte varias fuentes de AniList, mezcle resultados y guarde/actualice la reserva en backend.
- Muestre en tiempo real lo que entra nuevo en la bandeja sin depender de `sessionStorage`.
- Limpie o ignore expirados/ocultos para que no vuelva el bug de contador con lista vacía.

### 3. Arreglar contadores

En `PendingApproval.tsx`:

- “Pendientes” = candidatos reales renderizables.
- “Aprobados” = total real de `approved_animes` en backend.
- “Ocultos 7d” = ocultos activos.
- Añadir una mini métrica de “Reserva total” para saber cuántos candidatos hay guardados esperando gestión.
- recordar que los animes en reservas que han sido aprovados, son animes que deben permaecer ocultos hasta que el propio sistema realice el nuevo reavastecimiento de animes en el home , la idea es consumir poco a poco esos animes en reserva que se vallan mostrando animes cada cierto tiempo para que el home no se vea taan estatico y tenga mas vida, respetando que siemppre deben de mostrarse y ofrecerse como estreno o los animes HOT en el momento, en emision, 
- los animes en estado en emision se muestran si o si, en eh banner del hoome y en otras secciones, ya el sistema se encarga de gestionar como los quierre mostrar siempre y cuando se roten siempre los que estan en emision en el carruesel del home, y los demas animes que estan en estado finalizado en reserva ya aprovados, se permanecen ahi y se van consumiendo para mostrar en las demas secciones del home e ir actualizando  
pero eso debe funcionar como un stook, se van consumiendo y se va reduciendo los animes en reserva, para agregar mas, igualmente cuando se acaba la reserva simplemente se rotan los animes que ya estan aprovados, se van combinando todo el timepo hasta que haya mas animes aprovados fresquitos para meter al home como nuevo (nuevo pero ya finalizado, nuevo en el home porque ha sido aprovado), y introoducrlo en el home.
- recordar tambine de que en el directorio tambien debes implenetar estesistema, no debe mostrarse en el catalogo animes que no han sido agregados o aaprovados o con enlace seke , si esta vacio ese anime no se puede visualizar en el direcctorio hasta que sean aprovados, lo mismo se dice de las tarjetas de informacion o personajes, si el anime al que pertenecen no tiene alguna cosa de enlace seke  no se puede  mostrar.
- es necesario tambien realizar un refrescado en el directorio tambien, me refiero a que se vallan mostrando otros tipos de animes ya sea finlaizados o en emision, siempre y cuando respeten la regla de que tengan enlace seke, al igual que los personajes y fichas de informacion, deben rotar cada 7 dias.
- para el directorio aplica tambien lo de la reserva, sera una reserva copartida , la reserva servira para el home y ppara el directorio, pero la info de personajes  y fichas, es completamente fuera de esto, estas se actualizaran y rotaran de cada anime y peronaje con base a si tieneenlace seke o no, realiza la seleccion de manera random automatzado, personajes y fichas de informacion, de cualquier anime que este ya indexado en zetanimes y ya tenga elnace seke, como son mucho sanimes y muchos personajes por cada anime, los recursos para estes son exponencialmente enormes asi que se puede permitirse realizar un refresco cada 1 dia. aplca eso.

En `Admin.tsx`:

- Cambiar la tarjeta de alerta para que no muestre aprobados como pendientes.
- Agregar accesos rápidos separados:
  - “Pendientes”
  - “Gestor Seeke” / “Videos”
  - “Reportes”
- Mostrar números útiles: aprobados totales, enlaces madre Seeke y ocultos activos.

### 4. Reorganizar el flujo de gestión Seeke sin romper lo existente

Mantener los módulos actuales, pero ordenar el trabajo así:

```text
Dashboard
  ├─ Pendientes: decidir qué anime entra al Home
  ├─ Gestor Seeke: guardar enlace madre sub/latino y bloques
  ├─ Videos guardados: revisar/reemplazar enlaces existentes
  └─ Reportes: reparar enlaces rotos
```

Cambios concretos:

- En Pendientes, el botón “Avanzado” seguirá abriendo el anime preseleccionado en Videos.
- En Videos, destacar arriba una zona “Enlace madre Seeke” con sub/latino y estado guardado.
- Mantener BlocksEditor debajo, para casos especiales de temporadas/solapamientos.
- No tocar el player ni la lógica de ocultar URLs del inspector.

### 5. Verificación

Después de implementar:

- Confirmar que Pendientes muestra candidatos desde la reserva.
- Confirmar que el botón de refresh agrega/actualiza candidatos.
- Confirmar que Aprobados muestra el conteo real de la base.
- Confirmar que Dashboard abre Pendientes correctamente y muestra métricas coherentes.
- Confirmar que guardar enlaces madre Seeke desde Pendientes/Videos sigue funcionando para sub y latino.
- realizar debug y verificar que cada cosa funcione, y por ningun motivo debemos hacerle daño a los enlaces seke que ya estan en los animes o en la base de datos ya que es lo mas importante de toda la pagina.