const API = {
  async fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async postJSON(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async putJSON(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteJSON(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Branches
  getBranches() { return this.fetchJSON('/api/branches'); },

  // Screenings
  getScreenings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/screenings${query ? '?' + query : ''}`);
  },
  getScreening(id) { return this.fetchJSON(`/api/screenings/${id}`); },
  createScreening(data) { return this.postJSON('/api/screenings', data); },
  updateScreening(id, data) { return this.putJSON(`/api/screenings/${id}`, data); },
  deleteScreening(id) { return this.deleteJSON(`/api/screenings/${id}`); },

  // Guests
  getGuests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/guests${query ? '?' + query : ''}`);
  },
  createGuest(data) { return this.postJSON('/api/guests', data); },
  updateGuest(id, data) { return this.putJSON(`/api/guests/${id}`, data); },
  deleteGuest(id) { return this.deleteJSON(`/api/guests/${id}`); },

  // Stats
  getStatsSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/stats/summary${query ? '?' + query : ''}`);
  },
  getStatsByBranch(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/stats/by-branch${query ? '?' + query : ''}`);
  },
  getStatsByMediaType(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/stats/by-media-type${query ? '?' + query : ''}`);
  },
  getStatsTrend(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/stats/trend${query ? '?' + query : ''}`);
  },
  getStatsByGuestType(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJSON(`/api/stats/by-guest-type${query ? '?' + query : ''}`);
  },
  getOverviewCinema() {
    return this.fetchJSON('/api/stats/overview-cinema');
  }
};
