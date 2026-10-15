"use client";
import React, { useEffect, useRef } from "react";
// Scoped d3 submodules rather than the full `d3` meta-package — this scene
// only needs selection + geo projection, and the full package pulls in
// several hundred KB of unused modules (scales, transitions, chord
// diagrams, etc.) into the bundle for no benefit.
import { select } from "d3-selection";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import * as topojson from "topojson-client";
import { flagCdnUrl } from "./landingTokens";

/**
 * Rotating orthographic globe for hero scene 1. Ported from the design
 * handoff's `landing.js` (`mountGlobe`/`draw`) — d3-geo projection, 18
 * pinging location pins, 30°/s auto-rotation. World outline is fetched once
 * from the same CDN the design specifies and cached for the component's
 * lifetime; the render loop is cancelled on unmount and skipped entirely
 * under prefers-reduced-motion (a single static frame is drawn instead).
 */

const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

// ISO-3166 numeric ids highlighted amber on the globe — exact set from the design.
const HIGHLIGHTED_IDS = new Set([
  "840", "484", "170", "076", "032", "826", "276", "250", "380", "724",
  "528", "056", "620", "040", "792", "818", "566", "404", "710", "784",
  "356", "156", "702", "392", "036",
]);

type Pin = { iso: string; c: [number, number]; dx?: number };

const PINS: Pin[] = [
  { iso: "us", c: [-74, 40.7] }, { iso: "mx", c: [-99.1, 19.4] }, { iso: "co", c: [-74, 4.7] },
  { iso: "br", c: [-46.6, -23.5] }, { iso: "ar", c: [-58.4, -34.6] },
  { iso: "gb", c: [-0.1, 51.5], dx: -12 }, { iso: "eu", c: [12.5, 41.9] }, { iso: "tr", c: [29, 41] }, { iso: "eg", c: [31.2, 30] },
  { iso: "ng", c: [3.4, 6.5] }, { iso: "ke", c: [36.8, -1.3] }, { iso: "za", c: [28, -26.2] }, { iso: "ae", c: [55.3, 25.2] },
  { iso: "in", c: [72.9, 19.1] }, { iso: "cn", c: [114, 22.5] }, { iso: "sg", c: [103.8, 1.35] }, { iso: "jp", c: [139.7, 35.7] }, { iso: "au", c: [151.2, -33.9] },
];

let cachedWorld: any = null;
let worldPromise: Promise<any> | null = null;

function loadWorld(): Promise<any> {
  if (cachedWorld) return Promise.resolve(cachedWorld);
  if (!worldPromise) {
    worldPromise = fetch(WORLD_ATLAS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`world-atlas ${r.status}`);
        return r.json();
      })
      .then((topology) => {
        cachedWorld = topojson.feature(topology, topology.objects.countries as any);
        return cachedWorld;
      })
      .catch((err) => {
        // Clear so the next scene activation retries instead of reusing a
        // rejected promise for the rest of the session.
        worldPromise = null;
        throw err;
      });
  }
  return worldPromise;
}

