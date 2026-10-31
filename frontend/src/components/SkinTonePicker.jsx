/**
 * The skin tone question as color circles (radio buttons underneath), with Prefer not to say.
 */

import React, { useId } from 'react';
import { SKIN_TONE_OPTIONS } from '../utils/constants';
import styles from './SkinTonePicker.module.css';

/** A radio group of skin tones, with the choice written underneath. */
function SkinTonePicker({ value, onChange, label = 'Skin Tone', required = false, labelClassName = 'form-label' }) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div>
      <div id={labelId} className={labelClassName}>{label}{required && ' *'}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="d-flex gap-3 py-2">
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
            <span
              className={tone.color ? styles.circle : `${styles.circle} ${styles.none}`}
              style={tone.color ? { backgroundColor: tone.color } : undefined}
              aria-hidden="true"
            />
            <span className="visually-hidden">{tone.label}</span>
          </label>
        ))}
      </div>
      <div className="form-text mt-2" aria-hidden="true">
        Selected: <strong>{value || 'None'}</strong>
      </div>
    </div>
  );
}

export default SkinTonePicker;
