
// Runs inside the current webpage.
//
// Responsibilities:
// 1. Read job information from the page.
// 2. Support common job websites.
// 3. Fall back to generic selectors when the website is unknown.
// 4. Send the extracted job data back to sidepanel.js.
//
// This file does not save anything.
// storage.js handles saving, while sidepanel.js controls the interface.

(() => {
  // Prevent the message listener from being registered more than once
  // if Chrome injects this file again into the same page.
  if (globalThis.__JOB_TRACKER_CONTENT_SCRIPT_LOADED__) {
    return;
  }

  globalThis.__JOB_TRACKER_CONTENT_SCRIPT_LOADED__ = true;

  // SMALL DOM HELPERS

  function cleanText(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .replace(/\s+/g, " ")
      .trim();
  }

  function getText(selector) {
    const element = document.querySelector(selector);

    return cleanText(
      element?.innerText ||
      element?.textContent ||
      ""
    );
  }

  function getFirstText(selectors) {
    for (const selector of selectors) {
      const text = getText(selector);

      if (text) {
        return text;
      }
    }

    return "";
  }

  function getMetaContent(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content = cleanText(element?.getAttribute("content") || "");

      if (content) {
        return content;
      }
    }

    return "";
  }

  function getCanonicalUrl() {
    const canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    );

    return canonicalLink?.href || window.location.href;
  }

  // JSON-LD JOB POSTING

  function findJobPostingInJsonLd() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (const script of scripts) {
      const rawJson = script.textContent?.trim();

      if (!rawJson) {
        continue;
      }

      try {
        const parsedData = JSON.parse(rawJson);
        const jobPosting = searchForJobPosting(parsedData);

        if (jobPosting) {
          return jobPosting;
        }
      } catch (error) {
        // Some websites place invalid JSON inside JSON-LD scripts.
        // Ignore that script and continue searching.
        console.debug("Invalid JSON-LD skipped:", error);
      }
    }

    return null;
  }

  function searchForJobPosting(data) {
    if (!data) {
      return null;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const result = searchForJobPosting(item);

        if (result) {
          return result;
        }
      }

      return null;
    }

    if (typeof data !== "object") {
      return null;
    }

    const type = data["@type"];

    if (
      type === "JobPosting" ||
      (Array.isArray(type) && type.includes("JobPosting"))
    ) {
      return data;
    }

    if (data["@graph"]) {
      const graphResult = searchForJobPosting(data["@graph"]);

      if (graphResult) {
        return graphResult;
      }
    }

    for (const value of Object.values(data)) {
      const nestedResult = searchForJobPosting(value);

      if (nestedResult) {
        return nestedResult;
      }
    }

    return null;
  }

  function extractFromJsonLd() {
    const jobPosting = findJobPostingInJsonLd();

    if (!jobPosting) {
      return null;
    }

    let company = "";

    if (typeof jobPosting.hiringOrganization === "string") {
      company = jobPosting.hiringOrganization;
    } else if (
      jobPosting.hiringOrganization &&
      typeof jobPosting.hiringOrganization === "object"
    ) {
      company = jobPosting.hiringOrganization.name || "";
    }

    return {
      title: cleanText(jobPosting.title || ""),
      company: cleanText(company),
      description: cleanText(
        stripHtml(jobPosting.description || "")
      ),
      location: extractLocationFromJsonLd(jobPosting),
      salary: extractSalaryFromJsonLd(jobPosting),
      employmentType: formatEmploymentType(
        jobPosting.employmentType
      ),
      datePosted: cleanText(jobPosting.datePosted || ""),
      url: cleanText(jobPosting.url || getCanonicalUrl())
    };
  }

  function extractLocationFromJsonLd(jobPosting) {
    const location = jobPosting.jobLocation;

    if (!location) {
      return "";
    }

    const firstLocation = Array.isArray(location)
      ? location[0]
      : location;

    const address = firstLocation?.address;

    if (!address) {
      return cleanText(firstLocation?.name || "");
    }

    if (typeof address === "string") {
      return cleanText(address);
    }

    return cleanText(
      [
        address.addressLocality,
        address.addressRegion,
        address.addressCountry
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  function extractSalaryFromJsonLd(jobPosting) {
    const salary = jobPosting.baseSalary;

    if (!salary) {
      return "";
    }

    if (typeof salary === "string" || typeof salary === "number") {
      return String(salary);
    }

    const currency = salary.currency || "";
    const value = salary.value;

    if (!value) {
      return cleanText(currency);
    }

    if (typeof value === "number" || typeof value === "string") {
      return cleanText(`${currency} ${value}`);
    }

    const minimum = value.minValue;
    const maximum = value.maxValue;
    const unitText = value.unitText;

    const range = [minimum, maximum]
      .filter((item) => item !== undefined && item !== null)
      .join(" - ");

    return cleanText(
      [currency, range, unitText].filter(Boolean).join(" ")
    );
  }

  function formatEmploymentType(value) {
    if (!value) {
      return "";
    }

    if (Array.isArray(value)) {
      return cleanText(value.join(", "));
    }

    return cleanText(String(value));
  }

  function stripHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html);

    return template.content.textContent || "";
  }

  // WEBSITE-SPECIFIC EXTRACTORS

  function extractLinkedInJob() {
    return {
      title: getFirstText([
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".top-card-layout__title",
        "h1"
      ]),

      company: getFirstText([
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".top-card-layout__card a[data-tracking-control-name*='company']"
      ]),

      description: getFirstText([
        "#job-details",
        ".jobs-description__content",
        ".jobs-box__html-content",
        ".description__text"
      ]),

      location: getFirstText([
        ".job-details-jobs-unified-top-card__primary-description-container",
        ".jobs-unified-top-card__bullet",
        ".topcard__flavor--bullet"
      ]),

      salary: getFirstText([
        ".job-details-jobs-unified-top-card__job-insight-view-model-secondary",
        ".compensation__salary"
      ]),

      employmentType: "",
      datePosted: "",
      url: getCanonicalUrl()
    };
  }

  function extractIndeedJob() {
    return {
      title: getFirstText([
        "h1[data-testid='jobsearch-JobInfoHeader-title']",
        "h1.jobsearch-JobInfoHeader-title",
        "h1"
      ]),

      company: getFirstText([
        "[data-testid='inlineHeader-companyName']",
        "[data-company-name='true']",
        ".jobsearch-InlineCompanyRating-companyHeader"
      ]),

      description: getFirstText([
        "#jobDescriptionText",
        "[data-testid='jobsearch-jobDescriptionText']"
      ]),

      location: getFirstText([
        "[data-testid='job-location']",
        "[data-testid='inlineHeader-companyLocation']",
        ".jobsearch-JobInfoHeader-subtitle div:last-child"
      ]),

      salary: getFirstText([
        "#salaryInfoAndJobType",
        "[data-testid='attribute_snippet_testid']"
      ]),

      employmentType: "",
      datePosted: "",
      url: getCanonicalUrl()
    };
  }

  function extractGlassdoorJob() {
    return {
      title: getFirstText([
        "[data-test='job-title']",
        "h1"
      ]),

      company: getFirstText([
        "[data-test='employer-name']",
        "[data-test='company-name']"
      ]),

      description: getFirstText([
        "[data-test='jobDescriptionContent']",
        ".JobDetails_jobDescription__uW_fK"
      ]),

      location: getFirstText([
        "[data-test='location']",
        "[data-test='job-location']"
      ]),

      salary: getFirstText([
        "[data-test='detailSalary']",
        "[data-test='salary-estimate']"
      ]),

      employmentType: "",
      datePosted: "",
      url: getCanonicalUrl()
    };
  }

  function extractZipRecruiterJob() {
    return {
      title: getFirstText([
        "h1.job_title",
        "[data-testid='job-title']",
        "h1"
      ]),

      company: getFirstText([
        ".hiring_company_text",
        "[data-testid='company-name']",
        ".company_name"
      ]),

      description: getFirstText([
        ".job_description",
        "[data-testid='job-description']"
      ]),

      location: getFirstText([
        ".location",
        "[data-testid='job-location']"
      ]),

      salary: getFirstText([
        ".salary",
        "[data-testid='salary']"
      ]),

      employmentType: "",
      datePosted: "",
      url: getCanonicalUrl()
    };
  }

  // GENERIC FALLBACK

  function extractGenericJob() {
    const pageTitle =
      getMetaContent([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]'
      ]) ||
      document.title;

    return {
      title:
        getFirstText([
          "h1",
          "[class*='job-title']",
          "[class*='jobTitle']",
          "[data-testid*='job-title']",
          "[data-test*='job-title']"
        ]) ||
        cleanText(pageTitle),

      company:
        getFirstText([
          "[class*='company-name']",
          "[class*='companyName']",
          "[class*='employer-name']",
          "[class*='employerName']",
          "[data-testid*='company']",
          "[data-test*='company']"
        ]) ||
        getMetaContent([
          'meta[property="og:site_name"]',
          'meta[name="application-name"]'
        ]),

      description:
        getFirstText([
          "[class*='job-description']",
          "[class*='jobDescription']",
          "[id*='job-description']",
          "[id*='jobDescription']",
          "[data-testid*='description']",
          "main article",
          "article"
        ]) ||
        getMetaContent([
          'meta[name="description"]',
          'meta[property="og:description"]'
        ]),

      location: getFirstText([
        "[class*='job-location']",
        "[class*='jobLocation']",
        "[class*='location']",
        "[data-testid*='location']"
      ]),

      salary: getFirstText([
        "[class*='salary']",
        "[class*='compensation']",
        "[data-testid*='salary']"
      ]),

      employmentType: getFirstText([
        "[class*='employment-type']",
        "[class*='job-type']",
        "[class*='jobType']"
      ]),

      datePosted: getFirstText([
        "time[datetime]",
        "[class*='posted-date']",
        "[class*='date-posted']"
      ]),

      url: getCanonicalUrl()
    };
  }

  // MERGE EXTRACTION RESULTS

  function mergeJobData(primary, fallback) {
    return {
      title: primary?.title || fallback?.title || "",
      company: primary?.company || fallback?.company || "",
      description:
        primary?.description ||
        fallback?.description ||
        "",
      location:
        primary?.location ||
        fallback?.location ||
        "",
      salary:
        primary?.salary ||
        fallback?.salary ||
        "",
      employmentType:
        primary?.employmentType ||
        fallback?.employmentType ||
        "",
      datePosted:
        primary?.datePosted ||
        fallback?.datePosted ||
        "",
      url:
        primary?.url ||
        fallback?.url ||
        window.location.href
    };
  }

  function extractCurrentJob() {
    const hostname = window.location.hostname.toLowerCase();

    let websiteData = null;

    if (hostname.includes("linkedin.com")) {
      websiteData = extractLinkedInJob();
    } else if (hostname.includes("indeed.")) {
      websiteData = extractIndeedJob();
    } else if (hostname.includes("glassdoor.")) {
      websiteData = extractGlassdoorJob();
    } else if (hostname.includes("ziprecruiter.com")) {
      websiteData = extractZipRecruiterJob();
    }

    const jsonLdData = extractFromJsonLd();
    const genericData = extractGenericJob();

    // Prefer structured JSON-LD because it is usually the cleanest.
    // Then use website-specific selectors and finally generic selectors.
    const firstMerge = mergeJobData(jsonLdData, websiteData);
    const finalJob = mergeJobData(firstMerge, genericData);

    return {
      ...finalJob,
      title: cleanText(finalJob.title),
      company: cleanText(finalJob.company),
      description: cleanText(finalJob.description).slice(0, 5000),
      location: cleanText(finalJob.location),
      salary: cleanText(finalJob.salary),
      employmentType: cleanText(finalJob.employmentType),
      datePosted: cleanText(finalJob.datePosted),
      url: finalJob.url || window.location.href
    };
  }

  // MESSAGE LISTENER

  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message?.type !== "EXTRACT_CURRENT_JOB") {
        return;
      }

      try {
        const job = extractCurrentJob();

        sendResponse({
          success: true,
          job
        });
      } catch (error) {
        console.error("Job extraction failed:", error);

        sendResponse({
          success: false,
          error: error.message || "Could not extract job information."
        });
      }
    }
  );
})();
