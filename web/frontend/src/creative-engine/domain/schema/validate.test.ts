import { describe, expect, it } from "vitest";
import { FIXTURES, rawFixture } from "../../test/documentFixtures.ts";
import type { Migration } from "./migrations.ts";
import { loadDocument, type LoadResult } from "./validate.ts";

// Les données brutes sont modifiées par chemin, comme un fichier corrompu ou forgé le serait.
type Path = readonly (string | number)[];
const DELETE = Symbol("supprimer");
type Edit = readonly [Path, unknown];

function parentOf(root: unknown, path: Path): Record<PropertyKey, unknown> {
  const parent = path.slice(0, -1).reduce<unknown>((node, key) => {
    if (typeof node !== "object" || node === null) throw new Error(`Chemin introuvable : ${path.join(".")}`);
    return (node as Record<PropertyKey, unknown>)[key];
  }, root);
  if (typeof parent !== "object" || parent === null)
    throw new Error(`Chemin introuvable : ${path.join(".")}`);
  return parent as Record<PropertyKey, unknown>;
}

function edit(raw: Record<string, unknown>, ...edits: Edit[]): Record<string, unknown> {
  for (const [path, value] of edits) {
    const key = path.at(-1);
    if (key === undefined) throw new Error("Chemin vide");
    const parent = parentOf(raw, path);
    if (value === DELETE) Reflect.deleteProperty(parent, key);
    else parent[key] = value;
  }
  return raw;
}

/** Exemple 04 ([0] image, [1] titre, [2] date) modifié puis chargé. */
function load04(...edits: Edit[]): LoadResult {
  return loadDocument(edit(rawFixture("04-avec-image.json"), ...edits));
}

function issuesOf(result: LoadResult) {
  if (result.status !== "invalid") throw new Error(`Rejet attendu, obtenu : ${result.status}`);
  return result.issues;
}

const pathsOf = (result: LoadResult) => issuesOf(result).map((issue) => issue.path);
const ASSET_KEY: Path = ["assets", "a0000000-0000-4000-8000-000000000001", "source", "key"];

describe("documents d'exemple", () => {
  it("contient les cinq exemples attendus", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([
      "01-vide.json",
      "02-fond-uni-a5.json",
      "03-titre-sous-titre.json",
      "04-avec-image.json",
      "05-formes-decoratives.json",
    ]);
  });

  it.each(Object.keys(FIXTURES))("%s est valide, sans avertissement", (name) => {
    expect(loadDocument(rawFixture(name))).toMatchObject({ status: "ok", warnings: [] });
  });
});

describe("structure", () => {
  it("rejette ce qui n'est pas un objet", () => {
    for (const input of [null, 42, "doc", []]) {
      expect(issuesOf(loadDocument(input))[0]).toMatchObject({ path: "", code: "invalid_type" });
    }
  });

  it("signale chaque propriété manquante avec son chemin", () => {
    const paths = pathsOf(
      load04([["meta", "title"], DELETE], [["elements", 1, "style", "fontSize"], DELETE]),
    );
    expect(paths).toEqual(expect.arrayContaining(["meta.title", "elements[1].style.fontSize"]));
  });

  it("rejette un type d'élément inconnu", () => {
    expect(pathsOf(load04([["elements", 0, "type"], "video"]))).toEqual(["elements[0].type"]);
  });

  it("accepte les champs invité connus, rejette les autres", () => {
    expect(load04([["elements", 1, "slot"], "guest-name"])).toMatchObject({ status: "ok", warnings: [] });
    expect(pathsOf(load04([["elements", 1, "slot"], "guest-email"]))).toEqual(["elements[1].slot"]);
  });

  it("accepte les effets d'un texte, rejette des valeurs hors limites", () => {
    const shadow = { color: "#0B0B0B40", blur: 12, offsetX: 0, offsetY: 6 };
    const gradient = { from: "#B8862E", to: "#F3D98B", angle: 90 };
    expect(
      load04(
        [["elements", 1, "style", "shadow"], shadow],
        [["elements", 1, "style", "outline"], { color: "#FFFFFF", width: 2 }],
        [["elements", 1, "style", "gradient"], gradient],
      ),
    ).toMatchObject({ status: "ok", warnings: [] });
    expect(pathsOf(load04([["elements", 1, "style", "shadow"], { ...shadow, blur: 900 }]))).toEqual([
      "elements[1].style.shadow.blur",
    ]);
    expect(pathsOf(load04([["elements", 1, "style", "gradient"], { ...gradient, angle: 360 }]))).toEqual([
      "elements[1].style.gradient.angle",
    ]);
  });

  it("rejette les types incorrects", () => {
    const paths = pathsOf(load04([["elements", 0, "x"], "140"], [["elements", 1, "hidden"], "non"]));
    expect(paths).toEqual(expect.arrayContaining(["elements[0].x", "elements[1].hidden"]));
  });
});

