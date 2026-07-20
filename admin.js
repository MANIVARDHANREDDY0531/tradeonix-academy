const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const productForm = document.querySelector("[data-product-form]");
const productList = document.querySelector("[data-product-list]");
const orderList = document.querySelector("[data-order-list]");
const toast = document.querySelector("[data-toast]");
const photoUpload = document.querySelector("[data-photo-upload]");
const uploadPreview = document.querySelector("[data-upload-preview]");

let products = [];
let orders = [];
const liveConfig = window.VASTRAVATHI_LIVE_CONFIG || {};
const supabaseEnabled = Boolean(liveConfig.supabaseUrl && liveConfig.supabaseAnonKey);
const cloudinaryEnabled = Boolean(liveConfig.cloudinaryCloudName && liveConfig.cloudinaryUploadPreset);
const productsTable = liveConfig.productsTable || "products";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("active");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("active"), 1800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (response.status === 401) {
    window.location.href = "/admin-login.html";
    throw new Error("Admin login required");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return response.json();
}

async function supabaseRequest(path, options = {}) {
  const baseUrl = String(liveConfig.supabaseUrl || "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: liveConfig.supabaseAnonKey,
      Authorization: `Bearer ${liveConfig.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Live request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

function productId() {
  return `saree_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadProducts() {
  if (!supabaseEnabled) return api("/api/products");
  const rows = await supabaseRequest(`${productsTable}?select=id,payload,updated_at&order=updated_at.desc`);
  return rows.map((row) => row.payload || row).filter((product) => product && product.id);
}

async function saveProduct(data) {
  if (!supabaseEnabled) {
    const id = data.id;
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/products/${id}` : "/api/products";
    if (!id) delete data.id;
    return api(path, { method, body: JSON.stringify(data) });
  }

  const id = data.id || productId();
  data.id = id;
  return supabaseRequest(productsTable, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id, payload: data, updated_at: new Date().toISOString() })
  });
}

async function deleteProduct(id) {
  if (!supabaseEnabled) return api(`/api/products/${id}`, { method: "DELETE" });
  return supabaseRequest(`${productsTable}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function loadOrders() {
  if (supabaseEnabled) return [];
  return api("/api/orders");
}

async function uploadPhoto(file) {
  if (cloudinaryEnabled) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", liveConfig.cloudinaryUploadPreset);
    formData.append("folder", "vastravathi/products");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${liveConfig.cloudinaryCloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message || "Cloudinary upload failed");
    }

    const body = await response.json();
    return { url: body.secure_url };
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file
  });
  if (response.status === 401) {
    window.location.href = "/admin-login.html";
    throw new Error("Admin login required");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Photo upload failed");
  }
  return response.json();
}

function updateStats() {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || order.subtotal || 0), 0);
  document.querySelector("[data-product-total]").textContent = products.length;
  document.querySelector("[data-order-total]").textContent = orders.length;
  document.querySelector("[data-pending-total]").textContent = orders.filter((order) => order.status === "Pending").length;
  document.querySelector("[data-revenue-total]").textContent = rupees.format(revenue);
}

