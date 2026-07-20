let products = [
  {
    "id": "saree_mrrvow43_wfhk39",
    "name": "Rani Pink & Mehendi Green Kanchi Pattu Saree",
    "category": "wedding",
    "occasion": "Wedding, Festive, Party, Traditional Ceremony",
    "price": 4500,
    "compare": 7699,
    "badge": "Bestseller",
    "image": "/uploads/saree_photo_mrrvk3ln_p89vr0.jpg",
    "images": [
      "/uploads/saree_photo_mrrvk3ln_p89vr0.jpg",
      "/uploads/saree_photo_mrrvk3m5_98s45d.jpg",
      "/uploads/saree_photo_mrrvk3mm_9w9m3u.jpg",
      "/uploads/saree_photo_mrrvk3n3_6pa4pw.jpg",
      "/uploads/saree_photo_mrrvk3nn_7unq8s.jpg",
      "/uploads/saree_photo_mrrvk3o7_h7t4o3.jpg",
      "/uploads/saree_photo_mrrvk3ov_weyviw.jpg",
      "/uploads/saree_photo_mrrvk3ph_pao2sc.jpg"
    ],
    "details": "Elegant mehendi-green and rani-pink silk-blend saree featuring intricate golden floral zari weaving and a richly designed pink border and pallu. An excellent choice for weddings, festivals, parties, and traditional celebrations.\n\nPackage includes: 1 saree with matching unstitched blouse piece.",
    "fabric": "Woven Silk Blend with Zari Work (kanchi pattu)",
    "color": "Mehendi Green and Rani Pink",
    "stock": 15
  },
  {
    "id": "saree_mrrw4815_hl917h",
    "name": "Golden Mustard & Rani Pink Kanchi Pattu Saree",
    "category": "wedding",
    "occasion": "Wedding, Festival, Party and Traditional Ceremony",
    "price": 4499,
    "compare": 7699,
    "badge": "Festive Special",
    "image": "/uploads/saree_photo_mrrvz7fq_9m05ew.jpg",
    "images": [
      "/uploads/saree_photo_mrrvz7fq_9m05ew.jpg",
      "/uploads/saree_photo_mrrvz7gl_wpprx4.jpg",
      "/uploads/saree_photo_mrrvz7ha_wrqcpa.jpg",
      "/uploads/saree_photo_mrrvz7i0_6x3wyt.jpg",
      "/uploads/saree_photo_mrrvz7ip_2z3q46.jpg",
      "/uploads/saree_photo_mrrvz7jj_gfvk0x.jpg",
      "/uploads/saree_photo_mrrvz7kf_xg3i67.jpg",
      "/uploads/saree_photo_mrrvz7ld_9yjmo5.jpg"
    ],
    "details": "Add a vibrant traditional touch to your wardrobe with this golden mustard-yellow and rani-pink woven silk saree. It features intricate golden floral zari work, a contrasting pink border and an elaborately woven pink pallu. Ideal for weddings, festivals, parties and traditional celebrations.\n\nPackage includes: 1 saree with matching unstitched blouse piece.",
    "fabric": "Woven Silk Blend with Golden Zari Floral Work (kanchi pattu)",
    "color": "Golden Mustard Yellow and Rani Pink",
    "stock": 10
  },
  {
    "id": "saree_mrrwekqt_s0bi90",
    "name": "Rust Orange & Emerald Green Kanchi Pattu Saree",
    "category": "silk",
    "occasion": "Wedding, Festive, Party, Traditional Ceremony",
    "price": 4500,
    "compare": 7699,
    "badge": "Bestseller",
    "image": "/uploads/saree_photo_mrrwd7ao_owhbx5.jpg",
    "images": [
      "/uploads/saree_photo_mrrwd7ao_owhbx5.jpg",
      "/uploads/saree_photo_mrrwd7b1_s7csz7.jpg",
      "/uploads/saree_photo_mrrwd7bb_qxl587.jpg",
      "/uploads/saree_photo_mrrwd7bm_vzlb13.jpg",
      "/uploads/saree_photo_mrrwd7c3_k76nb7.jpg",
      "/uploads/saree_photo_mrrwd7ck_gvjw3c.jpg",
      "/uploads/saree_photo_mrrwd7d4_stj1mr.jpg",
      "/uploads/saree_photo_mrrwd7do_rw66ik.jpg"
    ],
    "details": "Make an elegant traditional statement with this rust-orange and emerald-green woven silk saree. The saree features elaborate golden zari motifs throughout the body, a contrasting green border and a richly woven pallu decorated with peacock and floral patterns. Perfect for weddings, festivals, parties and traditional celebrations.\n\nPackage includes: 1 saree with matching unstitched blouse piece.",
    "fabric": "Woven Silk Blend with Zari Work (kanchi pattu)",
    "color": "Rust Orange and Emerald Green",
    "stock": 10
  },
  {
    "id": "saree_mrrwls9a_y6ltvq",
    "name": "Turquoise Teal & Royal Purple Woven Kanchi Pattu Saree",
    "category": "wedding",
    "occasion": "Wedding, Festive, Party, Traditional Ceremony",
    "price": 4500,
    "compare": 7699,
    "badge": "Bestseller",
    "image": "/uploads/saree_photo_mrrwhnsk_5ihgtr.jpg",
    "images": [
      "/uploads/saree_photo_mrrwhnsk_5ihgtr.jpg",
      "/uploads/saree_photo_mrrwhnsy_773g1e.jpg",
      "/uploads/saree_photo_mrrwhntb_f38prs.jpg",
      "/uploads/saree_photo_mrrwhntz_vvl8lz.jpg",
      "/uploads/saree_photo_mrrwhnui_wiwe82.jpg",
      "/uploads/saree_photo_mrrwhnv2_a1om4v.jpg",
      "/uploads/saree_photo_mrrwhnvj_es30x3.jpg",
      "/uploads/saree_photo_mrrwhnvy_rf9vb8.jpg"
    ],
    "details": "Bring timeless elegance to special occasions with this turquoise-teal and royal-purple woven silk saree. It features intricate golden zari motifs across the body, a contrasting purple border and an ornate pallu decorated with traditional peacock and floral designs. Ideal for weddings, festivals, parties and cultural celebrations.\n\nPackage includes: 1 saree with matching unstitched blouse piece.",
    "fabric": "Woven Silk Blend with Zari Work (kanchi pattu)",
    "color": "Turquoise Teal and Royal Purple",
    "stock": 10
  }
]
;

