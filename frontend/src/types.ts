export const STATUSES = [
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
] as const;

export type ApplicationStatus = (typeof STATUSES)[number];

export type JobApplication = {
  id: number;
  company: string;
  job_title: string;
  status: string;
  application_date: string;
  job_url: string | null;
  notes: string | null;
};

export type ApplicationForm = {
  company: string;
  job_title: string;
  status: string;
  application_date: string;
  job_url: string;
  notes: string;
};
