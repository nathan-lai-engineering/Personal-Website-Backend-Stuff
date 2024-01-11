module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle')
const oracledb = require('oracledb');

const ROUTE = 'tft';

function loadModule(expressApp){
    createGet(":set/:champion/3star", expressApp, async (req, res) => {
        // optional parameters
        var championsHeld = req.query.championsHeld || "";
        var championsAcquired = req.query.championsAcquired || "";
        var chanceOfFreeRoll = req.query.chanceOfFreeRoll || "";
        var championDuplicators = req.query.championDuplicators || "";

        const oracleLogin = getOracleCredentials();
        const connection = await oracledb.getConnection(oracleLogin);
        try{
            let sqlString = `
            SELECT cost, pool_size
            FROM pool_sizes
            WHERE set_number=:set_number
            `;
            result = await connection.execute(sqlString, {set_number: req.params.set}, {});
            let poolSize = result.data;
            console.log(poolSize);
            console.log(poolSize[0]);
        }
        catch(error){
            console.log(error);
        }
        finally{
            connection.close();
        }

        res.send(`received ${req.params.set} and ${req.params.champion}, optional: ${championsHeld} ${championsAcquired} ${chanceOfFreeRoll} ${championDuplicators}`);

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