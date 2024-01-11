module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle')
const oracledb = require('oracledb');

const ROUTE = 'tft';

function loadModule(expressApp){
    createGet(":set/:champion/3star", expressApp, async (req, res) => {
        // required parameters
        var setNumber = parseInt(req.params.set);
        var championName = req.params.champion;

        // optional parameters
        var championsHeld = req.query.championsHeld || "";
        var championsAcquired = req.query.championsAcquired || "";
        var chanceOfFreeRoll = req.query.chanceOfFreeRoll || "";
        var championDuplicators = req.query.championDuplicators || "";

        const oracleLogin = getOracleCredentials();
        const connection = await oracledb.getConnection(oracleLogin);
        var result = null;
        try{
            var poolSizes = {};
            var champion = {name: championName, traits: []};

            // getting pool sizes
            let sqlString = `
            SELECT cost, pool_size
            FROM pool_sizes
            WHERE set_number=:setNumber
            `;
            result = await connection.execute(sqlString, {setNumber: setNumber}, {});
            if(result.rows.length > 0){
                for(let poolSize of result.rows){
                    poolSizes[poolSize[0]] = poolSize[1];
                }
            }
            else
            return res.status(404).send({message: 'Set not found!'});


            // champion data
            let sqlString2 = `
            SELECT cost, trait_name
            FROM champion_traits INNER JOIN champions 
            USING (set_number, champion_name)
            WHERE set_number=:setNumber AND champion_name=:championName 
            `;
            result = await connection.execute(sqlString2, {setNumber: setNumber, championName: championName}, {});
            if(result.rows.length > 0){
                champion.cost = result.rows[0][0];
                for(let championTrait of result.rows){
                    champion.traits.push(championTrait[1]);
                }
            }
            else
                return res.status(404).send({message: 'Champion not found!'});
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