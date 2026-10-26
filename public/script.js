const state = { items: [], rentals: [], selectedItem: null };

const $ = selector => document.querySelector(selector);
const itemGrid = $("#item-grid");
const searchInput = $("#search-input");
const filterSelect = $("#filter-select");
const typeSelect = $("#type-select");
const modal = $("#rental-modal");
const rentalForm = $("#rental-form");
const startInput = $("#start-date");
const endInput = $("#end-date");
const toast = $("#toast");

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function money(value) {
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR"
  });
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function isAvailableToday(itemId) {
  const today = localDateString();
  return !state.rentals.some(r => Number(r.item_id) === Number(itemId) && r.start_date <= today && r.end_date >= today);
}
function renderItems() {
  const search = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;
  const type = typeSelect.value;
  const filtered = state.items.filter(item => {
    const available = isAvailableToday(item.id);
    const matchesSearch = `${item.name} ${item.description}`.toLowerCase().includes(search);
    const matchesAvailability = filter === "all" || (filter === "available" ? available : !available);
    const matchesType = type === "all" || item.type === type;
    return matchesSearch && matchesAvailability && matchesType;
  });

  $("#item-count").textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;
  $("#empty-state").hidden = filtered.length !== 0;
  itemGrid.innerHTML = filtered.map(item => {
    const available = isAvailableToday(item.id);
    return `<article class="card">
      <div class="card-image-wrap">
        <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy"
          onerror="this.onerror=null;this.src='https://placehold.co/900x600/e9eee7/26352b?text=Rental+Item'">
        <span class="category-pill">${escapeHTML(item.type)}</span>
      </div>
      <div class="card-content">
        <span class="status ${available ? "available" : "rented"}">${available ? "Available today" : "Booked today"}</span>
        <h3 class="card-title">${escapeHTML(item.name)}</h3>
        <p class="card-desc">${escapeHTML(item.description)}</p>
        <div class="card-bottom">
          <div class="card-price"><strong>${money(item.price_per_day)}</strong><span> / day</span></div>
          <button class="btn btn-primary" type="button" data-rent-id="${item.id}">Check dates ↗</button>
        </div>
      </div>
    </article>`;
  }).join("");
}
function renderRentals() {
  const body = $("#rentals-table tbody");
  if (!state.rentals.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">No rentals found yet. Confirm a rental to see it here.</td></tr>';
  } else {
    body.innerHTML = state.rentals.map(r => `<tr>
      <td><strong>${escapeHTML(r.customer_name)}</strong></td>
      <td>${escapeHTML(r.email)}<br><span class="muted">${escapeHTML(r.phone)}</span></td>
      <td>${escapeHTML(r.item_name)}</td>
      <td>${escapeHTML(r.start_date)}</td>
      <td>${escapeHTML(r.end_date)}</td>
      <td>${Number(r.total_days)}</td>
      <td><strong>${money(r.total_cost)}</strong></td>
    </tr>`).join("");
  }
  $("#stat-bookings").textContent = state.rentals.length;
  $("#stat-items").textContent = state.items.length;
  const revenue = state.rentals.reduce((sum, rental) => sum + Number(rental.total_cost || 0), 0);
  $("#stat-revenue").textContent = money(revenue);
}
async function refreshData() {
  const [items, rentals] = await Promise.all([api("/api/items"), api("/api/rentals")]);
  state.items = items;
  state.rentals = rentals;
  renderItems();
  renderRentals();
}
function openRentalModal(itemId) {
  const item = state.items.find(candidate => Number(candidate.id) === Number(itemId));
  if (!item) return;
  state.selectedItem = item;
  rentalForm.reset();
  $("#item-id").value = item.id;
  $("#item-price").value = item.price_per_day;
  $("#modal-title").textContent = `Rent ${item.name}`;
  $("#modal-description").textContent = item.description;
  $("#display-price").textContent = Number(item.price_per_day).toFixed(2);
  $("#display-days").textContent = "0";
  $("#display-total").textContent = "0.00";
  $("#form-message").textContent = "";
  $("#form-message").className = "form-message";
  startInput.min = localDateString();
  endInput.min = localDateString();
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("#customer-name").focus();
}
function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function calculatePrice() {
  const start = startInput.value;
  const end = endInput.value;
  const price = Number($("#item-price").value || 0);
  if (!start || !end || end < start) {
    $("#display-days").textContent = "0";
    $("#display-total").textContent = "0.00";
    return;
  }
  const days = Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  $("#display-days").textContent = days;
  $("#display-total").textContent = (days * price).toFixed(2);
}
function setPage(page) {
  const home = page === "home";
  $("#home-page").classList.toggle("active", home);
  $("#admin-page").classList.toggle("active", !home);
  $("#nav-home").classList.toggle("active", home);
  $("#nav-admin").classList.toggle("active", !home);
  if (!home) refreshData().catch(error => showToast(error.message));
}
itemGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-rent-id]");
  if (button) openRentalModal(button.dataset.rentId);
});
$("#nav-home").addEventListener("click", () => setPage("home"));
$("#brand-home").addEventListener("click", event => { event.preventDefault(); setPage("home"); });
$("#nav-admin").addEventListener("click", () => setPage("admin"));
$("#refresh-rentals").addEventListener("click", () => refreshData().then(() => showToast("Rental records refreshed.")).catch(error => showToast(error.message)));
searchInput.addEventListener("input", renderItems);
filterSelect.addEventListener("change", renderItems);
typeSelect.addEventListener("change", renderItems);
$(".close-btn").addEventListener("click", closeModal);
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && modal.classList.contains("active")) closeModal(); });
startInput.addEventListener("change", () => { endInput.min = startInput.value || localDateString(); calculatePrice(); });
endInput.addEventListener("change", calculatePrice);

rentalForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = $("#submit-rental");
  const message = $("#form-message");
  message.textContent = "";
  message.className = "form-message";
  if (endInput.value < startInput.value) {
    message.textContent = "The end date must be on or after the start date.";
    message.classList.add("error");
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = "Confirming…";
  try {
    const result = await api("/api/rentals", {
      method: "POST",
      body: JSON.stringify({
        itemId: Number($("#item-id").value),
        customerName: $("#customer-name").value,
        email: $("#customer-email").value,
        phone: $("#customer-phone").value,
        startDate: startInput.value,
        endDate: endInput.value
      })
    });
    closeModal();
    await refreshData();
    showToast(`${result.message} Total: ${money(result.rental.total_cost)}`);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirm rental";
  }
});

refreshData().catch(error => {
  itemGrid.innerHTML = `<p class="empty-state">Unable to load items: ${escapeHTML(error.message)}. Make sure the server is running.</p>`;
  $("#item-count").textContent = "Unavailable";
});