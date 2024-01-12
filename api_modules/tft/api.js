module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle')
const oracledb = require('oracledb');

const ROUTE = 'tft';
var poolSizes = {};
var champions = {};

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

        // checking if the needed data is stored in memory
        let hasPoolSize = Object.keys(poolSizes).length > 0;
        let hasChampion = Object.keys(champions).includes(championName);

        // getting champion and pool size data from the database
        if(!hasPoolSize || !hasChampion){
            const oracleLogin = getOracleCredentials();
            const connection = await oracledb.getConnection(oracleLogin);
            var result = null;
            try{ 
                // getting pool sizes
                if(!hasPoolSize){
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
                }
                // champion data
                if(!hasChampion){
                    let sqlString2 = `
                    SELECT cost, trait_name
                    FROM champion_traits INNER JOIN champions 
                    USING (set_number, champion_name)
                    WHERE set_number=:setNumber AND champion_name=:championName 
                    `;
                    result = await connection.execute(sqlString2, {setNumber: setNumber, championName: championName}, {});
                    if(result.rows.length > 0){
                        champions[championName] = {traits: []};
                        champions[championName].cost = result.rows[0][0];
                        for(let championTrait of result.rows){
                            champions[championName].traits.push(championTrait[1]);
                        }
                    }
                    else
                        return res.status(404).send({message: 'Champion not found!'});
                }
            }
            catch(error){
                console.log(error);
            }
            finally{
                connection.close();
            }
    
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