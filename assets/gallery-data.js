const DEFAULT_BASE_URL =
  typeof document !== "undefined" && document.baseURI ? document.baseURI : "https://example.com/";
const ROOT_FOLDER = "facetedframes";

export function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stripNumericPrefix(value) {
  return String(value || "")
    // Remove ordering prefixes such as "01_", "02 - ", or "3. ".
    .replace(/^\s*\d+\s*(?:[-_.:)]+\s*)?/, "")
    .trim();
}

export function humanize(value) {
  const compact = String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return "Gallery";
  }

  return compact.replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

export function parseLeadingNumber(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)/);

  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}

function splitPath(value) {
  return String(value || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeFolderParts(folder) {
  const parts = splitPath(folder);

  if (parts.length && toSlug(parts[0]) === toSlug(ROOT_FOLDER)) {
    return parts.slice(1);
  }

  return parts;
}

export function normalizeFolder(folder) {
  return normalizeFolderParts(folder).join("/");
}

export function folderLabelFromPath(folder) {
  const parts = normalizeFolderParts(folder);

  if (!parts.length) {
    return "Unsorted";
  }

  return parts.map((part) => humanize(stripNumericPrefix(part))).join(" / ");
}

export function sectionKeyFromFolder(folder) {
  const normalizedFolder = normalizeFolder(folder);
  return toSlug(normalizedFolder || "unsorted");
}

export function extractCloudinaryInfo(source) {
  try {
    const url = new URL(source, DEFAULT_BASE_URL);
    const uploadIndex = url.pathname.indexOf("/upload/");

    if (uploadIndex === -1) {
      return null;
    }

    const parts = url.pathname
      .slice(uploadIndex + "/upload/".length)
      .split("/")
      .filter(Boolean);

    if (!parts.length) {
      return null;
    }

    const versionIndex = parts[0] && /^v\d+$/.test(parts[0]) ? 1 : 0;
    const resolvedParts = parts.slice(versionIndex);

    if (!resolvedParts.length) {
      return null;
    }

    return {
      folder: resolvedParts.slice(0, -1).join("/"),
      fileName: resolvedParts[resolvedParts.length - 1],
      version: versionIndex === 1 ? Number(parts[0].slice(1)) : Number.POSITIVE_INFINITY,
    };
  } catch {
    return null;
  }
}

export function inferTagsFromName(fileName) {
  const lowerName = String(fileName || "").toLowerCase();
  const tags = [];

  if (lowerName.includes("featured")) {
    tags.push("featured");
  }

  if (lowerName.includes("pendant")) {
    tags.push("pendants");
  }

  if (lowerName.includes("photoroom")) {
    tags.push("studio");
  }

  return tags;
}

function normalizeItemName(source, fallbackName = "") {
  return stripNumericPrefix(
    String(source || fallbackName)
      .replace(/\.[^.]+$/, "")
      .trim(),
  );
}

export function normalizeAsset(source, index = 0) {
  if (typeof source === "string") {
    const resolvedUrl = new URL(source, DEFAULT_BASE_URL).href;
    const cloudinaryInfo = extractCloudinaryInfo(resolvedUrl);
    const fileName = cloudinaryInfo?.fileName || resolvedUrl.split("/").pop() || "";

    return {
      url: resolvedUrl,
      mediaType: /\.(mp4|webm|mov|m4v|ogg)(?:$|\?)/i.test(resolvedUrl) ? "video" : "image",
      folder: normalizeFolder(cloudinaryInfo?.folder || ""),
      tags: inferTagsFromName(fileName),
      label: normalizeItemName(fileName),
      public_id: "",
      version: cloudinaryInfo?.version ?? Number.POSITIVE_INFINITY,
      index,
    };
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  const resolvedUrl = source.secure_url || source.url || source.src || "";
  const safeUrl = resolvedUrl ? new URL(resolvedUrl, DEFAULT_BASE_URL).href : "";
  const cloudinaryInfo = extractCloudinaryInfo(safeUrl);
  const folder = normalizeFolder(source.asset_folder || source.folder || cloudinaryInfo?.folder || "");
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const fileName = source.public_id?.split("/").pop() || cloudinaryInfo?.fileName || safeUrl.split("/").pop() || "";
  const explicitLabel = source.title || source.label || source.name || "";

  return {
    url: safeUrl,
    mediaType: source.resource_type === "video" || /\.(mp4|webm|mov|m4v|ogg)(?:$|\?)/i.test(safeUrl) ? "video" : "image",
    folder,
    tags: tags.map(toSlug).filter(Boolean),
    label: normalizeItemName(explicitLabel, fileName),
    public_id: source.public_id || "",
    version: cloudinaryInfo?.version ?? Number.POSITIVE_INFINITY,
    index,
  };
}

function getSectionSortLabel(section) {
  const folder = normalizeFolder(section.folder || "");
  const parts = splitPath(folder);
  const firstPart = parts[0] || section.label || section.key || "";
  // Keep the prefix here so numbered Cloudinary folders control display order.
  return firstPart || "";
}

function compareItems(left, right) {
  const leftLabel = left.label || left.public_id || left.url;
  const rightLabel = right.label || right.public_id || right.url;

  const labelComparison = compareText(leftLabel, rightLabel);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  const leftVersion = Number.isFinite(left.version) ? left.version : Number.POSITIVE_INFINITY;
  const rightVersion = Number.isFinite(right.version) ? right.version : Number.POSITIVE_INFINITY;

  if (leftVersion !== rightVersion) {
    return rightVersion - leftVersion;
  }

  return left.index - right.index;
}

function compareSections(left, right) {
  const leftOrder = parseLeadingNumber(getSectionSortLabel(left));
  const rightOrder = parseLeadingNumber(getSectionSortLabel(right));

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const labelComparison = compareText(left.label || left.key, right.label || right.key);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return compareText(left.key, right.key);
}

export function normalizeGallerySections(rawSections) {
  return rawSections
    .map((section, index) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const folderSource = section.asset_folder || section.folder || section.key || section.label || section.title || "";
      const folder = normalizeFolder(folderSource);
      const key = toSlug(section.key || section.id || folder || section.label || section.title || `section-${index + 1}`);
      const label = stripNumericPrefix(section.label || section.title || folderLabelFromPath(folder) || key);
      const items = (section.items || section.images || section.assets || [])
        .map((item, itemIndex) => normalizeAsset(item, itemIndex))
        .filter((item) => item && item.url)
        .sort(compareItems);

      return {
        key,
        label,
        folder,
        items,
      };
    })
    .filter(Boolean);
}

export function groupGalleryItems(rawItems) {
  const sections = new Map();

  rawItems.forEach((source, index) => {
    const item = normalizeAsset(source, index);

    if (!item || !item.url) {
      return;
    }

    const folder = normalizeFolder(item.folder || "");
    const key = sectionKeyFromFolder(folder);

    if (!sections.has(key)) {
      sections.set(key, {
        key,
        label: folderLabelFromPath(folder),
        folder,
        items: [],
      });
    }

    sections.get(key).items.push(item);
  });

  return [...sections.values()]
    .sort(compareSections)
    .map((section) => ({
      key: section.key,
      label: section.label,
      items: section.items.sort(compareItems),
    }));
}

export function normalizeGalleryData(rawData) {
  if (!Array.isArray(rawData) || !rawData.length) {
    return [];
  }

  const firstItem = rawData[0];

  if (
    typeof firstItem === "object" &&
    !Array.isArray(firstItem) &&
    ("items" in firstItem || "images" in firstItem || "assets" in firstItem)
  ) {
    const sectionItems = rawData.flatMap((section) =>
      section && typeof section === "object"
        ? section.items || section.images || section.assets || []
        : [],
    );

    // Prefer each asset's Cloudinary folder over legacy hardcoded section names.
    if (sectionItems.some((item) => item && typeof item === "object" && (item.asset_folder || item.folder))) {
      return groupGalleryItems(sectionItems);
    }

    return normalizeGallerySections(rawData);
  }

  return groupGalleryItems(rawData);
}

