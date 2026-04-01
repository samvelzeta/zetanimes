## Plan de Implementación - Todo junto

### Fase A: Base de datos y estructura
1. **Migración DB**: Crear tabla `latino_episodes` para almacenar episodios HLS subidos con campos: slug, episode_number, sources JSON, status, timestamps
2. **Migración DB**: Crear tabla `app_settings` para guardar configuración de R2 (account_id, bucket_name, public_url) - valores se llenan después

### Fase B: Slug Resolution Fix
3. **Arreglar `zetapi.ts`**: Mejorar `resolveSlugFromTitle()` para hacer múltiples intentos de resolución (título completo, sin caracteres especiales, solo palabras principales)
4. **Cache de slugs**: Guardar slugs resueltos en DB para no repetir búsquedas

### Fase C: Download Tracker Mejoras
5. **Edge Function `check-new-episodes`**: Cron job que cada 2-3h revisa si hay nuevos capítulos de los animes en agenda
6. **Rotación de sugerencias**: En vez de scroll infinito, rotar animes sugeridos cada vez que se carga la página
7. **Registro de descargas**: Asegurar que todo quede registrado (qué se descargó, cuándo)

### Fase D: Superadmin - Upload HLS Latino
8. **Edge Function `upload-hls`**: Recibe ZIP con estructura HLS, lo descomprime y sube a R2 (preparado, esperando credenciales R2)
9. **Panel Upload**: UI en superadmin con botón por episodio para subir, estados (pendiente/subido/en proceso)
10. **Generación JSON automática**: Al subir, generar JSON compatible con la API

### Fase E: Player y APK
11. **Player**: Guardar progreso en localStorage (`time-{slug}-{episode}`), restaurar al recargar
12. **APK Detection**: Detectar WebView y evitar reloads innecesarios
13. **Prioridad HLS**: Si existe fuente latino HLS, usarla primero; fallback a scraper sub

### Fase F: Secrets pendientes
14. Dejar placeholders para: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
