"use client";

import { useRef, useState } from "react";
import { EDIT_LABELS } from "@/lib/render/kit";

export interface CssBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  boxes: CssBox[];
  trimW: number; // ancho del área de corte en px de pantalla
  trimH: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dxFrac: number, dyFrac: number) => void;
}

/** Capa del modo edición: un recuadro por elemento que se puede arrastrar con el mouse. */
export default function EditLayer({ boxes, trimW, trimH, selected, onSelect, onMove }: Props) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="absolute inset-0" onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}>
      {boxes.map((b) => {
        const active = selected === b.id;
        const off = drag?.id === b.id ? drag : null;
        return (
          <div
            key={b.id}
            className={`absolute cursor-move rounded-sm border ${
              active ? "border-[#2b7bff] bg-[#2b7bff]/10" : "border-dashed border-[#2b7bff]/60 hover:bg-[#2b7bff]/5"
            }`}
            style={{
              left: b.x - 2,
              top: b.y - 2,
              width: b.w + 4,
              height: b.h + 4,
              transform: off ? `translate(${off.dx}px, ${off.dy}px)` : undefined,
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              start.current = { x: e.clientX, y: e.clientY };
              onSelect(b.id);
              setDrag({ id: b.id, dx: 0, dy: 0 });
            }}
            onPointerMove={(e) => {
              if (!start.current || drag?.id !== b.id) return;
              setDrag({ id: b.id, dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
            }}
            onPointerUp={() => {
              if (drag && drag.id === b.id && (Math.abs(drag.dx) > 1 || Math.abs(drag.dy) > 1)) {
                onMove(b.id, drag.dx / trimW, drag.dy / trimH);
              }
              start.current = null;
              setDrag(null);
            }}
          >
            {active && (
              <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-[#2b7bff] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {EDIT_LABELS[b.id] ?? b.id}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
