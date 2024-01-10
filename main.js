const express = require('express');
const {loadModule} = require('./api_modules/tft/api');

var app = express();

loadModule(app);

// port
var port = process.env.PORT || 3000;
app.listen(port);