describe("valeurs numériques", () => {
  it.each([
    ["NaN", Number.NaN],
    ["l'infini", Number.POSITIVE_INFINITY],
  ])("refuse %s dans une position, avec un message explicite", (_, value) => {
    const [issue] = issuesOf(load04([["elements", 0, "x"], value]));
    expect(issue).toMatchObject({ path: "elements[0].x", code: "non_finite_number" });
    expect(issue?.message).toContain("fini");
  });

  it("accepte une position négative (élément qui déborde de la page)", () => {
    expect(load04([["elements", 0, "x"], -50]).status).toBe("ok");
  });

  it.each<[string, Edit[], string]>([
    ["une largeur nulle", [[["elements", 0, "width"], 0]], "elements[0].width"],
    ["une largeur négative", [[["elements", 0, "width"], -10]], "elements[0].width"],
    ["une rotation de 360°", [[["elements", 0, "rotation"], 360]], "elements[0].rotation"],
    ["une opacité > 1", [[["elements", 0, "opacity"], 1.5]], "elements[0].opacity"],
    ["une taille de police nulle", [[["elements", 1, "style", "fontSize"], 0]], "elements[1].style.fontSize"],
    [
      "une graisse hors liste",
      [[["elements", 1, "style", "fontWeight"], 450]],
      "elements[1].style.fontWeight",
    ],
    ["une couleur mal formée", [[["elements", 1, "style", "color"], "red"]], "elements[1].style.color"],
    [
      "un recadrage hors de l'image",
      [[["elements", 0, "crop"], { x: 0.5, y: 0, width: 0.6, height: 1 }]],
      "elements[0].crop",
    ],
    [
      "une page trop petite",
      [
        [["page", "preset"], "custom"],
        [["page", "width"], 10],
      ],
      "page.width",
    ],
    [
      "une page en px décimaux",
      [
        [["page", "preset"], "custom"],
        [["page", "width"], 1080.5],
      ],
      "page.width",
    ],
  ])("refuse %s", (_, edits, path) => {
    expect(pathsOf(load04(...edits))).toContain(path);
  });
});

