const express = require('express');
const router = express.Router();
const screeningController = require('../controllers/screeningController');
const { validateScreening, handleValidation } = require('../middleware/validator');

router.get('/', screeningController.getAll);
router.get('/:id', screeningController.getById);
router.post('/', validateScreening, handleValidation, screeningController.create);
router.put('/:id', screeningController.update);
router.delete('/:id', screeningController.remove);

module.exports = router;
