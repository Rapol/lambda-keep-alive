'use strict';

const request = require('request-promise');
const test = require('./test.json');
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});

const config = require('./config.json');
require('./env')(config);


module.exports.handler = (event, context, callback) => {

    if (!test || !test.url || test.endpoints === null || test.endpoints.length === 0) {
        callback(new Error("Test config not properly formatted", test));
    }
    console.log(config);

    let promises = test.endpoints.map((endpoint) => {
        var options = {
            method: endpoint.method,
            uri: `${test.url}/${process.env.stage || 'dev'}/${endpoint.name}`,
            body: endpoint.body,
            json: true,
            simple: false,
            resolveWithFullResponse: true,
            time: true,
            timeout: test.timeout
        };
        console.log(options);
        return request(options);
    });

    Promise.all(promises)
        .then((results) => {
            let dynamoRequests = results.map((result, i) => {
                return putItem(parseResponseToDynamo(result, i))
            });
            return Promise.all(dynamoRequests);
        })
        .then(() => callback)
        .catch((err) => {
            callback(err)
        })
};

function parseResponseToDynamo(result, i) {
    return {
        endpoint: {"S": result.request.uri.path.replace(`/${process.env.stage}/`, "")},
        timestamp: {"N": Date.now().toString()},
        error: {"BOOL": (test.endpoints[i].status != result.statusCode)},
        status: {"S": result.statusCode.toString()},
        responseTime: {"S": result.elapsedTime.toString()},
        body: {"S": JSON.stringify(result.body)}
    }
}

function putItem(item) {
    return new Promise((resolve, reject) => {
        let params = {
            "TableName": process.env.stage + "-" + process.env.tableName,
            "Item": item
        };
        console.log(params);
        dynamoDB.putItem(params, function (err, result) {
            if (err)
                return reject(err);
            resolve();
        });
    })
}