let currentData = [];
let currentPage = 1;
const pageSize = 10;
let sortField = 'date';
let sortDir = 'desc';

async function loadTable(params = {}) {
  try {
    const data = await API.getScreenings(params);
    currentData = data;
    currentPage = 1;
    sortTableByCurrentField();
  } catch (error) {
    console.error('Error loading table:', error);
    if(window.showToast) showToast('ไม่สามารถโหลดข้อมูลตารางได้', 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  
  if (currentData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">ไม่พบข้อมูล</td></tr>';
    renderPagination();
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = currentData.slice(start, end);

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    
    // Map data
    const branchName = window.appData?.branches?.find(b => b.id === parseInt(row.branchId))?.name || `สาขา ${row.branchId}`;
    const dateThai = new Date(row.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const mediaTypeThai = window.formatMediaType(row.mediaType);
    const statusObj = window.formatStatus(row.status);
    
    // Calculate attendance if guests data exists or default to 0
    let attendanceStr = row.capacity ? `${Math.round((row.guestsCount || 0) / row.capacity * 100)}%` : '0%';
    const safeEscape = (str) => window.escapeHtml ? window.escapeHtml(str) : String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    const safeTitle = safeEscape(row.title || '-');
    const safeId = safeEscape(row.id);

    tr.innerHTML = `
      <td>${dateThai} ${row.time}</td>
      <td>${safeEscape(branchName)}</td>
      <td><strong>${safeTitle}</strong></td>
      <td><span class="badge badge-media">${mediaTypeThai}</span></td>
      <td>${row.guestsCount || 0} / ${row.capacity}</td>
      <td>${attendanceStr}</td>
      <td><span class="badge ${statusObj.class}">${statusObj.label}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary btn-icon" onclick="openGuestModal('${safeId}')" title="จัดการแขก"><i class="fas fa-users"></i></button>
        <button class="btn btn-sm btn-primary btn-icon" onclick="editScreening('${safeId}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deleteScreening('${safeId}')" title="ลบ"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination();
}

function sortTableByCurrentField() {
  currentData.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    if (sortField === 'date') {
      valA = new Date(`${a.date}T${a.time}`).getTime();
      valB = new Date(`${b.date}T${b.time}`).getTime();
    }
    if (sortField === 'guestsCount') {
      valA = a.guestsCount || 0;
      valB = b.guestsCount || 0;
    }
    
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  renderTable();
}

function sortTable(field) {
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = 'asc';
  }
  sortTableByCurrentField();
}

function renderPagination() {
  const container = document.getElementById('pagination');
  container.innerHTML = '';
  
  const totalPages = Math.ceil(currentData.length / pageSize);
  if (totalPages <= 1) return;

  // Prev
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);
  container.appendChild(prevBtn);

  // Pages
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.innerText = i;
    btn.onclick = () => goToPage(i);
    container.appendChild(btn);
  }

  // Next
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);
  container.appendChild(nextBtn);
}

function goToPage(page) {
  const totalPages = Math.ceil(currentData.length / pageSize);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
}

// Attach sort event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      document.querySelectorAll('th i.fa-sort').forEach(i => i.className = 'fas fa-sort');
      sortTable(th.dataset.sort);
      const icon = th.querySelector('i');
      if(icon) icon.className = sortDir === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    });
  });
});

async function editScreening(id) {
  try {
    const data = await API.getScreening(id);
    openScreeningModal(data);
  } catch (error) {
    showToast('ไม่สามารถดึงข้อมูลได้', 'error');
  }
}

async function deleteScreening(id) {
  if (confirm('คุณต้องการลบรอบฉายนี้ใช่หรือไม่? แขกทั้งหมดในรอบฉายนี้จะถูกลบไปด้วย')) {
    try {
      await API.deleteScreening(id);
      showToast('ลบรอบฉายสำเร็จ', 'success');
      onFilterChange(); // reload
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการลบ', 'error');
    }
  }
}