const state = {
  filter: "all",
  sort: "featured",
  cart: [],
  wishlist: new Set()
};

const apiBase = window.location.protocol === "file:" ? "http://127.0.0.1:4180" : "";
const apiEnabled = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
const liveConfig = window.VASTRAVATHI_LIVE_CONFIG || {};
const supabaseEnabled = Boolean(liveConfig.supabaseUrl && liveConfig.supabaseAnonKey);
const productsTable = liveConfig.productsTable || "products";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const grid = document.querySelector("[data-product-grid]");
const cartDrawer = document.querySelector("[data-cart-drawer]");
const wishlistDrawer = document.querySelector("[data-wishlist-drawer]");
const overlay = document.querySelector("[data-overlay]");
const toast = document.querySelector("[data-toast]");
const quickView = document.querySelector("[data-quick-view]");
const quickContent = document.querySelector("[data-quick-content]");
const productDetail = document.querySelector("[data-product-detail]");
const detailContent = document.querySelector("[data-detail-content]");
const checkoutModal = document.querySelector("[data-checkout-modal]");
const orderSuccess = document.querySelector("[data-order-success]");
const searchModal = document.querySelector("[data-search-modal]");
const searchInput = document.querySelector("[data-search-input]");
const searchResults = document.querySelector("[data-search-results]");
const paymentNote = document.querySelector("[data-payment-note]");
const submitOrder = document.querySelector("[data-submit-order]");

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
    throw new Error(body || "Live products could not be loaded");
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loadLiveProducts() {
  const rows = await supabaseRequest(`${productsTable}?select=id,payload,updated_at&order=updated_at.desc`);
  return rows
    .map((row) => row.payload || row)
    .filter((product) => product && product.id && product.name);
}

