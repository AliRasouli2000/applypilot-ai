import { useEffect, useState } from "react";

import ApplicationFormFields from "./ApplicationFormFields";
import Modal from "./Modal";
import Spinner from "./Spinner";
import StatusBadge from "./StatusBadge";
import {
  AlertIcon,
  BriefcaseIcon,
  CheckIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";

import { API_URL } from "../config";
import {
  STATUSES,
  type ApplicationForm,
  type JobApplication,
} from "../types";
import { formatDate, getErrorMessage, getToday } from "../utils";

type DashboardProps = {
  token: string;
  onSessionExpired: () => void;
};

// Which form is open: none, "create", or editing a specific application
type Editor =
  | { mode: "create" }
  | { mode: "edit"; application: JobApplication }
  | null;

function emptyForm(): ApplicationForm {
  return {
    company: "",
    job_title: "",
    status: "Applied",
    application_date: getToday(),
    job_url: "",
    notes: "",
  };
}

function toForm(application: JobApplication): ApplicationForm {
  return {
    company: application.company,
    job_title: application.job_title,
    status: application.status,
    application_date: application.application_date,
    job_url: application.job_url ?? "",
    notes: application.notes ?? "",
  };
}

export default function Dashboard({
  token,
  onSessionExpired,
}: DashboardProps) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [pendingDelete, setPendingDelete] =
    useState<JobApplication | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Dashboard statistics
  const countByStatus = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      applications.filter((app) => app.status === status).length,
    ])
  ) as Record<(typeof STATUSES)[number], number>;

  const total = applications.length;

  // Search and status filtering
  const query = searchQuery.trim().toLowerCase();

  const filteredApplications = applications.filter((application) => {
    const matchesSearch =
      application.company.toLowerCase().includes(query) ||
      application.job_title.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" || application.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const isFiltering = query !== "" || statusFilter !== "All";

  // Load applications from FastAPI
  useEffect(() => {
    let cancelled = false;

    async function fetchApplications() {
      try {
        const response = await fetch(`${API_URL}/applications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) return;

        if (response.status === 401) {
          onSessionExpired();
          return;
        }

        if (!response.ok) {
          throw new Error("We couldn't load your applications.");
        }

        const data: JobApplication[] = await response.json();

        if (!cancelled) {
          setApplications(data);
          setLoadError("");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            getErrorMessage(err, "We couldn't load your applications.")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchApplications();

    return () => {
      cancelled = true;
    };
  }, [token, onSessionExpired, reloadCount]);

  // Hide the toast after a few seconds
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function retryLoading() {
    setLoading(true);
    setLoadError("");
    setReloadCount((count) => count + 1);
  }

  function openCreateForm() {
    setFormError("");
    setEditor({ mode: "create" });
  }

  function openEditForm(application: JobApplication) {
    setFormError("");
    setEditor({ mode: "edit", application });
  }

  function closeForm() {
    if (saving) return;
    setEditor(null);
    setFormError("");
  }

  // Create or update application
  async function handleSubmit(values: ApplicationForm) {
    if (saving || editor === null) return;

    setSaving(true);
    setFormError("");

    const isEditing = editor.mode === "edit";

    const payload = {
      company: values.company.trim(),
      job_title: values.job_title.trim(),
      status: values.status,
      application_date: values.application_date,
      job_url: values.job_url.trim() || null,
      notes: values.notes.trim() || null,
    };

    try {
      const endpoint = isEditing
        ? `${API_URL}/applications/${editor.application.id}`
        : `${API_URL}/applications`;

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          isEditing
            ? "We couldn't save your changes. Please try again."
            : "We couldn't add this application. Please try again."
        );
      }

      const saved: JobApplication = await response.json();

      if (isEditing) {
        setApplications((previous) =>
          previous.map((application) =>
            application.id === saved.id ? saved : application
          )
        );
        setToast("Application updated");
      } else {
        setApplications((previous) => [saved, ...previous]);
        setToast("Application added");
      }

      setEditor(null);
    } catch (err) {
      setFormError(getErrorMessage(err, "Something went wrong."));
    } finally {
      setSaving(false);
    }
  }

  // Delete application
  async function confirmDelete() {
    if (deleting || pendingDelete === null) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `${API_URL}/applications/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error("We couldn't delete this application.");
      }

      const deletedId = pendingDelete.id;

      setApplications((previous) =>
        previous.filter((item) => item.id !== deletedId)
      );
      setPendingDelete(null);
      setToast("Application deleted");
    } catch (err) {
      setDeleteError(
        getErrorMessage(err, "We couldn't delete this application.")
      );
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError("");
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("All");
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Applications</h1>
          <p className="page-subtitle">
            Track every role you've applied to, from first click to offer.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={openCreateForm}
        >
          <PlusIcon />
          New application
        </button>
      </div>

      {/* Dashboard Statistics */}
      <section className="stats-grid" aria-label="Application statistics">
        <div className="stat-card stat-card-total">
          <p className="stat-label">Total applications</p>
          <p className="stat-value">{loading ? "–" : total}</p>

          <div className="pipeline-bar" aria-hidden="true">
            {total > 0 &&
              STATUSES.map((status) =>
                countByStatus[status] > 0 ? (
                  <span
                    key={status}
                    className={`pipeline-segment status-${status.toLowerCase()}`}
                    style={{
                      width: `${(countByStatus[status] / total) * 100}%`,
                    }}
                  />
                ) : null
              )}
          </div>
        </div>

        {STATUSES.map((status) => (
          <div className="stat-card" key={status}>
            <p className="stat-label">
              <span
                className={`status-dot status-${status.toLowerCase()}`}
                aria-hidden="true"
              />
              {status === "Offer" ? "Offers" : status}
            </p>
            <p className="stat-value">
              {loading ? "–" : countByStatus[status]}
            </p>
            <p className="stat-hint">
              {total > 0
                ? `${Math.round((countByStatus[status] / total) * 100)}% of total`
                : "No data yet"}
            </p>
          </div>
        ))}
      </section>

      {/* Applications list */}
      <section className="card" aria-labelledby="applications-heading">
        <div className="card-toolbar">
          <h2 id="applications-heading" className="card-title">
            All applications
          </h2>

          <div className="search-field">
            <SearchIcon />
            <input
              type="search"
              className="input"
              placeholder="Search company or role"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search applications"
            />
          </div>
        </div>

        <div
          className="filter-chips"
          role="group"
          aria-label="Filter by status"
        >
          {["All", ...STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              className="chip"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status}
              <span className="chip-count">
                {status === "All"
                  ? total
                  : countByStatus[status as (typeof STATUSES)[number]]}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="skeleton-list" aria-busy="true">
            <span className="visually-hidden" role="status">
              Loading applications
            </span>
            {[0, 1, 2, 3].map((row) => (
              <div className="skeleton-row" key={row}>
                <span className="skeleton skeleton-avatar" />
                <span className="skeleton skeleton-text" />
                <span className="skeleton skeleton-text short" />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-icon empty-icon-error">
              <AlertIcon size={22} />
            </div>
            <h3>Something went wrong</h3>
            <p role="alert">{loadError}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={retryLoading}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && total === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <BriefcaseIcon size={22} />
            </div>
            <h3>No applications yet</h3>
            <p>
              Add the first role you've applied to and start building your
              pipeline.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={openCreateForm}
            >
              <PlusIcon />
              Add your first application
            </button>
          </div>
        )}

        {!loading &&
          !loadError &&
          total > 0 &&
          filteredApplications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <SearchIcon size={22} />
              </div>
              <h3>No matching applications</h3>
              <p>Try a different search term or status filter.</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}

        {!loading && !loadError && filteredApplications.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Applied</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredApplications.map((application) => (
                    <tr key={application.id}>
                      <td className="cell-company">
                        <span className="company-avatar" aria-hidden="true">
                          {application.company.charAt(0).toUpperCase()}
                        </span>
                        <span className="company-name">
                          {application.company}
                        </span>
                        {application.job_url && (
                          <a
                            className="icon-link"
                            href={application.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open job posting for ${application.job_title} at ${application.company} (opens in a new tab)`}
                          >
                            <ExternalLinkIcon size={14} />
                          </a>
                        )}
                      </td>

                      <td className="cell-role">
                        <span className="role-title">
                          {application.job_title}
                        </span>
                        {application.notes && (
                          <span className="role-notes" title={application.notes}>
                            {application.notes}
                          </span>
                        )}
                      </td>

                      <td className="cell-status">
                        <StatusBadge status={application.status} />
                      </td>

                      <td className="cell-date">
                        {formatDate(application.application_date)}
                      </td>

                      <td className="cell-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => openEditForm(application)}
                          aria-label={`Edit ${application.job_title} at ${application.company}`}
                          title="Edit"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button-danger"
                          onClick={() => setPendingDelete(application)}
                          aria-label={`Delete ${application.job_title} at ${application.company}`}
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="table-footer">
              Showing {filteredApplications.length} of {total}{" "}
              {total === 1 ? "application" : "applications"}
              {isFiltering && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </section>

      {/* Add / Edit dialog */}
      <Modal
        open={editor !== null}
        title={
          editor?.mode === "edit" ? "Edit application" : "New application"
        }
        description={
          editor?.mode === "edit"
            ? "Update the details of this application."
            : "Add a role you've applied to."
        }
        onClose={closeForm}
      >
        {editor !== null && (
          <ApplicationFormFields
            initialValues={
              editor.mode === "edit"
                ? toForm(editor.application)
                : emptyForm()
            }
            isEditing={editor.mode === "edit"}
            saving={saving}
            error={formError}
            onCancel={closeForm}
            onSubmit={(values) => void handleSubmit(values)}
          />
        )}
      </Modal>

      {/* Delete confirmation dialog */}
      <Modal
        open={pendingDelete !== null}
        title="Delete application?"
        size="sm"
        onClose={closeDeleteDialog}
      >
        {pendingDelete && (
          <>
            <div className="modal-body">
              <p className="confirm-text">
                This will permanently delete your application for{" "}
                <strong>{pendingDelete.job_title}</strong> at{" "}
                <strong>{pendingDelete.company}</strong>. This can't be
                undone.
              </p>

              {deleteError && (
                <div className="alert alert-error" role="alert">
                  <AlertIcon />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeDeleteDialog}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Success notifications */}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span className="toast-icon">
              <CheckIcon size={14} />
            </span>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
