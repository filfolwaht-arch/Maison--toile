/* ==============================================================
   VELORA JEWELRY — STOREFRONT LOGIC (index.html)
   Vanilla JS, ES6. Depends on supabase.js being loaded first.
   ============================================================== */

const MOROCCAN_CITIES = [
  'الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'طنجة', 'أكادير', 'مكناس',
  'وجدة', 'القنيطرة', 'تطوان', 'آسفي', 'الجديدة', 'بني ملال', 'خريبكة',
  'سطات', 'العيون', 'الناظور', 'برشيد', 'خنيفرة', 'المحمدية'
];

const state = {
  categories: [],
  products: [],
  currentFilter: { categorySlug: null, search: '', sort: 'newest' },
  cart: JSON.parse(localStorage.getItem('velora_cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('velora_wishlist') || '[]'),
  settings: null
};

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
function formatPrice(value) {
  return `${Number(value).toFixed(2)} د.م.`;
}
function finalPrice(product) {
  const d = Number(product.discount || 0);
  return d > 0 ? +(product.price * (1 - d / 100)).toFixed(2) : +product.price;
}
function primaryImage(product) {
  if (!product.images || !product.images.length) return 'assets/images/placeholder.jpg';
  const sorted = [...product.images].sort((a, b) => (b.is_primary - a.is_primary) || (a.display_order - b.display_order));
  return sorted[0].image_url;
}
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
function saveCart() { localStorage.setItem('velora_cart', JSON.stringify(state.cart)); updateBadges(); }
function saveWishlist() { localStorage.setItem('velora_wishlist', JSON.stringify(state.wishlist)); updateBadges(); }
function updateBadges() {
  document.getElementById('cart-badge').textContent = state.cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('wishlist-badge').textContent = state.wishlist.length;
}

/* ---------------------------------------------------------------
   LAZY IMAGE LOADING (IntersectionObserver)
--------------------------------------------------------------- */
const lazyObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.onload = () => img.classList.add('loaded');
      obs.unobserve(img);
    }
  });
}, { rootMargin: '100px' });

function lazyImg(src, alt, extraClass = '') {
  return `<img data-src="${src}" alt="${alt}" class="lazy ${extraClass}" loading="lazy" onerror="this.src='assets/images/placeholder.jpg'">`;
}
function observeLazyImages(container) {
  container.querySelectorAll('img.lazy').forEach(img => lazyObserver.observe(img));
}

/* ---------------------------------------------------------------
   RENDER: CATEGORIES
--------------------------------------------------------------- */
function renderCategories() {
  const grid = document.getElementById('categories-grid');
  const filterSelect = document.getElementById('category-filter');
  if (!state.categories.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-gem"></i>لا توجد فئات حالياً</div>`;
    return;
  }
  grid.innerHTML = state.categories.map(cat => `
    <a href="#shop" class="cat-card" data-cat="${cat.slug}">
      ${lazyImg(cat.image_url || 'assets/images/placeholder.jpg', cat.name)}
      <span>${cat.name}</span>
    </a>
  `).join('');
  observeLazyImages(grid);

  filterSelect.innerHTML = `<option value="">كل الفئات</option>` +
    state.categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
}

/* ---------------------------------------------------------------
   RENDER: PRODUCT CARD / GRID
--------------------------------------------------------------- */
function productCardHTML(p) {
  const inWishlist = state.wishlist.includes(p.id);
  const fPrice = finalPrice(p);
  return `
  <div class="product-card" data-id="${p.id}">
    <div class="product-thumb">
      ${p.discount > 0 ? `<span class="discount-tag">-${p.discount}%</span>` : ''}
      ${p.stock === 0 ? `<span class="stock-tag">نفدت الكمية</span>` : ''}
      <button class="wish-toggle ${inWishlist ? 'active' : ''}" data-action="wishlist" data-id="${p.id}">
        <i class="fa-${inWishlist ? 'solid' : 'regular'} fa-heart"></i>
      </button>
      ${lazyImg(primaryImage(p), p.title)}
    </div>
    <div class="product-info">
      <span class="product-cat">${p.category ? p.category.name : ''}</span>
      <h3 class="product-title">${p.title}</h3>
      <div class="product-price-row">
        <span class="price-now">${formatPrice(fPrice)}</span>
        ${p.discount > 0 ? `<span class="price-old">${formatPrice(p.price)}</span>` : ''}
      </div>
      <div class="product-actions">
        <button class="btn btn-outline" data-action="view" data-id="${p.id}">التفاصيل</button>
        <button class="btn btn-gold" data-action="add-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>أضف للسلة</button>
      </div>
    </div>
  </div>`;
}

