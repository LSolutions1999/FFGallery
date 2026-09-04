import { normalizeGalleryData, stripNumericPrefix, toSlug } from "./gallery-data.js";

const gallerySectionsRoot = document.querySelector(".gallery-sections");
const heroToggle = document.querySelector(".hero-category-toggle");
const heroPanel = document.querySelector(".hero-category-panel");
const sectionMenus = Array.from(document.querySelectorAll(".section-menu-toggle"))
  .map((toggle) => {
    const menuRoot = toggle.closest(".desktop-section-menu, .mobile-section-menu");
    const panel = menuRoot ? menuRoot.querySelector(".section-menu-panel") : null;
    return menuRoot && panel ? { root: menuRoot, toggle, panel, closeTimer: null } : null;
  })
  .filter(Boolean);

function makeThumbnailSource(source) {
  if (typeof source !== "string" || !source.includes("res.cloudinary.com")) {
    return source;
  }

  return source.replace("/upload/", "/upload/f_auto,q_auto,w_500/");
}

function makeDisplaySource(source) {
  if (typeof source !== "string" || !source.includes("res.cloudinary.com")) {
    return source;
  }

  return source.replace("/upload/", "/upload/f_auto,q_auto/");
}

function renderSection(section, index) {
  const sectionId = `gallery-section-${toSlug(section.key) || index + 1}`;
  const previewCount = section.items.length;

  return `
    <section class="gallery-section-block" id="${sectionId}">
      <div class="gallery-section-header">
        <div class="gallery-section-header-copy">
          <h3>${section.label}</h3>
          <span class="gallery-section-count">${previewCount} image${previewCount === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div class="gallery-grid">
        ${section.items
          .map((item) => {
            const thumbnailSource = makeThumbnailSource(item.url);
            const displaySource = item.mediaType === "video" ? item.url : makeDisplaySource(item.url);
            const mediaMarkup = item.mediaType === "video"
              ? `<video class="gallery-card-media" src="${thumbnailSource}" muted loop playsinline preload="metadata" aria-hidden="true"></video>`
              : `<img class="gallery-card-media" src="${thumbnailSource}" alt="${item.label}" loading="lazy" decoding="async" fetchpriority="low" />`;
            return `
              <a class="gallery-card" href="${displaySource}" target="_blank" rel="noreferrer" aria-label="${item.label}">
                ${mediaMarkup}
              </a>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function scrollToSection(sectionId, behavior = "smooth") {
  const target = document.getElementById(sectionId);

  if (!target) {
    return;
  }

  const header = document.querySelector(".site-header");
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior,
  });
}

function closeSectionMenu() {
  if (heroToggle && heroPanel) {
    heroToggle.setAttribute("aria-expanded", "false");
    heroToggle.classList.remove("is-open");
    heroPanel.classList.remove("is-open");
    window.setTimeout(() => {
      if (heroToggle.getAttribute("aria-expanded") !== "true") {
        heroPanel.hidden = true;
      }
    }, 220);
  }

  for (const menu of sectionMenus) {
    if (menu.closeTimer) {
      window.clearTimeout(menu.closeTimer);
      menu.closeTimer = null;
    }

    menu.toggle.setAttribute("aria-expanded", "false");
    menu.toggle.classList.remove("is-open");
    menu.panel.classList.remove("is-open");
    menu.panel.setAttribute("aria-hidden", "true");
    menu.closeTimer = window.setTimeout(() => {
      menu.panel.hidden = true;
      menu.closeTimer = null;
    }, 220);
  }
}

function openSectionMenu(menu) {
  if (!menu) {
    return;
  }

  if (menu.closeTimer) {
    window.clearTimeout(menu.closeTimer);
    menu.closeTimer = null;
  }

  menu.panel.hidden = false;
  menu.panel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    menu.panel.classList.add("is-open");
    menu.toggle.classList.add("is-open");
    menu.toggle.setAttribute("aria-expanded", "true");
  });
}

async function loadGalleryData() {
  try {
    const response = await fetch("../assets/gallery-images.json", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        return data;
      }
    }
  } catch {
    // Fall back to the generated JS payload or local fallback list.
  }

  return Array.isArray(window.gallerySections)
    ? window.gallerySections
    : Array.isArray(window.galleryImages)
      ? window.galleryImages
      : [];
}

function wireSectionMenus(sections) {
  const sectionLinksMarkup = sections
    .map((section, index) => {
      const targetId = `gallery-section-${toSlug(section.key) || index + 1}`;
      const label = stripNumericPrefix(section.label);
      return `<a class="section-pill" href="#${targetId}" data-target="${targetId}">${label}</a>`;
    })
    .join("");

  for (const menu of sectionMenus) {
    menu.panel.innerHTML = sectionLinksMarkup;
  }

  document.querySelectorAll(".section-menu-panel .section-pill").forEach((pill) => {
    pill.addEventListener("click", (event) => {
      const targetId = pill.getAttribute("data-target");

      if (!targetId) {
        return;
      }

      event.preventDefault();
      history.replaceState(null, "", `#${targetId}`);
      closeSectionMenu();
      scrollToSection(targetId);
    });
  });
}

function wireMenuButtons() {
  for (const menu of sectionMenus) {
    menu.toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const expanded = menu.toggle.getAttribute("aria-expanded") === "true";

      if (expanded) {
        closeSectionMenu();
      } else {
        openSectionMenu(menu);
      }
    });

    menu.panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
}

function wireHeroCategoryMenu(sections) {
  if (!heroToggle || !heroPanel) {
    return;
  }

  heroPanel.innerHTML = sections
    .map((section, index) => {
      const targetId = `gallery-section-${toSlug(section.key) || index + 1}`;
      return `<a class="section-pill" href="#${targetId}" data-target="${targetId}">${stripNumericPrefix(section.label)}</a>`;
    })
    .join("");

  heroToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = heroToggle.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      closeSectionMenu();
      return;
    }

    heroPanel.hidden = false;
    heroToggle.setAttribute("aria-expanded", "true");
    heroToggle.classList.add("is-open");
    requestAnimationFrame(() => heroPanel.classList.add("is-open"));
  });

  heroPanel.addEventListener("click", (event) => {
    const pill = event.target.closest(".section-pill");
    if (!pill) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    const targetId = pill.getAttribute("data-target");
    if (targetId) {
      history.replaceState(null, "", `#${targetId}`);
      closeSectionMenu();
      scrollToSection(targetId);
    }
  });
  document.addEventListener("click", closeSectionMenu);
}

loadGalleryData().then((rawGalleryData) => {
  const sections = normalizeGalleryData(rawGalleryData);

  if (!sections.length) {
    for (const menu of sectionMenus) {
      menu.panel.innerHTML = "";
    }
    gallerySectionsRoot.innerHTML = '<p class="section-copy">No gallery images found yet.</p>';
    return;
  }

  wireSectionMenus(sections);
  wireHeroCategoryMenu(sections);
  gallerySectionsRoot.innerHTML = sections.map(renderSection).join("");

  gallerySectionsRoot.querySelectorAll("video.gallery-card-media").forEach((video) => {
    const card = video.closest(".gallery-card");
    card?.addEventListener("mouseenter", () => video.play().catch(() => {}));
    card?.addEventListener("mouseleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  });

  if (location.hash) {
    const targetId = location.hash.slice(1);
    requestAnimationFrame(() => scrollToSection(targetId, "auto"));
  }

  wireMenuButtons();
});

