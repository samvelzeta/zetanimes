// Compatibility wrapper — usa el AdsterraBanner moderno (script real, no iframe interno).
import AdsterraBanner from "./AdsterraBanner";

export default function AdBanner300x250() {
  return (
    <AdsterraBanner
      adKey="b411f21fa26a4e8427eb13433959b4e8"
      width={300}
      height={250}
      uid="home-top10-300x250"
    />
  );
}