function renderProductsGrid(products) {
  const grid = document.getElementById('products-grid');
  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i>لم يتم العثور على منتجات مطابقة</div>`;
    return;
  }
  grid.innerHTML = products.map(productCardHTML).join('');
  observeLazyImages(grid);
}

function renderFeatured(products) {
  const grid = document.getElementById('featured-grid');
  if (!products.length) { document.getElementById('featured-section').classList.add('hidden'); return; }
  grid.innerHTML = products.map(productCardHTML).join('');
  observeLazyImages(grid);
}

/* ---------------------------------------------------------------
   DATA LOADING
--------------------------------------------------------------- */
async function loadShop() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = Array.from({ length: 8 }).map(() => `<div class="product-card"><div class="product-thumb skeleton"></div><div class="product-info"><div class="skeleton" style="height:14px;width:60%;margin-bottom:8px;"></div><div class="skeleton" style="height:18px;width:80%;"></div></div></div>`).join('');
  try {
    const products = await ProductsAPI.listActive(state.currentFilter);
    state.products = products;
    renderProductsGrid(products);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>تعذر تحميل المنتجات</div>`;
  }
}

async function init() {
  try {
    const [categories, featured, settings] = await Promise.all([
      CategoriesAPI.listActive(),
      ProductsAPI.listFeatured(),
      SettingsAPI.get().catch(() => null)
    ]);
    state.categories = categories;
    state.settings = settings;
    renderCategories();
    renderFeatured(featured);
    if (settings && settings.whatsapp_number) {
      document.getElementById('whatsapp-float').href = `https://wa.me/${settings.whatsapp_number}`;
      document.getElementById('contact-whatsapp-btn').href = `https://wa.me/${settings.whatsapp_number}`;
    }
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل بيانات المتجر', 'error');
  }
  await loadShop();
  updateBadges();
  document.getElementById('page-loader').classList.add('hide');
}

/* ---------------------------------------------------------------
   PRODUCT MODAL
--------------------------------------------------------------- */
let modalQty = 1;
let modalProduct = null;

