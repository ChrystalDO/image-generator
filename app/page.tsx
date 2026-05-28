"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface PhotoItem {
  id: string;
  src: string;
  name: string;
  isPortrait: boolean;
  naturalWidth: number;
  naturalHeight: number;
}

interface BadgeCatalogItem {
  id: string;
  name: string;
  src: string;
  addedAt: number;
}

const CATALOG_KEY = "image-generator:badge-catalog";

function loadCatalog(): BadgeCatalogItem[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCatalog(items: BadgeCatalogItem[]) {
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(items)); } catch {}
}

export default function ImageGenerator() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeBadge, setActiveBadge] = useState<BadgeCatalogItem | null>(null);
  const [catalog, setCatalog] = useState<BadgeCatalogItem[]>([]);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingBadge, setIsDraggingBadge] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const saved = loadCatalog();
    setCatalog(saved);
    if (saved.length > 0) setActiveBadge(saved[0]);
  }, []);

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

  const addBadgeToCatalog = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      // Check for duplicate name
      const existing = catalog.find(b => b.name === file.name);
      if (existing) {
        setActiveBadge(existing);
        return;
      }
      const newItem: BadgeCatalogItem = {
        id: crypto.randomUUID(),
        name: file.name,
        src,
        addedAt: Date.now(),
      };
      const updated = [newItem, ...catalog];
      setCatalog(updated);
      saveCatalog(updated);
      setActiveBadge(newItem);
    };
    reader.readAsDataURL(file);
  };

  const deleteBadgeFromCatalog = (id: string) => {
    const updated = catalog.filter(b => b.id !== id);
    setCatalog(updated);
    saveCatalog(updated);
    if (activeBadge?.id === id) {
      setActiveBadge(updated.length > 0 ? updated[0] : null);
    }
    setConfirmDelete(null);
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
    if (file) addBadgeToCatalog(file);
  }, [catalog]);

  const renderThumbnail = (photo: PhotoItem): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const W = photo.naturalWidth;
      const H = photo.naturalHeight;
      canvas.width = W;
      canvas.height = H;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, W, H);
        const r = Math.min(22, W * 0.034);
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
        ctx.clip();
        ctx.drawImage(img, 0, 0, W, H);

        if (activeBadge) {
          const badgeImg = new Image();
          badgeImg.onload = () => {
            const bW = badgeImg.naturalWidth || badgeImg.width;
            const bH = badgeImg.naturalHeight || badgeImg.height;
            const margin = 18;
            const bx = margin;
            const by = photo.isPortrait ? margin : H - bH - margin;
            ctx.drawImage(badgeImg, bx, by, bW, bH);
            resolve(canvas.toDataURL("image/png"));
          };
          badgeImg.src = activeBadge.src;
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
    link.download = `${photo.name.replace(/\.[^.]+$/, "")}-exported.png`;
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
      link.download = `${photo.name.replace(/\.[^.]+$/, "")}-exported.png`;
      link.href = dataUrl;
      link.click();
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloadingAll(false);
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id));

  const sectionLabel: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(26,25,23,0.4)", margin: "0 0 12px" };

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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 36, alignItems: "start" }}>

          {/* Left: photos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <p style={sectionLabel}>Photos</p>
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
                <div style={{ fontSize: 11, color: "rgba(26,25,23,0.3)", marginTop: 6 }}>Landscape and portrait · multiple files ok</div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => e.target.files && loadFiles(e.target.files)} />
            </div>

            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={{
                    width: photo.isPortrait ? 160 : 240,
                    borderRadius: 14, overflow: "hidden", background: "#fff",
                    border: "1px solid rgba(26,25,23,0.1)", flexShrink: 0,
                  }}>
                    <div style={{ position: "relative", paddingBottom: photo.isPortrait ? "148.8%" : "67.2%", borderRadius: "14px 14px 0 0", overflow: "hidden" }}>
                      <img src={photo.src} alt={photo.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      {activeBadge && (
                        <div style={{ position: "absolute", ...(photo.isPortrait ? { top: 8, left: 8 } : { bottom: 8, left: 8 }), pointerEvents: "none" }}>
                          <img src={activeBadge.src} alt="badge" style={{ height: 24, width: "auto", display: "block" }} />
                        </div>
                      )}
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.85)", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 600, color: "rgba(26,25,23,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {photo.isPortrait ? "Portrait" : "Landscape"}
                      </div>
                      <button onClick={() => removePhoto(photo.id)} style={{ position: "absolute", top: photo.isPortrait ? 30 : 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.85)", border: "1px solid rgba(26,25,23,0.15)", color: "#1a1917", cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "rgba(26,25,23,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.name}</span>
                      <button onClick={() => downloadOne(photo)} disabled={processing === photo.id} style={{ padding: "4px 10px", borderRadius: 5, flexShrink: 0, background: processing === photo.id ? "rgba(255,216,77,0.3)" : "#FFD84D", border: "none", color: "#0f0e0d", fontSize: 10, fontWeight: 600, cursor: processing === photo.id ? "wait" : "pointer", fontFamily: "inherit" }}>
                        {processing === photo.id ? "…" : "⬇ Export"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: badge catalog */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 24 }}>

            {/* Upload new badge */}
            <div>
              <p style={sectionLabel}>Badge catalog</p>
              <div
                onClick={() => badgeInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBadge(true); }}
                onDragLeave={() => setIsDraggingBadge(false)}
                onDrop={handleBadgeDrop}
                style={{
                  borderRadius: 12, border: isDraggingBadge ? "2px dashed #c4608a" : "2px dashed rgba(26,25,23,0.18)",
                  background: isDraggingBadge ? "rgba(255,158,198,0.06)" : "rgba(26,25,23,0.03)",
                  padding: "16px", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(26,25,23,0.35)" strokeWidth="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span style={{ fontSize: 12, color: "rgba(26,25,23,0.45)" }}>
                  Add badge — drop or <span style={{ color: "#c4608a", fontWeight: 600 }}>click to upload</span>
                </span>
              </div>
              <input ref={badgeInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) addBadgeToCatalog(e.target.files[0]); e.target.value = ""; }} />
            </div>

            {/* Catalog grid */}
            {catalog.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catalog.map((item) => (
                  <div key={item.id} onClick={() => setActiveBadge(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    borderRadius: 10, cursor: "pointer", transition: "all 0.12s",
                    background: activeBadge?.id === item.id ? "#fff" : "transparent",
                    border: activeBadge?.id === item.id ? "1.5px solid rgba(26,25,23,0.15)" : "1.5px solid transparent",
                    position: "relative",
                  }}>
                    {/* Active indicator */}
                    {activeBadge?.id === item.id && (
                      <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 24, background: "#FFD84D", borderRadius: "0 3px 3px 0" }} />
                    )}
                    {/* Badge preview */}
                    <div style={{ width: 64, height: 40, borderRadius: 8, background: "rgba(26,25,23,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", padding: 4 }}>
                      <img src={item.src} alt={item.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                    {/* Name + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name.replace(/\.[^.]+$/, "")}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(26,25,23,0.4)", marginTop: 2 }}>
                        {new Date(item.addedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    {/* Selected tick or delete */}
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      {activeBadge?.id === item.id && (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#FFD84D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0f0e0d" strokeWidth="2"><polyline points="2,6 5,9 10,3"/></svg>
                        </div>
                      )}
                      {confirmDelete === item.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); deleteBadgeFromCatalog(item.id); }} style={{ padding: "2px 8px", borderRadius: 4, background: "#E24B4A", border: "none", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(26,25,23,0.08)", border: "none", color: "#1a1917", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.id); }} style={{ background: "none", border: "none", color: "rgba(26,25,23,0.25)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px", fontFamily: "inherit" }}>×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", borderRadius: 10, background: "rgba(26,25,23,0.03)", border: "1px dashed rgba(26,25,23,0.12)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(26,25,23,0.35)", lineHeight: 1.7 }}>No badges yet. Upload one above and it will be saved here for future sessions.</p>
              </div>
            )}

            {/* Active badge summary */}
            {activeBadge && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(26,25,23,0.1)" }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "rgba(26,25,23,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Active badge</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={activeBadge.src} alt={activeBadge.name} style={{ height: 28, width: "auto", maxWidth: 80 }} />
                  <span style={{ fontSize: 11, color: "rgba(26,25,23,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeBadge.name}</span>
                </div>
              </div>
            )}

            {/* Spec */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(26,25,23,0.1)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, color: "rgba(26,25,23,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Output spec</p>
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
