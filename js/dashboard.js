document.addEventListener('DOMContentLoaded', () => {
  const client = window.SUPABASE_CLIENT;
  const state = {
    session: null,
    user: null,
    profile: null,
    role: 'guest',
    books: [],
    transactions: [],
    profiles: [],
    transactionFilter: 'all',
    bookSearch: '',
    editingBookId: null,
    channel: null,
    refreshTimer: null,
    pendingRefresh: new Set()
  };

  const el = (id) => document.getElementById(id);
  const toastRegion = el('toast-region');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const isAdmin = () => state.role === 'admin';
  const currentName = () => state.profile?.full_name || state.user?.user_metadata?.full_name || 'Anggota';

  function notify(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.type = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function setSyncState(label, status = 'connecting') {
    const node = el('realtime-status');
    node.dataset.state = status;
    node.lastChild.textContent = label;
  }

  function requireAdmin() {
    if (isAdmin()) return true;
    notify('Aksi ini hanya tersedia untuk administrator.', 'error');
    return false;
  }

  function setIdentity() {
    el('identity-name').textContent = state.user ? currentName() : 'Pengunjung';
    el('identity-role').textContent = state.role === 'admin' ? 'Administrator' : state.user ? 'Anggota' : 'Tamu';
    el('avatar').textContent = currentName().trim().slice(0, 1).toUpperCase();
    el('logout-button').hidden = !state.user;
    el('login-link').hidden = Boolean(state.user);
    document.querySelectorAll('[data-admin-only]').forEach((node) => {
      node.hidden = !isAdmin();
    });
    el('book-access-label').textContent = isAdmin() ? 'Admin access' : 'Read-only';
    el('admin-role-banner').hidden = isAdmin() || !state.user;
    el('guest-banner').hidden = Boolean(state.user);
    el('borrow-customer').textContent = state.user ? `Peminjam: ${currentName()}` : 'Masuk diperlukan untuk mengajukan peminjaman.';
    el('borrow-submit').textContent = state.user ? 'Ajukan Peminjaman' : 'Masuk untuk Meminjam';
    el('transaction-scope').textContent = isAdmin() ? 'Semua transaksi' : state.user ? 'Peminjaman milik Anda' : 'Masuk untuk melihat riwayat';
    if (state.role !== 'admin' && el('panel-members')) el('panel-members').hidden = true;
    updateMetricLabels();
  }

  function updateMetricLabels() {
    const member = state.user && !isAdmin();
    el('metric-transactions-label').textContent = member ? 'Peminjaman Saya' : 'Total Transaksi';
    el('metric-active-label').textContent = member ? 'Pinjaman Aktif Saya' : 'Peminjaman Aktif';
    el('metric-profiles').textContent = isAdmin() ? String(state.profiles.length) : '—';
    el('metric-profiles-note').textContent = isAdmin() ? 'Profil terdaftar' : 'Khusus admin';
    el('member-count').textContent = `${state.profiles.length} profil`;
  }

  async function loadProfile() {
    state.profile = null;
    state.role = state.user ? 'anggota' : 'guest';
    if (!state.user) {
      setIdentity();
      return;
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', state.user.id)
      .maybeSingle();

    if (error) {
      console.error('Gagal memuat profil:', error);
      notify(`Profil belum tersedia: ${error.message}`, 'error');
    } else {
      state.profile = data;
      state.role = data?.role === 'admin' ? 'admin' : 'anggota';
    }
    setIdentity();
  }

  async function loadBooks() {
    const { data, error } = await client
      .from('buku')
      .select('id, judul, stok, created_at')
      .order('judul', { ascending: true });
    if (error) throw error;
    state.books = data || [];
    renderBooks();
    renderBorrowOptions();
    renderOverviewBooks();
    updateMetrics();
  }

  async function loadTransactions() {
    if (!state.user) {
      state.transactions = [];
      renderTransactions();
      renderRecentTransactions();
      updateMetrics();
      return;
    }

    let query = client
      .from('transactions')
      .select('id, customer_name, borrower_id, item_id, qty, status, created_at')
      .order('created_at', { ascending: false });
    if (!isAdmin()) query = query.eq('borrower_id', state.user.id);

    const { data, error } = await query;
    if (error) throw error;
    state.transactions = data || [];
    renderTransactions();
    renderRecentTransactions();
    updateMetrics();
  }

  async function loadProfiles() {
    if (!isAdmin()) {
      state.profiles = [];
      updateMetrics();
      return;
    }
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, role, updated_at')
      .order('full_name', { ascending: true });
    if (error) throw error;
    state.profiles = data || [];
    renderProfiles();
    updateMetrics();
  }

  async function refreshAll() {
    if (!client) return;
    try {
      await loadProfile();
      await Promise.all([loadBooks(), loadTransactions(), loadProfiles()]);
      setSyncState('Terhubung', 'connected');
    } catch (error) {
      console.error('Gagal menyegarkan dashboard:', error);
      setSyncState('Periksa koneksi', 'error');
      notify(`Gagal memuat data: ${error.message}`, 'error');
    }
  }

  function getFilteredBooks() {
    const search = state.bookSearch.trim().toLocaleLowerCase('id-ID');
    return state.books.filter((book) => !search || book.judul.toLocaleLowerCase('id-ID').includes(search));
  }

  function renderBooks() {
    const body = el('book-rows');
    const rows = getFilteredBooks();
    el('book-count').textContent = `${rows.length} judul`;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty-state">${state.books.length ? 'Tidak ada judul yang cocok.' : 'Belum ada buku di katalog.'}</td></tr>`;
      return;
    }

    body.innerHTML = rows.map((book) => {
      const editing = String(state.editingBookId) === String(book.id) && isAdmin();
      const title = editing
        ? `<input class="inline-title" aria-label="Judul buku baru" data-title-input="${book.id}" value="${escapeHtml(book.judul)}">`
        : `<span class="book-title">${escapeHtml(book.judul)}</span>`;
      const titleActions = isAdmin()
        ? editing
          ? `<button class="row-button" data-action="save-title" data-id="${book.id}">Simpan</button><button class="row-button" data-action="cancel-title">Batal</button>`
          : `<button class="row-button" data-action="edit-title" data-id="${book.id}">Ubah judul</button>`
        : '';
      const stockCell = isAdmin()
        ? `<div class="stock-controls"><button class="step-button" aria-label="Kurangi stok" data-action="stock-down" data-id="${book.id}" ${Number(book.stok) < 1 ? 'disabled' : ''}>−</button><span class="stock-count" data-empty="${Number(book.stok) < 1}">${Number(book.stok)}</span><button class="step-button" aria-label="Tambah stok" data-action="stock-up" data-id="${book.id}">+</button></div>`
        : `<span class="stock-count" data-empty="${Number(book.stok) < 1}">${Number(book.stok)}</span>`;
      const actions = isAdmin()
        ? `<div class="row-actions">${titleActions}<button class="row-button danger" data-action="delete-book" data-id="${book.id}">Hapus</button></div>`
        : `<span class="stock-badge" data-out="${Number(book.stok) < 1}">${Number(book.stok) < 1 ? 'Habis' : 'Tersedia'}</span>`;
      return `<tr><td>${title}</td><td>${stockCell}</td><td>${book.created_at ? new Date(book.created_at).toLocaleDateString('id-ID') : '—'}</td><td>${actions}</td></tr>`;
    }).join('');
  }

  function renderOverviewBooks() {
    const body = el('overview-book-rows');
    const books = state.books.slice(0, 6);
    body.innerHTML = books.length
      ? books.map((book) => `<tr><td><span class="book-title">${escapeHtml(book.judul)}</span></td><td><span class="stock-count" data-empty="${Number(book.stok) < 1}">${Number(book.stok)}</span></td></tr>`).join('')
      : '<tr><td colspan="2" class="empty-state">Katalog masih kosong.</td></tr>';
  }

  function renderBorrowOptions() {
    const select = el('borrow-book');
    const selected = select.value;
    select.innerHTML = '<option value="">Pilih buku</option>' + state.books.map((book) =>
      `<option value="${book.id}" ${Number(book.stok) < 1 ? 'disabled' : ''}>${escapeHtml(book.judul)} · stok ${Number(book.stok)}</option>`
    ).join('');
    if (state.books.some((book) => String(book.id) === selected && Number(book.stok) > 0)) select.value = selected;
    updateBorrowStock();
  }

  function updateBorrowStock() {
    const book = state.books.find((item) => String(item.id) === el('borrow-book').value);
    const qty = el('borrow-qty');
    el('borrow-stock').textContent = book ? `Stok tersedia: ${book.stok}` : 'Pilih judul untuk melihat stok.';
    qty.max = book ? String(book.stok) : '';
    if (book && Number(qty.value) > Number(book.stok)) qty.value = book.stok;
  }

  function statusLabel(status) {
    if (status === 'sedang dipinjam') return 'Sedang dipinjam';
    if (status === 'sudah dikembalikan') return 'Sudah dikembalikan';
    return 'Terkena denda';
  }

  function getVisibleTransactions() {
    if (state.transactionFilter === 'active') return state.transactions.filter((row) => row.status === 'sedang dipinjam');
    if (state.transactionFilter === 'returned') return state.transactions.filter((row) => row.status === 'sudah dikembalikan');
    if (state.transactionFilter === 'fined') return state.transactions.filter((row) => row.status === 'terkena denda');
    return state.transactions;
  }

  function renderTransactions() {
    const body = el('transaction-rows');
    const rows = getVisibleTransactions();
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">${state.user ? 'Belum ada transaksi pada filter ini.' : 'Masuk untuk melihat dan mengajukan peminjaman.'}</td></tr>`;
      return;
    }
    const booksById = new Map(state.books.map((book) => [String(book.id), book.judul]));
    body.innerHTML = rows.map((row) => {
      const title = booksById.get(String(row.item_id)) || `Buku #${row.item_id}`;
      const actions = isAdmin()
        ? `${row.status === 'sedang dipinjam' ? `<button class="row-button" data-action="set-returned" data-id="${row.id}">Kembalikan</button><button class="row-button" data-action="set-fined" data-id="${row.id}">Denda</button>` : ''}<button class="row-button danger" data-action="delete-transaction" data-id="${row.id}">Hapus</button>`
        : '<span class="role-tag">Read-only</span>';
      return `<tr><td>${new Date(row.created_at).toLocaleString('id-ID')}</td><td>${escapeHtml(row.customer_name)}</td><td><span class="book-title">${escapeHtml(title)}</span></td><td>${Number(row.qty)}</td><td><span class="status-badge" data-status="${escapeHtml(row.status)}">${statusLabel(row.status)}</span></td><td><div class="row-actions">${actions}</div></td></tr>`;
    }).join('');
  }

  function renderRecentTransactions() {
    const body = el('recent-transaction-rows');
    const rows = state.transactions.slice(0, 5);
    const booksById = new Map(state.books.map((book) => [String(book.id), book.judul]));
    body.innerHTML = rows.length
      ? rows.map((row) => `<tr><td>${escapeHtml(row.customer_name)}</td><td>${escapeHtml(booksById.get(String(row.item_id)) || `Buku #${row.item_id}`)}</td><td><span class="status-badge" data-status="${escapeHtml(row.status)}">${statusLabel(row.status)}</span></td></tr>`).join('')
      : '<tr><td colspan="3" class="empty-state">Belum ada aktivitas peminjaman.</td></tr>';
  }

  function renderProfiles() {
    const body = el('profile-rows');
    el('member-count').textContent = `${state.profiles.length} profil`;
    body.innerHTML = state.profiles.length
      ? state.profiles.map((profile) => {
        const isSelf = profile.id === state.user?.id;
        const nextRole = profile.role === 'admin' ? 'anggota' : 'admin';
        const actionLabel = profile.role === 'admin' ? 'Jadikan anggota' : 'Promosikan admin';
        return `<tr><td><span class="member-name">${escapeHtml(profile.full_name || 'Anggota')}</span><span class="member-email">ID ${escapeHtml(profile.id.slice(0, 8))}…</span></td><td><span class="role-badge" data-role="${profile.role}">${profile.role === 'admin' ? 'Admin' : 'Anggota'}</span></td><td>${profile.updated_at ? new Date(profile.updated_at).toLocaleDateString('id-ID') : '—'}</td><td>${isSelf ? '<span class="role-tag">Anda</span>' : `<button class="row-button" data-action="set-role" data-id="${profile.id}" data-role="${nextRole}">${actionLabel}</button>`}</td></tr>`;
      }).join('')
      : '<tr><td colspan="4" class="empty-state">Belum ada profil anggota.</td></tr>';
  }

  function updateMetrics() {
    el('metric-books').textContent = String(state.books.length);
    el('metric-stock').textContent = String(state.books.reduce((total, book) => total + Number(book.stok || 0), 0));
    el('metric-transactions').textContent = state.user ? String(state.transactions.length) : '—';
    el('metric-active').textContent = state.user
      ? String(state.transactions.filter((row) => row.status === 'sedang dipinjam').length)
      : '—';
    updateMetricLabels();
  }

  async function addBook(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    const title = el('new-book-title').value.trim();
    const stock = Number(el('new-book-stock').value);
    if (!title || !Number.isInteger(stock) || stock < 0) {
      notify('Judul dan stok awal harus valid.', 'error');
      return;
    }
    const { error } = await client.from('buku').insert({ judul: title, stok: stock });
    if (error) return notify(error.message, 'error');
    el('book-form').reset();
    el('new-book-stock').value = '1';
    notify('Buku ditambahkan.', 'success');
    await loadBooks();
  }

  async function saveBookTitle(id) {
    if (!requireAdmin()) return;
    const input = document.querySelector(`[data-title-input="${CSS.escape(String(id))}"]`);
    const title = input?.value.trim();
    if (!title) return notify('Judul buku tidak boleh kosong.', 'error');
    const { error } = await client.from('buku').update({ judul: title }).eq('id', id);
    if (error) return notify(error.message, 'error');
    state.editingBookId = null;
    notify('Judul buku diperbarui.', 'success');
    await loadBooks();
  }

  async function changeStock(id, delta) {
    if (!requireAdmin()) return;
    const book = state.books.find((item) => String(item.id) === String(id));
    if (!book) return;
    const stock = Number(book.stok) + delta;
    if (stock < 0) return notify('Stok tidak dapat kurang dari nol.', 'error');
    const { error } = await client.from('buku').update({ stok: stock }).eq('id', id);
    if (error) return notify(error.message, 'error');
    await loadBooks();
    notify(`Stok ${book.judul} diperbarui menjadi ${stock}.`, 'success');
  }

  async function deleteBook(id) {
    if (!requireAdmin()) return;
    const book = state.books.find((item) => String(item.id) === String(id));
    if (!book || !window.confirm(`Hapus buku “${book.judul}”? Riwayat transaksi buku ini juga akan dihapus.`)) return;
    const { error } = await client.from('buku').delete().eq('id', id);
    if (error) return notify(error.message, 'error');
    notify('Buku dan transaksi terkait dihapus.', 'success');
    await Promise.all([loadBooks(), loadTransactions()]);
  }

  async function submitBorrow(event) {
    event.preventDefault();
    if (!state.user) {
      window.location.href = 'index.html';
      return;
    }
    const bookId = Number(el('borrow-book').value);
    const qty = Number(el('borrow-qty').value);
    const book = state.books.find((item) => Number(item.id) === bookId);
    if (!book || !Number.isInteger(qty) || qty < 1 || qty > Number(book.stok)) {
      notify('Periksa judul, jumlah, dan stok yang tersedia.', 'error');
      return;
    }
    const { error } = await client.rpc('proses_transaksi', {
      p_customer_name: currentName(),
      p_item_id: bookId,
      p_qty: qty
    });
    if (error) return notify(error.message, 'error');
    el('borrow-form').reset();
    el('borrow-qty').value = '1';
    notify('Permintaan peminjaman berhasil dicatat.', 'success');
    await Promise.all([loadBooks(), loadTransactions()]);
  }

  async function setTransactionStatus(id, status) {
    if (!requireAdmin()) return;
    const { error } = await client.rpc('set_transaction_status', {
      p_transaction_id: Number(id),
      p_status: status
    });
    if (error) return notify(error.message, 'error');
    notify(`Status diubah: ${statusLabel(status)}.`, 'success');
    await loadTransactions();
  }

  async function deleteTransaction(id) {
    if (!requireAdmin()) return;
    if (!window.confirm('Hapus catatan transaksi ini? Stok buku tidak berubah.')) return;
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) return notify(error.message, 'error');
    notify('Catatan transaksi dihapus.', 'success');
    await loadTransactions();
  }

  async function updateRole(id, role) {
    if (!requireAdmin()) return;
    if (!['admin', 'anggota'].includes(role)) return;
    if (!window.confirm(`Ubah role pengguna ini menjadi ${role}?`)) return;
    const { error } = await client.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return notify(error.message, 'error');
    notify('Role pengguna diperbarui.', 'success');
    await loadProfiles();
  }

  function setupRealtime() {
    if (!client || typeof client.channel !== 'function') return;
    let channel = client.channel('litera-admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buku' }, () => scheduleRefresh(['books', 'transactions']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => scheduleRefresh(['transactions']));
    if (state.user) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
        if (payload.new?.id === state.user?.id || payload.old?.id === state.user?.id) await loadProfile();
        scheduleRefresh(['profiles']);
      });
    }
    state.channel = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setSyncState('Realtime aktif', 'connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncState('Realtime gagal', 'error');
    });
    window.addEventListener('beforeunload', () => {
      if (state.channel) client.removeChannel(state.channel);
    }, { once: true });
  }

  function scheduleRefresh(parts) {
    parts.forEach((part) => state.pendingRefresh.add(part));
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(async () => {
      const pending = new Set(state.pendingRefresh);
      state.pendingRefresh.clear();
      try {
        if (pending.has('books')) await loadBooks();
        if (pending.has('transactions')) await loadTransactions();
        if (pending.has('profiles')) await loadProfiles();
      } catch (error) {
        console.error('Realtime refresh gagal:', error);
        notify(`Pembaruan realtime gagal: ${error.message}`, 'error');
      }
    }, 120);
  }

  function setupNavigation() {
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        if (view === 'members' && !requireAdmin()) return;
        document.querySelectorAll('.nav-link[data-view]').forEach((item) => {
          item.setAttribute('aria-current', String(item.dataset.view === view ? 'page' : 'false'));
        });
        document.querySelectorAll('.view-panel').forEach((panel) => {
          panel.hidden = panel.id !== `panel-${view}`;
        });
        el('page-title').textContent = button.dataset.title;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function setupEvents() {
    setupNavigation();
    el('book-form').addEventListener('submit', addBook);
    el('book-search').addEventListener('input', (event) => {
      state.bookSearch = event.target.value;
      renderBooks();
    });
    el('borrow-form').addEventListener('submit', submitBorrow);
    el('borrow-book').addEventListener('change', updateBorrowStock);
    el('borrow-qty').addEventListener('input', updateBorrowStock);
    el('transaction-filters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      state.transactionFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      renderTransactions();
    });
    el('book-rows').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const { action, id } = button.dataset;
      if (action === 'edit-title') { state.editingBookId = id; renderBooks(); document.querySelector(`[data-title-input="${CSS.escape(String(id))}"]`)?.focus(); }
      if (action === 'cancel-title') { state.editingBookId = null; renderBooks(); }
      if (action === 'save-title') await saveBookTitle(id);
      if (action === 'stock-up') await changeStock(id, 1);
      if (action === 'stock-down') await changeStock(id, -1);
      if (action === 'delete-book') await deleteBook(id);
    });
    el('book-rows').addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && event.target.matches('[data-title-input]')) {
        event.preventDefault();
        await saveBookTitle(event.target.dataset.titleInput);
      }
      if (event.key === 'Escape' && event.target.matches('[data-title-input]')) {
        state.editingBookId = null;
        renderBooks();
      }
    });
    el('transaction-rows').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (button.dataset.action === 'set-returned') await setTransactionStatus(button.dataset.id, 'sudah dikembalikan');
      if (button.dataset.action === 'set-fined') await setTransactionStatus(button.dataset.id, 'terkena denda');
      if (button.dataset.action === 'delete-transaction') await deleteTransaction(button.dataset.id);
    });
    el('profile-rows').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="set-role"]');
      if (button) await updateRole(button.dataset.id, button.dataset.role);
    });
    el('logout-button').addEventListener('click', async () => {
      const { error } = await client.auth.signOut();
      if (error) notify(error.message, 'error');
      else window.location.href = 'index.html';
    });
  }

  async function init() {
    if (!client?.auth) {
      setSyncState('Client tidak tersedia', 'error');
      notify('Supabase client tidak tersedia.', 'error');
      return;
    }
    setupEvents();
    const { data, error } = await client.auth.getSession();
    if (error) {
      notify(error.message, 'error');
      return;
    }
    state.session = data.session;
    state.user = data.session?.user || null;
    setIdentity();
    await refreshAll();
    setupRealtime();
    client.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      if (nextUser?.id !== state.user?.id) {
        state.session = session;
        state.user = nextUser;
        await refreshAll();
      }
    });
  }

  init();
});