async function openProductModal(id) {
  try {
    modalProduct = await ProductsAPI.getById(id);
  } catch (err) {
    showToast('تعذر تحميل بيانات المنتج', 'error'); return;
  }
  modalQty = 1;
  const images = (modalProduct.images && modalProduct.images.length)
    ? [...modalProduct.images].sort((a, b) => (b.is_primary - a.is_primary) || (a.display_order - b.display_order))
    : [{ image_url: 'assets/images/placeholder.jpg' }];

  const fPrice = finalPrice(modalProduct);
  const modal = document.getElementById('product-modal');
  modal.querySelector('.pd-main-image img').src = images[0].image_url;
  modal.querySelector('.pd-thumbs').innerHTML = images.map((img, i) =>
    `<img src="${img.image_url}" class="${i === 0 ? 'active' : ''}" data-idx="${i}">`).join('');
  modal.querySelector('.product-cat').textContent = modalProduct.category ? modalProduct.category.name : '';
  modal.querySelector('h2').textContent = modalProduct.title;
  modal.querySelector('.price-now').textContent = formatPrice(fPrice);
  const oldPriceEl = modal.querySelector('.price-old');
  if (modalProduct.discount > 0) { oldPriceEl.textContent = formatPrice(modalProduct.price); oldPriceEl.classList.remove('hidden'); }
  else oldPriceEl.classList.add('hidden');
  modal.querySelector('.pd-desc').textContent = modalProduct.description || '';
  modal.querySelector('.qty-control span').textContent = modalQty;
  const addBtn = modal.querySelector('[data-action="modal-add-cart"]');
  addBtn.disabled = modalProduct.stock === 0;
  addBtn.textContent = modalProduct.stock === 0 ? 'نفدت الكمية' : 'أضف للسلة';
  const wishBtn = modal.querySelector('[data-action="modal-wishlist"]');
  wishBtn.classList.toggle('active', state.wishlist.includes(modalProduct.id));

  modal.classList.add('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
  document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
  document.getElementById('mobile-menu').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.querySelector('.pd-main-image')?.classList.remove('zoomed');
}

/* ---------------------------------------------------------------
   CART / WISHLIST ACTIONS
--------------------------------------------------------------- */
function toggleWishlist(id) {
  const idx = state.wishlist.indexOf(id);
  if (idx > -1) { state.wishlist.splice(idx, 1); showToast('تمت الإزالة من المفضلة'); }
  else { state.wishlist.push(id); showToast('تمت الإضافة إلى المفضلة'); }
  saveWishlist();
  document.querySelectorAll(`[data-action="wishlist"][data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', state.wishlist.includes(id));
    btn.querySelector('i').className = `fa-${state.wishlist.includes(id) ? 'solid' : 'regular'} fa-heart`;
  });
  if (modalProduct && modalProduct.id === id) {
    document.querySelector('[data-action="modal-wishlist"]').classList.toggle('active', state.wishlist.includes(id));
  }
  if (document.getElementById('wishlist-drawer').classList.contains('open')) renderWishlistDrawer();
}

function addToCart(product, qty = 1) {
  const existing = state.cart.find(i => i.id === product.id);
  const fPrice = finalPrice(product);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, product.stock || 999);
  } else {
    state.cart.push({ id: product.id, title: product.title, price: product.price, finalPrice: fPrice, image: primaryImage(product), qty, stock: product.stock });
  }
  saveCart();
  showToast('تمت الإضافة إلى السلة');
}

function renderCartDrawer() {
  const body = document.getElementById('cart-drawer-body');
  const footer = document.getElementById('cart-drawer-footer');
  if (!state.cart.length) {
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bag-shopping"></i>سلتك فارغة</div>`;
    footer.innerHTML = '';
    return;
  }
  body.innerHTML = state.cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image}" alt="${item.title}">
      <div class="cart-item-info">
        <h4>${item.title}</h4>
        <div class="price-now">${formatPrice(item.finalPrice)}</div>
        <div class="qty-control" style="margin-top:6px;">
          <button data-action="cart-dec" data-id="${item.id}">−</button>
          <span>${item.qty}</span>
          <button data-action="cart-inc" data-id="${item.id}">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-action="cart-remove" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
  const total = state.cart.reduce((s, i) => s + i.finalPrice * i.qty, 0);
  footer.innerHTML = `
    <div class="cart-total-row"><span>المجموع</span><strong>${formatPrice(total)}</strong></div>
    <button class="btn btn-gold btn-block" id="go-checkout">إتمام الطلب</button>
  `;
}

