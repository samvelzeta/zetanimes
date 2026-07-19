import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/60">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center gap-3 md:gap-6 text-center md:text-left">
        <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
          <strong className="text-foreground">ZetAnime</strong> no aloja ni distribuye archivos de video. Somos un
          índice de reproductores embebidos de terceros. Todos los derechos pertenecen a sus respectivos autores y
          licenciantes. Para retirar un enlace escríbenos a{" "}
          <a href="mailto:zetanimes@gmail.com" className="text-primary hover:underline font-bold">zetanimes@gmail.com</a>.
        </p>
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
          <Link to="/terms" className="text-muted-foreground hover:text-primary transition">Términos</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/dmca" className="text-muted-foreground hover:text-primary transition">DMCA</Link>
          <span className="text-muted-foreground/40">·</span>
          <a href="mailto:zetanimes@gmail.com" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition">
            <Mail className="w-3 h-3" /> Contacto
          </a>
        </div>
      </div>
    </footer>
  );
}
