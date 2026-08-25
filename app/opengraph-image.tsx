import { ImageResponse } from "next/og";

export const alt = "Selykai — Comprendre une entreprise avant de la contacter";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#0d1520",
          color: "#f7f9fc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ position: "absolute", inset: "0 0 auto", height: 8, background: "#2149b6" }} />
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 78px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#172235",
                border: "1px solid rgba(255,255,255,.14)",
              }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path
                  d="M34.6 14.2C32 11.4 28.5 10 24.1 10c-5.8 0-9.7 2.7-9.7 6.8 0 9.2 19.2 4.4 19.2 14.1 0 4.4-4.2 7.1-10.1 7.1-4.7 0-8.6-1.7-11.2-5"
                  stroke="#b9d56a"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
                <circle cx="36.5" cy="11.5" r="2.5" fill="#d6e3ac" />
                <circle cx="10.5" cy="35.5" r="2.5" fill="#b9d56a" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 31, fontWeight: 700, letterSpacing: "-1px" }}>Selykai</span>
              <span style={{ color: "#95a3bd", fontSize: 17, letterSpacing: "1px" }}>
                COMPANY INTELLIGENCE
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 930 }}>
            <span style={{ color: "#9db2e8", fontSize: 20, fontWeight: 600, letterSpacing: "1px" }}>
              INTELLIGENCE ENTREPRISE · FRANCE
            </span>
            <div style={{ fontSize: 64, lineHeight: 1.04, fontWeight: 700, letterSpacing: "-3px" }}>
              Comprendre l’entreprise. Agir au bon moment.
            </div>
            <div style={{ color: "#b4bfd2", fontSize: 25, lineHeight: 1.45 }}>
              Sources officielles, faits traçables et décisions explicables — dans un seul espace.
            </div>
          </div>

          <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,.14)", borderBottom: "1px solid rgba(255,255,255,.14)" }}>
            {["Sources officielles", "Provenance conservée", "Inférences identifiées"].map((label, index) => (
              <span
                key={label}
                style={{
                  padding: "14px 22px",
                  color: "#dce4f3",
                  fontSize: 16,
                  borderRight: index < 2 ? "1px solid rgba(255,255,255,.14)" : "none",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
