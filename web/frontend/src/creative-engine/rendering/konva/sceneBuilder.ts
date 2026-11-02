import Konva from "konva";
import type { CreativeDocument } from "../../domain/document/types.ts";
import type { Element } from "../../domain/elements/types.ts";
import { placementOf } from "./geometry.ts";
import { imageKey } from "../svgImages.ts";
import { layoutImage } from "./imageFit.ts";
import { shadowConfig, shapeConfig, textConfig } from "./mappers.ts";

// Scène d'export (ADR-008) : construite hors écran depuis le document, avec les mêmes correspondances que
// l'affichage (mappers, imageFit, geometry). Elle ne contient ni poignées, ni sélection, ni repères, et ne
// dépend ni du zoom ni de la vue de l'éditeur. Les polices et les images doivent être prêtes : la scène ne
// charge rien et n'attend rien.

export interface SceneOptions {
  /** Facteur entre les px du document et les px de l'image produite. */
  readonly pixelRatio: number;
  /** Marge ajoutée autour de la page (fond perdu), en px du document ; le fond de page s'y prolonge. */
  readonly bleedPx: number;
  /** « page » : fond de la page sur blanc, comme dans l'éditeur ; « transparent » : éléments seuls. */
  readonly background: "page" | "transparent";
}

function elementNode(
  element: Element,
  images: ReadonlyMap<string, HTMLImageElement>,
  assets: CreativeDocument["assets"],
): Konva.Group | null {
  if (element.hidden) return null;
  const group = new Konva.Group({ ...placementOf(element), opacity: element.opacity, listening: false });
  switch (element.type) {
    case "text":
      group.add(new Konva.Text(textConfig(element)));
      break;
    case "shape": {
      const shape = shapeConfig(element);
      group.add(
        shape.kind === "rect"
          ? new Konva.Rect(shape.config)
          : shape.kind === "ellipse"
            ? new Konva.Ellipse(shape.config)
            : new Konva.Line(shape.config),
      );
      break;
    }
    case "image": {
      const image = images.get(imageKey(element, assets[element.assetId]));
      // L'appelant vérifie les images avant : une image absente ici est une erreur de programmation.
      if (!image) throw new Error(`Image non préparée pour l'élément ${element.id}`);
      const layout = layoutImage(
        element.fit,
        element,
        { width: image.naturalWidth, height: image.naturalHeight },
        element.crop,
      );
      group.add(new Konva.Image({ image, ...layout, ...shadowConfig(element.shadow) }));
      break;
    }
  }
  return group;
}

/**
 * Dessine le document dans un nouveau canvas de (page + 2 × fond perdu) × pixelRatio pixels. Le contenu hors
 * de cette zone est coupé, comme dans l'éditeur. `images` : fichier décodé de chaque ressource utilisée (clé : imageKey, la teinte d'un SVG comprise).
 */
export function renderDocumentToCanvas(
  document: CreativeDocument,
  images: ReadonlyMap<string, HTMLImageElement>,
  options: SceneOptions,
): HTMLCanvasElement {
  const { page } = document;
  const bleed = options.bleedPx;
  const width = page.width + 2 * bleed;
  const height = page.height + 2 * bleed;
  // Conteneur détaché : la scène n'apparaît jamais dans la page.
  const container = window.document.createElement("div");
  const stage = new Konva.Stage({ container, width, height, x: bleed, y: bleed, listening: false });
  try {
    const background = new Konva.Layer({ listening: false });
    if (options.background === "page") {
      const area = { x: -bleed, y: -bleed, width, height };
      // Blanc sous le fond : un fond semi-transparent (#RRGGBBAA) apparaît comme dans l'éditeur.
      background.add(
        new Konva.Rect({ ...area, fill: "#FFFFFF" }),
        new Konva.Rect({ ...area, fill: page.background.color }),
      );
    }
    const content = new Konva.Layer({
      listening: false,
      clipX: -bleed,
      clipY: -bleed,
      clipWidth: width,
      clipHeight: height,
    });
    for (const element of document.elements) {
      const node = elementNode(element, images, document.assets);
      if (node) content.add(node);
    }
    stage.add(background, content);
    return stage.toCanvas({ x: 0, y: 0, width, height, pixelRatio: options.pixelRatio });
  } finally {
    stage.destroy();
  }
}
