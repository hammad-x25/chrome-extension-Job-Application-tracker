
// Main JavaScript file for the Job Application Tracker extension.
//
// Responsibilities:
// 1. Load jobs from Chrome storage.
// 2. Save new jobs.
// 3. Update existing jobs.
// 4. Delete jobs.
// 5. Search and filter jobs.
// 6. Render job cards.
// 7. Extract job information from the active webpage.
// 8. Export jobs as a CSV file.

import {
  getJobs,
  addJob,
  updateJob,
  deleteJob,
  findJobByUrl
} from "./storage.js";

// DOM ELEMENTS

const jobForm = document.querySelector("#jobForm");
const jobIdInput = document.querySelector("#jobId");
const jobTitleInput = document.querySelector("#jobTitle");
const companyNameInput = document.querySelector("#companyName");
const jobUrlInput = document.querySelector("#jobUrl");
const jobStatusInput = document.querySelector("#jobStatus");
const applicationDateInput = document.querySelector("#applicationDate");
const jobNotesInput = document.querySelector("#jobNotes");

const jobsList = document.querySelector("#jobsList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");

const totalCount = document.querySelector("#totalCount");
const appliedCount = document.querySelector("#appliedCount");
const interviewCount = document.querySelector("#interviewCount");

const extractJobButton = document.querySelector("#extractJobButton");
const exportButton = document.querySelector("#exportButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const saveJobButton = document.querySelector("#saveJobButton");
const formMessage = document.querySelector("#formMessage");

// This variable keeps a temporary copy of the jobs currently loaded
// from Chrome storage.
let jobs = [];

// STARTUP

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  setTodayAsDefaultDate();

  try {
    jobs = await getJobs();
    renderJobs();
  } catch (error) {
    console.error("Could not load jobs:", error);
    showMessage("Could not load saved jobs.", true);
  }
}

// FORM SUBMISSION: CREATE AND UPDATE

jobForm.addEventListener("submit", async (event) => {
  // Prevent the browser from reloading the page.
  event.preventDefault();

  const jobData = getFormData();

  // The HTML already uses required fields, but this gives us
  // an additional JavaScript check.
  if (!jobData.title || !jobData.company) {
    showMessage("Job title and company are required.", true);
    return;
  }

  try {
    const editingJobId = jobIdInput.value;

    if (editingJobId) {
      // UPDATE operation
      await updateJob(editingJobId, jobData);
      showMessage("Job updated successfully.");
    } else {
      // CREATE operation

      // Only check duplicate URLs when a URL was entered.
      if (jobData.url) {
        const existingJob = await findJobByUrl(jobData.url);

        if (existingJob) {
          showMessage("This job URL is already saved.", true);
          return;
        }
      }

      await addJob(jobData);
      showMessage("Job saved successfully.");
    }

    // Read the latest jobs again after changing storage.
    jobs = await getJobs();

    // Update the interface.
    renderJobs();

    // Clear the form.
    resetForm();
  } catch (error) {
    console.error("Could not save job:", error);
    showMessage("Could not save the job.", true);
  }
});

cancelEditButton.addEventListener("click", resetForm);

// SEARCH AND FILTER

searchInput.addEventListener("input", renderJobs);
statusFilter.addEventListener("change", renderJobs);

// EXTRACT JOB FROM CURRENT WEBPAGE

