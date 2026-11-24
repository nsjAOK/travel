"use client";
import { useState } from "react";

export type ChipEdit =
  | { type: "number"; value: number | null; min?: number; step?: number; suffix?: string; onSave: (v: number | null) => void }
  | { type: "text" | "date"; value: string; onSave: (v: string) => void }
  | { type: "select"; value: string; options: { value: string; label: string }[]; onSave: (v: string) => void };

function Pencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M8 1.5l2.5 2.5L4 10.5H1.5V8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** A chip that shows one understood requirement and edits it in place. */
export default function Chip({ text, edit, onRemove }: { text: string; edit?: ChipEdit; onRemove?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing && edit) {
    const save = () => {
      if (edit.type === "number") edit.onSave(draft.trim() === "" ? null : Number(draft));
      else edit.onSave(draft);
      setEditing(false);
    };
    return (
      <span className="chip-edit">
        {edit.type === "select" ? (
          <select aria-label={`Change ${text}`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
            {edit.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            aria-label={`Change ${text}`}
            type={edit.type === "number" ? "number" : edit.type === "date" ? "date" : "text"}
            min={edit.type === "number" ? edit.min : undefined}
            step={edit.type === "number" ? edit.step : undefined}
            value={draft}
            placeholder={edit.type === "number" ? "any" : ""}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
        )}
        {edit.type === "number" && edit.suffix ? <span className="small">{edit.suffix}</span> : null}
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button>
        <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      <button
        type="button"
        className="chip"
        aria-label={edit ? `Edit ${text}` : text}
        onClick={() => {
          if (!edit) return;
          setDraft(edit.value === null ? "" : String(edit.value));
          setEditing(true);
        }}
      >
        {text}
        {edit ? <Pencil /> : null}
      </button>
      {onRemove ? (
        <button type="button" className="chip" aria-label={`Remove ${text}`} onClick={onRemove} style={{ padding: "0 10px" }}>
          ×
        </button>
      ) : null}
    </span>
  );
}
