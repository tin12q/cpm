const express = require('express')
const router = express.Router()

const SiteController = require('../controller/SiteController')

router.get('/', SiteController.home)

module.exports = router