function visibleProducts() {
  const filtered = state.filter === "all"
    ? [...products]
    : products.filter((product) => product.category === state.filter);

  if (state.sort === "low") {
    return filtered.sort((a, b) => a.price - b.price);
  }

  if (state.sort === "high") {
    return filtered.sort((a, b) => b.price - a.price);
  }

  return filtered;
}

function productImages(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  return (images.length ? images : [product.image]).filter(Boolean).slice(0, 8);
}

function mainImage(product) {
  return productImages(product)[0] || "vastravathi-logo.svg";
}

function isInStock(product) {
  return Number(product?.stock ?? 1) > 0;
}

function stockLabel(product) {
  if (!isInStock(product)) return "Sold Out";
  const stock = Number(product.stock ?? 0);
  return stock > 0 && stock <= 3 ? `Only ${stock} left` : "In Stock";
}

function renderProducts() {
  if (!visibleProducts().length) {
    grid.innerHTML = `
      <div class="product-empty-state">
        <p class="eyebrow">No products</p>
        <h3>No sarees added yet</h3>
        <p>Add products from the admin dashboard and refresh this page.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = visibleProducts().map((product) => {
    const available = isInStock(product);
    return `
    <article class="product-card reveal visible ${available ? "" : "sold-out"}" data-product-id="${product.id}">
      <div class="product-image">
        <span class="badge">${available ? product.badge : "Sold Out"}</span>
        <span class="stock-ribbon">${stockLabel(product)}</span>
        <button class="icon-btn wishlist-btn ${state.wishlist.has(product.id) ? "active" : ""}" type="button" data-wishlist="${product.id}" aria-label="Save ${product.name}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg>
        </button>
        <img src="${mainImage(product)}" alt="${product.name}" loading="lazy" />
        <button class="quick-btn" type="button" data-quick="${product.id}">Quick View</button>
      </div>
      <div class="product-info">
        <small>${product.occasion}</small>
        <h3>${product.name}</h3>
        <div class="price-row">
          <strong>${rupees.format(product.price)}</strong>
          <del>${rupees.format(product.compare)}</del>
        </div>
        <div class="product-actions">
          <button class="secondary-product-btn" type="button" data-detail="${product.id}">View Details</button>
          <button class="primary-btn add-btn" type="button" data-buy-now="${product.id}" ${available ? "" : "disabled"}>${available ? "Buy Now" : "Sold Out"}</button>
        </div>
      </div>
    </article>
  `;
  }).join("");
}

function renderCart() {
  const cartItems = document.querySelector("[data-cart-items]");
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemCount = state.cart.reduce((sum, item) => sum + item.qty, 0);

  document.querySelector("[data-cart-count]").textContent = itemCount;
  document.querySelector("[data-cart-title]").textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  document.querySelector("[data-subtotal]").textContent = rupees.format(subtotal);

  if (!state.cart.length) {
    cartItems.innerHTML = '<p class="empty-state">Your cart is waiting for a saree you love.</p>';
    return;
  }

  cartItems.innerHTML = state.cart.map((item) => `
    <div class="cart-line">
      <img src="${mainImage(item)}" alt="${item.name}" />
      <div>
        <h4>${item.name}</h4>
        <span>${rupees.format(item.price)} x ${item.qty}</span>
      </div>
      <button class="icon-btn" type="button" data-remove="${item.id}" aria-label="Remove ${item.name}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
      </button>
    </div>
  `).join("");
}

function renderWishlist() {
  const wishlistItems = document.querySelector("[data-wishlist-items]");
  const saved = products.filter((product) => state.wishlist.has(product.id));

  document.querySelector("[data-wishlist-count]").textContent = saved.length;
  document.querySelector("[data-wishlist-title]").textContent = `${saved.length} saved`;

  if (!saved.length) {
    wishlistItems.innerHTML = '<p class="empty-state">Tap the heart on a saree to save it here.</p>';
    return;
  }

  wishlistItems.innerHTML = saved.map((item) => `
    <div class="cart-line">
      <img src="${mainImage(item)}" alt="${item.name}" />
      <div>
        <h4>${item.name}</h4>
        <span>${rupees.format(item.price)} � ${stockLabel(item)}</span>
      </div>
      <button class="icon-btn" type="button" data-add="${item.id}" aria-label="Add ${item.name} to cart" ${isInStock(item) ? "" : "disabled"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"></path><path d="M6 6 5 3H2"></path></svg>
      </button>
    </div>
  `).join("");
}

function addToCart(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  if (!isInStock(product)) {
    showToast("This saree is sold out");
    return;
  }
  const existing = state.cart.find((item) => item.id === id);

  if (existing) {
    if (Number(product.stock ?? 999) <= existing.qty) {
      showToast("No more stock available");
      return;
    }
    existing.qty += 1;
  } else {
    state.cart.push({ ...product, image: mainImage(product), images: productImages(product), qty: 1 });
  }

  renderCart();
  showToast(`${product.name} added`);
}

function removeFromCart(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  renderCart();
}

function buyNow(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  if (!isInStock(product)) {
    showToast("This saree is sold out");
    return;
  }
  state.cart = [{ ...product, image: mainImage(product), images: productImages(product), qty: 1 }];
  renderCart();
  if (quickView.open) quickView.close();
  if (productDetail.open) productDetail.close();
  openCheckout();
}

function toggleWishlist(id) {
  if (state.wishlist.has(id)) {
    state.wishlist.delete(id);
  } else {
    state.wishlist.add(id);
  }
  renderProducts();
  renderWishlist();
}

function openPanel(panel) {
  closePanels();
  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
  overlay.classList.add("active");
}

function closePanels() {
  [cartDrawer, wishlistDrawer].forEach((panel) => {
    panel.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
  });
  overlay.classList.remove("active");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("active");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("active"), 1800);
}

function openQuickView(id) {
  const product = products.find((item) => item.id === id);
  const images = productImages(product);
  const available = isInStock(product);
  quickContent.innerHTML = `
    <div class="quick-layout">
      <img src="${images[0]}" alt="${product.name}" />
      <div class="quick-copy">
        <p class="eyebrow">${product.occasion} saree</p>
        <h3>${product.name}</h3>
        <div class="price-row">
          <strong>${rupees.format(product.price)}</strong>
          <del>${rupees.format(product.compare)}</del>
        </div>
        <p>${product.details}</p>
        <div class="detail-list">
          <span>Fabric: ${product.fabric}</span>
          <span>Color: ${product.color}</span>
          <span>Blouse piece included</span>
          <span>${available ? "Ships in 3-5 days" : "Sold out"}</span>
        </div>
        <div class="detail-actions">
          <button class="primary-btn" type="button" data-buy-now="${product.id}" ${available ? "" : "disabled"}>${available ? "Buy Now" : "Sold Out"}</button>
          <button class="secondary-detail-btn" type="button" data-add="${product.id}" ${available ? "" : "disabled"}>Add to Cart</button>
        </div>
      </div>
    </div>
  `;
  quickView.showModal();
}

function openProductDetail(id) {
  const product = products.find((item) => item.id === id);
  const images = productImages(product);
  const available = isInStock(product);

  detailContent.innerHTML = `
    <div class="detail-hero">
      <div class="detail-gallery">
        <img class="detail-main-image" src="${images[0]}" alt="${product.name}" />
        <div class="detail-thumbs">
          ${images.map((image) => `<img src="${image}" alt="${product.name}" />`).join("")}
        </div>
      </div>
      <div class="detail-copy">
        <p class="eyebrow">${product.occasion} saree</p>
        <h2>${product.name}</h2>
        <div class="price-row">
          <strong>${rupees.format(product.price)}</strong>
          <del>${rupees.format(product.compare)}</del>
        </div>
        <p>${product.details}</p>
        <div class="detail-list">
          <span>Fabric: ${product.fabric}</span>
          <span>Color: ${product.color}</span>
          <span>Blouse piece included</span>
          <span>${available ? "Ready to ship" : "Sold out"}</span>
          <span>Free shipping in India</span>
          <span>No returns on confirmed orders</span>
        </div>
        <div class="detail-actions">
          <button class="primary-btn" type="button" data-buy-now="${product.id}" ${available ? "" : "disabled"}>${available ? "Buy Now" : "Sold Out"}</button>
          <button class="secondary-detail-btn" type="button" data-add="${product.id}" ${available ? "" : "disabled"}>Add to Cart</button>
          <button class="secondary-detail-btn" type="button" data-wishlist="${product.id}">Save to Wishlist</button>
        </div>
      </div>
    </div>
  `;
  productDetail.showModal();
}

function renderCheckout() {
  const items = document.querySelector("[data-checkout-items]");
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  document.querySelector("[data-checkout-subtotal]").textContent = rupees.format(subtotal);
  document.querySelector("[data-checkout-total]").textContent = rupees.format(subtotal);

  if (!state.cart.length) {
    items.innerHTML = '<p class="empty-state">Your cart is empty. Add a saree before checkout.</p>';
    return;
  }

  items.innerHTML = state.cart.map((item) => `
    <div class="checkout-item">
      <img src="${mainImage(item)}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <span>${rupees.format(item.price)} x ${item.qty}</span>
      </div>
      <b>${rupees.format(item.price * item.qty)}</b>
    </div>
  `).join("");
}

function syncPaymentUi() {
  const paymentMode = document.querySelector("[data-checkout-form] input[name='payment']:checked")?.value || "cod";
  const isCod = paymentMode === "cod";
  paymentNote.textContent = isCod
    ? "COD selected: your order will be saved for Shiprocket delivery and payment collection."
    : "Prepaid selected: your order will be saved for Razorpay payment, then prepared for Shiprocket delivery.";
  submitOrder.textContent = isCod ? "Place COD Order" : "Continue to Razorpay";
}

function openCheckout() {
  if (!state.cart.length) {
    showToast("Add a saree before checkout");
    return;
  }
  closePanels();
  renderCheckout();
  syncPaymentUi();
  checkoutModal.showModal();
}

function createOrder(order) {
  // COD route: Shiprocket collects payment. Prepaid route: Razorpay payment first, then Shiprocket shipment.
  if (!apiEnabled) {
    console.info("Order payload", order);
    showToast(order.payment.mode === "cod" ? "Shiprocket COD order ready" : "Razorpay payment order ready");
    return Promise.resolve({ localOnly: true });
  }

  return fetch(`${apiBase}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Could not create order");
    }
    return response.json();
  });
}

