module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle')
const oracledb = require('oracledb');

const ROUTE = 'tft';
var poolSizes = {};
var champions = {};
var shopChances = {};

var dbReady = false;

function loadModule(expressApp){
    const oracleLogin = getOracleCredentials();
    const VARIABLES = 3;
    var variablesLoaded = 0;
    oracledb.getConnection(oracleLogin).then(async (connection) => {
        try{
            connection.execute('SELECT set_number, cost, pool_size FROM pool_sizes', {}, {}).then(res => {
                if(res){
                    for(let row of res.rows){
                        let setNumber = row[0];
                        let cost = row[1];
                        if(!(setNumber in poolSizes))
                            poolSizes[setNumber] = {};
                        poolSizes[setNumber][cost] = row[2];
                    }
                    variablesLoaded++;
                    if(variablesLoaded >= VARIABLES)
                        dbReady = true;
                }
            });

            connection.execute(`SELECT set_number, champion_name, cost, trait_name
            FROM tft_sets INNER JOIN champions USING (set_number)
            INNER JOIN champion_traits USING(set_number, champion_name)`, {}, {}).then(res => {
                if(res){
                    // set_number, champion_name, cost, trait_name
                    // caching all the data
                    for(let row of res.rows){
                        let setNumber = row[0];
                        let championName = row[1];

                        if(!(setNumber in champions))
                            champions[setNumber] = {};
                        if(!(championName in champions[setNumber]))
                            champions[setNumber][championName] = {traits: []};
                        champions[setNumber][championName].cost = row[2];
                        champions[setNumber][championName].traits.push(row[3]);
                    }
                    variablesLoaded++;
                    if(variablesLoaded >= VARIABLES)
                        dbReady = true;
                }
            });

            
            connection.execute('SELECT set_number, shop_level, cost, chance FROM shop_chances', {}, {}).then(res => {
                if(res){
                    for(let row of res.rows){
                        let setNumber = row[0];
                        let level = row[1];
                        if(!(setNumber in shopChances))
                            shopChances[setNumber] = {};
                        if(!(level in shopChances[setNumber]))
                            shopChances[setNumber][level] = {};
                        shopChances[setNumber][level][parseInt(row[2])] = parseFloat(row[3]);
                    }

                    variablesLoaded++;
                    if(variablesLoaded >= VARIABLES)
                        dbReady = true;
                }
            });
            
        }
        catch(error){

        }
        finally {
            connection.close();
        }
    });



    createGet(":set/:champion/3star/:level/", expressApp, async (req, res) => {
        // the response object
        var responseObject = {info:{time:{}}, data:{}};
        responseObject.info.time.start = Date.now();

        // required parameters
        var setNumber = parseInt(req.params.set);
        var championName = req.params.champion;
        var level = req.params.level;

        // optional parameters
        var championsHeld = parseInt(req.query.championsHeld) || 0;
        var championsAcquired = parseInt(req.query.championsAcquired) || 0;
        var chanceOfFreeRoll = parseFloat(req.query.chanceOfFreeRoll) || 0;
        var championDuplicators = parseInt(req.query.championDuplicators) || 0;

        if(!dbReady)
            return res.status(503).send({message: 'Not finished starting up, try again later!'});
        if(!(setNumber in champions) || !(setNumber in poolSizes))
            return res.status(404).send({message: 'Set not found'});
        if(!(championName in champions[setNumber]))
            return res.status(404).send({message: 'Champion not found'});
        if(level < 0 || level > 10)
            return res.status(404).send({message: 'Level not found'});

        responseObject.info.request = {
            url: req.originalUrl,
            parameters: {
                setNumber: setNumber,
                championName: championName,
                championsHeld: championsHeld,
                championsAcquired: championsAcquired,
                chanceOfFreeRoll: chanceOfFreeRoll,
                championDuplicators: championDuplicators
            }
        };

        var championsAvailableBase = poolSizes[setNumber][champions[setNumber][championName].cost];
        var championsPoolBase;
        var totalRolls = 0;
        var totalSimulations = 0;

        
        while(Date.now() <= responseObject.info.time.start + 5000){
            totalSimulations++;

            let championsAvailable = championsAvailableBase - championsHeld;
            let championsNeeded = 9 - championsAcquired - championDuplicators;

            while(championsNeeded < 9){
                championsNeeded++;
            }
        }
        

        responseObject.data = {
            championName: championName,
            championData: champions[setNumber][championName],
            stats: {
                totalRolls: totalRolls,
                totalSimulations: totalSimulations
            },
            shopChances: shopChances[setNumber][level],
            averageRolls: totalRolls / totalSimulations
        };

        // times
        responseObject.info.time.end = Date.now();
        responseObject.info.time.duration = responseObject.info.time.end - responseObject.info.time.start;

        // send the data back
        res.send(responseObject);

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