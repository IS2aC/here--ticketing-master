import { Line } from "react-konva";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useSnapGuides } from "./snapping.ts";

const GUIDE = "#E10600";

/** Guides d'accroche pendant un geste : traits fins sur toute la page, d'épaisseur constante à l'écran. */
export function SnapGuides() {
  const guides = useSnapGuides();
  const page = useDocumentStore((s) => s.history.present.page);
  return (
    <>
      {guides.x.map((x) => (
        <Line key={`x${x}`} points={[x, 0, x, page.height]} stroke={GUIDE} strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false} listening={false} />
      ))}
      {guides.y.map((y) => (
        <Line key={`y${y}`} points={[0, y, page.width, y]} stroke={GUIDE} strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false} listening={false} />
      ))}
    </>
  );
}
