const RESTAURANT = {
  name: "Mai Wok",
  phoneDisplay: "+49 177 3943060",
  whatsapp: "491773943060",
  email: "maiwokzo@gmail.com",
  timezone: "Europe/Berlin"
};

const EMAIL_ENDPOINT = "";
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const MENU_PAGE_SIZE = 4;
const state = {
  cart: JSON.parse(sessionStorage.getItem("maiWokCart") || "[]"),
  filter: "alle",
  category: "Empfohlen",
  lunchCategory: "Beliebt",
  dinnerPage: 1,
  lunchPage: 1
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
let motionObserver;

document.addEventListener("DOMContentLoaded", () => {
  initPageIntro();
  initNavigation();
  initMenus();
  initCart();
  initForms();
  initGallery();
  initHeroTilt();
  setDefaultDates();
  initMotion();
  document.body.classList.add("page-ready");
});

function initPageIntro() {
  const curtain = $(".intro-curtain");
  const finish = () => document.body.classList.add("intro-complete");
  if (!curtain || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }
  const onIntroEnd = (event) => {
    if (event.animationName !== "intro-exit") return;
    curtain.removeEventListener("animationend", onIntroEnd);
    finish();
  };
  curtain.addEventListener("animationend", onIntroEnd);
  window.setTimeout(finish, 3200);
}

function initNavigation() {
  const toggle = $("[data-nav-toggle]");
  const nav = $("[data-nav]");
  const header = $(".site-header");
  if (header && "IntersectionObserver" in window) {
    const sentinel = document.createElement("span");
    sentinel.className = "scroll-sentinel";
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      header.classList.toggle("is-scrolled", !entry.isIntersecting);
    }, { rootMargin: "-12px 0px 0px 0px" }).observe(sentinel);
  }
  toggle?.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      nav?.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });
}

function initMenus() {
  buildLunchTabs();
  buildCategoryTabs();
  renderDinnerMenu();
  updateLunchMenu();
  setInterval(updateLunchMenu, 60_000);
  $$(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter;
      state.dinnerPage = 1;
      renderDinnerMenu();
    });
  });
}

