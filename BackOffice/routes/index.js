var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('index', {
    title: 'PAW Project',
    user: req.user || null
  });
});

module.exports = router;
