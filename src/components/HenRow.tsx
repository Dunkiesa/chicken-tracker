"use client";
import { memo } from "react";

type HenRowProps = {
  hen: { id: number; name: string; primary_photo_path: string | null };
  weight: string;
  existing: { id: number; weight: number } | undefined;
  warning: { type: string; message: string }[] | undefined;
  disabled: boolean;
  onWeightChange: (henId: number, value: string) => void;
};

function HenRowInner({ hen, weight, existing, warning, disabled, onWeightChange }: HenRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.75rem",
        borderBottom: "1px solid #f0f0f0",
        background: existing ? "#f5f5f5" : "transparent",
      }}
    >
      {hen.primary_photo_path ? (
        <img
          src={`/api/photos/${hen.primary_photo_path}`}
          alt=""
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#f0f0f0",
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#f0f0f0",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: "1 1 100px", fontWeight: 500, fontSize: "0.95rem", minWidth: 0 }}>
        {hen.name}
      </div>
      {existing ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#666" }}>
            {existing.weight.toFixed(2)}g
          </span>
          <span style={{ color: "#2e7d32", fontSize: "1rem" }}>✓</span>
        </div>
      ) : (
        <input
          type="number"
          step="0.01"
          min="0"
          value={weight}
          onChange={(e) => onWeightChange(hen.id, e.target.value)}
          placeholder="Weight (g)"
          disabled={disabled}
          style={{
            width: "110px",
            padding: "0.4rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
            textAlign: "right",
            flexShrink: 0,
          }}
        />
      )}
      {warning != null && warning.length > 0 && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#f57f17",
            maxWidth: "160px",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {warning.map((w, i) => (
            <div key={i}>{w.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export const HenRow = memo(HenRowInner);
