export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-8 pb-24 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-foreground mb-6">Términos y Condiciones & Políticas de Privacidad</h1>

      {/* Aviso destacado DMCA / no alojamiento */}
      <div className="mb-8 rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 space-y-3"
        style={{ boxShadow: "0 0 22px hsl(var(--primary) / 0.18)" }}>
        <h2 className="text-base font-black text-primary uppercase tracking-wider">
          Aviso importante · Política de contenido
        </h2>
        <p className="text-sm text-foreground leading-relaxed">
          <strong className="text-primary">ZetAnime NO aloja, almacena, produce ni distribuye ningún contenido audiovisual de anime.</strong>
          Somos únicamente un sitio <strong className="text-foreground">recopilador de enlaces</strong> a reproductores embebidos
          (players) de terceros. No poseemos, no gestionamos y no tenemos control sobre los servidores externos que sirven ese contenido.
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          Todos los derechos de las series, imágenes, música y demás material pertenecen a sus respectivos autores, estudios,
          licenciatarios y distribuidores oficiales. Nuestra función se limita a organizar e indexar enlaces públicamente
          disponibles en internet con fines puramente informativos y de recomendación.
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          Si eres <strong className="text-foreground">titular de derechos</strong> o representante autorizado y no deseas que
          recopilemos enlaces de una obra en particular, te pedimos amablemente que <strong className="text-primary">no interpongas acciones legales</strong> sin antes contactarnos.
          Basta con una solicitud amistosa por correo indicando el anime en cuestión y procederemos a
          <strong className="text-foreground"> eliminarlo de inmediato</strong> de nuestro índice, sin necesidad de trámites judiciales.
        </p>
        <div className="rounded-xl bg-background/60 border border-primary/30 p-3">
          <p className="text-xs text-muted-foreground mb-1">Contacto para retiradas de contenido (DMCA / Takedown):</p>
          <a href="mailto:zetanimes@gmail.com" className="text-primary font-black text-base hover:underline break-all">
            zetanimes@gmail.com
          </a>
          <p className="text-[11px] text-muted-foreground mt-2">
            Incluye en tu mensaje: nombre del anime, motivo de la solicitud y acreditación como titular de derechos o representante.
            Respondemos y actuamos generalmente en menos de 48 horas.
          </p>
        </div>
      </div>

      <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground">1. Términos de Uso</h2>
          <p>Al acceder y utilizar ZetAnime, aceptas cumplir con estos términos. ZetAnime es una plataforma de entretenimiento que permite a los usuarios explorar, buscar y descubrir enlaces a contenido anime disponibles en la web.</p>
          <p>El servicio se proporciona "tal cual" sin garantías de disponibilidad continua. Nos reservamos el derecho de modificar, suspender o discontinuar cualquier aspecto del servicio.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">2. Cuentas de Usuario</h2>
          <p>Para acceder a funciones completas, debes crear una cuenta con información precisa y actualizada. Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</p>
          <p>Cada persona puede tener una sola cuenta. Las cuentas duplicadas pueden ser eliminadas sin previo aviso.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">3. Membresía Premium</h2>
          <p>La membresía Premium ofrece beneficios adicionales como experiencia sin anuncios, calidad mejorada y funciones exclusivas. Los pagos no son reembolsables una vez procesados.</p>
          <p>Las membresías anuales se renuevan de forma manual. Las membresías vitalicias no tienen fecha de expiración.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">4. Contenido y naturaleza del servicio</h2>
          <p><strong className="text-foreground">ZetAnime no aloja directamente ningún contenido audiovisual.</strong> Actuamos exclusivamente como <strong className="text-foreground">agregador e indexador de enlaces</strong> a reproductores embebidos de terceros que ya se encuentran públicamente disponibles en internet.</p>
          <p>No producimos, no codificamos, no subimos, no almacenamos y no distribuimos los videos. No tenemos ninguna relación comercial, técnica ni de propiedad con los servidores externos que sirven el contenido.</p>
          <p>Todo el contenido mostrado pertenece a sus respectivos autores, estudios, licenciatarios y distribuidores oficiales. Cualquier reclamo respecto al contenido en sí debe dirigirse a la fuente original que lo hospeda.</p>
          <p>Si eres titular de derechos y deseas que retiremos enlaces relacionados con tu obra, escríbenos a <a href="mailto:zetanimes@gmail.com" className="text-primary font-bold">zetanimes@gmail.com</a> y procederemos de forma inmediata y amistosa, sin necesidad de acciones legales.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">5. Política de Privacidad</h2>
          <p>Recopilamos información limitada: correo electrónico, nombre de usuario, historial de visualización y preferencias de configuración.</p>
          <p>Tu información personal no será vendida ni compartida con terceros. Se utiliza exclusivamente para mejorar tu experiencia en la plataforma.</p>
          <p><strong className="text-foreground">Eliminación por inactividad:</strong> por privacidad y seguridad, las cuentas que permanezcan <strong className="text-foreground">sin iniciar sesión durante más de 6 meses</strong> se eliminarán automáticamente junto con sus perfiles, historial y preferencias. Este proceso se ejecuta periódicamente y no se puede revertir. Las cuentas de administración están exentas.</p>
          <p>Puedes solicitar la eliminación anticipada de tu cuenta en cualquier momento desde el soporte de la app o escribiendo a <a href="mailto:zetanimes@gmail.com" className="text-primary font-bold">zetanimes@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">6. Cookies y Almacenamiento</h2>
          <p>Utilizamos cookies y almacenamiento local para recordar tus preferencias, mantener tu sesión activa y personalizar tu experiencia.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">7. Conducta del Usuario</h2>
          <p>Está prohibido el uso indebido de la plataforma, incluyendo pero no limitado a: intentos de hackeo, spam, distribución de malware, y uso de múltiples cuentas para evadir restricciones.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">8. Limitación de Responsabilidad</h2>
          <p>Dado que ZetAnime no aloja ni controla el contenido de terceros, no nos hacemos responsables por la disponibilidad, legalidad, exactitud o calidad del material accesible mediante los enlaces indexados.</p>
          <p>ZetAnime no se hace responsable por daños directos, indirectos, incidentales o consecuentes que resulten del uso o la imposibilidad de uso del servicio.</p>
          <p>El usuario reconoce que el servicio es de uso voluntario y acepta utilizarlo bajo su propio riesgo.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">9. Solicitudes de retirada (Takedown / DMCA)</h2>
          <p>Atendemos toda solicitud de retirada de enlaces de forma <strong className="text-foreground">amistosa, gratuita e inmediata</strong>. No es necesario iniciar procesos legales: basta con un correo educado.</p>
          <p>Envía tu solicitud a <a href="mailto:zetanimes@gmail.com" className="text-primary font-bold">zetanimes@gmail.com</a> indicando:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nombre del anime u obra afectada.</li>
            <li>Motivo de la solicitud.</li>
            <li>Acreditación como titular de derechos o representante autorizado.</li>
          </ul>
          <p>Procesaremos la retirada en un plazo máximo aproximado de 48 horas desde la recepción del correo.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">10. Modificaciones</h2>
          <p>Nos reservamos el derecho de actualizar estos términos en cualquier momento. Los cambios entran en vigor inmediatamente después de su publicación. El uso continuado implica aceptación.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">11. Contacto</h2>
          <p>Para cualquier duda, reclamo, solicitud de retirada o consulta general, escríbenos a: <a href="mailto:zetanimes@gmail.com" className="text-primary font-bold">zetanimes@gmail.com</a></p>
        </section>

        <p className="text-xs text-muted-foreground/60 mt-8">Última actualización: Julio 2026 · ZetAnime</p>
      </div>
    </div>
  );
}
