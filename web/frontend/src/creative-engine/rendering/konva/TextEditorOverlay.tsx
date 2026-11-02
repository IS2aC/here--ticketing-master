import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { TextElement } from "../../domain/elements/types.ts";
import { finishTextEditing } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import type { Viewport } from "../../editor/viewport.ts";
import styles from "./TextEditorOverlay.module.css";

// Édition directe d'un texte (double-clic ou Entrée) : un <textarea> superposé au texte Konva, qui reprend sa
// position, sa rotation, sa largeur et sa typographie à l'échelle de la vue. Le texte Konva est masqué pendant
// la saisie (ElementNode). La saisie native (curseur, sélection, annulation locale, accents, IME, lecteurs
// d'écran) est celle du navigateur ; le document n'est modifié qu'une fois, à la fin (une entrée d'historique).

/** Correspondance texte du modèle → CSS, à l'échelle de la vue (même conversion que mappers.textConfig). */
function editorStyle(element: TextElement, view: Viewport): CSSProperties {
  const { style } = element;
  const zoom = view.zoom;
  return {
    left: view.x + element.x * zoom,
    top: view.y + element.y * zoom,
    width: element.width * zoom,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: `${(element.width * zoom) / 2}px ${(element.height * zoom) / 2}px`,
    fontFamily: `"${style.fontFamily}"`,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontSize: style.fontSize * zoom,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
    color: style.color,
    textAlign: style.align,
    textTransform: style.textTransform === "uppercase" ? "uppercase" : "none",
  };
}

function TextEditor({ element, view, onDone }: { element: TextElement; view: Viewport; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(element.content);
  const finished = useRef(false);

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // La hauteur suit le contenu, comme le bloc de texte : nombre de lignes × hauteur de ligne (calcul de Konva).
  // scrollHeight seul ne suffit pas : il compte aussi les glyphes qui dépassent de la ligne (Playfair Display).
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    const lineHeight = element.style.fontSize * element.style.lineHeight * view.zoom;
    textarea.style.height = "0px";
    const lines = Math.max(1, Math.round(textarea.scrollHeight / lineHeight));
    textarea.style.height = `${lines * lineHeight}px`;
  }, [draft, view.zoom, element.style, element.width]);

  const finish = (returnFocus: boolean) => {
    if (finished.current) return;
    finished.current = true;
    finishTextEditing(ref.current?.value ?? draft);
    if (returnFocus) onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Échap ou Ctrl/⌘ + Entrée terminent la saisie en la gardant (comme les éditeurs de référence).
    if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    }
  };

  return (
    <textarea
      ref={ref}
      className={styles.editor}
      style={editorStyle(element, view)}
      value={draft}
      aria-label="Contenu du texte"
      aria-describedby="text-editor-hint"
      spellCheck
      rows={1}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => {
        finish(false);
      }}
    />
  );
}

/** Rend l'éditeur du texte en cours d'édition ; `onDone` rend le focus à la zone de travail. */
export function TextEditorOverlay({ onDone }: { onDone: () => void }) {
  const id = useEditorStore((s) => s.editingTextId);
  const view = useEditorStore((s) => s.viewport);
  const element = useDocumentStore((s) => s.history.present.elements.find((e) => e.id === id));
  if (!id || element?.type !== "text" || !view) return null;
  return (
    <>
      <TextEditor key={id} element={element} view={view} onDone={onDone} />
      <span id="text-editor-hint" className="visually-hidden">
        Échap ou Ctrl + Entrée pour terminer.
      </span>
    </>
  );
}
