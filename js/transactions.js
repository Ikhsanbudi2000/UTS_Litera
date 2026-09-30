document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('transaction-form');
  const toast = document.getElementById('toast');
  const resultBox = document.getElementById('result-box');
  const historyList = document.getElementById('history-list');
  const bookSelect = document.getElementById('item-id');
  const bookStockStatus = document.getElementById('book-stock-status');
  let historyRows = [];
  let books = [];

  function getRuntimeClient() {
    return window.SUPABASE_CLIENT || null;
  }

  function showToast(message, type = 'error') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
  }

  function ensureSupabaseReady() {
    const client = getRuntimeClient();

    if (!client || typeof client.rpc !== 'function') {
      showToast('Supabase client belum siap. Periksa URL dan anon key.', 'error');
      if (resultBox) {
        resultBox.textContent = 'Error: supabase.rpc is not a function';
      }
      return null;
    }

    return client;
  }

  function normalizeStatus(value) {
    return (value || 'sedang dipinjam').toLowerCase().trim();
  }

  function formatStatusLabel(value) {
    const status = normalizeStatus(value);

    if (status === 'sedang dipinjam') return 'Sedang Dipinjam';
    if (status === 'sudah dikembalikan') return 'Sudah Dikembalikan';
    if (status === 'terkena denda') return 'Terkena Denda';
    return status;
  }

  function renderHistory(rows) {
    historyRows = Array.isArray(rows) ? rows : [];

    if (!historyList) return;

    if (!historyRows.length) {
      historyList.innerHTML = '<li class="history-empty">Belum ada transaksi.</li>';
      return;
    }

    historyList.innerHTML = historyRows
      .map((row) => {
        const id = row.id ?? `${row.item_id ?? 'item'}-${row.created_at ?? Date.now()}`;
        const nama = row.customer_name || row.nama_pelanggan || 'Pelanggan';
        const jumlah = row.qty || row.quantity || 0;
        const status = normalizeStatus(row.status);
        const judul = row.judul || row.buku?.judul || row.item?.judul || `Buku #${row.item_id || row.book_id || 'unknown'}`;

        return `
          <li class="history-item" data-id="${id}">
            <div class="history-meta">
              <strong>${nama}</strong>
              <span class="history-status" data-status="${status}">${formatStatusLabel(status)}</span>
            </div>
            <div class="history-book">${judul}</div>
            <div class="history-row">
              <span>Qty: ${jumlah}</span>
              <div class="history-actions">
                <button type="button" class="detail-btn" data-id="${id}">Lihat Detail</button>
                <button type="button" class="action-btn success" data-action="return" data-id="${id}">Kembalikan</button>
                <button type="button" class="action-btn danger" data-action="fine" data-id="${id}">Denda</button>
              </div>
            </div>
          </li>
        `;
      })
      .join('');
  }

  async function loadBooks() {
    const client = ensureSupabaseReady();
    if (!client || !bookSelect) return;

    const { data, error } = await client
      .from('buku')
      .select('id, judul, stok')
      .order('judul', { ascending: true });

    if (error) {
      console.error('Gagal memuat buku:', error);
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Gagal memuat buku';
      bookSelect.replaceChildren(option);
      if (bookStockStatus) {
        bookStockStatus.textContent = `Gagal memuat data buku: ${error.message}`;
      }
      return;
    }

    books = Array.isArray(data) ? data : [];
    const selectedBookId = bookSelect.value;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = books.length ? '-- Pilih Buku --' : 'Belum ada data buku';
    bookSelect.replaceChildren(placeholder);

    books.forEach((book) => {
      const option = document.createElement('option');
      option.value = String(book.id);
      option.textContent = `${book.judul} (Stok: ${book.stok})`;
      option.disabled = Number(book.stok) < 1;
      bookSelect.append(option);
    });

    if (books.some((book) => String(book.id) === selectedBookId && Number(book.stok) > 0)) {
      bookSelect.value = selectedBookId;
    }
    updateSelectedBookStock();
  }

  function updateSelectedBookStock() {
    const selectedBook = books.find((book) => String(book.id) === bookSelect?.value);
    if (bookStockStatus) {
      bookStockStatus.textContent = selectedBook
        ? `Stok tersedia: ${selectedBook.stok}`
        : books.length ? 'Pilih buku untuk melihat stok.' : 'Tambahkan buku pada tabel public.buku di Supabase.';
    }
    if (selectedBook) {
      document.getElementById('qty').max = String(selectedBook.stok);
    } else {
      document.getElementById('qty').removeAttribute('max');
    }
  }

  async function loadHistory() {
    const client = ensureSupabaseReady();
    if (!client) return;

    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Gagal memuat riwayat:', error);
      if (historyList) {
        historyList.innerHTML = '<li class="history-empty">Gagal memuat riwayat transaksi.</li>';
      }
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const ids = [...new Set(rows
      .map((row) => Number(row.item_id ?? row.book_id))
      .filter((value) => Number.isFinite(value) && value > 0))];

    let bookMap = {};

    if (ids.length > 0) {
      const { data: books, error: booksError } = await client
        .from('buku')
        .select('id, judul')
        .in('id', ids);

      if (!booksError && Array.isArray(books)) {
        bookMap = Object.fromEntries(books.map((book) => [String(book.id), book.judul]));
      }
    }

    const mappedRows = rows.map((row) => ({
      ...row,
      judul: row.judul || bookMap[String(row.item_id ?? row.book_id)] || `Buku #${row.item_id ?? row.book_id ?? 'unknown'}`
    }));

    renderHistory(mappedRows);
  }

  async function saveTransactionToSupabase(client, payload) {
    const { data, error } = await client.rpc('proses_transaksi', payload);
    if (error) throw error;
    return { source: 'rpc', data };
  }

  async function updateTransactionStatus(id, nextStatus) {
    const client = ensureSupabaseReady();
    if (!client) return;

    const transactionId = Number(id);
    if (!Number.isFinite(transactionId)) {
      showToast('ID transaksi tidak valid.', 'error');
      return;
    }

    const row = historyRows.find((item) => Number(item.id) === transactionId);
    if (!row) {
      showToast('Transaksi tidak ditemukan.', 'error');
      return;
    }

    if (normalizeStatus(row.status) === nextStatus) {
      showToast(`Status sudah dalam kondisi ${formatStatusLabel(nextStatus)}.`, 'error');
      return;
    }

    try {
      const { error } = await client
        .from('transactions')
        .update({ status: nextStatus })
        .eq('id', transactionId);

      if (error) throw error;

      showToast(`Status berhasil diubah menjadi ${formatStatusLabel(nextStatus)}.`, 'success');
      await loadHistory();
    } catch (error) {
      console.error(error);
      showToast('Gagal mengubah status transaksi.', 'error');
      if (resultBox) {
        resultBox.textContent = `Error: ${error.message}`;
      }
    }
  }

  if (historyList) {
    historyList.addEventListener('click', async (event) => {
      const detailButton = event.target.closest('.detail-btn');
      if (detailButton) {
        const id = detailButton.dataset.id;
        const row = historyRows.find((item) => String(item.id ?? `${item.item_id ?? 'item'}-${item.created_at ?? ''}`) === String(id));

        if (!row || !resultBox) return;

        const detailText = [
          `ID Transaksi: ${row.id ?? '-'}`,
          `Nama Peminjam: ${row.customer_name || 'Pelanggan'}`,
          `Judul Buku: ${row.judul || 'Tidak tersedia'}`,
          `Jumlah: ${row.qty ?? 0}`,
          `Status: ${formatStatusLabel(row.status)}`,
          `Tanggal: ${row.created_at ? new Date(row.created_at).toLocaleString('id-ID') : '-'}`
        ].join('\n');

        resultBox.textContent = detailText;
        showToast('Detail transaksi ditampilkan.', 'success');
        return;
      }

      const actionButton = event.target.closest('.action-btn');
      if (!actionButton) return;

      const id = actionButton.dataset.id;
      const action = actionButton.dataset.action;
      const nextStatus = action === 'return' ? 'sudah dikembalikan' : 'terkena denda';
      await updateTransactionStatus(id, nextStatus);
    });
  }

  bookSelect?.addEventListener('change', updateSelectedBookStock);

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const client = ensureSupabaseReady();
      if (!client) return;

      const itemId = Number(document.getElementById('item-id').value);
      const qty = Number(document.getElementById('qty').value);
      const customer = document.getElementById('customer').value.trim();

      if (!itemId || !qty || qty < 1 || !customer) {
        showToast('Data transaksi tidak valid. Periksa form input Anda.', 'error');
        return;
      }

      const payload = {
        p_customer_name: customer,
        p_item_id: itemId,
        p_qty: qty
      };

      try {
        const saveResult = await saveTransactionToSupabase(client, payload);
        const resultValue = saveResult.data;
        const detail = Array.isArray(resultValue) && resultValue.length > 0
          ? JSON.stringify(resultValue[0], null, 2)
          : JSON.stringify(resultValue, null, 2);

      // Kosongkan/sembunyikan kotak hasil log
      if (resultBox) {
        resultBox.textContent = '';
        resultBox.style.display = 'none'; // Tambahkan ini jika ingin menyembunyikan kotaknya sepenuhnya
      }
      
      showToast('Transaksi berhasil diproses.', 'success');
      form.reset();
      document.getElementById('qty').value = 1;
      await loadHistory();
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan transaksi.', 'error');
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.textContent = `Error: ${err.message}\n\nPeriksa tabel transactions dan fungsi public.proses_transaksi di Supabase.`;
      }
    }
  });
}

  const client = getRuntimeClient();
  if (client && typeof client.channel === 'function') {
    client
      .channel('litera-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buku' }, () => {
        loadBooks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadHistory();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime Supabase tidak tersambung:', status);
        }
      });
  }

  loadBooks();
  loadHistory();
});
