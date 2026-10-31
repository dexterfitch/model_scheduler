/**
 * The body type question as picture buttons (radio buttons underneath), with a skip choice first.
 */

import React, { useId } from 'react';
import { BODY_TYPES } from '../utils/constants';
import BodyTypeIcon from './BodyTypeIcon';
import styles from './BodyTypePicker.module.css';

/** A radio group of body types, with the skip choice (Prefer not to say, or Any) first. */
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
