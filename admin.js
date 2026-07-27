/* ==============================================================
   VELORA JEWELRY — ADMIN PANEL LOGIC (admin.html)
   Vanilla JS, ES6. Depends on supabase.js being loaded first.
   ============================================================== */

const adminState = {
  categories: [],
  products: [],
  orders: [],
  editingProductId: null,
  pendingImages: [] // {file, preview} queued during product create, before product has an id
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}
function formatPrice(v) { return `${Number(v).toFixed(2)} د.م.`; }

/* ---------------------------------------------------------------
   AUTH / VIEW SWITCHING
--------------------------------------------------------------- */
async function checkSession() {
  const session = await AuthAPI.currentSession();
  if (session) {
    const { data: adminRow } = await supabaseClient.from('admins').select('*').eq('id', session.user.id).maybeSingle();
    if (adminRow) { showDashboard(adminRow); return; }
  }
  showLogin();
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
}

async function showDashboard(adminRow) {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.remove('hidden');
  document.getElementById('admin-name').textContent = adminRow.full_name || adminRow.email;
  await loadAllData();
  renderStats();
  renderProductsTable();
  renderCategoriesTable();
  renderOrdersTable();
  populateCategorySelects();
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true; btn.textContent = 'جاري الدخول...';
  try {
    const { admin } = await AuthAPI.signIn(e.target.email.value.trim(), e.target.password.value);
    showToast('تم تسجيل الدخول بنجاح');
    showDashboard(admin);
  } catch (err) {
    showToast(err.message || 'بيانات الدخول غير صحيحة', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'تسجيل الدخول';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await AuthAPI.signOut();
  showLogin();
});

/* ---------------------------------------------------------------
   SIDEBAR NAVIGATION
--------------------------------------------------------------- */
document.querySelectorAll('.admin-nav [data-panel]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(link.dataset.panel).classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('open');
  });
});
document.getElementById('admin-burger')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
});
document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
});

/* ---------------------------------------------------------------
   DATA LOADING
--------------------------------------------------------------- */
async function loadAllData() {
  const [categories, products, orders] = await Promise.all([
    CategoriesAPI.listAll(),
    ProductsAPI.listAllForAdmin(),
    OrdersAPI.listAllForAdmin()
  ]);
  adminState.categories = categories;
  adminState.products = products;
  adminState.orders = orders;
}

function renderStats() {
  const totalRevenue = adminState.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0);
  const pendingCount = adminState.orders.filter(o => o.status === 'pending').length;
  const lowStock = adminState.products.filter(p => p.stock <= 3 && p.is_active).length;

  document.getElementById('stat-products').textContent = adminState.products.length;
  document.getElementById('stat-orders').textContent = adminState.orders.length;
  document.getElementById('stat-pending').textContent = pendingCount;
  document.getElementById('stat-revenue').textContent = formatPrice(totalRevenue);
  document.getElementById('stat-lowstock').textContent = lowStock;
  document.getElementById('stat-categories').textContent = adminState.categories.length;
}

function populateCategorySelects() {
  const options = adminState.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('product-category-select').innerHTML = `<option value="">اختر الفئة</option>` + options;
  document.getElementById('product-filter-category').innerHTML = `<option value="">كل الفئات</option>` + options;
}

