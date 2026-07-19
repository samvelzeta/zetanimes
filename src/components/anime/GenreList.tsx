import { Link } from "react-router-dom";

const R2 = "https://pub-e2479e62bcc84fb097a7117ec086f7e7.r2.dev/genres";

const GENRES = [
  { name: "Acción", query: "Action", color: "from-red-600 to-red-900", img: `${R2}/accion.png`, offsetY: 0 },
  { name: "Romance", query: "Romance", color: "from-pink-500 to-pink-800", img: `${R2}/romance.png`, offsetY: 0 },
  { name: "Fantasía", query: "Fantasy", color: "from-purple-500 to-purple-800", img: `${R2}/fantasia.png`, offsetY: 0 },
  { name: "Terror", query: "Horror", color: "from-gray-600 to-gray-900", img: `${R2}/terror.png`, offsetY: 0 },
  { name: "Comedia", query: "Comedy", color: "from-yellow-500 to-yellow-800", img: `${R2}/comedia.png`, offsetY: 0 },
  { name: "Drama", query: "Drama", color: "from-blue-500 to-blue-800", img: `${R2}/drama.png`, offsetY: 0 },
  { name: "Aventura", query: "Adventure", color: "from-green-500 to-green-800", img: `${R2}/aventura.png`, offsetY: 0 },
  { name: "Sci-Fi", query: "Sci-Fi", color: "from-cyan-500 to-cyan-800", img: `${R2}/scifi.png`, offsetY: 10 },
  { name: "Deportes", query: "Sports", color: "from-orange-500 to-orange-800", img: `${R2}/deportes.png`, offsetY: 10 },
  { name: "Misterio", query: "Mystery", color: "from-indigo-500 to-indigo-800", img: `${R2}/misterio.png`, offsetY: 0 },
];

export default function GenreList() {
  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-3">🎭 Géneros</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {GENRES.map(({ name, query, color, img, offsetY }) => (
          <Link
            key={name}
            to={`/directory?genre=${query}`}
            className="group relative h-28 rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-105 active:scale-105"
          >
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-90`} />

            {/* Imagen servida desde R2 con cache immutable de 1 año en el navegador */}
            <img
              src={img}
              alt={name}
              loading="lazy"
              decoding="async"
              draggable={false}
              style={offsetY ? { ['--genre-offset' as any]: `${offsetY}px` } : undefined}
              className={`absolute right-0 -bottom-1 h-[120%] w-auto object-cover object-top pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-all duration-300 drop-shadow-lg ${offsetY ? "translate-y-[var(--genre-offset)] group-hover:scale-110" : "group-hover:scale-110"}`}
            />

            {/* Genre name */}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
              <span className="text-sm font-black text-white drop-shadow-md">{name}</span>
            </div>

            {/* Subtle overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </Link>
        ))}
      </div>
    </section>
  );
}
