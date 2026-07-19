import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldAlert, Clock } from "lucide-react";

export default function Dmca() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/60 hover:border-primary/50 hover:text-primary transition text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a ZetAnime
          </Link>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">DMCA · Retirada</span>
        </div>

        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6 mb-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-2xl font-black text-foreground mb-2">Política DMCA / Retirada de contenido</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">ZetAnime no aloja, sube, transcodifica ni distribuye videos</strong>.
                Somos únicamente un <strong className="text-foreground">índice</strong> de reproductores embebidos
                de terceros. Todos los videos residen en servidores ajenos que no controlamos.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5 mb-4">
          <h2 className="text-base font-black text-foreground mb-3">Cómo solicitar la retirada de un enlace</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Si eres titular de derechos (o su representante autorizado) y detectas que un enlace embebido en nuestro
            índice remite a una obra tuya sin permiso, escríbenos y lo retiramos de inmediato. No necesitas
            demandarnos ni iniciar proceso legal: basta un correo amable con estos datos.
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Nombre de la obra (título del anime) y episodios afectados.</li>
            <li>URL(s) de la página de ZetAnime donde aparece el enlace.</li>
            <li>Declaración de buena fe de que el uso no está autorizado.</li>
            <li>Datos de contacto (nombre y correo) y, si aplica, tu representación legal.</li>
          </ul>
        </section>

        <a
          href="mailto:zetanimes@gmail.com?subject=Solicitud%20de%20retirada%20DMCA"
          className="flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 hover:bg-primary/20 transition p-5 mb-4"
        >
          <Mail className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-black text-foreground">zetanimes@gmail.com</p>
            <p className="text-xs text-muted-foreground">Canal oficial de retirada. Respuesta rápida y sin trámites.</p>
          </div>
        </a>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-primary">Tiempo de respuesta</p>
            </div>
            <p className="text-sm text-muted-foreground">Tratamos de responder y retirar en menos de 48 horas hábiles.</p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">Contranotificación</p>
            <p className="text-sm text-muted-foreground">Si crees que un enlace fue retirado por error, puedes escribirnos al mismo correo para revisarlo.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/80 text-center">
          Al enviar una solicitud declaras actuar de buena fe. ZetAnime coopera con los titulares y no defenderá el
          alojamiento de contenido protegido — solo indexamos enlaces públicos que ya circulan en la web.
        </p>
      </div>
    </div>
  );
}