function renderProducts() {
  if (!products.length) {
    productList.innerHTML = '<p class="empty-state">No products yet.</p>';
    return;
  }

  productList.innerHTML = products.map((product) => `
    <article class="admin-item">
      <img src="${product.image}" alt="${product.name}" />
      <div>
        <h3>${product.name}</h3>
        <p>${product.category} · ${product.fabric} · ${product.color}</p>
        <span>${rupees.format(product.price)} · Stock ${product.stock ?? 0} · ${(product.images?.length || (product.image ? 1 : 0))} photo(s)</span>
      </div>
      <div class="admin-actions">
        <button type="button" data-edit-product="${product.id}">Edit</button>
        <button type="button" data-delete-product="${product.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderOrders() {
  if (!orders.length) {
    orderList.innerHTML = '<p class="empty-state">No orders yet. Place a test order from the website checkout.</p>';
    return;
  }

  orderList.innerHTML = orders.map((order) => {
    const customer = order.customer || {};
    return `
      <article class="admin-item">
        <img src="${order.items?.[0]?.image || "vastravathi-logo.svg"}" alt="" />
        <div>
          <h3>${order.id}</h3>
          <p>${customer.name || "Customer"} · ${customer.phone || "No phone"} · ${customer.city || "No city"} ${customer.pin || ""}</p>
          <span>${rupees.format(order.total || order.subtotal || 0)} · ${order.payment?.collector || "Shiprocket"} · ${order.payment?.status || "COD Pending"} · ${order.shipmentStatus || "Ready for Shiprocket"}</span>
        </div>
        <div class="admin-actions">
          <select class="status-select" data-status="${order.id}">
            ${["Pending", "Packed", "Shipped", "Delivered", "Cancelled"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <button type="button" data-sync-shiprocket="${order.id}">Shiprocket Sync</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderOrders() {
  if (!orders.length) {
    orderList.innerHTML = '<p class="empty-state">No orders yet. Place a test order from the website checkout.</p>';
    return;
  }

  orderList.innerHTML = orders.map((order) => {
    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const firstItem = items[0] || {};
    const paymentMode = order.payment?.mode === "prepaid" ? "Prepaid" : "COD";
    const address = [customer.address, customer.landmark, customer.city, customer.state, customer.pin]
      .filter(Boolean)
      .join(", ");

    return `
      <article class="admin-item order-item">
        <img src="${firstItem.image || "vastravathi-logo.svg"}" alt="" />
        <div class="order-copy">
          <div class="order-title-row">
            <h3>${order.id}</h3>
            <span class="payment-pill">${paymentMode}</span>
          </div>
          <p><strong>${customer.name || "Customer"}</strong> · ${customer.phone || "No phone"} · ${customer.email || "No email"}</p>
          <p>${address || "No address added"}</p>
          <p>${items.map((item) => `${item.name} x ${item.qty || 1}`).join(", ")}</p>
          <span>${rupees.format(order.total || order.subtotal || 0)} · ${order.payment?.collector || "Shiprocket"} · ${order.payment?.status || "COD Pending"} · ${order.shipmentStatus || "Ready for Shiprocket"}</span>
        </div>
        <div class="admin-actions">
          <select class="status-select" data-status="${order.id}">
            ${["Pending", "Packed", "Shipped", "Delivered", "Cancelled"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <button type="button" data-copy-order="${order.id}">Copy Details</button>
          <button type="button" data-sync-shiprocket="${order.id}">Shiprocket Sync</button>
          <button class="danger-action" type="button" data-delete-order="${order.id}">Delete Order</button>
        </div>
      </article>
    `;
  }).join("");
}

function orderDetailsText(order) {
  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  return [
    `Order ID: ${order.id}`,
    `Customer: ${customer.name || ""}`,
    `Phone: ${customer.phone || ""}`,
    `Email: ${customer.email || ""}`,
    `Address: ${[customer.address, customer.landmark, customer.city, customer.state, customer.pin].filter(Boolean).join(", ")}`,
    `Payment: ${order.payment?.mode || "cod"} - ${order.payment?.status || ""}`,
    `Total: ${rupees.format(order.total || order.subtotal || 0)}`,
    "Products:",
    ...items.map((item) => `- ${item.name} x ${item.qty || 1} - ${rupees.format(item.price || 0)}`)
  ].join("\n");
}

function fillProductForm(product) {
  Object.entries(product).forEach(([key, value]) => {
    const input = productForm.elements[key];
    if (input) input.value = Array.isArray(value) ? value.join("\n") : value ?? "";
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearProductForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  uploadPreview.innerHTML = "";
}

function renderUploadPreview(urls) {
  uploadPreview.innerHTML = urls.map((url) => `<img src="${url}" alt="Uploaded saree photo" />`).join("");
}

photoUpload.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []).slice(0, 8);
  if (!files.length) return;
  try {
    showToast(`Uploading ${files.length} photo(s)...`);
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadPhoto(file));
    }
    const urls = uploaded.map((item) => item.url);
    productForm.elements.image.value = urls[0];
    productForm.elements.images.value = urls.join("\n");
    renderUploadPreview(urls);
    showToast(`${urls.length} photo(s) uploaded`);
  } catch (error) {
    showToast(error.message);
  }
});

async function loadAll() {
  [products, orders] = await Promise.all([
    loadProducts(),
    loadOrders()
  ]);
  renderProducts();
  renderOrders();
  updateStats();
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(productForm).entries());
  delete data.photoUpload;
  data.images = String(data.images || "")
    .split("\n")
    .map((image) => image.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!data.image && data.images.length) data.image = data.images[0];
  data.price = Number(data.price);
  data.compare = Number(data.compare || 0);
  data.stock = Number(data.stock || 0);

  await saveProduct(data);
  clearProductForm();
  await loadAll();
  showToast("Product saved");
});

document.addEventListener("click", async (event) => {
  const editId = event.target.closest("[data-edit-product]")?.dataset.editProduct;
  const deleteId = event.target.closest("[data-delete-product]")?.dataset.deleteProduct;
  const syncId = event.target.closest("[data-sync-shiprocket]")?.dataset.syncShiprocket;
  const copyId = event.target.closest("[data-copy-order]")?.dataset.copyOrder;
  const deleteOrderId = event.target.closest("[data-delete-order]")?.dataset.deleteOrder;

  if (editId) {
    const product = products.find((item) => item.id === editId);
    if (product) fillProductForm(product);
  }

  if (deleteId) {
    await deleteProduct(deleteId);
    await loadAll();
    showToast("Product deleted");
  }

  if (syncId) {
    await api(`/api/shiprocket/sync/${syncId}`, { method: "POST", body: "{}" });
    await loadAll();
    showToast("Shiprocket placeholder updated");
  }

  if (copyId) {
    const order = orders.find((item) => item.id === copyId);
    if (order) {
      await navigator.clipboard.writeText(orderDetailsText(order));
      showToast("Order details copied");
    }
  }

  if (deleteOrderId) {
    const order = orders.find((item) => item.id === deleteOrderId);
    const label = order?.id || "this order";
    if (!window.confirm(`Delete ${label}? Product stock from this order will be restored.`)) return;
    await api(`/api/orders/${deleteOrderId}`, { method: "DELETE" });
    await loadAll();
    showToast("Order deleted");
  }

  if (event.target.closest("[data-reset-product]")) clearProductForm();
  if (event.target.closest("[data-logout]")) {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    window.location.href = "/admin-login.html";
  }
  if (event.target.closest("[data-refresh-orders]")) {
    await loadAll();
    showToast("Orders refreshed");
  }
});

document.addEventListener("change", async (event) => {
  const id = event.target.dataset.status;
  if (!id) return;
  await api(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: event.target.value })
  });
  await loadAll();
  showToast("Order updated");
});

if (supabaseEnabled) {
  loadAll().catch((error) => showToast(error.message));
} else {
  api("/api/admin/me")
    .then((session) => {
      if (!session.loggedIn) window.location.href = "/admin-login.html";
      return loadAll();
    })
    .catch((error) => showToast(error.message));
}