function showOrderSuccess(order) {
  const isCod = order.payment?.mode === "cod";
  document.querySelector("[data-success-title]").textContent = isCod ? "COD order placed" : "Prepaid order created";
  document.querySelector("[data-success-message]").textContent = isCod
    ? "We saved the order for Shiprocket. Payment will be collected during delivery."
    : "We saved the order for Razorpay payment. After payment, it can be dispatched with Shiprocket.";
  document.querySelector("[data-success-id]").textContent = `Order ID: ${order.id || "Saved"}`;
  orderSuccess.showModal();
}

function renderSearch(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = products.filter((product) => {
    return [product.name, product.category, product.occasion, product.fabric, product.color]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });

  if (!normalized) {
    searchResults.innerHTML = '<p class="empty-state">Popular searches: silk, wedding, kanchi pattu, festive.</p>';
    return;
  }

  if (!matches.length) {
    searchResults.innerHTML = '<p class="empty-state">No sarees found. Try another fabric or occasion.</p>';
    return;
  }

  searchResults.innerHTML = matches.map((product) => `
    <div class="search-result">
      <img src="${mainImage(product)}" alt="${product.name}" />
      <div>
        <strong>${product.name}</strong>
        <div>${rupees.format(product.price)} � ${stockLabel(product)}</div>
      </div>
      <button class="primary-btn" type="button" data-add="${product.id}" ${isInStock(product) ? "" : "disabled"}>${isInStock(product) ? "Add" : "Sold Out"}</button>
    </div>
  `).join("");
}

