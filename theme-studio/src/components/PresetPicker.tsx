import { THEME_PRESETS, PRESET_SCOPES, type ThemePreset } from '../theme/presets';
import { useAssignments } from '../store/AssignmentsContext';

export function PresetPicker() {
  const { setMode, setChrome, setColor, clearColor } = useAssignments();

  function applyPreset(preset: ThemePreset) {
    setMode(preset.mode);
    setChrome(preset.mode, { background: preset.background, foreground: preset.text });
    setColor(PRESET_SCOPES.comments, preset.comments, preset.mode);
    setColor(PRESET_SCOPES.keywords, preset.keywords, preset.mode);
    setColor(PRESET_SCOPES.strings, preset.strings, preset.mode);
    setColor(PRESET_SCOPES.functions, preset.functions, preset.mode);
    // Applying a preset is a clean swap to exactly what it defines, not a
    // merge — a preset with no numbers color clears any prior assignment
    // instead of leaving a leftover from whatever was set before.
    if (preset.numbers) setColor(PRESET_SCOPES.numbers, preset.numbers, preset.mode);
    else clearColor(PRESET_SCOPES.numbers, preset.mode);
  }

  return (
    <div className="preset-picker">
      <span className="preset-picker-label">Quick start</span>
      <div className="preset-list">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="preset-card"
            style={{ background: preset.background, color: preset.text, borderColor: preset.comments }}
            onClick={() => applyPreset(preset)}
            title={`Apply the ${preset.name} preset`}
          >
            <span className="preset-name">{preset.name}</span>
            <span className="preset-dots">
              <span className="preset-dot" style={{ background: preset.keywords }} />
              <span className="preset-dot" style={{ background: preset.strings }} />
              <span className="preset-dot" style={{ background: preset.functions }} />
              {preset.numbers && <span className="preset-dot" style={{ background: preset.numbers }} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
