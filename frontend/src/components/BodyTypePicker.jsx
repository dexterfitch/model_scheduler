import React, { useId } from 'react';
import { BODY_TYPES } from '../utils/constants';
import BodyTypeIcon from './BodyTypeIcon';
import styles from './BodyTypePicker.module.css';

// Body type as picture buttons, each with its word on screen. The first choice is
// for not answering ("Prefer not to say" on a profile, "Any" on a request).
// Each choice is a real radio button: Tab reaches the group, arrow keys move between them.
function BodyTypePicker({ value, onChange, noneLabel, noneValue = '', label = 'Body Type', labelClassName = 'form-label' }) {
  const id = useId();
  const labelId = `${id}-label`;
  const choices = [{ value: noneValue, label: noneLabel }, ...BODY_TYPES.map(t => ({ value: t, label: t }))];
  const current = value || noneValue;

  return (
    <div>
      <div id={labelId} className={labelClassName}>{label}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="d-flex flex-wrap gap-2">
        {choices.map(choice => (
          <label key={choice.label} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={`${id}-body-type`}
              value={choice.value}
              checked={current === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span className={styles.card}>
              <BodyTypeIcon type={choice.value} size={28} />
              <span>{choice.label}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default BodyTypePicker;
