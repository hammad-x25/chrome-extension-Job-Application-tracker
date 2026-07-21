// storage.js
// This file hides the chrome.storage API behind simple reusable functions.
// You can import these functions inside sidepanel.js.

const STORAGE_KEY = "jobApplications";

export async function getJobs() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

export async function saveJobs(jobs) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: jobs
  });
}

export async function addJob(job) {
  const jobs = await getJobs();

  const newJob = {
    ...job,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updatedJobs = [newJob, ...jobs];
  await saveJobs(updatedJobs);

  return newJob;
}

export async function updateJob(jobId, changes) {
  const jobs = await getJobs();

  const updatedJobs = jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }

    return {
      ...job,
      ...changes,
      updatedAt: new Date().toISOString()
    };
  });

  await saveJobs(updatedJobs);
}

export async function deleteJob(jobId) {
  const jobs = await getJobs();
  const updatedJobs = jobs.filter((job) => job.id !== jobId);
  await saveJobs(updatedJobs);
}

export async function findJobByUrl(url) {
  const jobs = await getJobs();
  return jobs.find((job) => job.url === url) ?? null;
}

export async function clearJobs() {
  await chrome.storage.local.remove(STORAGE_KEY);
}
