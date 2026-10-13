import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { HeartPulse } from "lucide-react";

const styles = {
  card: {
    width: "100%",
    maxWidth: 760,
    margin: "24px auto",
    padding: 24,
    border: "1px solid #bfdbfe",
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(30, 64, 175, 0.08)",
    color: "#111827",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 18,
    borderBottom: "1px solid #e5e7eb",
    color: "#2563eb",
  },
  title: { margin: 0, fontSize: 21, fontWeight: 700, color: "#111827" },
  content: {
    display: "grid",
    gridTemplateColumns: "170px minmax(0, 1fr)",
    gap: 24,
    alignItems: "start",
    paddingTop: 22,
  },
  qrPanel: {
    display: "grid",
    justifyItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 600,
  },
  qr: { display: "block", width: 140, height: 140 },
  badge: {
    display: "inline-flex",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 700,
  },
  details: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px 20px",
  },
  field: { display: "grid", gap: 5, minWidth: 0 },
  label: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  value: {
    overflowWrap: "anywhere",
    color: "#111827",
    fontSize: 13,
    fontWeight: 600,
  },
  buttons: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
};

const printStyles = `
  @page { size: auto; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; color: #111827; font-family: Arial, sans-serif; }
  .health-card {
    width: 720px; max-width: 100%; margin: 0 auto; padding: 24px;
    border: 1px solid #bfdbfe; border-radius: 20px; background: #fff;
  }
  .health-card-header {
    display: flex; align-items: center; gap: 12px; padding-bottom: 18px;
    border-bottom: 1px solid #e5e7eb; color: #2563eb;
  }
  .health-card-header h1 { margin: 0; color: #111827; font-size: 21px; }
  .health-card-content {
    display: grid; grid-template-columns: 170px minmax(0, 1fr);
    gap: 24px; align-items: start; padding-top: 22px;
  }
  .health-card-qr {
    display: grid; justify-items: center; gap: 10px; padding: 12px;
    border: 1px solid #bfdbfe; border-radius: 14px; color: #2563eb;
    font-size: 12px; font-weight: 600;
  }
  .health-card-qr img { display: block; width: 140px; height: 140px; }
  .health-card-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; }
  .health-card-field { display: grid; gap: 5px; min-width: 0; }
  .health-card-field span {
    color: #60a5fa; font-size: 10px; font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase;
  }
  .health-card-field strong { overflow-wrap: anywhere; color: #111827; font-size: 13px; }
  .health-card-footer { margin-top: 20px; }
  .health-card-badge {
    display: inline-flex; padding: 7px 12px; border-radius: 999px;
    background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700;
  }
  @media print { body { padding: 0; } }
`;

function escapeHtml(value) {
  return String(value ?? "Not recorded").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function displayValue(value) {
  return value === undefined || value === null || value === "" ? "Not recorded" : value;
}

function buildPrintCard(qrUrl, healthId, patient) {
  const fields = [
    ["Health ID", healthId],
    ["Name", patient.name],
    ["Gender", patient.gender],
    ["DOB", patient.dob],
    ["Mobile", patient.mobile],
  ];

  return `
    <article class="health-card">
      <header class="health-card-header">
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M2 12h20" />
          <path d="M19.8 4.2a5 5 0 0 0-7.1 0L12 5l-.7-.8a5 5 0 0 0-7.1 7.1L12 19l7.8-7.7a5 5 0 0 0 0-7.1Z" />
        </svg>
        <h1>Digital Health Card</h1>
      </header>
      <div class="health-card-content">
        <div class="health-card-qr">
          <img src="${escapeHtml(qrUrl)}" width="140" height="140" alt="QR code for Health ID" />
          <span>Scan for details</span>
        </div>
        <div class="health-card-details">
          ${fields.map(([label, value]) => `
            <div class="health-card-field">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(displayValue(value))}</strong>
            </div>
          `).join("")}
        </div>
      </div>
      <footer class="health-card-footer">
        <span class="health-card-badge">Active &bull; Valid</span>
      </footer>
    </article>
  `;
}

export default function DigitalHealthCard({ healthId, patient = {} }) {
  const [qrResult, setQrResult] = useState({ healthId: "", url: "", error: "" });
  const navigate = useNavigate();
  const qrUrl = qrResult.healthId === healthId ? qrResult.url : "";
  const qrError = qrResult.healthId === healthId ? qrResult.error : "";

  useEffect(() => {
    let active = true;

    if (!healthId) {
      return undefined;
    }

    QRCode.toDataURL(healthId, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    }).then((dataUrl) => {
      if (active) {
        setQrResult({ healthId, url: dataUrl, error: "" });
      }
    }).catch(() => {
      if (active) {
        setQrResult({
          healthId,
          url: "",
          error: "Unable to generate the QR code. Please try again.",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [healthId]);

  function handlePrint() {
    if (!qrUrl) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      window.alert("Allow pop-ups to print the Digital Health Card.");
      return;
    }

    printWindow.onload = () => {
      window.setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      }, 800);
    };

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Digital Health Card</title>
          <style>${printStyles}</style>
        </head>
        <body>${buildPrintCard(qrUrl, healthId, patient)}</body>
      </html>`);
    printWindow.document.close();
  }

  const fields = [
    ["HEALTH ID", healthId],
    ["NAME", patient.name],
    ["GENDER", patient.gender],
    ["DOB", patient.dob],
    ["MOBILE", patient.mobile],
  ];

  return (
    <section style={styles.card}>
      <header style={styles.header}>
        <HeartPulse aria-hidden="true" size={26} />
        <h3 style={styles.title}>Digital Health Card</h3>
      </header>

      <div style={styles.content}>
        <div style={styles.qrPanel}>
          {qrUrl ? (
            <img src={qrUrl} width="140" height="140" alt="QR code for Health ID" style={styles.qr} />
          ) : (
            <span role={qrError ? "alert" : "status"}>
              {qrError || "Generating QR code..."}
            </span>
          )}
          <span>Scan for details</span>
          <span style={styles.badge}>Active &bull; Valid</span>
        </div>

        <div style={styles.details}>
          {fields.map(([label, value]) => (
            <div key={label} style={styles.field}>
              <span style={styles.label}>{label}</span>
              <strong style={styles.value}>{displayValue(value)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.buttons}>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrUrl}
          style={{
            border: "1px solid #2563eb",
            borderRadius: 9,
            padding: "11px 16px",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: qrUrl ? "pointer" : "not-allowed",
            opacity: qrUrl ? 1 : 0.65,
          }}
        >
          Print Health ID
        </button>
        <button
          type="button"
          onClick={() => navigate(`/add-medical-history/${encodeURIComponent(healthId)}`)}
          style={{
            border: "1px solid #bfdbfe",
            borderRadius: 9,
            padding: "11px 16px",
            background: "#fff",
            color: "#2563eb",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add Medical History
        </button>
      </div>
    </section>
  );
}
