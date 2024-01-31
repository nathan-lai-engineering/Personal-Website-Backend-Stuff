module.exports = {loadModule};
const {getOracleCredentials} = require('../../utils/oracle');
const oracledb = require('oracledb');
const {humanTimeNow} = require('../../utils/time');

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

    /**
     * responds with the information of the whole set
     */
    createGet(":set", expressApp, async (req, res) => {
        let startTime = Date.now();

        // required parameters
        var setNumber = parseInt(req.params.set);

        // errors
        if(!dbReady)
            return res.status(503).send({message: 'Service unavailable: Still initializing service'});

        if(!(setNumber in champions) || !(setNumber in poolSizes))
            return res.status(404).send({message: 'Data not found: Set'});

        res.send(set(startTime, req.originalUrl, setNumber));
    });

    /**
     * responds with the information of a certain champion
     */
    createGet(":set/champ/:champion", expressApp, async (req, res) => {
        let startTime = Date.now();

        // required parameters
        var setNumber = parseInt(req.params.set);
        var championName = req.params.champion;

        // errors
        if(!dbReady)
            return res.status(503).send({message: 'Service unavailable: Still initializing service'});

        if(!(setNumber in champions) || !(setNumber in poolSizes))
            return res.status(404).send({message: 'Data not found: Set'});
        if(!(championName in champions[setNumber]))
            return res.status(404).send({message: 'Data not found: Champion'});

        // send the data back
        res.send(champion(startTime, req.originalUrl, setNumber, championName));
    });

    /**
     * responds with the information of a certain trait
     */
        createGet(":set/trait/:trait", expressApp, async (req, res) => {
            let startTime = Date.now();
    
            // required parameters
            var setNumber = parseInt(req.params.set);
            var traitName = req.params.trait;
    
            // errors
            if(!dbReady)
                return res.status(503).send({message: 'Service unavailable: Still initializing service'});
    
            if(!(setNumber in champions) || !(setNumber in poolSizes))
                return res.status(404).send({message: 'Data not found: Set'});
            
            // send the data back
            res.send(trait(startTime, req.originalUrl, setNumber, traitName));
        });

    /**
     * responds with the statistics of hitting a 3 star
     */
    createGet(":set/champ/:champion/3star", expressApp, async (req, res) => {
        let startTime = Date.now();

        // required parameters
        var setNumber = parseInt(req.params.set);
        var championName = req.params.champion;

        // optional parameters
        var level = parseInt(req.query.level) || 6;
        var championsHeld = parseInt(req.query.championsHeld) || 0;
        var championsAcquired = parseInt(req.query.championsAcquired) || 0;
        var chanceOfFreeRoll = parseFloat(req.query.chanceOfFreeRoll) || 0;
        var championDuplicators = parseInt(req.query.championDuplicators) || 0;

        // errors
        if(!dbReady)
            return res.status(503).send({message: 'Service unavailable: Still initializing service'});

        if(!(setNumber in champions) || !(setNumber in poolSizes))
            return res.status(404).send({message: 'Data not found: Set'});
        if(!(championName in champions[setNumber]))
            return res.status(404).send({message: 'Data not found: Champion'});

        if(level < 0 || level > 10)
            return res.status(403).send({message: 'Forbidden: Please enter a valid level range'});
        if(championsHeld < 0 || championsAcquired < 0 || championDuplicators < 0)
            return res.status(403).send({message: 'Forbidden: Please enter a non-negative integer'});
        if(chanceOfFreeRoll > 1 || chanceOfFreeRoll < 0)
            return res.status(403).send({message: 'Forbidden: Please enter a valid decimal percentage between 0.0 and 1.0'});
        if(championsHeld < championsAcquired)
            return res.status(403).send({message: 'Forbidden: You cannot hold more champions than what is collectively acquired'});

        // send the data back
        res.send(threestars(startTime, req.originalUrl, setNumber, championName, level, championsHeld, championsAcquired, chanceOfFreeRoll, championDuplicators));

    });
}

/**
 * wrapper just to make a little easier to read with logging too
 * @param {} name 
 * @param {*} app 
 * @param {*} func 
 */
function createGet(name, app, func){
    app.get(`/${ROUTE}/${name}`, (req, res) => {
        console.log('[%s] %s', humanTimeNow(), req.originalUrl);
        func(req,res);
    });
}

function set(startTime, url, setNumber){
    var responseObject = {};
    // put in some api info
    responseObject.info = {
        start: startTime,
        url: url,
        parameters: {
            setNumber: setNumber
        }
    };

    // times
    responseObject.info.end = Date.now();
    responseObject.info.duration = responseObject.info.end - responseObject.info.start;

    return responseObject;
}

function champion(startTime, url, setNumber, championName){
    var responseObject = {};
    // put in some api info
    responseObject.info = {
        start: startTime,
        url: url,
        parameters: {
            setNumber: setNumber,
            championName: championName
        }
    };

    // package the data up
    responseObject.championData = {
        championName: championName,
        championTraits: champions[setNumber][championName].traits,
        championCost: champions[setNumber][championName].cost
    };

    // times
    responseObject.info.end = Date.now();
    responseObject.info.duration = responseObject.info.end - responseObject.info.start;

    return responseObject;
}

