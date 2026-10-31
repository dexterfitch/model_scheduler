/**
 * The body type and genitalia questions on a model's profile. Genitalia is only asked
 * of models who pose nude.
 */

import React, { useId } from "react";
import { GENITALIA_OPTIONS } from "../utils/constants";
import BodyTypePicker from "./BodyTypePicker";

/** The body type picker and, for nude models, the genitalia question. */
function ModelBodyFields({ values, onChange, labelClassName = "form-label" }) {
  /** Passes a changed field to the form. */
  const handle = (e) => onChange(e.target.name, e.target.value);
  const id = useId();
  const genitaliaId = `${id}-genitalia`;
  const genitaliaHelpId = `${id}-genitalia-help`;

  return (
    <div className="row mb-3">
      <div className="col-md-6 mb-3 mb-md-0">
        <BodyTypePicker
          value={values.body_type || ""}
          onChange={(value) => onChange("body_type", value)}
          noneLabel="Prefer not to say"
          labelClassName={labelClassName}
        />
      </div>
      {values.willing_to_model_nude && (
        <div className="col-md-6">
          <label className={labelClassName} htmlFor={genitaliaId}>Genitalia</label>
          <select id={genitaliaId} className="form-select" name="genitalia" value={values.genitalia || ""} onChange={handle} aria-describedby={genitaliaHelpId}>
            <option value="">Prefer not to say</option>
            {GENITALIA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div id={genitaliaHelpId} className="form-text">Only visible to admins, and only used to match nude sessions.</div>
        </div>
      )}
    </div>
  );
}

export default ModelBodyFields;
