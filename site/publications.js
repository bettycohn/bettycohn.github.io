const publicationsList = document.getElementById("pubList");
const publicationsTags = document.getElementById("pubTags");
const publicationsSearchInput = document.getElementById("pubSearchInput");
const publicationsSearchButton = document.getElementById("pubSearchBtn");
const publicationsResetButton = document.getElementById("pubResetBtn");

const OPENALEX_WORKS_URL = "https://api.openalex.org/works";
const OPENALEX_DOI_BATCH_SIZE = 50;

const publicationsState = {
  items: [],
  tags: [],
  activeTag: "all",
  query: ""
};

const toPlainText = (value) => {
  if (!value) {
    return "";
  }

  const parser = document.createElement("div");
  parser.innerHTML = String(value);
  return parser.textContent ? parser.textContent.trim() : "";
};

const isUsableLink = (link) => {
  if (!link || typeof link !== "string") {
    return false;
  }

  const trimmed = link.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("mailto:");
};

const normalizeDoi = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const doi = trimmed
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim();

  return doi ? doi.toLowerCase() : "";
};

const getDoiFromLink = (link) => {
  if (!link || typeof link !== "string") {
    return "";
  }

  const trimmed = link.trim();
  if (/^https?:\/\/(dx\.)?doi\.org\//i.test(trimmed) || /^doi:/i.test(trimmed)) {
    return normalizeDoi(trimmed);
  }

  return "";
};

const getPublicationDoi = (publication) => {
  const primaryDoi = getDoiFromLink(publication.link);
  if (primaryDoi) {
    return primaryDoi;
  }

  if (!Array.isArray(publication.buttons)) {
    return "";
  }

  const doiButton = publication.buttons.find((button) => button && getDoiFromLink(button.link));
  return doiButton ? getDoiFromLink(doiButton.link) : "";
};

const getPublicationButtons = (publication) => {
  if (Array.isArray(publication.buttons) && publication.buttons.length > 0) {
    return publication.buttons.filter((button) => button && isUsableLink(button.link));
  }

  if (isUsableLink(publication.link)) {
    return [{ title: "Publisher Link", link: publication.link }];
  }

  return [];
};

const sortByCreatedAtDescending = (left, right) => {
  const leftDate = Number(left.created_at) || 0;
  const rightDate = Number(right.created_at) || 0;
  return rightDate - leftDate;
};

const getFilteredPublications = () => {
  const normalizedQuery = publicationsState.query.trim().toLowerCase();

  return publicationsState.items
    .filter((publication) => {
      if (publicationsState.activeTag === "all") {
        return true;
      }

      return Array.isArray(publication.tags) && publication.tags.includes(publicationsState.activeTag);
    })
    .filter((publication) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchableContent = [publication.title, toPlainText(publication.content), publication.publisher]
        .join(" ")
        .toLowerCase();

      return searchableContent.includes(normalizedQuery);
    })
    .sort(sortByCreatedAtDescending);
};

const renderNoResults = () => {
  if (!publicationsList) {
    return;
  }

  publicationsList.innerHTML = "";
  const empty = document.createElement("li");
  empty.className = "pub-empty";
  empty.textContent = "No publications found. Add items in content/publications.json.";
  publicationsList.appendChild(empty);
};

const createTitleNode = (publication) => {
  if (isUsableLink(publication.link)) {
    const title = document.createElement("a");
    title.className = "pub-item-title";
    title.href = publication.link;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = publication.title || "Untitled publication";
    return title;
  }

  const title = document.createElement("span");
  title.className = "pub-item-title";
  title.textContent = publication.title || "Untitled publication";
  return title;
};

const createCitationCountNode = (publication) => {
  if (!Number.isInteger(publication.citationCount) || publication.citationCount < 0) {
    return null;
  }

  const citation = document.createElement("span");
  citation.className = "pub-citation-count";
  citation.setAttribute("aria-label", `${publication.citationCount} citations`);

  const icon = document.createElement("i");
  icon.className = "fa-brands fa-google-scholar";
  icon.setAttribute("aria-hidden", "true");

  const count = document.createElement("span");
  count.textContent = String(publication.citationCount);

  citation.appendChild(icon);
  citation.appendChild(count);
  return citation;
};

