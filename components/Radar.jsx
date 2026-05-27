import { useState, useCallback, useMemo, useRef, useEffect } from "react";

const S = {
  root: {
    minHeight: "100vh",
    background: "#080c18",
    fontFamily: "system-ui",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  },
  bgWrap: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" },
  bgCircle: {
    position: "absolute", top: "10%", left: "50%",
    transform: "translateX(-50%)", width: 600, height: 600,
    background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",
    borderRadius: "50%",
  },
  bgGrid: {
    position: "absolute", inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px)," +
      "linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",
    backgroundSize: "50px 50px",
  },
  container: {
    position: "relative", zIndex: 1,
    maxWidth: 920, margin: "0 auto", padding: "24px 16px",
  },
  header: {
    textAlign: "center", marginBottom: 32,
    paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerRow: {
    display: "flex", alignItems: "center",
    justifyContent: "center", gap: 12, marginBottom: 10,
  },
  dot: (color) => ({
    width: 10, height: 10, borderRadius: "50%",
    background: color, boxShadow: `0 0 16px ${color}`,
    transition: "background 0.3s, box-shadow 0.3s",
  }),
  title: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 2, color: "#fff" },
  titleAccent: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  badge: {
    fontSize: 10,
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    borderRadius: 4, padding: "3px 8px",
    color: "#fff", fontWeight: 700, letterSpacing: 1,
  },
  subtitle: { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
