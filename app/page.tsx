"use client";

import { useState, useRef, useCallback } from "react";

const BADGE_OPTIONS = [
  { label: "FAMILY", color: "#FF9EC6", textColor: "#7a2447" },
  { label: "TOP-RATED", color: "#FFD84D", textColor: "#6b4a00" },
  { label: "ADVENTURE", color: "#7DD9A8", textColor: "#1a5c3a" },
  { label: "LUXURY", color: "#C5A8FF", textColor: "#3c1f7a" },
  { label: "SOLO", color: "#FF9E7D", textColor: "#7a2a0f" },
  { label: "HONEYMOON", color: "#FFB3C6", textColor: "#7a1f3a" },
  { label: "NONE", color: "transparent", textColor: "transparent" },
];

const BADGE_POSITIONS = [
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom right", value: "bottom-right" },
  { label: "Top left", value: "top-left" },
  { label: "Top right", value: "top-right" },
];

type BadgePosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";

export default function ThumbnailMaker() {
  const [image, setImage] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState(BADGE_OPTIONS[0]);
  const [badgePosition, setBadgePosition] = useState<BadgePosition>("bottom-left");
  const [customLabel, setCustomLabel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const activeBadge = useCustom
    ? { label: customLabel.toUpperCase() || "CUSTOM", color: selectedBadge.color, textColor: selectedBadge.textColor }
    : selectedBadge;

  const downloadCanvas = () => {
    if (!image) return;
    setDownloading(true);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      const W = 640;
      const H = 430;
      canvas.width = W;
      canvas.height = H;

      // Clip to rounded rectangle
      const radius = 22;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(W - radius, 0);
      ctx.quadraticCurveTo(W, 0, W, radius);
      ctx.lineTo(W, H - radius);
      ctx.quadraticCurveTo(W, H, W - radius, H);
      ctx.lineTo(radius, H);
      ctx.quadraticCurveTo(0, H, 0, H - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();

      // Draw image cover
      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      // Dark frame border
      ctx.strokeStyle = "rgba(10,10,10,0.85)";
      ctx.lineWidth = 14;
      ctx.stroke();

      // Badge
      if (activeBadge.label !== "NONE" && activeBadge.color !== "transparent") {
        const bLabel = activeBadge.label;
        const bColor = activeBadge.color;
        const bTextColor = activeBadge.textColor;

        ctx.font = "bold 16px 'DM Sans', sans-serif";
        const textW = ctx.measureText(bLabel).width;
        const padH = 22;
        const padV = 11;
        const bW = textW + padH * 2;
        const bH = 34;
        const margin = 18;

        let bx = margin;
        let by = H - bH - margin + bH / 2;

        if (badgePosition === "bottom-right") bx = W - bW - margin;
        if (badgePosition === "top-left") { bx = margin; by = margin + bH / 2; }
        if (badgePosition === "top-right") { bx = W - bW - margin; by = margin + bH / 2; }

        const centerX = bx + bW / 2;
        const centerY = by;

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;

        // Pill
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, bW / 2, bH / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = bColor;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // Text
        ctx.fillStyle = bTextColor;
        ctx.font = "bold 15px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(bLabel, centerX, centerY);
      }

      // Trigger download
      const link = document.createElement("a");
      link.download = `trip-thumbnail-${activeBadge.label.toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setDownloading(false);
    };
    img.src = image;
  };

  const getBadgeStyle = (pos: BadgePosition) => {
    const base = { position: "absolute" as const, pointerEvents: "none" as const };
    const margin = "18px";
    if (pos === "bottom-left") return { ...base, bottom: margin, left: margin };
    if (pos === "bottom-right") return { ...base, bottom: margin, right: margin };
    if (pos === "top-left") return { ...base, top: margin, left: margin };
    return { ...base, top: margin, right: margin };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e0d", fontFamily: "var(--font-dm-sans, DM Sans, sans-serif)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "20px 40px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #FF9EC6, #FFD84D)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f0e0d" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
        </div>
        <span style={{ fontFamily: "var(--font-playfair, Playfair Display, serif)", fontSize: 20, fontWeight: 700, color: "#f0ede8", letterSpacing: "-0.01em" }}>Trip Thumbnail Maker</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "1fr 420px", gap: 40, alignItems: "start" }}>
        
        {/* Left: Preview */}
        <div>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(240,237,232,0.4)", marginBottom: 16, marginTop: 0 }}>Preview</p>

          {/* Drop zone / Preview card */}
          <div
            onClick={() => !image && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: "67.2%",
              borderRadius: 22,
              overflow: "hidden",
              border: isDragging ? "2px dashed #FFD84D" : image ? "none" : "2px dashed rgba(255,255,255,0.15)",
              background: image ? "transparent" : "rgba(255,255,255,0.03)",
              cursor: image ? "default" : "pointer",
              transition: "border-color 0.2s",
            }}
          >
            {image ? (
              <>
                {/* Photo */}
                <img
                  src={image}
                  alt="Trip"
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", borderRadius: 22,
                  }}
                />
                {/* Dark border overlay */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 22,
                  boxShadow: "inset 0 0 0 10px rgba(10,10,10,0.82)",
                  pointerEvents: "none",
                }} />
                {/* Badge */}
                {activeBadge.label !== "NONE" && activeBadge.color !== "transparent" && (
                  <div style={getBadgeStyle(badgePosition)}>
                    <div style={{
                      background: activeBadge.color,
                      color: activeBadge.textColor,
                      fontWeight: 700,
                      fontSize: 14,
                      letterSpacing: "0.04em",
                      padding: "8px 20px",
                      borderRadius: 999,
                      boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-dm-sans, DM Sans, sans-serif)",
                    }}>
                      {activeBadge.label}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,232,0.3)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                <span style={{ color: "rgba(240,237,232,0.4)", fontSize: 14 }}>Drop an image or click to upload</span>
              </div>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {image && (
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "9px 18px", borderRadius: 8, background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)", color: "rgba(240,237,232,0.8)",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}>
                Change photo
              </button>
              <button
                onClick={downloadCanvas}
                disabled={downloading}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  background: downloading ? "rgba(255,216,77,0.3)" : "#FFD84D",
                  border: "none",
                  color: downloading ? "rgba(240,237,232,0.5)" : "#0f0e0d",
                  fontSize: 13, fontWeight: 600, cursor: downloading ? "wait" : "pointer",
                  fontFamily: "inherit", transition: "all 0.15s",
                }}>
                {downloading ? "Generating…" : "⬇ Download PNG"}
              </button>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          
          {/* Badge label */}
          <div>
            <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(240,237,232,0.4)", margin: "0 0 14px" }}>Badge label</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {BADGE_OPTIONS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => { setSelectedBadge(b); setUseCustom(false); }}
                  style={{
                    padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                    border: selectedBadge.label === b.label && !useCustom
                      ? "1.5px solid rgba(255,255,255,0.5)"
                      : "1px solid rgba(255,255,255,0.1)",
                    background: selectedBadge.label === b.label && !useCustom
                      ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    display: "flex", alignItems: "center", gap: 8,
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  {b.color !== "transparent" && (
                    <span style={{
                      display: "inline-block", width: 24, height: 16,
                      borderRadius: 999, background: b.color, flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", color: "rgba(240,237,232,0.85)" }}>
                    {b.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom label input */}
            <div style={{ marginTop: 10 }}>
              <input
                placeholder="Or type a custom label…"
                value={customLabel}
                onChange={(e) => { setCustomLabel(e.target.value); setUseCustom(true); }}
                onFocus={() => setUseCustom(true)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: useCustom ? "1.5px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: "#f0ede8", fontSize: 13, fontFamily: "inherit", outline: "none",
                  transition: "border-color 0.15s",
                }}
              />
            </div>
          </div>

          {/* Badge colour (when custom) */}
          {useCustom && (
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(240,237,232,0.4)", margin: "0 0 14px" }}>Badge colour</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BADGE_OPTIONS.filter(b => b.color !== "transparent").map((b) => (
                  <button
                    key={b.color}
                    onClick={() => setSelectedBadge(b)}
                    title={b.label}
                    style={{
                      width: 36, height: 36, borderRadius: 999, background: b.color,
                      border: selectedBadge.color === b.color ? "3px solid #f0ede8" : "2px solid transparent",
                      cursor: "pointer", transition: "border 0.15s",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Position */}
          {activeBadge.label !== "NONE" && (
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(240,237,232,0.4)", margin: "0 0 14px" }}>Badge position</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BADGE_POSITIONS.map((pos) => (
                  <button
                    key={pos.value}
                    onClick={() => setBadgePosition(pos.value as BadgePosition)}
                    style={{
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      border: badgePosition === pos.value
                        ? "1.5px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      background: badgePosition === pos.value ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      color: "rgba(240,237,232,0.85)", fontSize: 12, fontWeight: 500,
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}>
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          <div style={{
            padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(240,237,232,0.45)", lineHeight: 1.6 }}>
              Thumbnails are exported at 640×430px with rounded corners and the dark border frame — ready to drop straight into your trip listings.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
