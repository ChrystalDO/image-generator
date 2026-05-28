"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoItem {
  id: string;
  src: string;
  name: string;
  isPortrait: boolean;
  naturalWidth: number;
  naturalHeight: number;
}

export default function ThumbnailMaker() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState<string>("");
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingBadge, setIsDraggingBadge] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const isPortrait = img.height > img.width;
          setPhotos((prev) => [
            ...prev,
            { id: crypto.randomUUID(), src, name: file.name, isPortrait, naturalWidth: img.width, naturalHeight: img.height },
          ]);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  const loadBadge = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setBadge(e.target?.result as string);
      setBadgeName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhotos(false);
    loadFiles(e.dataTransfer.files);
  }, []);

  const handleBadgeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBadge(false);
    const file = e.dataTransfer.files[0];
    if (file) loadBadge(file);
  }, []);

  const renderThumbnail = (photo: PhotoItem): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      // Use the image's natural dimensions
      const W = photo.naturalWidth;
      const H = photo.naturalHeight;
      canvas.width = W;
      canvas.height = H;

      const img = new Image();
      img.onload = () => {
        // Fill white first — prevents black canvas on transparent PNGs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        // Rounded clip
        const r = Math.min(10, W * 0.016);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(W - r, 0);
        ctx.quadraticCurveTo(W, 0, W, r);
        ctx.lineTo(W, H - r);
        ctx.quadraticCurveTo(W, H, W - r, H);
        ctx.lineTo(r, H);
        ctx.quadraticCurveTo(0, H, 0, H - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        // Draw image at full native size (no crop needed)
        ctx.drawImage(img, 0, 0, W, H);

        // Restore context so badge is drawn without rounded clip
        ctx.restore();

        if (badge) {
          const badgeImg = new Image();
          badgeImg.onload = () => {
            const bW = badgeImg.naturalWidth || badgeImg.width;
            const bH = badgeImg.naturalHeight || badgeImg.height;
            // Badge overlaps bottom-left corner edge
            const bx = -10;
            const by = photo.isPortrait ? -10 : H - bH + 10;
            ctx.drawImage(badgeImg, bx, by, bW, bH);
            resolve(canvas.toDataURL("image/png"));
          };
          badgeImg.src = badge;
        } else {
          resolve(canvas.toDataURL("image/png"));
        }
      };
      img.src = photo.src;
    });
  };

  const downloadOne = async (photo: PhotoItem) => {
    setProcessing(photo.id);
    const dataUrl = await renderThumbnail(photo);
    const link = document.createElement("a");
    const base = photo.name.replace(/\.[^.]+$/, "");
    link.download = `${base}-thumbnail.png`;
    link.href = dataUrl;
    link.click();
    setProcessing(null);
  };

  const downloadAll = async () => {
    if (!photos.length) return;
    setDownloadingAll(true);
    for (const photo of photos) {
      const dataUrl = await renderThumbnail(photo);
      const link = document.createElement("a");
      const base = photo.name.replace(/\.[^.]+$/, "");
      link.download = `${base}-thumbnail.png`;
      link.href = dataUrl;
      link.click();
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloadingAll(false);
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id));

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif", color: "#1a1917" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(26,25,23,0.1)", padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#FFD84D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f0e0d" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#1a1917" }}>Image Generator</span>
        </div>
        {photos.length > 1 && (
          <button onClick={downloadAll} disabled={downloadingAll} style={{
            padding: "9px 20px", borderRadius: 8,
            background: downloadingAll ? "rgba(255,216,77,0.4)" : "#FFD84D",
            border: "none", color: "#0f0e0d", fontSize: 13, fontWeight: 600,
            cursor: downloadingAll ? "wait" : "pointer", fontFamily: "inherit",
          }}>
            {downloadingAll ? "Exporting…" : `⬇ Export all (${photos.length})`}
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 32, alignItems: "start" }}>

          {/* Left: photos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(26,25,23,0.4)", margin: "0 0 12px" }}>Photos</p>
              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                onDragLeave={() => setIsDraggingPhotos(false)}
                onDrop={handlePhotoDrop}
                style={{
                  borderRadius: 14, border: isDraggingPhotos ? "2px dashed #e6a800" : "2px dashed rgba(26,25,23,0.18)",
                  background: isDraggingPhotos ? "rgba(255,216,77,0.06)" : "rgba(26,25,23,0.03)",
                  padding: "28px 20px", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(26,25,23,0.25)" strokeWidth="1.5" style={{ margin: "0 auto 10px", display: "block" }}>
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>
                </svg>
                <span style={{ fontSize: 13, color: "rgba(26,25,23,0.45)" }}>
                  Drop photos here or <span style={{ color: "#b07d00", fontWeight: 600 }}>click to upload</span>
                </span>
                <div style={{ fontSize: 11, color: "rgba(26,25,23,0.3)", marginTop: 6 }}>Landscape and portrait supported · multiple files ok</div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => e.target.files && loadFiles(e.target.files)} />
            </div>

            {/* Photo grid — mixed orientations */}
            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={{
                    width: photo.isPortrait ? 160 : 240,
                    borderRadius: 14, overflow: "hidden", background: "#fff",
                    border: "1px solid rgba(26,25,23,0.1)",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      position: "relative",
                      paddingBottom: photo.isPortrait ? "148.8%" : "67.2%",
                      borderRadius: "14px 14px 0 0", overflow: "hidden",
                    }}>
                      <img src={photo.src} alt={photo.name} style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        objectFit: "cover",
                      }} />
                      {/* Badge preview */}
                      {badge && (
                        <div style={{
                          position: "absolute",
                          ...(photo.isPortrait ? { top: 8, left: 8 } : { bottom: 8, left: 8 }),
                          pointerEvents: "none",
                        }}>
                          <img src={badge} alt="badge" style={{ height: 24, width: "auto", display: "block", marginLeft: -4, marginBottom: photo.isPortrait ? 0 : -4, marginTop: photo.isPortrait ? -4 : 0 }} />
                        </div>
                      )}
                      {/* Orientation tag */}
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        background: "rgba(255,255,255,0.85)", borderRadius: 4,
                        padding: "2px 6px", fontSize: 9, fontWeight: 600,
                        color: "rgba(26,25,23,0.6)", letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}>
                        {photo.isPortrait ? "Portrait" : "Landscape"}
                      </div>
                      <button onClick={() => removePhoto(photo.id)} style={{
                        position: "absolute", top: photo.isPortrait ? 30 : 8, right: 8,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(255,255,255,0.85)", border: "1px solid rgba(26,25,23,0.15)",
                        color: "#1a1917", cursor: "pointer", fontSize: 13, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
                      }}>×</button>
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "rgba(26,25,23,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {photo.name}
                      </span>
                      <button onClick={() => downloadOne(photo)} disabled={processing === photo.id} style={{
                        padding: "4px 10px", borderRadius: 5, flexShrink: 0,
                        background: processing === photo.id ? "rgba(255,216,77,0.2)" : "#FFD84D",
                        border: "none",
                        color: "#0f0e0d", fontSize: 10, fontWeight: 600,
                        cursor: processing === photo.id ? "wait" : "pointer", fontFamily: "inherit",
                      }}>
                        {processing === photo.id ? "…" : "⬇ Export"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: badge + spec */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 24 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(26,25,23,0.4)", margin: "0 0 12px" }}>Badge</p>
              <div
                onClick={() => badgeInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBadge(true); }}
                onDragLeave={() => setIsDraggingBadge(false)}
                onDrop={handleBadgeDrop}
                style={{
                  borderRadius: 14, border: isDraggingBadge ? "2px dashed #FF9EC6" : "2px dashed rgba(26,25,23,0.18)",
                  background: isDraggingBadge ? "rgba(255,158,198,0.06)" : "rgba(26,25,23,0.03)",
                  padding: "22px 16px", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                }}>
                {badge ? (
                  <img src={badge} alt="badge" style={{ maxHeight: 60, maxWidth: "100%", margin: "0 auto", display: "block" }} />
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(26,25,23,0.25)" strokeWidth="1.5" style={{ margin: "0 auto 8px", display: "block" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span style={{ fontSize: 12, color: "rgba(26,25,23,0.45)" }}>
                      Drop badge PNG or <span style={{ color: "#c4608a", fontWeight: 600 }}>click to upload</span>
                    </span>
                  </>
                )}
              </div>
              <input ref={badgeInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && loadBadge(e.target.files[0])} />
              {badge && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "rgba(26,25,23,0.4)", overflow: "hidden", textOverflow: "ellipsis" }}>{badgeName}</span>
                  <button onClick={() => { setBadge(null); setBadgeName(""); }} style={{
                    background: "none", border: "none", color: "rgba(26,25,23,0.4)",
                    cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: "2px 6px",
                  }}>Remove</button>
                </div>
              )}
            </div>

            {/* Spec */}
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid rgba(26,25,23,0.1)" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "rgba(26,25,23,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Output spec</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(26,25,23,0.45)", lineHeight: 2 }}>
                Original dimensions preserved<br />
                Badge at native pixel size<br />
                Landscape → badge bottom-left<br />
                Portrait → badge top-left<br />
                Rounded corners · no frame · PNG
              </p>
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