/* ---------------------------------------------------------------
   PRODUCTS TABLE
--------------------------------------------------------------- */
function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  const search = document.getElementById('product-search').value.trim().toLowerCase();
  const catFilter = document.getElementById('product-filter-category').value;
  let list = adminState.products;
  if (search) list = list.filter(p => p.title.toLowerCase().includes(search));
  if (catFilter) list = list.filter(p => p.category_id === catFilter);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">لا توجد منتجات</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const img = p.images && p.images.length ? p.images[0].image_url : 'assets/images/placeholder.jpg';
    return `
    <tr>
      <td><img src="${img}" class="table-thumb" alt=""></td>
      <td>${p.title}</td>
      <td>${p.category ? p.category.name : '—'}</td>
      <td>${formatPrice(p.price)} ${p.discount > 0 ? `<span class="tag-mini">-${p.discount}%</span>` : ''}</td>
      <td>${p.stock}</td>
      <td><span class="tag-mini ${p.is_active ? 'tag-green' : 'tag-gray'}">${p.is_active ? 'نشط' : 'موقوف'}</span> ${p.featured ? '<span class="tag-mini tag-gold">مميز</span>' : ''}</td>
      <td class="table-actions">
        <button data-action="edit-product" data-id="${p.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
        <button data-action="delete-product" data-id="${p.id}" title="حذف"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}
document.getElementById('product-search').addEventListener('input', renderProductsTable);
document.getElementById('product-filter-category').addEventListener('change', renderProductsTable);

/* ---------------------------------------------------------------
   PRODUCT FORM (create / edit)
--------------------------------------------------------------- */
const productModal = document.getElementById('product-form-modal');

function openProductForm(product = null) {
  adminState.editingProductId = product ? product.id : null;
  adminState.pendingImages = [];
  const form = document.getElementById('product-form');
  form.reset();
  document.getElementById('product-form-title').textContent = product ? 'تعديل المنتج' : 'إضافة منتج جديد';

  if (product) {
    form.title.value = product.title;
    form.slug.value = product.slug;
    form.description.value = product.description || '';
    form.price.value = product.price;
    form.discount.value = product.discount || 0;
    form.stock.value = product.stock;
    form.sku.value = product.sku || '';
    form.category_id.value = product.category_id || '';
    form.featured.checked = product.featured;
    form.is_active.checked = product.is_active;
    renderExistingImages(product.images || []);
  } else {
    form.is_active.checked = true;
    renderExistingImages([]);
  }
  renderPendingImages();
  productModal.classList.add('show');
}

function closeProductForm() { productModal.classList.remove('show'); }

function renderExistingImages(images) {
  const box = document.getElementById('existing-images');
  if (!images.length) { box.innerHTML = ''; return; }
  box.innerHTML = images.map(img => `
    <div class="img-chip" data-img-id="${img.id}">
      <img src="${img.image_url}">
      <button type="button" data-action="remove-existing-image" data-id="${img.id}" data-path="${img.image_path}">&times;</button>
      ${img.is_primary ? '<span class="primary-badge">رئيسية</span>' : `<button type="button" class="set-primary-btn" data-action="set-primary-image" data-id="${img.id}">تعيين كرئيسية</button>`}
    </div>
  `).join('');
}

function renderPendingImages() {
  const box = document.getElementById('pending-images');
  box.innerHTML = adminState.pendingImages.map((p, idx) => `
    <div class="img-chip"><img src="${p.preview}"><button type="button" data-action="remove-pending-image" data-idx="${idx}">&times;</button></div>
  `).join('');
}

document.getElementById('product-images-input').addEventListener('change', e => {
  Array.from(e.target.files).forEach(file => {
    adminState.pendingImages.push({ file, preview: URL.createObjectURL(file) });
  });
  renderPendingImages();
  e.target.value = '';
});

document.getElementById('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try {
    const payload = {
      title: form.title.value.trim(),
      slug: form.slug.value.trim() || slugify(form.title.value),
      description: form.description.value.trim(),
      price: parseFloat(form.price.value),
      discount: parseFloat(form.discount.value) || 0,
      stock: parseInt(form.stock.value, 10) || 0,
      sku: form.sku.value.trim() || null,
      category_id: form.category_id.value || null,
      featured: form.featured.checked,
      is_active: form.is_active.checked
    };

    let product;
    if (adminState.editingProductId) {
      product = await ProductsAPI.update(adminState.editingProductId, payload);
    } else {
      product = await ProductsAPI.create(payload);
    }

    // upload any newly queued images
    const hadNoImages = !(product.images && product.images.length);
    for (let i = 0; i < adminState.pendingImages.length; i++) {
      const isPrimary = hadNoImages && i === 0;
      await ProductImagesAPI.upload(product.id, adminState.pendingImages[i].file, { isPrimary, order: i });
    }

    showToast('تم حفظ المنتج بنجاح');
    closeProductForm();
    await loadAllData();
    renderProductsTable();
    renderStats();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'حدث خطأ أثناء حفظ المنتج', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'حفظ المنتج';
  }
});

function slugify(text) {
  return text.toString().trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    + '-' + Math.random().toString(36).substring(2, 6);
}

/* ---------------------------------------------------------------
   DELEGATED ADMIN ACTIONS
--------------------------------------------------------------- */
document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'add-product') openProductForm();
  if (action === 'edit-product') {
    const product = adminState.products.find(p => p.id === id);
    if (product) openProductForm(product);
  }
  if (action === 'delete-product') {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟ سيتم حذف جميع صوره أيضاً.')) return;
    try {
      await ProductsAPI.remove(id);
      showToast('تم حذف المنتج');
      await loadAllData(); renderProductsTable(); renderStats();
    } catch (err) { showToast('تعذر حذف المنتج', 'error'); }
  }
  if (action === 'close-product-form') closeProductForm();
  if (action === 'remove-existing-image') {
    const path = btn.dataset.path;
    try {
      await ProductImagesAPI.remove(id, path);
      btn.closest('.img-chip').remove();
      showToast('تم حذف الصورة');
    } catch (err) { showToast('تعذر حذف الصورة', 'error'); }
  }
  if (action === 'set-primary-image') {
    if (!adminState.editingProductId) return;
    try {
      await ProductImagesAPI.setPrimary(adminState.editingProductId, id);
      const product = await ProductsAPI.getById(adminState.editingProductId);
      renderExistingImages(product.images || []);
      showToast('تم تعيين الصورة الرئيسية');
    } catch (err) { showToast('تعذر التحديث', 'error'); }
  }
  if (action === 'remove-pending-image') {
    adminState.pendingImages.splice(parseInt(btn.dataset.idx, 10), 1);
    renderPendingImages();
  }

  // categories
  if (action === 'add-category') openCategoryForm();
  if (action === 'edit-category') {
    const cat = adminState.categories.find(c => c.id === id);
    if (cat) openCategoryForm(cat);
  }
  if (action === 'delete-category') {
    if (!confirm('حذف هذه الفئة؟ سيتم فك ارتباط المنتجات بها.')) return;
    try {
      await CategoriesAPI.remove(id);
      showToast('تم حذف الفئة');
      await loadAllData(); renderCategoriesTable(); populateCategorySelects(); renderStats();
    } catch (err) { showToast('تعذر حذف الفئة', 'error'); }
  }
  if (action === 'close-category-form') closeCategoryForm();

  // orders
  if (action === 'view-order') openOrderDetail(id);
  if (action === 'close-order-detail') document.getElementById('order-detail-modal').classList.remove('show');
});

/* ---------------------------------------------------------------
   CATEGORIES
--------------------------------------------------------------- */
const categoryModal = document.getElementById('category-form-modal');
let editingCategoryId = null;

function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!adminState.categories.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">لا توجد فئات</td></tr>`; return; }
  tbody.innerHTML = adminState.categories.map(c => `
    <tr>
      <td><img src="${c.image_url || 'assets/images/placeholder.jpg'}" class="table-thumb"></td>
      <td>${c.name}</td>
      <td><span class="tag-mini ${c.is_active ? 'tag-green' : 'tag-gray'}">${c.is_active ? 'نشطة' : 'موقوفة'}</span></td>
      <td class="table-actions">
        <button data-action="edit-category" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
        <button data-action="delete-category" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function openCategoryForm(cat = null) {
  editingCategoryId = cat ? cat.id : null;
  const form = document.getElementById('category-form');
  form.reset();
  document.getElementById('category-form-title').textContent = cat ? 'تعديل الفئة' : 'إضافة فئة جديدة';
  if (cat) {
    form.name.value = cat.name;
    form.slug.value = cat.slug;
    form.image_url.value = cat.image_url || '';
    form.display_order.value = cat.display_order;
    form.is_active.checked = cat.is_active;
  } else {
    form.is_active.checked = true;
  }
  categoryModal.classList.add('show');
}
function closeCategoryForm() { categoryModal.classList.remove('show'); }

document.getElementById('category-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    slug: form.slug.value.trim() || slugify(form.name.value),
    image_url: form.image_url.value.trim() || null,
    display_order: parseInt(form.display_order.value, 10) || 0,
    is_active: form.is_active.checked
  };
  try {
    if (editingCategoryId) await CategoriesAPI.update(editingCategoryId, payload);
    else await CategoriesAPI.create(payload);
    showToast('تم حفظ الفئة');
    closeCategoryForm();
    await loadAllData(); renderCategoriesTable(); populateCategorySelects(); renderStats();
  } catch (err) {
    showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
  }
});

/* ---------------------------------------------------------------
   ORDERS
--------------------------------------------------------------- */
function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  const statusFilter = document.getElementById('order-status-filter').value;
  let list = adminState.orders;
  if (statusFilter) list = list.filter(o => o.status === statusFilter);

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">لا توجد طلبات</td></tr>`; return; }
  const statusLabels = { pending: 'قيد الانتظار', confirmed: 'مؤكد', shipping: 'قيد الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  tbody.innerHTML = list.map(o => `
    <tr>
      <td>${o.order_number}</td>
      <td>${o.customer_name}<br><small>${o.customer_phone}</small></td>
      <td>${o.customer_city}</td>
      <td>${formatPrice(o.total)}</td>
      <td>
        <select data-action="update-status" data-id="${o.id}" class="status-select status-${o.status}">
          ${Object.entries(statusLabels).map(([val, label]) => `<option value="${val}" ${o.status === val ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </td>
      <td class="table-actions"><button data-action="view-order" data-id="${o.id}"><i class="fa-solid fa-eye"></i></button></td>
    </tr>
  `).join('');
}
document.getElementById('order-status-filter').addEventListener('change', renderOrdersTable);

document.addEventListener('change', async e => {
  const select = e.target.closest('[data-action="update-status"]');
  if (!select) return;
  const id = select.dataset.id;
  try {
    await OrdersAPI.updateStatus(id, select.value);
    select.className = `status-select status-${select.value}`;
    showToast('تم تحديث حالة الطلب');
    const order = adminState.orders.find(o => o.id === id);
    if (order) order.status = select.value;
    renderStats();
  } catch (err) { showToast('تعذر تحديث الحالة', 'error'); }
});

function openOrderDetail(id) {
  const order = adminState.orders.find(o => o.id === id);
  if (!order) return;
  const body = document.getElementById('order-detail-body');
  body.innerHTML = `
    <p><strong>${order.order_number}</strong></p>
    <p>${order.customer_name} — ${order.customer_phone}</p>
    <p>${order.customer_city} · ${order.customer_address}</p>
    ${order.notes ? `<p style="color:var(--gray-dim);">ملاحظات: ${order.notes}</p>` : ''}
    <hr style="border-color:rgba(255,255,255,0.08);margin:14px 0;">
    ${order.items.map(i => `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>${i.product_title} × ${i.quantity}</span><span>${formatPrice(i.subtotal)}</span></div>`).join('')}
    <div class="cart-total-row" style="margin-top:10px;"><span>المجموع</span><strong>${formatPrice(order.total)}</strong></div>
  `;
  document.getElementById('order-detail-modal').classList.add('show');
}

/* ---------------------------------------------------------------
   SETTINGS
--------------------------------------------------------------- */
document.getElementById('settings-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  try {
    await SettingsAPI.update({
      site_name: form.site_name.value.trim(),
      whatsapp_number: form.whatsapp_number.value.trim(),
      currency: form.currency.value.trim()
    });
    showToast('تم حفظ الإعدادات');
  } catch (err) { showToast('تعذر حفظ الإعدادات', 'error'); }
});

async function loadSettingsForm() {
  try {
    const s = await SettingsAPI.get();
    const form = document.getElementById('settings-form');
    form.site_name.value = s.site_name;
    form.whatsapp_number.value = s.whatsapp_number || '';
    form.currency.value = s.currency;
  } catch (err) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  loadSettingsForm();
});
