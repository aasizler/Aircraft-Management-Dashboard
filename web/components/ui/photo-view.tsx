"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/image";

/**
 * The photo that was just parsed: thumbnail, click to inspect full-size.
 *
 * The point is verification — checking the model's digits against the actual
 * meter face or receipt total — so this shows the *processed* image, the exact
 * pixels the model received. If the downscale or crop lost a digit, that is
 * visible here rather than hidden behind a crisp original the model never saw.
 *
 * Phone photos are tall and the numbers are usually small within them, so a
 * fit-to-screen view is not enough on its own: it supports wheel/pinch zoom,
 * drag to pan, and double-click to snap between fit and 3x.
 */
const MIN_SCALE = 1;
const MAX_SCALE = 8;

export function PhotoView({
  src,
  alt,
  caption,
  regions,
}: {
  src: string;
  alt: string;
  caption?: string;
  /**
   * Named regions worth looking at, normalised 0..1. The lightbox opens zoomed
   * to the first one and offers a button per region, so inspecting shows the
   * digits large instead of re-presenting the same thumbnail slightly bigger.
   */
  regions?: { label: string; box: Box }[];
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Index into `regions`, or -1 for the whole photo. */
  const [region, setRegion] = useState(-1);

  const fit = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    fit();
    setRegion(-1);
  }, [fit]);

  /**
   * Frame `focus` in the stage. The image is object-fit:contain, so its drawn
   * size is derived from the natural aspect rather than the element box.
   */
  const zoomTo = useCallback((index: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    const focus = regions?.[index]?.box;
    if (!img || !stage || !focus || !img.naturalWidth) return;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const drawn = Math.min(sw / img.naturalWidth, sh / img.naturalHeight);
    const cw = img.naturalWidth * drawn;
    const ch = img.naturalHeight * drawn;

    const next = Math.max(
      1,
      Math.min(MAX_SCALE, Math.min(sw / (focus.w * cw), sh / (focus.h * ch)) * 0.9),
    );
    // Distance from image centre to focus centre, in drawn pixels.
    const dx = (focus.x + focus.w / 2 - 0.5) * cw;
    const dy = (focus.y + focus.h / 2 - 0.5) * ch;
    setScale(next);
    setTx(-dx * next);
    setTy(-dy * next);
    setRegion(index);
  }, [regions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "0") fit();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s * 1.3));
      if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s / 1.3));
    };
    window.addEventListener("keydown", onKey);
    // The lightbox owns the viewport while it is up; let the page scroll again
    // on close.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, fit]);

  /** Zoom about the pointer, so the digit under the cursor stays under it. */
  function zoomAt(clientX: number, clientY: number, factor: number, box: DOMRect) {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor));
      const k = next / s;
      const cx = clientX - box.left - box.width / 2;
      const cy = clientY - box.top - box.height / 2;
      setTx((x) => (next === MIN_SCALE ? 0 : cx - (cx - x) * k));
      setTy((y) => (next === MIN_SCALE ? 0 : cy - (cy - y) * k));
      return next;
    });
  }

  return (
    <>
      <button type="button" className="photo-thumb" onClick={() => setOpen(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span className="photo-thumb-hint">
          <span aria-hidden>⤢</span> View full size
        </span>
      </button>
      {caption && <div className="photo-caption">{caption}</div>}

      {open && (
        <div className="photo-lightbox" onClick={close}>
          <div className="photo-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.4))} aria-label="Zoom out">−</button>
            <span className="photo-zoom-val">{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.4))} aria-label="Zoom in">+</button>
            {regions?.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className={`photo-bar-focus ${region === i ? "on" : ""}`}
                onClick={() => zoomTo(i)}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              className={`photo-bar-focus ${region === -1 ? "on" : ""}`}
              onClick={() => { fit(); setRegion(-1); }}
              aria-label="Reset zoom"
            >
              Whole photo
            </button>
            <button type="button" className="photo-bar-close" onClick={close} aria-label="Close">×</button>
          </div>

          <div
            ref={stageRef}
            className="photo-stage"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15, e.currentTarget.getBoundingClientRect());
            }}
            onDoubleClick={(e) => {
              if (scale > 1) { fit(); setRegion(-1); }
              else zoomAt(e.clientX, e.clientY, 3, e.currentTarget.getBoundingClientRect());
            }}
            onPointerDown={(e) => {
              if (scale === 1) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, tx, ty };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setTx(drag.current.tx + (e.clientX - drag.current.x));
              setTy(drag.current.ty + (e.clientY - drag.current.y));
            }}
            onPointerUp={() => { drag.current = null; setDragging(false); }}
            onPointerCancel={() => { drag.current = null; setDragging(false); }}
            onTouchStart={(e) => {
              if (e.touches.length !== 2) return;
              const [a, b] = [e.touches[0], e.touches[1]];
              pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
            }}
            onTouchMove={(e) => {
              if (e.touches.length !== 2 || !pinch.current) return;
              const [a, b] = [e.touches[0], e.touches[1]];
              const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
              setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (d / pinch.current.dist))));
            }}
            onTouchEnd={() => { pinch.current = null; }}
            style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              draggable={false}
              onLoad={() => { if (regions?.length && region === -1) zoomTo(0); }}
              style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
            />
          </div>

          <div className="photo-lightbox-hint">
            {scale > 1 ? "Drag to pan · double-click to fit" : "Scroll or double-click to zoom"} · Esc to close
          </div>
        </div>
      )}
    </>
  );
}
