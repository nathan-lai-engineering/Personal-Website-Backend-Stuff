module.exports = {loadModule};

const ROUTE = 'tft';

function loadModule(expressApp){
    createGet("3star/:set/:champion", expressApp, (req, res) => {
        res.send(`received ${request.params.set} and ${request.params.champion}`);
    });
}

/**
 * wrapper just to make a little easier to read
 * @param {} name 
 * @param {*} app 
 * @param {*} func 
 */
function createGet(name, app, func){
    app.get(`/${ROUTE}/${name}`, func);
}