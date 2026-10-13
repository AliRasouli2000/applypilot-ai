import { useState, type FormEvent } from "react";

import { AlertIcon } from "./Icons";
import Spinner from "./Spinner";
import { STATUSES, type ApplicationForm } from "../types";

type FieldErrors = Partial<Record<keyof ApplicationForm, string>>;

type ApplicationFormFieldsProps = {
  initialValues: ApplicationForm;
  isEditing: boolean;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (values: ApplicationForm) => void;
};

function validate(values: ApplicationForm): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.company.trim()) {
    errors.company = "Company is required.";
  }

  if (!values.job_title.trim()) {
    errors.job_title = "Job title is required.";
  }

  if (!values.application_date) {
    errors.application_date = "Choose the date you applied.";
  }

  const url = values.job_url.trim();
  if (url && !/^https?:\/\/\S+\.\S+/i.test(url)) {
    errors.job_url = "Enter a full link starting with https://";
  }

  return errors;
}

export default function ApplicationFormFields({
  initialValues,
  isEditing,
  saving,
  error,
  onCancel,
  onSubmit,
}: ApplicationFormFieldsProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function updateField(field: keyof ApplicationForm, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));

    // Clear a field's error as soon as the user edits it
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const validationErrors = validate(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Move focus to the first invalid field
      const firstField = Object.keys(validationErrors)[0];
      document.getElementById(`field-${firstField}`)?.focus();
      return;
    }

    onSubmit(values);
  }

  // Shared accessibility props for an input with an optional error
  function fieldProps(field: keyof ApplicationForm) {
    return {
      id: `field-${field}`,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": errors[field] ? `error-${field}` : undefined,
    };
  }

  function fieldError(field: keyof ApplicationForm) {
    return errors[field] ? (
      <span id={`error-${field}`} className="field-error">
        {errors[field]}
      </span>
    ) : null;
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit} noValidate>
      <div className="modal-body">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="field-company">Company</label>
            <input
              {...fieldProps("company")}
              className="input"
              maxLength={150}
              autoComplete="organization"
              value={values.company}
              onChange={(e) => updateField("company", e.target.value)}
              placeholder="e.g. Microsoft"
            />
            {fieldError("company")}
          </div>

          <div className="field">
            <label htmlFor="field-job_title">Job title</label>
            <input
              {...fieldProps("job_title")}
              className="input"
              maxLength={150}
              value={values.job_title}
              onChange={(e) => updateField("job_title", e.target.value)}
              placeholder="e.g. Software Engineer"
            />
            {fieldError("job_title")}
          </div>

          <div className="field">
            <label htmlFor="field-status">Status</label>
            <select
              {...fieldProps("status")}
              className="input"
              value={values.status}
              onChange={(e) => updateField("status", e.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="field-application_date">Date applied</label>
            <input
              {...fieldProps("application_date")}
              className="input"
              type="date"
              value={values.application_date}
              onChange={(e) =>
                updateField("application_date", e.target.value)
              }
            />
            {fieldError("application_date")}
          </div>
        </div>

        <div className="field">
          <label htmlFor="field-job_url">
            Job posting URL <span className="optional">Optional</span>
          </label>
          <input
            {...fieldProps("job_url")}
            className="input"
            type="url"
            inputMode="url"
            value={values.job_url}
            onChange={(e) => updateField("job_url", e.target.value)}
            placeholder="https://example.com/careers/123"
          />
          {fieldError("job_url")}
        </div>

        <div className="field">
          <label htmlFor="field-notes">
            Notes <span className="optional">Optional</span>
          </label>
          <textarea
            {...fieldProps("notes")}
            className="input"
            rows={3}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Recruiter name, next steps, salary range..."
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="button button-primary"
          disabled={saving}
        >
          {saving && <Spinner />}
          {saving
            ? "Saving..."
            : isEditing
              ? "Save changes"
              : "Add application"}
        </button>
      </div>
    </form>
  );
}