extractJobButton.addEventListener("click", async () => {
  try {
    extractJobButton.disabled = true;
    extractJobButton.textContent = "Reading page...";

    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const activeTab = tabs[0];

    if (!activeTab?.id) {
      throw new Error("No active browser tab was found.");
    }

    // Chrome does not allow extensions to access certain internal pages.
    if (
      activeTab.url?.startsWith("chrome://") ||
      activeTab.url?.startsWith("edge://") ||
      activeTab.url?.startsWith("about:") ||
      activeTab.url?.startsWith("chrome-extension://")
    ) {
      throw new Error("Open a normal website before extracting a job.");
    }

    let response;

    try {
      // First try to contact content.js in case it is already loaded.
      response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXTRACT_CURRENT_JOB"
      });
    } catch {
      // If content.js is not loaded, inject it into the active webpage.
      await chrome.scripting.executeScript({
        target: {
          tabId: activeTab.id
        },
        files: ["scripts/content.js"]
      });

      // Now ask content.js to extract the job information.
      response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXTRACT_CURRENT_JOB"
      });
    }

    if (!response?.success) {
      throw new Error(response?.error || "Could not read this webpage.");
    }

    const extractedJob = response.job;

    jobTitleInput.value = extractedJob.title || "";
    companyNameInput.value = extractedJob.company || "";
    jobUrlInput.value = extractedJob.url || activeTab.url || "";

    showMessage("Job information added to the form.");
  } catch (error) {
    console.error("Could not extract job:", error);
    showMessage(error.message || "Could not read this webpage.", true);
  } finally {
    extractJobButton.disabled = false;
    extractJobButton.textContent = "Get Current Job";
  }
});

// RENDER JOBS

