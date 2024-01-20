module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle')
const oracledb = require('oracledb');

const ROUTE = 'tft';
var poolSizes = {};
var champions = {};

var dbReady = false;

function loadModule(expressApp){
    const oracleLogin = getOracleCredentials();
    var variablesLoaded = 0;
    oracledb.getConnection(oracleLogin).then(connection => {
        try{
            connection.execute('SELECT * FROM pool_sizes', {}, {}).then(res => {
                if(res){
                    for(let row of res.rows){
                        let setNumber = row[0];
                        let cost = row[1];
                        if(!(setNumber in poolSizes))
                            poolSizes[setNumber] = {};
                        poolSizes[setNumber][cost] = row[2];
                    }
                    variablesLoaded++;
                    if(variablesLoaded >= 2)
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
                    if(variablesLoaded >= 2)
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



    createGet(":set/:champion/3star", expressApp, async (req, res) => {
        // the response object
        var responseObject = {info:{time:{}}, data:{}};
        responseObject.info.time.start = Date.now();

        // required parameters
        var setNumber = parseInt(req.params.set);
        var championName = req.params.champion;

        // optional parameters
        var championsHeld = parseInt(req.query.championsHeld) || 0;
        var championsAcquired = parseInt(req.query.championsAcquired) || 0;
        var chanceOfFreeRoll = parseFloat(req.query.chanceOfFreeRoll) || 0;
        var championDuplicators = parseInt(req.query.championDuplicators) || 0;

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

        if(!(setNumber in champions) || !(setNumber in poolSizes))
            return res.status(404).send({message: 'Set not found!'});
        if(!(championName in champions[setNumber]))
            return res.status(404).send({message: 'Champion not found!'});
        if(!dbReady)
            return res.status(503).send({message: 'Not finished starting up, try again later!'});
        
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