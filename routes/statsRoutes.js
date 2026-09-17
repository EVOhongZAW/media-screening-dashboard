const express = require('express');
const router = express.Router();
const statsService = require('../services/statsService');

router.get('/overview-cinema', async (req, res, next) => {
    try {
        const data = await statsService.getOverviewCinema(req.query.screeningId);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.get('/summary', async (req, res, next) => {
    try {
        const data = await statsService.getSummary(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.get('/by-branch', async (req, res, next) => {
    try {
        const data = await statsService.getByBranch(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.get('/by-media-type', async (req, res, next) => {
    try {
        const data = await statsService.getByMediaType(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.get('/trend', async (req, res, next) => {
    try {
        const data = await statsService.getTrend(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.get('/by-guest-type', async (req, res, next) => {
    try {
        const data = await statsService.getByGuestType(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
