const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');

router.get('/', branchController.getAll);

module.exports = router;
