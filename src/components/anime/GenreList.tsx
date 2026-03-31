import { Link } from "react-router-dom";

import accionImg from "@/assets/genres/accion.png";
import romanceImg from "@/assets/genres/romance.png";
import fantasiaImg from "@/assets/genres/fantasia.png";
import terrorImg from "@/assets/genres/terror.png";
import comediaImg from "@/assets/genres/comedia.png";
import dramaImg from "@/assets/genres/drama.png";
import aventuraImg from "@/assets/genres/aventura.png";
import scifiImg from "@/assets/genres/scifi.png";
import deportesImg from "@/assets/genres/deportes.png";
import misterioImg from "@/assets/genres/misterio.png";

const GENRES = [
  { name: "Acción", query: "Action", color: "from-red-600 to-red-900", img: accionImg },
  { name: "Romance", query: "Romance", color: "from-pink-500 to-pink-800", img: romanceImg },
  { name: "Fantasía", query: "Fantasy", color: "from-purple-500 to-purple-800", img: fantasiaImg },
  { name: "Terror", query: "Horror", color: "from-gray-600 to-gray-900", img: terrorImg },
  { name: "Comedia", query: "Comedy", color: "from-yellow-500 to-yellow-800", img: comediaImg },
  { name: "Drama", query: "Drama", color: "from-blue-500 to-blue-800", img: dramaImg },
  { name: "Aventura", query: "Adventure", color: "from-green-500 to-green-800", img: aventuraImg },
  { name: "Sci-Fi", query: "Sci-Fi", color: "from-cyan-500 to-cyan-800", img: scifiImg },
  { name: "Deportes", query: "Sports", color: "from-orange-500 to-orange-800", img: deportesImg },
  { name: "Misterio", query: "Mystery", color: "from-indigo-500 to-indigo-800", img: misterioImg },
];

export default function GenreList() {
  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-3">🎭 Géneros</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {GENRES.map(({ name, query, color, img }) => (
          <Link
            key={name}
            to={`/directory?genre=${query}`}
            className="group relative h-28 rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-105 active:scale-105"
          >
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-90`} />
            
            {/* Character image - positioned right, overflowing top */}
            <img
              src={img}
              alt={name}
              className="absolute right-0 -bottom-1 h-[120%] w-auto object-cover object-top pointer-events-none select-none opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 drop-shadow-lg"
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
