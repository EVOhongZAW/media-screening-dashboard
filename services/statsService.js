const { readData } = require('./dataService');

const mediaTypeLabels = {
    movie: 'ภาพยนตร์',
    documentary: 'สารคดี',
    ad: 'โฆษณา',
    event: 'อีเวนต์'
};

const guestTypeLabels = {
    press: 'สื่อมวลชน',
    influencer: 'อินฟลูเอนเซอร์',
    vip: 'VIP',
    guest: 'แขกรับเชิญ'
};

async function getFilteredData(filters) {
    let screenings = await readData('screenings.json');
    let guests = await readData('guests.json');

    const { branchId, mediaType, dateFrom, dateTo, status } = filters;

    if (branchId) screenings = screenings.filter(s => s.branchId === branchId);
    if (mediaType) screenings = screenings.filter(s => s.mediaType === mediaType);
    if (dateFrom) screenings = screenings.filter(s => s.date >= dateFrom);
    if (dateTo) screenings = screenings.filter(s => s.date <= dateTo);
    if (status) screenings = screenings.filter(s => s.status === status);

    const screeningIds = new Set(screenings.map(s => s.id));
    guests = guests.filter(g => screeningIds.has(g.screeningId));

    return { screenings, guests };
}

exports.getSummary = async (filters) => {
    const { screenings, guests } = await getFilteredData(filters);

    const totalScreenings = screenings.length;
    const totalGuests = guests.length;
    
    const attendedGuests = guests.filter(g => g.attended).length;
    const attendanceRate = totalGuests > 0 ? (attendedGuests / totalGuests) * 100 : 0;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const screeningsThisMonth = screenings.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    }).length;

    return {
        totalScreenings,
        totalGuests,
        attendanceRate: parseFloat(attendanceRate.toFixed(2)),
        screeningsThisMonth
    };
};

exports.getByBranch = async (filters) => {
    const { screenings } = await getFilteredData(filters);
    const branches = await readData('branches.json');
    
    const counts = screenings.reduce((acc, curr) => {
        acc[curr.branchId] = (acc[curr.branchId] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(counts).map(([branchId, count]) => {
        const branch = branches.find(b => b.id === branchId);
        return {
            branchName: branch ? branch.name : 'Unknown',
            count
        };
    }).sort((a, b) => b.count - a.count);
};

exports.getByMediaType = async (filters) => {
    const { screenings } = await getFilteredData(filters);
    
    const counts = screenings.reduce((acc, curr) => {
        acc[curr.mediaType] = (acc[curr.mediaType] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(counts).map(([type, count]) => ({
        mediaType: mediaTypeLabels[type] || type,
        count
    })).sort((a, b) => b.count - a.count);
};

exports.getTrend = async (filters) => {
    const { screenings } = await getFilteredData(filters);
    
    const monthlyCounts = screenings.reduce((acc, curr) => {
        const month = curr.date.substring(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(monthlyCounts)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
};

exports.getByGuestType = async (filters) => {
    const { guests } = await getFilteredData(filters);
    
    const counts = guests.reduce((acc, curr) => {
        acc[curr.guestType] = (acc[curr.guestType] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(counts).map(([type, count]) => ({
        guestType: guestTypeLabels[type] || type,
        count
    })).sort((a, b) => b.count - a.count);
};

exports.getOverviewCinema = async (screeningId) => {
    let guests = await readData('guests.json');
    let totalSeats = 60;

    if (screeningId) {
        const screenings = await readData('screenings.json');
        const sc = screenings.find(s => s.id === screeningId);
        if (sc && sc.capacity) {
            totalSeats = sc.capacity;
        }
        const matchingGuests = guests.filter(g => g.screeningId === screeningId);
        if (matchingGuests.length > 0) {
            guests = matchingGuests;
        }
    }

    const totalGuests = guests.length;
    const accepted = guests.filter(g => g.status === 'accepted').length;
    const pending = guests.filter(g => g.status === 'pending').length;
    const declined = guests.filter(g => g.status === 'declined').length;

    const bookedSeatsList = guests.flatMap(g => g.seat ? g.seat.split(',').map(s => s.trim()) : []).filter(Boolean);
    const bookedSeats = bookedSeatsList.length;

    const platforms = {
        youtube: guests.filter(g => g.platforms && g.platforms.youtube).length,
        tiktok: guests.filter(g => g.platforms && g.platforms.tiktok).length,
        facebook: guests.filter(g => g.platforms && g.platforms.facebook).length,
        instagram: guests.filter(g => g.platforms && g.platforms.instagram).length
    };

    return {
        totalGuests,
        accepted,
        pending,
        declined,
        bookedSeats,
        totalSeats,
        platforms
    };
};

