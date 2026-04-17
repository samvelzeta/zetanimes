// Compatibility wrapper — usa el AdsterraBanner moderno (script real, no iframe interno).
// Se mantiene la API original (forwardRef sin props) para no romper imports existentes.
import { forwardRef } from "react";
import AdsterraBanner from "./AdsterraBanner";

const AdBanner300x250 = forwardRef<HTMLDivElement>((_, _outerRef) => (
  <AdsterraBanner
    adKey="b411f21fa26a4e8427eb13433959b4e8"
    width={300}
    height={250}
    uid="home-top10-300x250"
  />
));
AdBanner300x250.displayName = "AdBanner300x250";
export default AdBanner300x250;
