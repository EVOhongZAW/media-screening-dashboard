const express = require('express');
const router = express.Router();
const seatController = require('../controllers/seatController');

router.post('/assign', seatController.assign);
router.post('/move', seatController.move);
router.post('/move-partial', seatController.movePartial);
router.post('/release', seatController.release);
router.post('/recommend-groups', seatController.recommendGroups);
router.get('/suggestions', seatController.getSuggestions);
router.get('/status-all', seatController.getAllStatus);
router.post('/auto-assign', seatController.autoAssign);

module.exports = router;
