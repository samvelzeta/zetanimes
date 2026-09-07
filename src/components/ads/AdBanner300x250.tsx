// Compatibility wrapper — usa el AdsterraBanner moderno (script real, no iframe interno).
import AdsterraBanner from "./AdsterraBanner";
import { adKey } from "@/config/ads";

export default function AdBanner300x250() {
  return (
    <AdsterraBanner
      adKey={adKey("300x250")}
      width={300}
      height={250}
      uid="home-top10-300x250"
    />
  );
}
