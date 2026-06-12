import fs from "node:fs/promises";
import path from "node:path";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_FOLDER || "facetedframes";
const outputPath = process.env.OUTPUT_PATH || path.resolve("assets", "gallery-images.json");

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before running this script.",
  );
}

const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
const searchBaseUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;

async function fetchResourcesByQuery(query) {
  const imageUrls = [];
  let nextCursor = null;

  do {
    const url = new URL(searchBaseUrl);
    url.searchParams.set("expression", query);
    url.searchParams.set("max_results", "500");
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
        imageUrls.push(resource.secure_url);
      }
    }

    nextCursor = payload.next_cursor || null;
  } while (nextCursor);

  return imageUrls;
}

async function fetchAllResources() {
  const strategies = [
    `asset_folder:${folder}`,
    `folder:${folder}`,
    `tags:${folder}`,
    `public_id:${folder}/*`,
  ];

  for (const query of strategies) {
    const imageUrls = await fetchResourcesByQuery(query);
    if (imageUrls.length > 0) {
      console.log(`Matched ${imageUrls.length} assets using: ${query}`);
      return [...new Set(imageUrls)];
    }
  }

  return [];
}

const urls = await fetchAllResources();
await fs.writeFile(outputPath, `${JSON.stringify(urls, null, 2)}\n`, "utf8");
console.log(`Wrote ${urls.length} image URLs to ${outputPath}`);