function buildLunchTabs() {
  const tabs = $("#lunchCategoryTabs");
  if (!tabs) return;
  const categories = ["Beliebt", ...new Set(lunchMenu.map((item) => lunchCategoryFor(item)))];
  tabs.innerHTML = categories.map((category) => (
    `<button class="${category === state.lunchCategory ? "active" : ""}" type="button" data-lunch-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");
  $$("button", tabs).forEach((button) => {
    button.addEventListener("click", () => {
      $$("button", tabs).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.lunchCategory = button.dataset.lunchCategory;
      state.lunchPage = 1;
      updateLunchMenu();
    });
  });
}

function buildCategoryTabs() {
  const tabs = $("#categoryTabs");
  if (!tabs) return;
  const categories = ["Empfohlen", "Alle Kategorien", ...new Set(dinnerMenu.map((item) => item.category))];
  tabs.innerHTML = categories.map((category) => (
    `<button class="${category === state.category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");
  $$("button", tabs).forEach((button) => {
    button.addEventListener("click", () => {
      $$("button", tabs).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.category = button.dataset.category;
      state.dinnerPage = 1;
      renderDinnerMenu();
    });
  });
}

function renderDinnerMenu() {
  const grid = $("#dinnerGrid");
  if (!grid) return;
  const items = dinnerMenu.filter((item) => {
    const filterMatch = state.filter === "alle" || item.tags.includes(state.filter);
    const categoryMatch = state.category === "Empfohlen"
      ? item.tags.includes("beliebt")
      : state.category === "Alle Kategorien" || item.category === state.category;
    return filterMatch && categoryMatch;
  });
  const pageData = paginateItems(items, state.dinnerPage);
  state.dinnerPage = pageData.page;
  grid.innerHTML = pageData.items.length ? pageData.items.map((item) => menuCard(item)).join("") : emptyMenu("Keine Gerichte für diese Auswahl gefunden.");
  renderMenuPager("#dinnerPager", pageData, "dinner");
  bindAddButtons(grid);
  observeMotionElements(grid);
}

function updateLunchMenu() {
  const grid = $("#lunchGrid");
  if (!grid) return;
  const section = $("[data-lunch-section]");
  const now = getBerlinParts();
  const clock = $("[data-berlin-time]");
  const badge = $("[data-lunch-badge]");
  const message = $("[data-lunch-message]");
  const open = isLunchOpenParts(now);

  if (section) section.hidden = false;
  $$("[data-lunch-nav]").forEach((link) => { link.hidden = false; });
  if (clock) clock.textContent = `Berlin: ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")} Uhr`;
  if (badge) {
    badge.textContent = open ? "Mittag jetzt bestellbar" : "Bestellung ab 09:00 Uhr";
    badge.classList.toggle("closed", !open);
  }
  if (message) {
    message.textContent = open
      ? "Es ist gerade Mittagszeit in Deutschland. Das Mittagsmenü ist jetzt bestellbar."
      : "Das Mittagsmenü bleibt sichtbar. Kaufen können Sie diese Gerichte Montag bis Samstag von 09:00 bis 15:00 Uhr nach deutscher Zeit.";
  }
  renderLunchMenu(open);
  renderCart();
}

function renderLunchMenu(open = isLunchOpenNow()) {
  const grid = $("#lunchGrid");
  if (!grid) return;
  const items = lunchMenu.filter((item) => {
    const category = lunchCategoryFor(item);
    return state.lunchCategory === "Beliebt" ? item.tags.includes("beliebt") : category === state.lunchCategory;
  });
  const cardOptions = open ? {} : { disabled: true, buttonText: "Nur 09:00-15:00" };
  const pageData = paginateItems(items, state.lunchPage);
  state.lunchPage = pageData.page;
  grid.innerHTML = pageData.items.length ? pageData.items.map((item) => menuCard(item, cardOptions)).join("") : emptyMenu("Keine Mittagsgerichte für diese Auswahl gefunden.");
  renderMenuPager("#lunchPager", pageData, "lunch");
  bindAddButtons(grid);
  observeMotionElements(grid);
}

function paginateItems(items, requestedPage) {
  const totalPages = Math.max(1, Math.ceil(items.length / MENU_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * MENU_PAGE_SIZE;
  return {
    items: items.slice(start, start + MENU_PAGE_SIZE),
    totalItems: items.length,
    totalPages,
    page,
    start: items.length ? start + 1 : 0,
    end: Math.min(start + MENU_PAGE_SIZE, items.length)
  };
}

function renderMenuPager(selector, pageData, target) {
  const pager = $(selector);
  if (!pager) return;
  if (pageData.totalItems <= MENU_PAGE_SIZE) {
    pager.innerHTML = pageData.totalItems
      ? `<span>${pageData.totalItems} Gerichte</span>`
      : "";
    return;
  }
  pager.innerHTML = `
    <button type="button" data-page-target="${target}" data-page-action="prev" ${pageData.page === 1 ? "disabled" : ""}>Zurück</button>
    <span>${pageData.start}-${pageData.end} von ${pageData.totalItems} Gerichten | Seite ${pageData.page}/${pageData.totalPages}</span>
    <button type="button" data-page-target="${target}" data-page-action="next" ${pageData.page === pageData.totalPages ? "disabled" : ""}>Weiter</button>
  `;
  $$("button", pager).forEach((button) => {
    button.addEventListener("click", () => {
      changeMenuPage(button.dataset.pageTarget, button.dataset.pageAction);
    });
  });
}

function changeMenuPage(target, action) {
  const delta = action === "next" ? 1 : -1;
  if (target === "lunch") {
    state.lunchPage += delta;
    renderLunchMenu();
  } else {
    state.dinnerPage += delta;
    renderDinnerMenu();
  }
  $(".menu-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function lunchCategoryFor(item) {
  if (item.id.startsWith("LD")) return "Getränke";
  if (item.id.startsWith("B")) return "Klassiker";
  const code = Number.parseInt(item.code, 10);
  if (Number.isNaN(code)) return "Weitere";
  if (code <= 19) return "Suppen & Snacks";
  if (code < 30) return "Chop Suey";
  if (code < 40) return "Süß-Sauer";
  if (code < 50) return "Erdnuss";
  if (code < 60) return "Red Curry";
  if (code < 70) return "Mango";
  if (code < 80) return "Spezial";
  if (code < 100) return "Vegetarisch";
  return "Weitere";
}

function menuCard(item, options = {}) {
  const tags = item.tags.map((tag) => `<span class="tag">${tagLabel(tag)}</span>`).join("");
  const disabled = options.disabled ? "disabled" : "";
  const buttonText = options.buttonText || "In den Warenkorb";
  return `
    <article class="menu-card">
      <div class="menu-card-body">
        <div class="menu-card-top">
          <span class="code">${escapeHtml(item.code || item.id)}</span>
          <span class="price">${euro.format(item.price)}</span>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <div class="tag-row">${tags}</div>
        <span class="allergens">Zusatzstoffe/Allergene: ${escapeHtml(item.allergens || "Bitte im Restaurant erfragen")}</span>
        <button class="btn btn-gold" type="button" data-add="${escapeHtml(item.id)}" ${disabled}>${escapeHtml(buttonText)}</button>
      </div>
    </article>
  `;
}

function emptyMenu(message) {
  return `<div class="cart-empty">${escapeHtml(message)}</div>`;
}

function tagLabel(tag) {
  return { vegetarisch: "Vegetarisch", vegan: "Vegan", scharf: "Scharf", beliebt: "Beliebt" }[tag] || tag;
}

function bindAddButtons(scope = document) {
  $$("[data-add]", scope).forEach((button) => {
    if (!button.disabled) button.onclick = () => addToCart(button.dataset.add, button);
  });
}

function findItem(id) {
  return [...lunchMenu, ...dinnerMenu].find((item) => item.id === id);
}

function addToCart(id, trigger) {
  const item = findItem(id);
  if (!item) return;
  if (lunchMenu.some((lunchItem) => lunchItem.id === id) && !isLunchOpenNow()) {
    showNotice($("#orderNotice"), "Das Mittagsmenü ist aktuell nicht bestellbar.", true);
    return;
  }
  const existing = state.cart.find((cartItem) => cartItem.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1, note: "" });
  persistCart();
  renderCart();
  animateAddButton(trigger);
  bumpCartCount();
}

function initCart() {
  renderCart();
  $$("[data-open-cart]").forEach((button) => button.addEventListener("click", openCart));
  $$("[data-close-cart], [data-close-cart-link]").forEach((button) => button.addEventListener("click", closeCart));
  $("[data-cart-backdrop]")?.addEventListener("click", closeCart);
  $("[data-clear-cart]")?.addEventListener("click", () => {
    state.cart = [];
    persistCart();
    renderCart();
  });
}

function openCart() {
  $("[data-cart-panel]")?.classList.add("open");
  $("[data-cart-backdrop]")?.classList.add("open");
}

function closeCart() {
  $("[data-cart-panel]")?.classList.remove("open");
  $("[data-cart-backdrop]")?.classList.remove("open");
}

function renderCart() {
  const wrap = $("#cartItems");
  if (!wrap) return;
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  $$("[data-cart-count]").forEach((node) => { node.textContent = String(count); });
  if (!state.cart.length) {
    wrap.innerHTML = `<div class="cart-empty">Ihr Warenkorb ist leer.</div>`;
    $("#cartTotal").textContent = euro.format(0);
    return;
  }
  wrap.innerHTML = state.cart.map((cartItem) => {
    const item = findItem(cartItem.id);
    if (!item) return "";
    return `
      <div class="cart-item" data-cart-id="${escapeHtml(cartItem.id)}">
        <div class="cart-item-main">
          <strong>${escapeHtml(item.code || item.id)} ${escapeHtml(item.name)}</strong>
          <strong>${euro.format(item.price * cartItem.qty)}</strong>
        </div>
        <div class="cart-controls">
          <button type="button" data-cart-action="minus">-</button>
          <span>${cartItem.qty}</span>
          <button type="button" data-cart-action="plus">+</button>
          <button type="button" data-cart-action="remove">Löschen</button>
        </div>
        <textarea placeholder="Notiz zu diesem Gericht" data-note>${escapeHtml(cartItem.note || "")}</textarea>
      </div>
    `;
  }).join("");
  $$(".cart-item", wrap).forEach((row) => {
    const id = row.dataset.cartId;
    row.querySelector('[data-cart-action="minus"]').addEventListener("click", () => changeQty(id, -1));
    row.querySelector('[data-cart-action="plus"]').addEventListener("click", () => changeQty(id, 1));
    row.querySelector('[data-cart-action="remove"]').addEventListener("click", () => removeCartItem(id));
    row.querySelector("[data-note]").addEventListener("input", (event) => {
      const item = state.cart.find((cartItem) => cartItem.id === id);
      if (item) item.note = event.target.value;
      persistCart();
    });
  });
  $("#cartTotal").textContent = euro.format(cartTotal());
}

function changeQty(id, delta) {
  const item = state.cart.find((cartItem) => cartItem.id === id);
  if (!item) return;
  if (delta > 0 && isLunchItem(id) && !isLunchOpenNow()) {
    showNotice($("#orderNotice"), "Mittagsgerichte können nur Montag bis Samstag von 09:00 bis 15:00 Uhr bestellt werden.", true);
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) removeCartItem(id);
  persistCart();
  renderCart();
}

function removeCartItem(id) {
  state.cart = state.cart.filter((cartItem) => cartItem.id !== id);
  persistCart();
  renderCart();
}

function cartTotal() {
  return state.cart.reduce((sum, cartItem) => {
    const item = findItem(cartItem.id);
    return sum + (item ? item.price * cartItem.qty : 0);
  }, 0);
}

function persistCart() {
  sessionStorage.setItem("maiWokCart", JSON.stringify(state.cart));
}

function initForms() {
  $("#orderForm")?.addEventListener("submit", handleOrder);
  $("#reservationForm")?.addEventListener("submit", handleReservation);
}

function handleOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!state.cart.length) return showNotice($("#orderNotice"), "Bitte legen Sie zuerst mindestens ein Gericht in den Warenkorb.", true);
  if (cartHasLunchItems() && !isLunchOpenNow()) {
    return showNotice($("#orderNotice"), "Mittagsgerichte können nur Montag bis Samstag von 09:00 bis 15:00 Uhr bestellt werden.", true);
  }
  if (!form.checkValidity()) return showNotice($("#orderNotice"), "Bitte füllen Sie alle Pflichtfelder korrekt aus.", true);
  const lines = state.cart.map((cartItem) => {
    const item = findItem(cartItem.id);
    return `${cartItem.qty}x ${item.code || item.id} ${item.name} - ${euro.format(item.price * cartItem.qty)}${cartItem.note ? ` | Hinweis: ${cartItem.note}` : ""}`;
  });
  const message = [
    "Bestellanfrage Mai Wok", "",
    `Name: ${data.name}`,
    `Telefon: ${data.phone}`,
    `E-Mail: ${data.email}`, "",
    "Gerichte:", ...lines, "",
    `Gesamt: ${euro.format(cartTotal())}`,
    `Abholung: ${data.pickupDate} um ${data.pickupTime} Uhr`,
    `Zahlungsmethode: ${data.payment || "Nicht angegeben"}`,
    `Hinweise: ${data.notes || "-"}`
  ].join("\n");
  const links = sendMessage("Bestellung Mai Wok", message);
  showActionNotice($("#orderNotice"), "WhatsApp wurde geöffnet. Falls Sie auch per E-Mail senden möchten:", links);
}

function handleReservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!form.checkValidity()) return showNotice($("#reservationNotice"), "Bitte füllen Sie alle Pflichtfelder korrekt aus.", true);
  const message = [
    "Reservierungsanfrage Mai Wok", "",
    `Name: ${data.name}`,
    `Telefon: ${data.phone}`,
    `E-Mail: ${data.email}`,
    `Datum: ${data.date}`,
    `Uhrzeit: ${data.time}`,
    `Personen: ${data.people}`,
    `Besondere Wünsche: ${data.requests || "-"}`
  ].join("\n");
  const links = sendMessage("Reservierung Mai Wok", message);
  showActionNotice($("#reservationNotice"), "WhatsApp wurde geöffnet. Falls Sie auch per E-Mail senden möchten:", links);
}

