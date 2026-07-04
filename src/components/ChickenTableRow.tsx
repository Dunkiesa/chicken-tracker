"use client";
import { memo } from "react";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  breed_name: string | null;
  origin_source_name: string | null;
  acquisition_type_name: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

const DEPARTURE_REASONS = ["died/illness", "sold", "predator", "gave away", "Other"] as const;

type ChickenTableRowProps = {
  chicken: Chicken;
  isAdmin: boolean;
  departingChickenId: number | null;
  departureDate: string;
  departureReason: string;
  departureOtherReason: string;
  departingSave: boolean;
  onMarkDeparted: () => void;
  onReinstate: () => void;
  onStartDepart: () => void;
  onCancelDepart: () => void;
  onDepartureDateChange: (value: string) => void;
  onDepartureReasonChange: (value: string) => void;
  onDepartureOtherReasonChange: (value: string) => void;
};

function ChickenTableRowInner({
  chicken,
  isAdmin,
  departingChickenId,
  departureDate,
  departureReason,
  departureOtherReason,
  departingSave,
  onMarkDeparted,
  onReinstate,
  onStartDepart,
  onCancelDepart,
  onDepartureDateChange,
  onDepartureReasonChange,
  onDepartureOtherReasonChange,
}: ChickenTableRowProps) {
  return (
    <tr
      style={{
        borderBottom: "1px solid #eee",
        background: chicken.departed ? "#f5f5f5" : "transparent",
      }}
    >
      <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", width: "40px" }}>
        {chicken.primary_photo_path ? (
          <img
            src={`/api/photos/${chicken.primary_photo_path}`}
            alt=""
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              objectFit: "cover",
              background: "#f0f0f0",
              display: "block",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#f0f0f0",
            }}
          />
        )}
      </td>
      <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", fontWeight: 500 }}>
        <a
          href={`/chickens/${chicken.id}`}
          style={{ color: "#1565c0", textDecoration: "none" }}
        >
          {chicken.name}
        </a>
      </td>
      <td style={{ padding: "0.5rem" }}>
        <span
          style={{
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
            fontSize: "0.8rem",
            fontWeight: 600,
            background:
              chicken.sex === "Hen"
                ? "#fce4ec"
                : chicken.sex === "Rooster"
                ? "#e3f2fd"
                : "#f3e5f5",
            color:
              chicken.sex === "Hen"
                ? "#c62828"
                : chicken.sex === "Rooster"
                ? "#1565c0"
                : "#7b1fa2",
          }}
        >
          {chicken.sex}
        </span>
      </td>
      <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
        {chicken.breed_name || "-"}
      </td>
      <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
        {chicken.origin_source_name || "-"}
      </td>
      <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
        {chicken.acquisition_type_name || "-"}
      </td>
      <td style={{ padding: "0.5rem" }}>
        {chicken.departed ? (
          <span
            style={{
              padding: "0.15rem 0.4rem",
              borderRadius: "4px",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: "#ffebee",
              color: "#b71c1c",
            }}
          >
            Departed
          </span>
        ) : (
          <span
            style={{
              padding: "0.15rem 0.4rem",
              borderRadius: "4px",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: "#e8f5e9",
              color: "#2e7d32",
            }}
          >
            Active
          </span>
        )}
        {chicken.departed && chicken.departure_date && (
          <span style={{ display: "block", fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>
            {chicken.departure_date}
            {chicken.departure_reason && ` · ${chicken.departure_reason}`}
          </span>
        )}
      </td>
      {isAdmin && (
        <td style={{ padding: "0.5rem", textAlign: "center" }}>
          {departingChickenId === chicken.id ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                background: "#fafafa",
                minWidth: "220px",
              }}
            >
              <input
                type="date"
                value={departureDate}
                onChange={(e) => onDepartureDateChange(e.target.value)}
                disabled={departingSave}
                style={{
                  padding: "0.4rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              />
              <select
                value={departureReason}
                onChange={(e) => onDepartureReasonChange(e.target.value)}
                disabled={departingSave}
                style={{
                  padding: "0.4rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {DEPARTURE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {departureReason === "Other" && (
                <input
                  type="text"
                  value={departureOtherReason}
                  onChange={(e) => onDepartureOtherReasonChange(e.target.value)}
                  placeholder="Describe reason..."
                  disabled={departingSave}
                  style={{
                    padding: "0.4rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                  onClick={onMarkDeparted}
                  disabled={departingSave || (departureReason === "Other" && !departureOtherReason.trim())}
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.8rem",
                    border: "none",
                    borderRadius: "4px",
                    background: "#d32f2f",
                    color: "#fff",
                    cursor: "pointer",
                    opacity: departingSave ? 0.6 : 1,
                  }}
                >
                  {departingSave ? "Saving..." : "Confirm"}
                </button>
                <button
                  onClick={onCancelDepart}
                  disabled={departingSave}
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.8rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : chicken.departed ? (
            <button
              onClick={onReinstate}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                border: "1px solid #a5d6a7",
                borderRadius: "4px",
                background: "#fff",
                color: "#2e7d32",
                cursor: "pointer",
              }}
            >
              Reinstate
            </button>
          ) : (
            <button
              onClick={onStartDepart}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                border: "1px solid #ef9a9a",
                borderRadius: "4px",
                background: "#fff",
                color: "#c62828",
                cursor: "pointer",
              }}
            >
              Mark Departed
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

export const ChickenTableRow = memo(ChickenTableRowInner);
