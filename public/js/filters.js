window.appData = { branches: [] };

async function initFilters() {
  try {
    const branches = await API.getBranches();
    window.appData.branches = branches;
    
    const branchSelect = document.getElementById('filterBranch');
    branches.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = b.name;
      branchSelect.appendChild(option);
    });
    
    // Also populate modal branch select
    const scrBranch = document.getElementById('scrBranch');
    if(scrBranch) {
      branches.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.name;
        scrBranch.appendChild(option);
      });
    }

  } catch (error) {
    console.error('Failed to load branches:', error);
  }

  document.getElementById('btnFilter').addEventListener('click', onFilterChange);
  document.getElementById('btnClearFilter').addEventListener('click', onClearFilter);
}

function getFilterParams() {
  const params = {};
  
  const branchId = document.getElementById('filterBranch').value;
  if (branchId) params.branchId = branchId;
  
  const mediaType = document.getElementById('filterMediaType').value;
  if (mediaType) params.mediaType = mediaType;
  
  const dateFrom = document.getElementById('filterDateFrom').value;
  if (dateFrom) params.dateFrom = dateFrom;
  
  const dateTo = document.getElementById('filterDateTo').value;
  if (dateTo) params.dateTo = dateTo;
  
  return params;
}

function onFilterChange() {
  const params = getFilterParams();
  if (window.updateSummaryCards) updateSummaryCards(params);
  if (window.updateCharts) updateCharts(params);
  if (window.loadTable) loadTable(params);
}

function onClearFilter() {
  document.getElementById('filterBranch').value = '';
  document.getElementById('filterMediaType').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  
  onFilterChange();
}
