# Corregir búsqueda tolerante y títulos aprobados

## Objetivo
Hacer que títulos aprobados como **Yosuga no Sora** aparezcan siempre, incluso cuando el buscador externo falle, y aceptar consultas sin espacios o con errores pequeños.

## Cambios
- Añadir un índice público seguro con solo ID, título y slug de animes aprobados; nunca expondrá enlaces de reproducción.
- Combinar ese índice con AniList/Jikan para que los animes aprobados no dependan de que una API externa acepte contenido adulto.
- Comparar búsquedas ignorando espacios, acentos, signos y errores ortográficos leves.
- Probar casos como `Yosuga no Sora`, `YosuganoSora`, `Yosuga no Sra` y títulos normales.
- Mantener la regla actual: los +18 solo aparecen en búsqueda cuando ya fueron aprobados por Seeke o slug.

## Detalles técnicos
- La causa confirmada es doble: AniList está respondiendo 403 y el respaldo Jikan usa filtro seguro, que excluye Yosuga no Sora.
- El catálogo seguro se resolverá en el backend y devolverá únicamente metadatos de búsqueda, sin URLs madre ni fuentes.
- Se conservarán cachés para evitar aumentar consultas a la base de datos.