function sendMessage(subject, message) {
  const links = {
    whatsapp: `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(message)}`,
    email: `mailto:${RESTAURANT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  };
  if (EMAIL_ENDPOINT) {
    fetch(EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message, to: RESTAURANT.email })
    }).catch(() => {});
  }
  window.open(links.whatsapp, "_blank", "noopener");
  return links;
}

function initGallery() {
  const gallery = $("#galleryGrid");
  if (!gallery) return;
  gallery.innerHTML = imagePool.slice(0, 16).map((src, index) => `
    <button class="gallery-item" type="button" data-gallery="${src}">
      <img src="${src}" alt="Mai Wok Gericht ${index + 1}" loading="lazy">
    </button>
  `).join("");
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightbox img");
  $$("[data-gallery]").forEach((button) => {
    button.addEventListener("click", () => {
      lightboxImg.src = button.dataset.gallery;
      lightbox.classList.add("open");
    });
  });
  $("[data-lightbox-close]")?.addEventListener("click", () => lightbox.classList.remove("open"));
  observeMotionElements(gallery);
}

function initMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motionObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        motionObserver.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" })
    : null;
  document.body.classList.add("motion-ready");
  observeMotionElements(document);
}

function initHeroTilt() {
  const visual = $(".hero-visual");
  if (!visual || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let frame = 0;
  visual.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      const rect = visual.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -7;
      visual.style.setProperty("--tilt-x", `${x.toFixed(2)}deg`);
      visual.style.setProperty("--tilt-y", `${y.toFixed(2)}deg`);
    });
  });
  visual.addEventListener("pointerleave", () => {
    visual.style.removeProperty("--tilt-x");
    visual.style.removeProperty("--tilt-y");
  });
}

function observeMotionElements(scope = document) {
  if (!motionObserver) return;
  const selectors = [
    ".section-head",
    ".feature-grid article",
    ".menu-aside",
    ".panel-head",
    ".filters",
    ".category-tabs",
    ".menu-card",
    ".gallery-item",
    ".form-card",
    ".order-intro",
    ".order-steps span",
    ".pickup-note",
    ".map-wrap",
    ".contact-layout > div:first-child"
  ].join(",");
  $$(selectors, scope).forEach((element, index) => {
    if (element.dataset.revealReady) return;
    element.dataset.revealReady = "true";
    element.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 45}ms`);
    motionObserver.observe(element);
  });
}

