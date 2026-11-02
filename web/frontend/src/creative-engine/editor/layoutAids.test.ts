import { describe, expect, it } from "vitest";
import { alignMoves, boundsOf, distributeMoves, SAFE_MARGIN, snapBox, snapPoint, snapTargets } from "./layoutAids.ts";

const PAGE = { width: 1080, height: 1350 };
const el = (id: string, x: number, y: number, width = 100, height = 50, rotation = 0) => ({ id, x, y, width, height, rotation });

describe("boîte englobante", () => {
  it("contient l'élément tourné", () => {
    const box = boundsOf(el("a", 0, 0, 100, 50, 90));
    expect(box.width).toBeCloseTo(50);
    expect(box.height).toBeCloseTo(100);
    expect(box.x).toBeCloseTo(25);
    expect(box.y).toBeCloseTo(-25);
  });
});

describe("magnétisme", () => {
  const targets = snapTargets(PAGE, [boundsOf(el("autre", 600, 300, 200, 100))]);

  it("accroche le milieu de la boîte au milieu de la page", () => {
    const snap = snapBox({ x: 487, y: 900, width: 100, height: 40 }, targets, 6);
    expect(snap.dx).toBe(3);
    expect(snap.guides.x).toEqual([540]);
  });

  it("accroche un bord à la marge de sécurité et au bord d'un autre élément", () => {
    const snap = snapBox({ x: SAFE_MARGIN + 4, y: 395, width: 100, height: 40 }, targets, 6);
    expect(snap).toMatchObject({ dx: -4, dy: 5, guides: { x: [SAFE_MARGIN], y: [400] } });
  });

  it("n'accroche rien au-delà de la tolérance", () => {
    expect(snapBox({ x: 200, y: 700, width: 100, height: 40 }, targets, 6)).toEqual({ dx: 0, dy: 0, guides: { x: [], y: [] } });
  });

  it("accroche une poignée de redimensionnement", () => {
    expect(snapPoint({ x: 797, y: 10 }, targets, 6)).toMatchObject({ dx: 3, dy: 0, guides: { x: [800], y: [] } });
  });
});

describe("alignement", () => {
  it("aligne un élément seul sur la page", () => {
    expect(alignMoves([el("a", 10, 10)], "center", PAGE)).toEqual([{ id: "a", x: 490, y: 10 }]);
    expect(alignMoves([el("a", 10, 10)], "bottom", PAGE)).toEqual([{ id: "a", x: 10, y: 1300 }]);
  });

  it("aligne plusieurs éléments entre eux, sans renvoyer ceux déjà en place", () => {
    const moves = alignMoves([el("a", 10, 10), el("b", 300, 80, 50), el("c", 100, 40)], "right", PAGE);
    expect(moves).toEqual([
      { id: "a", x: 250, y: 10 },
      { id: "c", x: 250, y: 40 },
    ]);
  });
});

describe("distribution", () => {
  it("répartit à espaces égaux, les extrêmes restent en place", () => {
    const moves = distributeMoves([el("a", 0, 0), el("c", 500, 0), el("b", 120, 0, 60)], "horizontal");
    // Étendue 600, largeurs 260 : deux espaces de 170 ; b va en 270.
    expect(moves).toEqual([{ id: "b", x: 270, y: 0 }]);
  });

  it("ne fait rien sous 3 éléments", () => {
    expect(distributeMoves([el("a", 0, 0), el("b", 300, 0)], "vertical")).toEqual([]);
  });
});
