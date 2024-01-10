module.exports = {loadModule};

const ROUTE = 'tft';

function loadModule(expressApp){
    createGet(":set/:champion/3star", expressApp, (req, res) => {
        var championsHeld = req.query.championsHeld || "";
        var championsAcquired = req.query.championsAcquired || "";
        var chanceOfFreeRoll = req.query.chanceOfFreeRoll || "";

        res.send(`received ${req.params.set} and ${req.params.champion}, optional: ${championsHeld} ${championsAcquired} ${chanceOfFreeRoll}`);

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