function animateAddButton(button) {
  if (!button) return;
  const originalText = button.textContent;
  button.classList.remove("added");
  void button.offsetWidth;
  button.classList.add("added");
  button.textContent = "Hinzugef\u00fcgt";
  window.setTimeout(() => {
    button.classList.remove("added");
    button.textContent = originalText;
  }, 900);
}

function bumpCartCount() {
  $$("[data-cart-count]").forEach((node) => {
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  });
  const cart = $(".floating-cart");
  cart?.classList.add("attention");
  window.setTimeout(() => cart?.classList.remove("attention"), 520);
}

function getBerlinParts() {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: RESTAURANT.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const weekdayMap = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 7 };
  return { hour: Number(parts.hour), minute: Number(parts.minute), weekday: weekdayMap[String(parts.weekday).replace(".", "")] || 1 };
}

function isLunchOpenNow() {
  const now = getBerlinParts();
  return isLunchOpenParts(now);
}

function isLunchOpenParts(now) {
  const minutes = now.hour * 60 + now.minute;
  return now.weekday !== 7 && minutes >= 9 * 60 && minutes < 15 * 60;
}

function cartHasLunchItems() {
  return state.cart.some((cartItem) => isLunchItem(cartItem.id));
}

function isLunchItem(id) {
  return lunchMenu.some((lunchItem) => lunchItem.id === id);
}

function setDefaultDates() {
  const iso = getBerlinDateISO();
  $$('input[type="date"]').forEach((input) => {
    input.min = iso;
    if (!input.value) input.value = iso;
  });
}

function getBerlinDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function showNotice(node, text, isError = false) {
  if (!node) return;
  node.textContent = text;
  node.classList.toggle("error", isError);
  node.classList.add("show");
}

function showActionNotice(node, text, links) {
  if (!node) return;
  node.classList.remove("error");
  node.innerHTML = `
    <span>${escapeHtml(text)}</span>
    <span class="notice-actions">
      <a href="${escapeHtml(links.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp öffnen</a>
      <a href="${escapeHtml(links.email)}">E-Mail öffnen</a>
    </span>
  `;
  node.classList.add("show");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
