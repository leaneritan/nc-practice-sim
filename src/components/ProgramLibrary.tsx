import { useState } from "react";
import { useI18n } from "../i18n";
import { usePrograms } from "../programs";
import { useAppStore } from "../store";
import { sampleMazatrol } from "../nc/mazatrol/model";
export function ProgramLibrary({
  disabled,
  beforeChange,
}: {
  disabled: boolean;
  beforeChange: () => void;
}) {
  const { t } = useI18n();
  const library = usePrograms();
  const tools = useAppStore((s) => s.tools);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"eia" | "mazatrol">("mazatrol");
  return (
    <details className="program-library">
      <summary>{t.maz.library}</summary>
      <fieldset disabled={disabled}>
        <label>
          {t.maz.program}
          <select
            value={library.activeId ?? ""}
            onChange={(e) => {
              beforeChange();
              library.select(e.target.value || null);
            }}
          >
            <option value="">{t.maz.original}</option>
            {library.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {t.maz.formats[d.kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.maz.name}
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t.maz.format}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {Object.entries(t.maz.formats).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!name.trim() || library.documents.length >= 100}
          onClick={() => {
            beforeChange();
            library.add(name, kind);
            setName("");
          }}
        >
          {t.maz.create}
        </button>
        <button
          disabled={library.documents.length >= 100}
          onClick={() => {
            beforeChange();
            library.add(t.maz.sample, "mazatrol", sampleMazatrol(tools));
          }}
        >
          {t.maz.loadSample}
        </button>
      </fieldset>
    </details>
  );
}