function trait(startTime, url, setNumber, traitName){
    var responseObject = {};
    // put in some api info
    responseObject.info = {
        start: startTime,
        url: url,
        parameters: {
            setNumber: setNumber,
            traitName: traitName
        }
    };

    responseObject.traitData = {
        traitName: traitName,
        champions: []
    }

    // add the champion to list if they share a trait
    for(let championName in champions[setNumber]){
        if(champions[setNumber][championName].traits.includes(traitName.toLowerCase())){
            responseObject.traitData.champions.push({
                championName: championName,
                championTraits: champions[setNumber][championName].traits,
                championCost: champions[setNumber][championName].cost
            });
        }
    }

    // times
    responseObject.info.end = Date.now();
    responseObject.info.duration = responseObject.info.end - responseObject.info.start;

    return responseObject;
}

/**
 * Given parameters, simulates the average rolls for a certain 3-star, and returns an object for the response
 * @param {*} startTime 
 * @param {*} url 
 * @param {*} setNumber 
 * @param {*} championName 
 * @param {*} level 
 * @param {*} championsHeld 
 * @param {*} championsAcquired 
 * @param {*} chanceOfFreeRoll 
 * @param {*} championDuplicators 
 * @returns 
 */
function threestars(startTime, url, setNumber, championName, level, championsHeld, championsAcquired, chanceOfFreeRoll, championDuplicators){
    var responseObject = {};
    // put in some api info
    responseObject.info = {
        start: startTime,
        url: url,
        parameters: {
            setNumber: setNumber,
            championName: championName,
            championsHeld: championsHeld,
            championsAcquired: championsAcquired,
            chanceOfFreeRoll: chanceOfFreeRoll,
            championDuplicators: championDuplicators
        }
    };

    // variables for ease
    let cost = champions[setNumber][championName].cost;

    // set up the starter variables
    var championsAvailableBase = poolSizes[setNumber][cost];
    var championsPoolBase = calculateCostPool(setNumber, cost);

    // counter variables
    let championsAvailable = championsAvailableBase - championsHeld;
    let championsNeeded = 9 - championsAcquired - championDuplicators;

    // statistic variables
    var totalRolls = 0;
    var freeRolls = 0;
    var totalSimulations = 0;

    var currentShopChances = shopChances[setNumber][level];
    var currentChampion = champions[setNumber][championName];

    // checking if acquiring the champion is possible first
    var possibleThreeStar = (championsAvailable >= championsNeeded && currentChampion.cost in currentShopChances);
    if(possibleThreeStar){
        // run the simulations
        while(Date.now() <= responseObject.info.start + 5000){ // each iteration is a whole simulation
            totalSimulations++;

            // reset counter variables
            championsAvailable = championsAvailableBase - championsHeld;
            championsNeeded = 9 - championsAcquired - championDuplicators;
            var simChampionsHeld = championsHeld;

            let rollsLeft = 1;
            while(championsNeeded > 0 && championsAvailable >= championsNeeded && rollsLeft > 0){ // each iteration is a single roll of shop
                totalRolls++;
                rollsLeft--;

                // roll the chance of a free roll
                if(Math.random() < chanceOfFreeRoll){
                    rollsLeft++;
                    freeRolls++;
                }

                for(let i = 0; i < 5; i++){ // each iteration is a slot in shop

                    // calculate chance
                    let championsPool = championsPoolBase - simChampionsHeld;
                    let targetChance = championsAvailable / championsPool;

                    // roll the chance of getting cost
                    if(Math.random() < currentShopChances[cost]) {

                        // roll the chance of getting champion
                        if(Math.random() < targetChance){
                            simChampionsHeld++;
                            championsAvailable--;
                            championsNeeded--;
                        }
                    }
                }
                if(rollsLeft == 0){ // no more free rolls, reset the roll
                    rollsLeft = 1;
                }
            }
        }
    }

    
    // package the data up
    responseObject.championData = {
        championName: championName,
        championTraits: champions[setNumber][championName].traits,
        championCost: champions[setNumber][championName].cost
    };
    responseObject.stats = {
        total:{
            rolls: totalRolls,
            paidRolls: totalRolls - freeRolls,
            freeRolls: freeRolls,
            simulations: totalSimulations,
        },
        average: {
            rolls: totalRolls / totalSimulations,
            paidRolls: (totalRolls - freeRolls) / totalSimulations,
            freeRolls: freeRolls / totalSimulations
        },
        possibleThreeStar: possibleThreeStar,
        shopChance: shopChances[setNumber][level][cost],
    },

    // times
    responseObject.info.end = Date.now();
    responseObject.info.duration = responseObject.info.end - responseObject.info.start;

    return responseObject;
}

function calculateCostPool(setNumber, cost){
    var poolSize = 0;
    let targetCostChampions = Object.keys(champions[setNumber]).filter((championName) => champions[setNumber][championName].cost == cost);
    poolSize = targetCostChampions.length * poolSizes[setNumber][cost];
    return poolSize;
}