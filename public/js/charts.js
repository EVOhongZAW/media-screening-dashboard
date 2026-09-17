const chartInstances = {};

const chartColors = {
  palette: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'],
  bgOpacities: ['rgba(99, 102, 241, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(6, 182, 212, 0.7)'],
  borderOpacities: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4']
};

Chart.defaults.font.family = "'Prompt', sans-serif";
Chart.defaults.color = '#64748b';

function initCharts() {
  // Initialization happens on first data load
}

async function updateCharts(filterParams) {
  try {
    const [byBranch, byMediaType, trend, byGuestType] = await Promise.all([
      API.getStatsByBranch(filterParams),
      API.getStatsByMediaType(filterParams),
      API.getStatsTrend(filterParams),
      API.getStatsByGuestType(filterParams)
    ]);

    renderByBranch(byBranch);
    renderByMediaType(byMediaType);
    renderTrend(trend);
    renderByGuestType(byGuestType);
  } catch (error) {
    console.error('Error updating charts:', error);
    if(window.showToast) showToast('ไม่สามารถโหลดข้อมูลกราฟได้', 'error');
  }
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
  }
}

function renderByBranch(data) {
  destroyChart('chartByBranch');
  const ctx = document.getElementById('chartByBranch').getContext('2d');
  
  chartInstances['chartByBranch'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.branchName),
      datasets: [{
        label: 'จำนวนรอบฉาย',
        data: data.map(d => d.count),
        backgroundColor: chartColors.bgOpacities[0],
        borderColor: chartColors.borderOpacities[0],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderByMediaType(data) {
  destroyChart('chartByMediaType');
  const ctx = document.getElementById('chartByMediaType').getContext('2d');
  
  chartInstances['chartByMediaType'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: chartColors.bgOpacities,
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      },
      cutout: '65%'
    }
  });
}

function renderTrend(data) {
  destroyChart('chartTrend');
  const ctx = document.getElementById('chartTrend').getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  chartInstances['chartTrend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'รอบฉาย',
        data: data.map(d => d.count),
        borderColor: chartColors.palette[0],
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: chartColors.palette[0],
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { borderDash: [4, 4] } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderByGuestType(data) {
  destroyChart('chartByGuestType');
  const ctx = document.getElementById('chartByGuestType').getContext('2d');
  
  chartInstances['chartByGuestType'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'จำนวนแขก',
        data: data.map(d => d.count),
        backgroundColor: chartColors.bgOpacities.slice(1),
        borderColor: chartColors.borderOpacities.slice(1),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { borderDash: [4, 4] } },
        x: { grid: { display: false } }
      }
    }
  });
}
