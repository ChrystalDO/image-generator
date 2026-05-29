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

const PRESET_BADGES = [
  { name: "Bestseller", file: "/label_bestseller.png" },
  { name: "Family", file: "/label_family.png" },
  { name: "18 to 35s", file: "/label_label1835.png" },
  { name: "New Experience", file: "/label_new experience.png" },
  { name: "New Trip", file: "/label_new trip.png" },
  { name: "Staff Pick", file: "/label_staff pick.png" },
  { name: "Top-Rated", file: "/label_top-rated.png" },
];

export default function ThumbnailMaker() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
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

  const selectPresetBadge = (preset: { name: string; file: string }) => {
    if (selectedPreset === preset.file) {
      // Deselect
      setSelectedPreset(null);
      setBadge(null);
      setBadgeName("");
      return;
    }
    setSelectedPreset(preset.file);
    setBadgeName(preset.name);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      setBadge(canvas.toDataURL("image/png"));
    };
    img.src = preset.file;
  };

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

      // Resize to max 640x427 (landscape) or 427x640 (portrait) if larger
      const MAX_W = photo.isPortrait ? 427 : 640;
      const MAX_H = photo.isPortrait ? 640 : 427;
      const scale = Math.min(1, MAX_W / photo.naturalWidth, MAX_H / photo.naturalHeight);
      const W = Math.round(photo.naturalWidth * scale);
      const H = Math.round(photo.naturalHeight * scale);
      const margin = 20;
      const r = 12;
      canvas.width = W;
      canvas.height = H;

      // Inner photo area after padding
      const iX = margin;
      const iY = margin;
      const iW = W - margin * 2;
      const iH = H - margin * 2;

      const img = new Image();
      img.onload = () => {
        // Transparent background
        ctx.clearRect(0, 0, W, H);

        // Rounded clip inset by margin
        ctx.beginPath();
        ctx.moveTo(iX + r, iY);
        ctx.lineTo(iX + iW - r, iY);
        ctx.quadraticCurveTo(iX + iW, iY, iX + iW, iY + r);
        ctx.lineTo(iX + iW, iY + iH - r);
        ctx.quadraticCurveTo(iX + iW, iY + iH, iX + iW - r, iY + iH);
        ctx.lineTo(iX + r, iY + iH);
        ctx.quadraticCurveTo(iX, iY + iH, iX, iY + iH - r);
        ctx.lineTo(iX, iY + r);
        ctx.quadraticCurveTo(iX, iY, iX + r, iY);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        // Draw image scaled to fit within the padded area
        ctx.drawImage(img, 0, 0, W, H, iX, iY, iW, iH);

        // Restore so badge is not clipped
        ctx.restore();

        if (badge) {
          const badgeImg = new Image();
          badgeImg.onload = () => {
            const bW = badgeImg.naturalWidth || badgeImg.width;
            const bH = badgeImg.naturalHeight || badgeImg.height;
            // Overlay badge at top-left of the photo area
            ctx.drawImage(badgeImg, 0, 0, bW, bH);
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
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#1a1917" }}>Trip Image Generator</span>
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
                <div style={{ fontSize: 11, color: "rgba(26,25,23,0.3)", marginTop: 6 }}>Multiple files ok</div>
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
                    borderRadius: 14, overflow: "hidden", background: "#e8e6e1",
                    border: "1px solid rgba(26,25,23,0.1)",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      position: "relative",
                      paddingBottom: photo.isPortrait ? "148.8%" : "67.2%",
                    }}>
                      {/* Outer transparent margin — matches the 20px padding in export */}
                      <div style={{
                        position: "absolute", inset: "5%",
                        borderRadius: 8, overflow: "hidden",
                      }}>
                        <img src={photo.src} alt={photo.name} style={{
                          width: "100%", height: "100%",
                          objectFit: "cover", display: "block",
                        }} />
                        {/* Badge overlay — covers full photo like the export does */}
                        {badge && (
                          <img src={badge} alt="badge" style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            pointerEvents: "none",
                          }} />
                        )}
                      </div>
                      {/* Remove button */}
                      <button onClick={() => removePhoto(photo.id)} style={{
                        position: "absolute", top: 6, right: 6,
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

              {/* Preset badge grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {PRESET_BADGES.map((preset) => {
                  const isSelected = selectedPreset === preset.file;
                  return (
                    <button
                      key={preset.file}
                      onClick={() => selectPresetBadge(preset)}
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        border: isSelected ? "2.5px solid #FFD84D" : "2px solid rgba(26,25,23,0.12)",
                        background: isSelected ? "#fffbe6" : "#fff",
                        padding: "10px 8px", cursor: "pointer", textAlign: "center",
                        transition: "all 0.15s", fontFamily: "inherit",
                        boxShadow: isSelected ? "0 0 0 3px rgba(255,216,77,0.35)" : "none",
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: "absolute", top: 5, right: 5,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "#FFD84D", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="#0f0e0d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      <img src={preset.file} alt={preset.name} style={{ maxHeight: 36, maxWidth: "100%", margin: "0 auto", display: "block", objectFit: "contain" }} />
                      <span style={{ fontSize: 10, color: isSelected ? "#0f0e0d" : "rgba(26,25,23,0.5)", fontWeight: isSelected ? 600 : 400, marginTop: 4, display: "block" }}>{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom upload */}
              <div
                onClick={() => badgeInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBadge(true); }}
                onDragLeave={() => setIsDraggingBadge(false)}
                onDrop={handleBadgeDrop}
                style={{
                  borderRadius: 10, border: isDraggingBadge ? "2px dashed #FF9EC6" : "2px dashed rgba(26,25,23,0.18)",
                  background: isDraggingBadge ? "rgba(255,158,198,0.06)" : "rgba(26,25,23,0.03)",
                  padding: "12px 16px", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                }}>
                <span style={{ fontSize: 11, color: "rgba(26,25,23,0.45)" }}>
                  Or drop custom badge / <span style={{ color: "#c4608a", fontWeight: 600 }}>click to upload</span>
                </span>
              </div>
              <input ref={badgeInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) { setSelectedPreset(null); loadBadge(e.target.files[0]); }}} />
              {badge && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "rgba(26,25,23,0.4)", overflow: "hidden", textOverflow: "ellipsis" }}>{badgeName}</span>
                  <button onClick={() => { setBadge(null); setBadgeName(""); setSelectedPreset(null); }} style={{
                    background: "none", border: "none", color: "rgba(26,25,23,0.4)",
                    cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: "2px 6px",
                  }}>Remove</button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
