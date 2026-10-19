import React from "react";
import { BODY_TYPES, GENITALIA_OPTIONS } from "../utils/constants";

// Optional model-profile fields used for matching. Genitalia is only asked of
// models who are willing to pose nude, and is only visible to admins.
function ModelBodyFields({ values, onChange, labelClassName = "form-label" }) {
  const handle = (e) => onChange(e.target.name, e.target.value);

  return (
    <div className="row mb-3">
      <div className="col-md-6 mb-3 mb-md-0">
        <label className={labelClassName}>Body Type</label>
        <select className="form-select" name="body_type" value={values.body_type || ""} onChange={handle}>
          <option value="">Prefer not to say</option>
          {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      {values.willing_to_model_nude && (
        <div className="col-md-6">
          <label className={labelClassName}>Genitalia</label>
          <select className="form-select" name="genitalia" value={values.genitalia || ""} onChange={handle}>
            <option value="">Prefer not to say</option>
            {GENITALIA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="form-text">Only visible to admins, and only used to match nude sessions.</div>
        </div>
      )}
    </div>
  );
}

export default ModelBodyFields;
