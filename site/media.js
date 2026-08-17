const fullMediaList = document.getElementById("mediaList");
const mediaCount = document.getElementById("mediaCount");

const MEDIA_DATA_PATH = "content/media.json";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_ICONS = {
  video: "fa-solid fa-video",
  article: "fa-solid fa-newspaper",
  podcast: "fa-solid fa-podcast",
};

const parseMediaDate = (dateValue) => {
  if (typeof dateValue !== "string" || !dateValue.trim()) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(`${dateValue}T00:00:00Z`);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const sortByLatestFirst = (left, right) => parseMediaDate(right.date) - parseMediaDate(left.date);

const formatMediaDate = (dateValue) => {
  const parsed = Date.parse(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    return dateValue;
  }

  const date = new Date(parsed);
  const month = MONTH_LABELS[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${month}'${year}`;
};

const createMediaItem = (item) => {
  const article = document.createElement("article");
  article.className = "news-item";

  const paragraph = document.createElement("p");

  const dateBadge = document.createElement("span");
  dateBadge.className = "news-date";
  dateBadge.textContent = formatMediaDate(item.date || "");

  const textContent = document.createElement("span");
  textContent.className = "news-text";

  const icon = TYPE_ICONS[item.type];
  if (icon) {
    const iconEl = document.createElement("i");
    iconEl.className = icon;
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.style.marginRight = "0.4em";
    textContent.appendChild(iconEl);
  }

  const titleText = document.createTextNode(item.title || "");
  textContent.appendChild(titleText);

  if (typeof item.outlet === "string" && item.outlet.trim()) {
    const outlet = document.createElement("span");
    outlet.textContent = ` \u2014 ${item.outlet}`;
    textContent.appendChild(outlet);
  }

  if (typeof item.url === "string" && item.url.trim()) {
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.url_label || "View";
    if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    textContent.appendChild(document.createTextNode(" "));
    textContent.appendChild(link);
  }

  paragraph.appendChild(dateBadge);
  paragraph.appendChild(textContent);
  article.appendChild(paragraph);

  return article;
};

const renderMediaItems = (target, items) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";
  items.forEach((item) => {
    target.appendChild(createMediaItem(item));
  });
};

const renderMessage = (target, message) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";
  const article = document.createElement("article");
  article.className = "news-item";

  const paragraph = document.createElement("p");
  paragraph.className = "news-empty";
  paragraph.textContent = message;

  article.appendChild(paragraph);
  target.appendChild(article);
};

const initializeMedia = async () => {
  if (!fullMediaList) {
    return;
  }

  try {
    const response = await fetch(window.resolveSiteUrl(MEDIA_DATA_PATH), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to fetch media data.");
    }

    const data = await response.json();
    const mediaItems = Array.isArray(data) ? data.slice().sort(sortByLatestFirst) : [];

    if (mediaCount) {
      mediaCount.textContent = `${mediaItems.length} item${mediaItems.length === 1 ? "" : "s"}`;
    }

    if (mediaItems.length === 0) {
      renderMessage(fullMediaList, "No media yet.");
      return;
    }

    renderMediaItems(fullMediaList, mediaItems);
  } catch {
    renderMessage(fullMediaList, "Unable to load media right now.");
    if (mediaCount) {
      mediaCount.textContent = "";
    }
  }
};

initializeMedia();
