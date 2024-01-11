const oracledb = require('oracledb');
const fs = require('fs');

module.exports = {oracleQuery, getOracleCredentials}

/**
 * Method for basic wrapping oracle connection and query
 * @param {*} sqlString 
 * @param {*} binds 
 * @param {*} config 
 * @returns 
 */
async function oracleQuery(sqlString, binds=[], config={}){
    const oracleLogin = getOracleCredentials();
    const connection = await oracledb.getConnection(oracleLogin);

    var result = null
    try{
        oracledb.fetchAsBuffer = [oracledb.BLOB];
        result = await connection.execute(sqlString, binds, config);
    }
    catch(error){
        console.error(error);
    }
    finally{
        connection.close();
    }
    return result;
}

/**
 * Uses either a local json file or the environment variables for Oracle login information
 * @returns 
 */
function getOracleCredentials(){
    let localPath = './oracledb.json'; // this is exclusively for local computer dev testing
    let dbLogin = null;
    if(fs.existsSync(localPath)){
        dbLogin = require(`.${localPath}`);
    }
    else {
        dbLogin = { // using environment variables for HEROKU hosting
            "user": process.env.oracle_user,
            "password": process.env.oracle_password,
            "configDir": process.env.oracle_directory,
            "walletLocation": process.env.oracle_directory,
            "walletPassword": process.env.oracle_wallet_password,
            "connectString": process.env.oracle_connect_string
        };
    }
    return dbLogin;
}