function renderWishlistDrawer() {
  const body = document.getElementById('wishlist-drawer-body');
  const items = state.products.filter(p => state.wishlist.includes(p.id));
  const missingIds = state.wishlist.filter(id => !state.products.find(p => p.id === id));
  if (!state.wishlist.length) {
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-heart"></i>قائمة المفضلة فارغة</div>`;
    return;
  }
  body.innerHTML = items.map(p => `
    <div class="cart-item" data-id="${p.id}">
      <img src="${primaryImage(p)}" alt="${p.title}">
      <div class="cart-item-info">
        <h4>${p.title}</h4>
        <div class="price-now">${formatPrice(finalPrice(p))}</div>
      </div>
      <button class="cart-item-remove" data-action="wishlist" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('') + (missingIds.length ? `<p style="color:var(--gray-dim);font-size:0.8rem;">بعض المنتجات لم تعد متوفرة</p>` : '');
}

/* ---------------------------------------------------------------
   CHECKOUT
--------------------------------------------------------------- */
function openCheckout() {
  if (!state.cart.length) { showToast('سلتك فارغة', 'error'); return; }
  const summary = document.getElementById('checkout-summary');
  const total = state.cart.reduce((s, i) => s + i.finalPrice * i.qty, 0);
  summary.innerHTML = state.cart.map(i => `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.85rem;">
      <span>${i.title} × ${i.qty}</span><span>${formatPrice(i.finalPrice * i.qty)}</span>
    </div>`).join('') + `<div class="cart-total-row" style="margin-top:10px;"><span>المجموع</span><strong>${formatPrice(total)}</strong></div>`;
  closeAllModals();
  document.getElementById('checkout-modal').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري الإرسال...';
  try {
    const total = state.cart.reduce((s, i) => s + i.finalPrice * i.qty, 0);
    const order = await OrdersAPI.create({
      customer: {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        city: form.city.value,
        address: form.address.value.trim(),
        notes: form.notes.value.trim()
      },
      items: state.cart,
      subtotal: total,
      total
    });
    closeAllModals();
    document.getElementById('order-success-number').textContent = order.order_number;
    document.getElementById('order-success-modal').classList.add('show');
    document.getElementById('overlay').classList.add('show');
    state.cart = [];
    saveCart();
    form.reset();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء إرسال الطلب، حاول مجدداً', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'تأكيد الطلب (الدفع عند الاستلام)';
  }
}

/* ---------------------------------------------------------------
   TRACK ORDER
--------------------------------------------------------------- */
async function handleTrackOrder(e) {
  e.preventDefault();
  const input = document.getElementById('track-input');
  const resultBox = document.getElementById('track-result');
  const num = input.value.trim();
  if (!num) return;
  resultBox.innerHTML = `<div class="skeleton" style="height:100px;border-radius:4px;"></div>`;
  resultBox.classList.remove('hidden');
  try {
    const order = await OrdersAPI.track(num);
    if (!order) {
      resultBox.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open"></i>لم يتم العثور على طلب بهذا الرقم</div>`;
      return;
    }
    const statusLabels = { pending: 'قيد الانتظار', confirmed: 'مؤكد', shipping: 'قيد الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
    resultBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <strong style="color:var(--white);">${order.order_number}</strong>
        <span class="status-pill status-${order.status}">${statusLabels[order.status] || order.status}</span>
      </div>
      <p style="color:var(--gray-dim);font-size:0.85rem;margin-bottom:10px;">${order.customer_name} · ${order.customer_city}</p>
      ${(order.items || []).map(i => `<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;"><span>${i.product_title} × ${i.quantity}</span><span>${formatPrice(i.subtotal)}</span></div>`).join('')}
      <div class="cart-total-row" style="margin-top:12px;"><span>المجموع</span><strong>${formatPrice(order.total)}</strong></div>
    `;
  } catch (err) {
    console.error(err);
    resultBox.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>حدث خطأ أثناء البحث</div>`;
  }
}