export default function HeroGlobe({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    loadWorld().then((world) => {
      if (cancelled || !node) return;
      node.innerHTML = "";

      const svg = select(node)
        .append("svg")
        .attr("viewBox", "0 0 400 400")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("overflow", "visible");
      const defs = svg.append("defs");
      const ocean = defs
        .append("radialGradient")
        .attr("id", "mbk-ocean")
        .attr("cx", "35%")
        .attr("cy", "30%")
        .attr("r", "75%");
      ocean.append("stop").attr("offset", "0%").attr("stop-color", "#6A5CFF");
      ocean.append("stop").attr("offset", "60%").attr("stop-color", "#3B2ED3");
      ocean.append("stop").attr("offset", "100%").attr("stop-color", "#1C1488");
      const shine = defs
        .append("radialGradient")
        .attr("id", "mbk-shine")
        .attr("cx", "32%")
        .attr("cy", "26%")
        .attr("r", "60%");
      shine.append("stop").attr("offset", "0%").attr("stop-color", "#FFFFFF").attr("stop-opacity", 0.28);
      shine.append("stop").attr("offset", "100%").attr("stop-color", "#FFFFFF").attr("stop-opacity", 0);

      const proj = geoOrthographic().scale(190).translate([200, 200]).clipAngle(90).precision(0.5);
      const path = geoPath(proj as any);
      const sphere = svg.append("path").datum({ type: "Sphere" } as any).attr("fill", "url(#mbk-ocean)");
      const grat = svg
        .append("path")
        .datum(geoGraticule10())
        .attr("fill", "none")
        .attr("stroke", "#FFFFFF")
        .attr("stroke-opacity", 0.1)
        .attr("stroke-width", 0.6);
      const land = svg
        .append("g")
        .selectAll("path")
        .data((world as any).features)
        .enter()
        .append("path")
        .attr("fill", (d: any) => (HIGHLIGHTED_IDS.has(String(d.id)) ? "#FFB224" : "#EDEBFB"))
        .attr("fill-opacity", (d: any) => (HIGHLIGHTED_IDS.has(String(d.id)) ? 1 : 0.9))
        .attr("stroke", "#3B2ED3")
        .attr("stroke-width", 0.4)
        .attr("stroke-opacity", 0.6);
      svg
        .append("circle")
        .attr("cx", 200)
        .attr("cy", 200)
        .attr("r", 190)
        .attr("fill", "url(#mbk-shine)")
        .style("pointer-events", "none");

      const pg = svg.append("g");
      const placed = PINS.map((p) => {
        const el = pg.append("g").style("transition", "opacity .35s");
        const ring = el
          .append("circle")
          .attr("r", 6)
          .attr("fill", "none")
          .attr("stroke", "#5ED6B4")
          .attr("stroke-width", 2);
        if (!reducedMotion) {
          ring
            .append("animate")
            .attr("attributeName", "r")
            .attr("values", "5;20")
            .attr("dur", "1.6s")
            .attr("repeatCount", "indefinite");
          ring
            .append("animate")
            .attr("attributeName", "stroke-opacity")
            .attr("values", "0.9;0")
            .attr("dur", "1.6s")
            .attr("repeatCount", "indefinite");
        }
        el.append("circle").attr("r", 4).attr("fill", "#5ED6B4").attr("stroke", "#FFFFFF").attr("stroke-width", 1.5);
        const tag = el.append("g").attr("transform", `translate(${-14 + (p.dx || 0)},-32)`);
        tag
          .append("rect")
          .attr("width", 28)
          .attr("height", 20)
          .attr("rx", 5)
          .attr("fill", "#FFFFFF")
          .style("filter", "drop-shadow(0 6px 10px rgba(10,8,40,0.35))");
        tag
          .append("image")
          .attr("href", flagCdnUrl(p.iso))
          .attr("x", 3)
          .attr("y", 3)
          .attr("width", 22)
          .attr("height", 14)
          .attr("preserveAspectRatio", "xMidYMid slice");
        tag.append("path").attr("d", "M10 20 L14 24 L18 20 Z").attr("fill", "#FFFFFF");
        return { c: p.c, el };
      });

      const t0 = performance.now();
      const frame = (now: number) => {
        const lam = 78 - ((now - t0) / 1000) * 30;
        const phi = -14;
        proj.rotate([lam, phi]);
        sphere.attr("d", path as any);
        grat.attr("d", path as any);
        land.attr("d", path as any);
        const center: [number, number] = [-lam, -phi];
        placed.forEach((p) => {
          const xy = proj(p.c);
          if (!xy) return;
          p.el
            .attr("transform", `translate(${xy[0]},${xy[1]})`)
            .style("opacity", geoDistance(p.c, center) < 1.35 ? 1 : 0);
        });
        if (!reducedMotion) rafRef.current = requestAnimationFrame(frame);
      };
      frame(t0);
    }).catch(() => {
      // World-atlas fetch failed — leave the scene's absolutely-positioned
      // container empty rather than crash; the next time this scene
      // activates, loadWorld() retries (worldPromise was cleared above).
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: "50%",
        top: "45%",
        width: "84%",
        aspectRatio: "1",
        transform: "translate(-50%,-50%)",
        filter: "drop-shadow(0 40px 50px rgba(59,46,211,0.4))",
      }}
      aria-hidden
    />
  );
}
