const RESTAURANT = {
  name: "Mai Wok",
  phoneDisplay: "+49 177 3943060",
  whatsapp: "491773943060",
  email: "maiwokzo@gmail.com",
  timezone: "Europe/Berlin"
};

const EMAIL_ENDPOINT = "";
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const state = {
  cart: JSON.parse(sessionStorage.getItem("maiWokCart") || "[]"),
  filter: "alle",
  category: "Alle"
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initMenus();
  initCart();
  initForms();
  initGallery();
  setDefaultDates();
  document.body.classList.add("page-ready");
});

function initNavigation() {
  const toggle = $("[data-nav-toggle]");
  const nav = $("[data-nav]");
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
  buildCategoryTabs();
  renderDinnerMenu();
  updateLunchMenu();
  setInterval(updateLunchMenu, 60_000);
  $$(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter;
      renderDinnerMenu();
    });
  });
}

function buildCategoryTabs() {
  const tabs = $("#categoryTabs");
  if (!tabs) return;
  const categories = ["Alle", ...new Set(dinnerMenu.map((item) => item.category))];
  tabs.innerHTML = categories.map((category) => (
    `<button class="${category === "Alle" ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");
  $$("button", tabs).forEach((button) => {
    button.addEventListener("click", () => {
      $$("button", tabs).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.category = button.dataset.category;
      renderDinnerMenu();
    });
  });
}

function renderDinnerMenu() {
  const grid = $("#dinnerGrid");
  if (!grid) return;
  const items = dinnerMenu.filter((item) => {
    const filterMatch = state.filter === "alle" || item.tags.includes(state.filter);
    const categoryMatch = state.category === "Alle" || item.category === state.category;
    return filterMatch && categoryMatch;
  });
  grid.innerHTML = items.length ? items.map((item) => menuCard(item)).join("") : emptyMenu("Keine Gerichte für diese Auswahl gefunden.");
  bindAddButtons(grid);
}

function updateLunchMenu() {
  const grid = $("#lunchGrid");
  const section = $("[data-lunch-section]");
  if (!grid || !section) return;
  const now = getBerlinParts();
  const clock = $("[data-berlin-time]");
  const badge = $("[data-lunch-badge]");
  const message = $("[data-lunch-message]");
  const minutes = now.hour * 60 + now.minute;
  const isSunday = now.weekday === 7;
  const open = !isSunday && minutes >= 9 * 60 && minutes < 15 * 60;
  const visible = open;

  section.hidden = !visible;
  $$("[data-lunch-nav]").forEach((link) => { link.hidden = !visible; });
  if (clock) clock.textContent = `Berlin: ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")} Uhr`;
  if (!visible) {
    grid.innerHTML = "";
    renderCart();
    return;
  }
  badge.textContent = "Jetzt verfügbar";
  badge.classList.remove("closed");
  message.textContent = "Das Mittagsmenü ist aktuell verfügbar.";
  grid.innerHTML = lunchMenu.map((item) => menuCard(item)).join("");
  bindAddButtons(grid);
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
    if (!button.disabled) button.onclick = () => addToCart(button.dataset.add);
  });
}

function findItem(id) {
  return [...lunchMenu, ...dinnerMenu].find((item) => item.id === id);
}

function addToCart(id) {
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
  const iso = new Date().toISOString().slice(0, 10);
  $$('input[type="date"]').forEach((input) => {
    input.min = iso;
    if (!input.value) input.value = iso;
  });
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
