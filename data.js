// Cocoa Gallery — data layer shared by the website (index.html) and the dashboard (admin.html).
// Uses Supabase when config.js has keys; otherwise DEMO mode in this browser's storage.
(function () {
  var cfg = window.CG_CONFIG || {};
  var LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // The 11 bonbons — text the shop can edit in the dashboard (visuals stay in the site code).
  var DEFAULT_PRODUCTS = [
    { id: '1',  name: 'Strawberry ganache',                  type: 'Ganache',  description: 'A smooth strawberry ganache inside a hand-painted, marbled red shell.' },
    { id: '2',  name: 'Milk chocolate ganache',              type: 'Ganache',  description: 'Our most popular piece: creamy milk chocolate ganache under a glossy violet shell.' },
    { id: '3',  name: 'Salted caramel cashew praline',       type: 'Praline',  description: 'Crunchy cashew praline with salted caramel, in a two-tone shell.' },
    { id: '4',  name: 'Dulce de leche caramel',              type: 'Caramel',  description: 'Soft dulce de leche caramel in a smooth caramel-brown shell.' },
    { id: '5',  name: 'Hazelnut gianduja',                   type: 'Gianduja', description: 'Silky hazelnut gianduja in a shimmering deep-teal shell.' },
    { id: '6',  name: 'Dark chocolate coffee ganache',       type: 'Ganache',  description: 'Dark chocolate ganache with a rich coffee finish.' },
    { id: '7',  name: 'Dark chocolate passionfruit ganache', type: 'Ganache',  description: 'Dark chocolate ganache brightened with tangy passionfruit.' },
    { id: '8',  name: 'Pistachio ganache',                   type: 'Ganache',  description: 'Pistachio ganache in a hand-painted, marbled green shell.' },
    { id: '9',  name: 'Almond gianduja',                     type: 'Gianduja', description: 'Almond gianduja in a speckled ruby shell.' },
    { id: '10', name: 'Pistachio gianduja',                  type: 'Gianduja', description: 'Pistachio gianduja in a sparkling, speckled green shell.' },
    { id: '11', name: 'Coconut vanilla',                     type: 'Ganache',  description: 'Coconut and vanilla in a pearl-white shell.' }
  ].map(function (p, i) { return Object.assign({ in_stock: true, visible: true, sort: i, photo_url: null }, p); });
  var DEFAULT_SETTINGS = { boxes: [ { size: 8, price: null }, { size: 16, price: null }, { size: 24, price: null } ] };
  var STATUSES = ['new', 'preparing', 'ready', 'delivered', 'cancelled'];

  // ---------- helpers ----------
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('cg-' + k) || 'null'); localStorage.setItem('cg-' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function clean(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }

  var sbPromise = null;
  function sb() {
    if (!LIVE) return Promise.reject(new Error('demo'));
    if (!sbPromise) sbPromise = new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey));
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = function () { res(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)); };
      s.onerror = function () { rej(new Error('Could not load Supabase')); };
      document.head.appendChild(s);
    });
    return sbPromise;
  }
  function q(r) { if (r.error) throw r.error; return r.data; }

  // ---------- demo store ----------
  function demoProducts() { return store('products') || DEFAULT_PRODUCTS.map(function (p) { return Object.assign({}, p); }); }
  function demoOrders() { return store('orders') || []; }
  function demoVisits() { return store('visits') || []; }

  var CG = {
    live: LIVE,
    statuses: STATUSES,
    defaults: DEFAULT_PRODUCTS,
    currency: cfg.currency || 'EGP',
    whatsapp: cfg.whatsapp || '',

    // ---- products ----
    listProducts: function () {
      if (!LIVE) return Promise.resolve(demoProducts());
      return sb().then(function (c) { return c.from('products').select('*').order('sort'); }).then(q);
    },
    saveProduct: function (p) {
      var row = { id: String(p.id), name: clean(p.name, 80), type: clean(p.type, 40), description: clean(p.description, 400),
        in_stock: !!p.in_stock, visible: !!p.visible, sort: Number(p.sort) || 0, photo_url: p.photo_url || null };
      if (!LIVE) { var all = demoProducts(), i = all.findIndex(function (x) { return x.id === row.id; }); if (i < 0) all.push(row); else all[i] = Object.assign(all[i], row); store('products', all); return Promise.resolve(row); }
      row.updated_at = new Date().toISOString();
      return sb().then(function (c) { return c.from('products').upsert(row).select().single(); }).then(q);
    },
    importDefaultProducts: function () {
      if (!LIVE) { store('products', DEFAULT_PRODUCTS); return Promise.resolve(DEFAULT_PRODUCTS); }
      return sb().then(function (c) { return c.from('products').upsert(DEFAULT_PRODUCTS).select(); }).then(q);
    },
    uploadPhoto: function (file, productId) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('Please choose a JPG, PNG or WebP image.'));
      if (file.size > 3 * 1024 * 1024) return Promise.reject(new Error('Please choose an image smaller than 3 MB.'));
      if (!LIVE) return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(file); });
      var path = 'p' + productId + '-' + Date.now() + '.' + file.type.split('/')[1];
      return sb().then(function (c) {
        return c.storage.from('product-photos').upload(path, file, { upsert: true, contentType: file.type }).then(function (r) {
          if (r.error) throw r.error; return c.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
        });
      });
    },

    // ---- settings ----
    getSettings: function () {
      if (!LIVE) return Promise.resolve(store('settings') || DEFAULT_SETTINGS);
      return sb().then(function (c) { return c.from('settings').select('*').eq('key', 'shop').maybeSingle(); }).then(q).then(function (r) { return (r && r.value) || DEFAULT_SETTINGS; });
    },
    saveSettings: function (v) {
      if (!LIVE) { store('settings', v); return Promise.resolve(v); }
      return sb().then(function (c) { return c.from('settings').upsert({ key: 'shop', value: v }); }).then(q).then(function () { return v; });
    },

    // ---- orders ----
    createOrder: function (o) {
      var row = { customer_name: clean(o.customer_name, 80), phone: clean(o.phone, 20), address: clean(o.address, 300), notes: clean(o.notes, 500),
        box_size: Number(o.box_size), items: o.items, total: o.total == null ? null : Number(o.total), status: 'new' };
      if (!LIVE) { var all = demoOrders(); row.id = (all.reduce(function (m, x) { return Math.max(m, x.id); }, 1000)) + 1; row.created_at = new Date().toISOString(); all.push(row); store('orders', all); return Promise.resolve(row); }
      // customers can't read orders back, so no .select() here
      return sb().then(function (c) { return c.from('orders').insert(row); }).then(q).then(function () { return row; });
    },
    listOrders: function (sinceDays) {
      var since = sinceDays ? Date.now() - sinceDays * 864e5 : 0;
      if (!LIVE) return Promise.resolve(demoOrders().filter(function (o) { return Date.parse(o.created_at) >= since; }).sort(function (a, b) { return b.id - a.id; }));
      return sb().then(function (c) {
        var r = c.from('orders').select('*').order('created_at', { ascending: false }).limit(2000);
        if (since) r = r.gte('created_at', new Date(since).toISOString());
        return r;
      }).then(q);
    },
    updateOrderStatus: function (id, status) {
      if (STATUSES.indexOf(status) < 0) return Promise.reject(new Error('bad status'));
      if (!LIVE) { var all = demoOrders(); all.forEach(function (o) { if (o.id === id) o.status = status; }); store('orders', all); return Promise.resolve(); }
      return sb().then(function (c) { return c.from('orders').update({ status: status }).eq('id', id); }).then(q);
    },

    // ---- visits ----
    logVisit: function () {
      try { if (sessionStorage.getItem('cg-visited')) return Promise.resolve(); sessionStorage.setItem('cg-visited', '1'); } catch (e) {}
      var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
      if (ref === location.hostname) ref = '';
      var row = { path: location.pathname.slice(0, 200), referrer: ref.slice(0, 200), device: window.matchMedia('(max-width: 820px)').matches ? 'mobile' : 'desktop' };
      if (!LIVE) { var v = demoVisits(); row.created_at = new Date().toISOString(); v.push(row); store('visits', v.slice(-5000)); return Promise.resolve(); }
      return sb().then(function (c) { return c.from('visits').insert(row); }).catch(function () {});
    },
    listVisits: function (sinceDays) {
      var since = Date.now() - (sinceDays || 30) * 864e5;
      if (!LIVE) return Promise.resolve(demoVisits().filter(function (v) { return Date.parse(v.created_at) >= since; }));
      return sb().then(function (c) { return c.from('visits').select('created_at,device,referrer').gte('created_at', new Date(since).toISOString()).limit(20000); }).then(q);
    },

    // ---- admin login ----
    session: function () {
      if (!LIVE) return Promise.resolve({ demo: true });
      return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data.session; });
    },
    signIn: function (email, password) {
      return sb().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }); }).then(function (r) { if (r.error) throw r.error; return r.data.session; });
    },
    signOut: function () { return LIVE ? sb().then(function (c) { return c.auth.signOut(); }) : Promise.resolve(); },
    isAdmin: function () {
      if (!LIVE) return Promise.resolve(true);
      return sb().then(function (c) { return c.rpc('is_admin'); }).then(q);
    },

    // ---- demo helpers ----
    seedDemo: function () {
      if (LIVE) return Promise.resolve();
      var names = ['Demo customer A', 'Demo customer B', 'Demo customer C', 'Demo customer D', 'Demo customer E'];
      var orders = demoOrders().slice(), visits = demoVisits().slice(), id = orders.reduce(function (m, x) { return Math.max(m, x.id); }, 1000), now = Date.now(), seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var d = 29; d >= 0; d--) {
        var day = now - d * 864e5, nv = 20 + Math.round(rnd() * 40), no = Math.round(rnd() * 4);
        for (var k = 0; k < nv; k++) visits.push({ created_at: new Date(day - rnd() * 864e5 * .9).toISOString(), device: rnd() < .7 ? 'mobile' : 'desktop', referrer: rnd() < .5 ? 'instagram.com' : '' });
        for (k = 0; k < no; k++) {
          var size = [8, 8, 16, 24][Math.floor(rnd() * 4)], counts = {};
          for (var s = 0; s < size; s++) { var pid = String(1 + Math.floor(rnd() * 11)); counts[pid] = (counts[pid] || 0) + 1; }
          var items = Object.keys(counts).map(function (pid) { return { id: pid, name: DEFAULT_PRODUCTS[+pid - 1].name, qty: counts[pid] }; });
          orders.push({ id: ++id, created_at: new Date(day - rnd() * 864e5 * .9).toISOString(), customer_name: names[Math.floor(rnd() * names.length)], phone: '0100000000' + Math.floor(rnd() * 10),
            address: 'Demo address', notes: '', box_size: size, items: items, total: null, status: d > 3 ? 'delivered' : STATUSES[Math.floor(rnd() * 3)] });
        }
      }
      store('orders', orders); store('visits', visits); store('demo-seeded', true);
      return Promise.resolve();
    },
    clearDemo: function () { ['orders', 'visits', 'products', 'settings', 'demo-seeded'].forEach(function (k) { try { localStorage.removeItem('cg-' + k); } catch (e) {} }); return Promise.resolve(); },
    demoSeeded: function () { return !!store('demo-seeded'); },
    withTimeout: withTimeout
  };
  window.CG = CG;
})();
