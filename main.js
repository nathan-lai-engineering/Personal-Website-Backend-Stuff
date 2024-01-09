const express = require('express');

var app = express();

app.get('/hello', (req, res) => {
    res.send('hello world');
});

// port
var port = process.env.PORT || 3000;
app.listen(port);