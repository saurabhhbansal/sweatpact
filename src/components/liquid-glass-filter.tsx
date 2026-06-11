"use client";

import { RefObject, useEffect, useId } from "react";

// ─── SDF for rounded rectangle ────────────────────────────────────────────────
// Returns negative inside, positive outside, 0 on the rounded edge.

function sdfRR(px: number, py: number, W: number, H: number, R: number): number {
  const cx = W / 2,  cy = H / 2;
  const ox = Math.abs(px - cx) - (W / 2 - R);
  const oy = Math.abs(py - cy) - (H / 2 - R);
  return (
    Math.sqrt(Math.max(ox, 0) ** 2 + Math.max(oy, 0) ** 2) +
    Math.min(Math.max(ox, oy), 0) -
    R
  );
}

// ─── Canvas maps ──────────────────────────────────────────────────────────────

function buildDisplacementMap(W: number, H: number, R: number, bezel: number): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const EPS = 0.5;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const d = sdfRR(px, py, W, H, R);
      const i = (py * W + px) * 4;

      if (d >= 0 || d < -bezel) {
        // Outside glass or beyond bezel zone — no displacement
        img.data[i] = img.data[i + 1] = 128;
        img.data[i + 2] = 0;
        img.data[i + 3] = 255;
        continue;
      }

      // Numerical gradient of SDF = outward normal
      const gdx = sdfRR(px + EPS, py, W, H, R) - sdfRR(px - EPS, py, W, H, R);
      const gdy = sdfRR(px, py + EPS, W, H, R) - sdfRR(px, py - EPS, W, H, R);
      const gLen = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      // Inward normal (toward glass centre — this is the refraction direction)
      const nx = -gdx / gLen;
      const ny = -gdy / gLen;

      // Displacement profile: maximum at the glass edge (d≈0), zero at bezel
      // boundary (d = -bezel).  sin((1-t)·π/2) gives a smooth easing curve.
      const t = -d / bezel; // 0 at edge, 1 at inner bezel boundary
      const profile = Math.sin((1 - t) * (Math.PI * 0.5));

      // Encode as ±127 displacement around neutral 128.
      // feDisplacementMap maps R/G 0–255 → ±scale/2 CSS px offset.
      img.data[i]     = Math.round(Math.max(0, Math.min(255, 128 + nx * profile * 127)));
      img.data[i + 1] = Math.round(Math.max(0, Math.min(255, 128 + ny * profile * 127)));
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function buildSpecularMap(W: number, H: number, R: number, bezel: number): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const specZone = bezel * 2.5; // specular extends a bit wider than displacement

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const d = sdfRR(px, py, W, H, R);
      const i = (py * W + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; // white highlight

      if (d >= 0 || d < -specZone) {
        img.data[i + 3] = 0;
        continue;
      }

      // Bell curve: peaks just inside the glass edge, fades inward
      img.data[i + 3] = Math.round(Math.sin((-d / specZone) * Math.PI) * 145);
    }
  }

  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// ─── Filter injection ─────────────────────────────────────────────────────────

function applyFilter(id: string, W: number, H: number, R: number, bezel: number) {
  const dispUrl = buildDisplacementMap(W, H, R, bezel);
  const specUrl = buildSpecularMap(W, H, R, bezel);

  // scale = 24 → max displacement ≈ 12 CSS px (scale/2 at full 0→255 range)
  const scale = 24;
  const blur  = 16; // stdDeviation in CSS px

  const hostId = `${id}__host`;
  const existing = document.getElementById(hostId);
  const host: Element = existing ?? (() => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.id = hostId;
    el.setAttribute("aria-hidden", "true");
    el.setAttribute(
      "style",
      "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;top:0;left:0",
    );
    document.body.appendChild(el);
    return el;
  })();

  host.innerHTML = `<defs>
    <filter id="${id}" x="-5%" y="-10%" width="110%" height="120%"
            color-interpolation-filters="linearRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred"/>
      <feImage href="${dispUrl}" x="0" y="0" width="${W}" height="${H}"
               preserveAspectRatio="none" result="disp"/>
      <feDisplacementMap in="blurred" in2="disp" scale="${scale}"
                         xChannelSelector="R" yChannelSelector="G" result="warped"/>
      <feColorMatrix in="warped" type="saturate" values="1.5" result="vivid"/>
      <feImage href="${specUrl}" x="0" y="0" width="${W}" height="${H}"
               preserveAspectRatio="none" result="spec"/>
      <feComponentTransfer in="spec" result="spec_dim">
        <feFuncA type="linear" slope="0.42"/>
      </feComponentTransfer>
      <feBlend in="spec_dim" in2="vivid" mode="screen"/>
    </filter>
  </defs>`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Attaches a physics-based glass refraction filter to `ref`.
 *
 * On Chromium (where `backdrop-filter: url(#…)` is supported) the hook
 * generates canvas displacement + specular maps, injects an SVG filter, and
 * exposes the filter URL via the `--glass-filter-url` CSS custom property on
 * the element.  Other browsers get the CSS-fallback blur from `.glass-liquid`.
 *
 * Pass `borderRadius` (px) to match the element's CSS corner radius; omit it
 * and the hook infers a circle (half the shorter dimension).
 */
export function useLiquidGlass<T extends HTMLElement>(
  ref: RefObject<T>,
  { borderRadius }: { borderRadius?: number } = {},
) {
  const rawId  = useId();
  // React useId() produces ":r0:" style strings; strip to a valid CSS id.
  const filterId = `lg${rawId.replace(/[^a-z0-9]/gi, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;

    function build() {
      const W = Math.round(el!.offsetWidth);
      const H = Math.round(el!.offsetHeight);
      if (W < 4 || H < 4) return;

      const R     = borderRadius ?? Math.min(W, H) / 2;
      const bezel = Math.min(20, Math.min(W, H) * 0.30);

      applyFilter(filterId, W, H, R, bezel);
      el!.style.setProperty("--glass-filter-url", `url(#${filterId})`);
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(build);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      document.getElementById(`${filterId}__host`)?.remove();
      el.style.removeProperty("--glass-filter-url");
    };
  }, [filterId, borderRadius]);
}
