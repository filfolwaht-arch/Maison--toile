/* ==============================================================
   VELORA JEWELRY — Supabase client & shared data-access layer
   Loaded by both the storefront (app.js) and admin panel (admin.js)
   ============================================================== */

// --- Project credentials -------------------------------------
const SUPABASE_URL = 'https://duklgudhjweurclhzthu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a2xndWRoandldXJjbGh6dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjE4NDYsImV4cCI6MjA5Nzk5Nzg0Nn0.sdslwXtZsBqk-UWwUvdOglKiGl5vWgZy29Bab9cpYHY';
const PRODUCT_IMAGES_BUCKET = 'product-images';

// supabase-js is loaded globally via CDN in the HTML <head>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------------------------------------------------------
   CATEGORIES
--------------------------------------------------------------- */
const CategoriesAPI = {
  async listActive() {
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  async listAll() {
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabaseClient.from('categories').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabaseClient.from('categories').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) throw error;
  }
};

/* ---------------------------------------------------------------
   PRODUCTS (with joined images + category)
--------------------------------------------------------------- */
const ProductsAPI = {
  async listActive({ categorySlug, search, sort } = {}) {
    let query = supabaseClient
      .from('products')
      .select('*, category:categories(id,name,slug), images:product_images(id,image_url,image_path,display_order,is_primary)')
      .eq('is_active', true);

    if (categorySlug) {
      const { data: cat } = await supabaseClient.from('categories').select('id').eq('slug', categorySlug).maybeSingle();
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    switch (sort) {
      case 'price_asc': query = query.order('price', { ascending: true }); break;
      case 'price_desc': query = query.order('price', { ascending: false }); break;
      case 'oldest': query = query.order('created_at', { ascending: true }); break;
      default: query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async listFeatured() {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*, category:categories(id,name,slug), images:product_images(id,image_url,image_path,display_order,is_primary)')
      .eq('is_active', true)
      .eq('featured', true)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;
    return data;
  },
  async getById(id) {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*, category:categories(id,name,slug), images:product_images(id,image_url,image_path,display_order,is_primary)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  async listAllForAdmin({ search, categoryId } = {}) {
    let query = supabaseClient
      .from('products')
      .select('*, category:categories(id,name), images:product_images(id,image_url,image_path,display_order,is_primary)')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabaseClient.from('products').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabaseClient.from('products').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    // fetch images first so their Storage objects can be removed
    const { data: images } = await supabaseClient.from('product_images').select('image_path').eq('product_id', id);
    if (images && images.length) {
      await supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).remove(images.map(i => i.image_path));
    }
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
  }
};

/* ---------------------------------------------------------------
   PRODUCT IMAGES
--------------------------------------------------------------- */
const ProductImagesAPI = {
  async upload(productId, file, { isPrimary = false, order = 0 } = {}) {
    const ext = file.name.split('.').pop();
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    const { data, error } = await supabaseClient
      .from('product_images')
      .insert({ product_id: productId, image_url: urlData.publicUrl, image_path: path, is_primary: isPrimary, display_order: order })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(imageId, imagePath) {
    await supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]);
    const { error } = await supabaseClient.from('product_images').delete().eq('id', imageId);
    if (error) throw error;
  },
  async setPrimary(productId, imageId) {
    await supabaseClient.from('product_images').update({ is_primary: false }).eq('product_id', productId);
    const { error } = await supabaseClient.from('product_images').update({ is_primary: true }).eq('id', imageId);
    if (error) throw error;
  }
};

/* ---------------------------------------------------------------
   ORDERS
--------------------------------------------------------------- */
const OrdersAPI = {
  async create({ customer, items, subtotal, total }) {
    const { data: order, error } = await supabaseClient
      .from('orders')
      .insert({
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_city: customer.city,
        customer_address: customer.address,
        notes: customer.notes || null,
        subtotal,
        total
      })
      .select()
      .single();
    if (error) throw error;

    const rows = items.map(i => ({
      order_id: order.id,
      product_id: i.id,
      product_title: i.title,
      unit_price: i.finalPrice,
      quantity: i.qty,
      subtotal: i.finalPrice * i.qty
    }));
    const { error: itemsErr } = await supabaseClient.from('order_items').insert(rows);
    if (itemsErr) throw itemsErr;

    return order;
  },
  async track(orderNumber) {
    const { data, error } = await supabaseClient.rpc('track_order', { p_order_number: orderNumber });
    if (error) throw error;
    return data && data.length ? data[0] : null;
  },
  async listAllForAdmin({ status } = {}) {
    let query = supabaseClient.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async updateStatus(id, status) {
    const { error } = await supabaseClient.from('orders').update({ status }).eq('id', id);
    if (error) throw error;
  }
};

/* ---------------------------------------------------------------
   SETTINGS
--------------------------------------------------------------- */
const SettingsAPI = {
  async get() {
    const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
    if (error) throw error;
    return data;
  },
  async update(payload) {
    const { error } = await supabaseClient.from('settings').update(payload).eq('id', 1);
    if (error) throw error;
  }
};

/* ---------------------------------------------------------------
   AUTH (admin login)
--------------------------------------------------------------- */
const AuthAPI = {
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: adminRow } = await supabaseClient.from('admins').select('*').eq('id', data.user.id).maybeSingle();
    if (!adminRow) {
      await supabaseClient.auth.signOut();
      throw new Error('هذا الحساب غير مخول للوصول إلى لوحة التحكم');
    }
    return { user: data.user, admin: adminRow };
  },
  async signOut() {
    await supabaseClient.auth.signOut();
  },
  async currentSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }
};
