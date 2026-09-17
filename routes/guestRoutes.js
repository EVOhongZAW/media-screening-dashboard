const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');
const { validateGuest, handleValidation } = require('../middleware/validator');

router.get('/', guestController.getAll);
router.post('/', validateGuest, handleValidation, guestController.create);
router.put('/:id', guestController.update);
router.delete('/:id', guestController.remove);

module.exports = router;
