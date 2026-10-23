import React, { useId } from 'react';
import { SKIN_TONE_OPTIONS } from '../utils/constants';
import styles from './SkinTonePicker.module.css';

// Skin tone circles that work with a mouse, touch, keyboard and screen readers.
// Each circle is a real radio button: Tab reaches the group, arrow keys move between tones.
function SkinTonePicker({ value, onChange, label = 'Skin Tone', required = false, labelClassName = 'form-label' }) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div>
      <div id={labelId} className={labelClassName}>{label}{required && ' *'}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="d-flex gap-2">
        {SKIN_TONE_OPTIONS.map(tone => (
          <label key={tone.label} className={styles.swatch} title={tone.label}>
            <input
              type="radio"
              className={styles.input}
              name={`${id}-skin-tone`}
              value={tone.label}
              checked={value === tone.label}
              onChange={() => onChange(tone.label)}
              required={required}
            />
            <span className={styles.circle} style={{ backgroundColor: tone.color }} aria-hidden="true" />
            <span className="visually-hidden">{tone.label}</span>
          </label>
        ))}
      </div>
      <div className="form-text mt-1" aria-hidden="true">
        Selected: <strong>{value || 'None'}</strong>
      </div>
    </div>
  );
}

export default SkinTonePicker;