document.addEventListener("click", (event) => {
  const addId = event.target.closest("[data-add]")?.dataset.add;
  const buyNowId = event.target.closest("[data-buy-now]")?.dataset.buyNow;
  const removeId = event.target.closest("[data-remove]")?.dataset.remove;
  const wishlistId = event.target.closest("[data-wishlist]")?.dataset.wishlist;
  const quickId = event.target.closest("[data-quick]")?.dataset.quick;
  const detailId = event.target.closest("[data-detail]")?.dataset.detail;
  const filter = event.target.closest("[data-filter]")?.dataset.filter;
  const shortcut = event.target.closest("[data-filter-shortcut]")?.dataset.filterShortcut;

  if (addId) addToCart(addId);
  if (buyNowId) buyNow(buyNowId);
  if (removeId) removeFromCart(removeId);
  if (wishlistId) toggleWishlist(wishlistId);
  if (quickId) openQuickView(quickId);
  if (detailId) openProductDetail(detailId);

  if (filter || shortcut) {
    state.filter = filter || shortcut;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
    renderProducts();
  }

  if (event.target.closest("[data-open-cart]")) openPanel(cartDrawer);
  if (event.target.closest("[data-open-wishlist]")) openPanel(wishlistDrawer);
  if (event.target.closest("[data-close-panels]") || event.target === overlay) closePanels();
  if (event.target.closest("[data-close-modal]")) quickView.close();
  if (event.target.closest("[data-close-detail]")) productDetail.close();
  if (event.target.closest("[data-open-checkout]")) openCheckout();
  if (event.target.closest("[data-close-checkout]")) checkoutModal.close();
  if (event.target.closest("[data-close-success]")) orderSuccess.close();
  if (event.target.closest("[data-open-search]")) {
    renderSearch();
    searchModal.showModal();
    setTimeout(() => searchInput.focus(), 80);
  }
  if (event.target.closest("[data-close-search]")) searchModal.close();
  if (event.target.closest(".menu-toggle")) document.querySelector(".nav-links").classList.toggle("open");
});