/* ---------------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------------- */
function wireEvents() {
  // mobile menu
  document.getElementById('burger-btn').addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.add('open');
    document.getElementById('overlay').classList.add('show');
  });
  document.querySelector('.close-menu').addEventListener('click', closeAllModals);
  document.getElementById('overlay').addEventListener('click', closeAllModals);

  // drawers
  document.getElementById('open-cart').addEventListener('click', () => { renderCartDrawer(); document.getElementById('cart-drawer').classList.add('open'); document.getElementById('overlay').classList.add('show'); });
  document.getElementById('open-wishlist').addEventListener('click', () => { renderWishlistDrawer(); document.getElementById('wishlist-drawer').classList.add('open'); document.getElementById('overlay').classList.add('show'); });
  document.querySelectorAll('.drawer .modal-close, .drawer-header .modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));

  // modal closes
  document.querySelectorAll('.modal-overlay .modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));

  // toolbar
  document.getElementById('search-input').addEventListener('input', debounce(e => {
    state.currentFilter.search = e.target.value.trim();
    loadShop();
  }, 400));
  document.getElementById('category-filter').addEventListener('change', e => {
    state.currentFilter.categorySlug = e.target.value || null;
    loadShop();
  });
  document.getElementById('sort-select').addEventListener('change', e => {
    state.currentFilter.sort = e.target.value;
    loadShop();
  });

  // category card -> jump to shop filtered
  document.getElementById('categories-grid').addEventListener('click', e => {
    const card = e.target.closest('.cat-card');
    if (!card) return;
    e.preventDefault();
    const slug = card.dataset.cat;
    state.currentFilter.categorySlug = slug;
    document.getElementById('category-filter').value = slug;
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    loadShop();
  });

  // delegated clicks: product cards (grid + featured)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'view') openProductModal(id);
    if (action === 'wishlist') toggleWishlist(id);
    if (action === 'add-cart') {
      const product = state.products.find(p => p.id === id) || (modalProduct && modalProduct.id === id ? modalProduct : null);
      if (product) addToCart(product, 1);
    }
    if (action === 'modal-add-cart') addToCart(modalProduct, modalQty);
    if (action === 'modal-wishlist') toggleWishlist(modalProduct.id);
    if (action === 'cart-remove') { state.cart = state.cart.filter(i => i.id !== id); saveCart(); renderCartDrawer(); }
    if (action === 'cart-inc') { const it = state.cart.find(i => i.id === id); if (it) it.qty = Math.min(it.qty + 1, it.stock || 999); saveCart(); renderCartDrawer(); }
    if (action === 'cart-dec') { const it = state.cart.find(i => i.id === id); if (it) { it.qty--; if (it.qty <= 0) state.cart = state.cart.filter(i => i.id !== id); } saveCart(); renderCartDrawer(); }
  });

  // qty control inside product modal
  document.querySelector('.qty-control [data-qty="dec"]').addEventListener('click', () => {
    if (modalQty > 1) modalQty--;
    document.querySelector('#product-modal .qty-control span').textContent = modalQty;
  });
  document.querySelector('.qty-control [data-qty="inc"]').addEventListener('click', () => {
    if (modalProduct && modalQty < (modalProduct.stock || 99)) modalQty++;
    document.querySelector('#product-modal .qty-control span').textContent = modalQty;
  });

  // gallery thumbs + zoom
  document.getElementById('product-modal').addEventListener('click', e => {
    const thumb = e.target.closest('.pd-thumbs img');
    if (thumb) {
      document.querySelectorAll('.pd-thumbs img').forEach(i => i.classList.remove('active'));
      thumb.classList.add('active');
      document.querySelector('.pd-main-image img').src = thumb.src;
    }
    const mainImg = e.target.closest('.pd-main-image');
    if (mainImg) mainImg.classList.toggle('zoomed');
  });

  // checkout flow (go-checkout button is rendered dynamically inside the drawer, so use delegation)
  document.getElementById('cart-drawer').addEventListener('click', e => { if (e.target.closest('#go-checkout')) openCheckout(); });
  document.getElementById('checkout-form').addEventListener('submit', submitOrder);
  document.getElementById('track-form').addEventListener('submit', handleTrackOrder);

  // close success modal
  document.querySelectorAll('[data-action="close-success"]').forEach(b => b.addEventListener('click', closeAllModals));
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function populateCities() {
  const select = document.getElementById('city-select');
  select.innerHTML = `<option value="">اختر المدينة</option>` + MOROCCAN_CITIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  populateCities();
  wireEvents();
  init();
});
