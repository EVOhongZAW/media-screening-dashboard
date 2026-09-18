const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');
const { validateGuest, handleValidation } = require('../middleware/validator');

router.get('/', guestController.getAll);
router.get('/check-duplicates', guestController.checkDuplicates);

router.post('/', validateGuest, handleValidation, guestController.create);
router.post('/walk-in', guestController.walkIn);
router.post('/import', guestController.importBatch);
router.post('/bulk-delete', guestController.bulkDelete);
router.post('/restore-snapshot', guestController.restoreSnapshot);
router.post('/:id/check-in', guestController.checkIn);

router.put('/:id', guestController.update);
router.delete('/:id', guestController.remove);

module.exports = router;
