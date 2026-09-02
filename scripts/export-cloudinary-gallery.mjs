import fs from "node:fs/promises";
import path from "node:path";
import { groupGalleryItems, normalizeAsset } from "../assets/gallery-data.js";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_FOLDER || "facetedframes";
const outputPath = process.env.OUTPUT_PATH || path.resolve("assets", "gallery-images.json");
const jsOutputPath = process.env.OUTPUT_JS_PATH || path.resolve("assets", "gallery-images.js");

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before running this script.",
  );
}

const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
const searchBaseUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

async function fetchResourcesByQuery(query) {
  const resources = [];
  let nextCursor = null;

  do {
    const url = new URL(searchBaseUrl);
    url.searchParams.set("expression", query);
    url.searchParams.set("max_results", "500");
    url.searchParams.set("with_field", "tags");
    url.searchParams.set("with_field", "context");
    if (nextCursor) {
      url.searchParams.set("next_cursor", nextCursor);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudinary search failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    for (const resource of payload.resources ?? []) {
      if (resource.secure_url) {
        resources.push({
          url: resource.secure_url,
          public_id: resource.public_id || "",
          asset_folder: resource.asset_folder || "",
          tags: normalizeTagList(resource.tags),
          section_keys: [],
        });
      }
    }

    nextCursor = payload.next_cursor || null;
  } while (nextCursor);

  return resources;
}

async function fetchAllResources() {
  const strategies = [
    `asset_folder:${folder}/*`,
    `asset_folder:"${folder}"`,
    `tags:${folder}`,
  ];

  for (const query of strategies) {
    console.log(`Searching Cloudinary with: ${query}`);
    const resources = await fetchResourcesByQuery(query);
    if (resources.length > 0) {
      console.log(`Matched ${resources.length} assets using: ${query}`);
      return resources;
    }
  }

  return [];
}

const resources = await fetchAllResources();
const normalizedResources = resources.map((resource, index) => normalizeAsset(resource, index)).filter((item) => item && item.url);
const sections = groupGalleryItems(normalizedResources);
const payload = `${JSON.stringify(sections, null, 2)}\n`;

await fs.writeFile(outputPath, payload, "utf8");
await fs.writeFile(
  jsOutputPath,
  `window.gallerySections = ${JSON.stringify(sections, null, 2)};\nwindow.galleryImages = ${JSON.stringify(normalizedResources.map((resource) => resource.url), null, 2)};\n`,
  "utf8",
);
console.log(`Wrote ${resources.length} image records to ${outputPath}`);
console.log(`Wrote gallery data to ${jsOutputPath}`);