function renderJobs() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  const filteredJobs = jobs.filter((job) => {
    const title = job.title?.toLowerCase() || "";
    const company = job.company?.toLowerCase() || "";

    const matchesSearch =
      title.includes(searchText) ||
      company.includes(searchText);

    const matchesStatus =
      selectedStatus === "all" ||
      job.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  // Remove old job cards from the interface.
  jobsList.replaceChildren();

  // Create and append one card for every filtered job.
  filteredJobs.forEach((job) => {
    const card = createJobCard(job);
    jobsList.append(card);
  });

  // Show the empty state only when no filtered jobs exist.
  emptyState.classList.toggle("hidden", filteredJobs.length > 0);

  updateStatistics();
}

// CREATE ONE JOB CARD

function createJobCard(job) {
  const card = document.createElement("article");
  card.classList.add("job-card");

  const header = document.createElement("div");
  header.classList.add("job-card-header");

  const titleArea = document.createElement("div");

  const title = document.createElement("h3");
  title.classList.add("job-card-title");
  title.textContent = job.title || "Untitled Job";

  const company = document.createElement("p");
  company.classList.add("job-company");
  company.textContent = job.company || "Unknown Company";

  titleArea.append(title, company);

  const statusBadge = document.createElement("span");
  statusBadge.classList.add("status-badge");
  statusBadge.textContent = job.status || "saved";

  header.append(titleArea, statusBadge);

  const meta = document.createElement("div");
  meta.classList.add("job-meta");

  const dateText = document.createElement("span");
  dateText.textContent = job.applicationDate
    ? `Date: ${formatDate(job.applicationDate)}`
    : "No application date";

  const createdText = document.createElement("span");
  createdText.textContent = job.createdAt
    ? `Saved: ${formatDate(job.createdAt)}`
    : "";

  meta.append(dateText);

  if (createdText.textContent) {
    meta.append(createdText);
  }

  card.append(header, meta);

  if (job.notes) {
    const notes = document.createElement("p");
    notes.classList.add("job-notes");
    notes.textContent = job.notes;
    card.append(notes);
  }

  const footer = document.createElement("div");
  footer.classList.add("job-card-footer");

  const linkArea = document.createElement("div");

  if (job.url) {
    const jobLink = document.createElement("a");
    jobLink.classList.add("job-link");
    jobLink.href = job.url;
    jobLink.target = "_blank";
    jobLink.rel = "noopener noreferrer";
    jobLink.textContent = "View job";

    linkArea.append(jobLink);
  }

  const actions = document.createElement("div");
  actions.classList.add("job-actions");

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.classList.add("button", "button-ghost");
  editButton.textContent = "Edit";

  editButton.addEventListener("click", () => {
    startEditing(job.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.classList.add("button", "button-danger");
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", () => {
    removeJob(job.id);
  });

  actions.append(editButton, deleteButton);
  footer.append(linkArea, actions);
  card.append(footer);

  return card;
}

// STATISTICS

function updateStatistics() {
  totalCount.textContent = jobs.length;

  appliedCount.textContent = jobs.filter((job) => {
    return job.status === "applied";
  }).length;

  interviewCount.textContent = jobs.filter((job) => {
    return job.status === "interview";
  }).length;
}

// EDIT JOB

function startEditing(jobId) {
  const selectedJob = jobs.find((job) => {
    return job.id === jobId;
  });

  if (!selectedJob) {
    showMessage("Could not find that job.", true);
    return;
  }

  jobIdInput.value = selectedJob.id;
  jobTitleInput.value = selectedJob.title || "";
  companyNameInput.value = selectedJob.company || "";
  jobUrlInput.value = selectedJob.url || "";
  jobStatusInput.value = selectedJob.status || "saved";
  applicationDateInput.value = selectedJob.applicationDate || "";
  jobNotesInput.value = selectedJob.notes || "";

  saveJobButton.textContent = "Update Job";
  cancelEditButton.classList.remove("hidden");

  // Move the form into view.
  jobForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  jobTitleInput.focus();
}

// DELETE JOB

async function removeJob(jobId) {
  const selectedJob = jobs.find((job) => {
    return job.id === jobId;
  });

  if (!selectedJob) {
    showMessage("Could not find that job.", true);
    return;
  }

  const shouldDelete = window.confirm(
    `Delete "${selectedJob.title}" at "${selectedJob.company}"?`
  );

  if (!shouldDelete) {
    return;
  }

  try {
    await deleteJob(jobId);

    // Reload the latest jobs from storage.
    jobs = await getJobs();

    // If the deleted job was currently being edited,
    // reset the form.
    if (jobIdInput.value === jobId) {
      resetForm();
    }

    renderJobs();
    showMessage("Job deleted successfully.");
  } catch (error) {
    console.error("Could not delete job:", error);
    showMessage("Could not delete the job.", true);
  }
}

// EXPORT JOBS TO CSV

exportButton.addEventListener("click", () => {
  if (jobs.length === 0) {
    showMessage("There are no jobs to export.", true);
    return;
  }

  const headers = [
    "Title",
    "Company",
    "Status",
    "Application Date",
    "URL",
    "Notes",
    "Created At",
    "Updated At"
  ];

  const rows = jobs.map((job) => {
    return [
      job.title || "",
      job.company || "",
      job.status || "",
      job.applicationDate || "",
      job.url || "",
      job.notes || "",
      job.createdAt || "",
      job.updatedAt || ""
    ];
  });

  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => {
      return row.map(escapeCsvValue).join(",");
    })
  ];

  const csvContent = csvLines.join("\n");

  const file = new Blob([csvContent], {
    type: "text/csv;charset=utf-8"
  });

  const downloadUrl = URL.createObjectURL(file);

  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = `job-applications-${getTodayForFilename()}.csv`;

  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(downloadUrl);

  showMessage("CSV exported successfully.");
});

// HELPER FUNCTIONS

function getFormData() {
  return {
    title: jobTitleInput.value.trim(),
    company: companyNameInput.value.trim(),
    url: jobUrlInput.value.trim(),
    status: jobStatusInput.value,
    applicationDate: applicationDateInput.value,
    notes: jobNotesInput.value.trim()
  };
}

function resetForm() {
  jobForm.reset();

  jobIdInput.value = "";
  saveJobButton.textContent = "Save Job";
  cancelEditButton.classList.add("hidden");

  setTodayAsDefaultDate();
}

function setTodayAsDefaultDate() {
  applicationDateInput.value = new Date()
    .toISOString()
    .split("T")[0];
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;

  formMessage.style.color = isError
    ? "#b42318"
    : "#027a48";

  window.clearTimeout(showMessage.timeoutId);

  showMessage.timeoutId = window.setTimeout(() => {
    formMessage.textContent = "";
  }, 3000);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function escapeCsvValue(value) {
  const stringValue = String(value);

  // CSV values containing commas, quotation marks or line breaks
  // must be wrapped in quotation marks.
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function getTodayForFilename() {
  return new Date()
    .toISOString()
    .split("T")[0];
}

