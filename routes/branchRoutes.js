const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');

router.get('/', branchController.getAll);
router.get('/pavalai-layout', branchController.getPavalaiLayout);

module.exports = router;

