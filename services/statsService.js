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
    
    let fullyAttendedCount = 0;
    let totalCheckedInSeats = 0;

    guests.forEach(g => {
        if (Array.isArray(g.seats) && g.seats.length > 0) {
            const checked = g.seats.filter(s => typeof s === 'object' ? s.checkedIn : false).length;
            totalCheckedInSeats += checked;
            if (checked >= g.seats.length) fullyAttendedCount++;
        } else {
            if (g.attended) fullyAttendedCount++;
            totalCheckedInSeats += g.attendedCount || (g.attended ? (parseInt(g.participant, 10) || 1) : 0);
        }
    });

    const attendedGuests = fullyAttendedCount;
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
        screeningsThisMonth,
        totalCheckedInSeats
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
    let totalSeats = 1164;

    if (screeningId) {
        const screenings = await readData('screenings.json');
        const sc = screenings.find(s => s.id === screeningId);
        if (sc && sc.capacity) {
            totalSeats = sc.capacity;
        }
        guests = guests.filter(g => g.screeningId === screeningId);
    }

    const totalGuests = guests.length;
    const totalParticipants = guests.reduce((sum, g) => sum + (parseInt(g.participant, 10) || 1), 0);

    let checkedInSeatsCount = 0;
    let fullyCheckedInGuests = 0;
    let partialCheckedInGuests = 0;

    guests.forEach(g => {
        if (Array.isArray(g.seats) && g.seats.length > 0) {
            const checked = g.seats.filter(s => typeof s === 'object' ? s.checkedIn : false).length;
            checkedInSeatsCount += checked;
            if (checked >= g.seats.length) {
                fullyCheckedInGuests++;
            } else if (checked > 0) {
                partialCheckedInGuests++;
            }
        } else {
            const attCount = g.attendedCount || (g.attended ? (parseInt(g.participant, 10) || 1) : 0);
            checkedInSeatsCount += attCount;
            const quota = parseInt(g.participant, 10) || 1;
            if (attCount >= quota && quota > 0) {
                fullyCheckedInGuests++;
            } else if (attCount > 0) {
                partialCheckedInGuests++;
            }
        }
    });

    const checkedIn = fullyCheckedInGuests;
    const checkedInTotal = fullyCheckedInGuests + partialCheckedInGuests;
    const pendingSign = Math.max(0, totalGuests - checkedInTotal);

    const bookedSeatsList = guests.flatMap(g => {
        if (Array.isArray(g.seats) && g.seats.length > 0) {
            return g.seats.map(s => typeof s === 'object' ? s.code : s);
        }
        return g.seat ? g.seat.split(',').map(s => s.trim()) : [];
    }).filter(Boolean);

    const bookedSeats = bookedSeatsList.length;
    const assignedGuests = guests.filter(g => (Array.isArray(g.seats) && g.seats.length > 0) || (g.seat && g.seat.trim() !== '')).length;
    const unassignedGuests = totalGuests - assignedGuests;

    const checkInRate = totalGuests > 0 ? Math.round((checkedInTotal / totalGuests) * 100) : 0;
    const seatOccupancyRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

    return {
        totalGuests,
        totalParticipants,
        checkedIn,
        checkedInTotal,
        fullyCheckedInGuests,
        partialCheckedInGuests,
        checkedInSeatsCount,
        pendingSign,
        bookedSeats,
        totalSeats,
        assignedGuests,
        unassignedGuests,
        checkInRate,
        seatOccupancyRate
    };
};