document.querySelector("[data-sort]").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderProducts();
});

searchInput.addEventListener("input", (event) => renderSearch(event.target.value));

document.querySelector("[data-checkout-form]").addEventListener("change", (event) => {
  if (event.target.name === "payment") syncPaymentUi();
});

document.querySelector(".newsletter form").addEventListener("submit", (event) => {
  event.preventDefault();
  event.currentTarget.reset();
  showToast("You are on the Vastravathi list");
});

document.querySelector("[data-checkout-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const checkoutForm = event.currentTarget;
  const formData = new FormData(checkoutForm);
  const customer = Object.fromEntries(formData.entries());
  const paymentMode = customer.payment || "cod";
  delete customer.payment;
  const order = {
    customer,
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      image: mainImage(item),
      sku: item.id,
      fabric: item.fabric,
      color: item.color
    })),
    subtotal: state.cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    payment: {
      mode: paymentMode,
      collector: paymentMode === "cod" ? "Shiprocket" : "Razorpay",
      status: paymentMode === "cod" ? "COD Pending" : "Razorpay Pending"
    },
    shipment: {
      provider: "Shiprocket",
      packageWeightKg: 0.5,
      pickupType: "Store pickup",
      cod: paymentMode === "cod"
    }
  };
  try {
    const savedOrder = await createOrder(order);
    state.cart = [];
    renderCart();
    renderCheckout();
    checkoutModal.close();
    checkoutForm.reset();
    syncPaymentUi();
    showOrderSuccess(savedOrder);
    showToast(paymentMode === "cod" ? "COD order saved for Shiprocket" : "Prepaid order saved for Razorpay");
  } catch (error) {
    showToast(error.message || "Order could not be saved");
  }
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));

async function initStorefront() {
  try {
    if (supabaseEnabled) {
      const liveProducts = await loadLiveProducts();
      if (liveProducts.length) {
        products = liveProducts;
      }
    } else {
      const productUrl = apiEnabled ? `${apiBase}/api/products?ts=${Date.now()}` : `data/products.json?ts=${Date.now()}`;
      const response = await fetch(productUrl, { cache: "no-store" });
      if (response.ok) {
        products = await response.json();
      }
    }
  } catch {
    showToast("Using saved products");
  }

  renderProducts();
  renderCart();
  renderWishlist();
}

initStorefront();