describe("règles transverses", () => {
  it("rejette deux éléments de même identifiant", () => {
    const [issue, ...others] = issuesOf(
      load04([["elements", 2, "id"], "e0000000-0000-4000-8000-000000000002"]),
    );
    expect(others).toEqual([]);
    expect(issue?.path).toBe("elements[2].id");
    expect(issue?.message).toContain("double");
  });

  it("rejette une image dont la ressource n'est pas déclarée", () => {
    const [issue] = issuesOf(load04([["elements", 0, "assetId"], "a0000000-0000-4000-8000-000000000099"]));
    expect(issue?.path).toBe("elements[0].assetId");
    expect(issue?.message).toContain("introuvable");
  });

  it.each(["blob:http://localhost/123", "https://cdn.example.com/a.jpg", "data:image/png;base64,AAAA", ""])(
    "rejette la référence de ressource « %s »",
    (key) => {
      expect(pathsOf(load04([ASSET_KEY, key]))).toEqual([
        "assets.a0000000-0000-4000-8000-000000000001.source.key",
      ]);
    },
  );

  it("rejette des dimensions qui ne correspondent pas au format déclaré", () => {
    expect(pathsOf(load04([["page", "width"], 1200]))).toEqual(["page.preset"]);
  });

  it("rejette un format d'impression incohérent avec les pixels", () => {
    const raw = edit(rawFixture("02-fond-uni-a5.json"), [["page", "print", "dpi"], 150]);
    expect(pathsOf(loadDocument(raw))).toEqual(["page.print"]);
  });

  it("rejette une ligne qui a une hauteur ou un remplissage", () => {
    const raw = edit(
      rawFixture("05-formes-decoratives.json"),
      [["elements", 2, "height"], 10],
      [["elements", 2, "fill"], "#FFFFFF"],
    );
    expect(pathsOf(loadDocument(raw))).toEqual(["elements[2].height", "elements[2].fill"]);
  });
});

describe("versions du schéma", () => {
  it.each([
    ["plus récente", 2],
    ["ancienne sans migration", 0],
    ["en texte", "1"],
    ["absente", DELETE],
  ])("refuse une version %s sans l'interpréter", (_, version) => {
    const result = load04([["schemaVersion"], version]);
    expect(result).toMatchObject({ status: "unsupported_version", supported: [1] });
  });

  it("annonce explicitement un document plus récent que le moteur", () => {
    const result = load04([["schemaVersion"], 7]);
    expect(result.status === "unsupported_version" && result.message).toContain("plus récente");
  });

  it("migre un document ancien quand une migration existe (registre de test)", () => {
    // « v0 » fictive : le titre était à la racine, sous `name`.
    const v0 = edit(
      rawFixture("01-vide.json"),
      [["schemaVersion"], 0],
      [["name"], "Ancien titre"],
      [["meta", "title"], DELETE],
    );
    const migrations: Record<number, Migration> = {
      0: ({ name, meta, ...rest }) => ({ ...rest, meta: { ...(meta as object), title: name } }),
    };

    const result = loadDocument(v0, { migrations });

    expect(result.status === "ok" && result.document.meta.title).toBe("Ancien titre");
    expect(result.status === "ok" && result.warnings.map((w) => w.code)).toEqual(["migrated"]);
  });

  it("signale une migration qui échoue sans renvoyer de document", () => {
    const v0 = edit(rawFixture("01-vide.json"), [["schemaVersion"], 0]);
    const migrations: Record<number, Migration> = {
      0: () => {
        throw new Error("champ manquant");
      },
    };

    expect(issuesOf(loadDocument(v0, { migrations }))[0]).toMatchObject({ code: "migration_failed" });
  });
});

describe("champs inconnus", () => {
  it("les retire et le signale par un avertissement chacun, sans modifier l'entrée", () => {
    const raw = edit(
      rawFixture("04-avec-image.json"),
      [["futureFeature"], true],
      [["elements", 1, "style", "glow"], { blur: 4 }],
    );
    const before = structuredClone(raw);

    const result = loadDocument(raw);

    if (result.status !== "ok") throw new Error(result.status);
    expect(result.warnings.map((w) => [w.code, w.path])).toEqual([
      ["unknown_field", "elements[1].style.glow"],
      ["unknown_field", "futureFeature"],
    ]);
    expect(result.document).not.toHaveProperty("futureFeature");
    expect(result.document.elements[1]).not.toHaveProperty("style.glow");
    expect(raw).toEqual(before);
  });

  it("rejette le document si d'autres erreurs accompagnent les champs inconnus", () => {
    const codes = issuesOf(load04([["futureFeature"], true], [["elements", 0, "width"], -1])).map(
      (i) => i.code,
    );
    expect(codes).toEqual(expect.arrayContaining(["unrecognized_keys", "too_small"]));
  });
});
