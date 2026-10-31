import { describe, expect, it } from "vitest";
import { CANVAS, QR_BOX, qrPosition, textBox, type TextLayout } from "./layout";

const NAME: TextLayout = { x: 540, y: 700, size: 64, color: "#0B0B0B", font: "serif", bold: false };

describe("mise en page d'une carte dessinée dans l'éditeur", () => {
  it("garde la zone exacte du texte placée dans l'éditeur", () => {
    const box = { left: 100, top: 650, width: 880, height: 90 };
    expect(textBox({ ...NAME, box })).toEqual(box);
    expect(textBox(NAME).width).toBeGreaterThan(0); // sans zone : calculée autour du centre
  });

  it("centre le sceau sur le QR code placé, sans sortir de la carte", () => {
    expect(qrPosition({ x: 540, y: 675 })).toEqual({ left: 540 - QR_BOX.width / 2, top: 675 - QR_BOX.height / 2 });
    expect(qrPosition({ x: 1080, y: 1350 })).toEqual({ left: CANVAS.width - QR_BOX.width, top: CANVAS.height - QR_BOX.height });
    expect(qrPosition({ x: 0, y: 0 })).toEqual({ left: 0, top: 0 });
  });
});
