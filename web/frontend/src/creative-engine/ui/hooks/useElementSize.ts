import { useLayoutEffect, useState, type RefObject } from "react";
import type { Size } from "../../editor/viewport.ts";

/** Taille (px CSS) d'un élément, suivie avec ResizeObserver. null avant la première mesure. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((previous) =>
        previous?.width === width && previous.height === height ? previous : { width, height },
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