const renderPublicationList = () => {
  if (!publicationsList) {
    return;
  }

  const publications = getFilteredPublications();
  publicationsList.innerHTML = "";

  if (publications.length === 0) {
    renderNoResults();
    return;
  }

  publications.forEach((publication) => {
    const item = document.createElement("li");
    item.className = "pub-item";

    const body = document.createElement("div");
    body.className = "pub-item-body";

    body.appendChild(createTitleNode(publication));

    const authors = document.createElement("p");
    authors.className = "pub-item-authors";
    authors.textContent = toPlainText(publication.content);
    body.appendChild(authors);

    const publisher = document.createElement("p");
    publisher.className = "pub-item-publisher";
    publisher.textContent = publication.publisher || "";
    body.appendChild(publisher);

    const citationCount = createCitationCountNode(publication);
    if (citationCount) {
      body.appendChild(citationCount);
    }

    const links = getPublicationButtons(publication);
    if (links.length > 0) {
      const buttons = document.createElement("div");
      buttons.className = "pub-item-links";

      links.forEach((button) => {
        const action = document.createElement("a");
        action.className = "pub-link-btn";
        action.href = button.link;
        action.target = "_blank";
        action.rel = "noopener noreferrer";
        action.textContent = button.title || "Link";
        buttons.appendChild(action);
      });

      body.appendChild(buttons);
    }

    item.appendChild(body);
    publicationsList.appendChild(item);
  });
};

const fetchOpenAlexCitationCounts = async () => {
  const dois = Array.from(
    new Set(publicationsState.items.map(getPublicationDoi).filter(Boolean))
  );

  if (dois.length === 0) {
    return;
  }

  const citationCountsByDoi = new Map();

  for (let index = 0; index < dois.length; index += OPENALEX_DOI_BATCH_SIZE) {
    const doiBatch = dois.slice(index, index + OPENALEX_DOI_BATCH_SIZE);
    const params = new URLSearchParams({
      filter: `doi:${doiBatch.join("|")}`,
      select: "doi,cited_by_count",
      per_page: String(doiBatch.length)
    });

    const response = await fetch(`${OPENALEX_WORKS_URL}?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch OpenAlex citation counts.");
    }

    const payload = await response.json();
    if (Array.isArray(payload.results)) {
      payload.results.forEach((work) => {
        const doi = normalizeDoi(work?.doi);
        const citationCount = Number(work?.cited_by_count);
        if (doi && Number.isInteger(citationCount) && citationCount >= 0) {
          citationCountsByDoi.set(doi, citationCount);
        }
      });
    }
  }

  publicationsState.items.forEach((publication) => {
    const doi = getPublicationDoi(publication);
    if (doi && citationCountsByDoi.has(doi)) {
      publication.citationCount = citationCountsByDoi.get(doi);
    }
  });
};

const renderTagFilters = () => {
  if (!publicationsTags) {
    return;
  }

  publicationsTags.innerHTML = "";
  const tags = [{ id: "all", title: "All" }, ...publicationsState.tags];

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.className = "pub-tag-btn";
    button.type = "button";
    button.dataset.tag = tag.id;
    button.textContent = tag.title;

    if (tag.id === publicationsState.activeTag) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      publicationsState.activeTag = tag.id;
      renderTagFilters();
      renderPublicationList();
    });

    publicationsTags.appendChild(button);
  });
};

const attachSearchHandlers = () => {
  if (!publicationsSearchInput || !publicationsSearchButton || !publicationsResetButton) {
    return;
  }

  const applySearch = () => {
    publicationsState.query = publicationsSearchInput.value || "";
    renderPublicationList();
  };

  publicationsSearchInput.addEventListener("input", applySearch);
  publicationsSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
    }
  });

  publicationsSearchButton.addEventListener("click", applySearch);

  publicationsResetButton.addEventListener("click", () => {
    publicationsState.query = "";
    publicationsState.activeTag = "all";
    publicationsSearchInput.value = "";
    renderTagFilters();
    renderPublicationList();
  });
};

const renderLoadingError = () => {
  if (!publicationsList) {
    return;
  }

  publicationsList.innerHTML = "";
  const error = document.createElement("li");
  error.className = "pub-empty";
  error.textContent = "Unable to load publications right now.";
  publicationsList.appendChild(error);
};

const initializePublicationsPage = async () => {
  if (!publicationsList) {
    return;
  }

  try {
    const [itemsResponse, tagsResponse] = await Promise.all([
      fetch(window.resolveSiteUrl("content/publications.json"), { cache: "no-store" }),
      fetch(window.resolveSiteUrl("content/publications_tags.json"), { cache: "no-store" })
    ]);

    if (!itemsResponse.ok || !tagsResponse.ok) {
      throw new Error("Failed to fetch publication data.");
    }

    const [items, tags] = await Promise.all([itemsResponse.json(), tagsResponse.json()]);
    publicationsState.items = Array.isArray(items) ? items : [];
    publicationsState.tags = Array.isArray(tags)
      ? tags.map((tag) => ({
          id: tag.name,
          title: tag.title || tag.name
        }))
      : [];

    renderTagFilters();
    renderPublicationList();
    attachSearchHandlers();

    fetchOpenAlexCitationCounts()
      .then(() => {
        renderPublicationList();
      })
      .catch(() => {
        // Citation counts are optional; keep the publication list visible if OpenAlex is unavailable.
      });
  } catch (error) {
    renderLoadingError();
  }
};

initializePublicationsPage();
