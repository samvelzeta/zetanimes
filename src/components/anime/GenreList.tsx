import { Link } from "react-router-dom";
import { Swords, Heart, Sparkles, Ghost, Laugh, Theater, Mountain, Rocket, Shield, HelpCircle } from "lucide-react";

const GENRES = [
  { name: "Acción", icon: Swords, color: "from-red-600 to-red-800" },
  { name: "Romance", icon: Heart, color: "from-pink-500 to-pink-700" },
  { name: "Fantasía", icon: Sparkles, color: "from-purple-500 to-purple-700" },
  { name: "Terror", icon: Ghost, color: "from-gray-600 to-gray-800" },
  { name: "Comedia", icon: Laugh, color: "from-yellow-500 to-yellow-700" },
  { name: "Drama", icon: Theater, color: "from-blue-500 to-blue-700" },
  { name: "Aventura", icon: Mountain, color: "from-green-500 to-green-700" },
  { name: "Sci-Fi", icon: Rocket, color: "from-cyan-500 to-cyan-700" },
  { name: "Deportes", icon: Shield, color: "from-orange-500 to-orange-700" },
  { name: "Misterio", icon: HelpCircle, color: "from-indigo-500 to-indigo-700" },
];

export default function GenreList() {
  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-3">🎭 Géneros</h2>
      <div className="flex gap-3 justify-center flex-wrap">
        {GENRES.map(({ name, icon: Icon, color }) => (
          <Link key={name} to={`/directory?genre=${name}`} className="flex flex-col items-center gap-1.5 w-16">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg transition-transform hover:scale-110`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground text-center">{name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
