const http = require('http');
const https = require('https');
const request = require('request');
const path = require('path');
var querystring = require('querystring');

// For local development getting around certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

module.exports = {
    authenticate: function (username, password, callback) {
        request({
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            uri: 'https://app.tradingdive.com/users/authenticate',
            body: 'username=' + username + '&password=' + password,
            method: 'POST'
        }, function (err, res, body) {
            if (err) {
                console.log(err)
                callback(err, null);
            } else {
                var response = JSON.parse(body);
                if (response.status === 401) {
                    callback(response.message, null);
                } else {
                    callback(err, response.token);
                }
            }

        });
    },
    getPortfolios: function (token, callback) {
        request({
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'X-Access-Token': token
            },
            uri: 'https://app.tradingdive.com/api/v1/account',
            method: 'GET'
        }, function (err, res, body) {
            if (err) {
                callback(err, null);
            } else {
                var response = JSON.parse(body);
                if (response.status === 401) {
                    callback(response.message, null);
                } else {
                    callback(err, response.portfolios);
                }
            }
        });
    },
    // Sync portfolio's balance with Robinhood
    updatePortfolioBalance: function (token, portfolio, callback) {
        var data = { 
            "portfolio": portfolio,
            "broker": "robinhood"
        };

        function update() {
            request({
                headers: {
                    "content-type": "application/json",
                    'X-Access-Token': token
                },
                uri: 'https://app.tradingdive.com/api/v1/update-portfolio',
                json: data,
                method: 'POST'
            }, function (err, res, body) {
                if(body.importStatus.inProgress) {
                    update();
                } else {
                    if (err) {
                        callback(err, null);
                    } else {                
                        if (body.status === 401) {
                            callback(body.message, null);
                        } else {
                            callback(err, body);
                        }
                    }
                }
            });
        }
        
        update();
    },
    // Import users trades to Trading Dive
    import: function (token, portfolio, csv, callback) {
        var data = {
            import: {
                broker: 'robinhood',
                email: null,
                portfolio: portfolio,
                csv: csv
            }
        }

        request({
            headers: {
                "content-type": "application/json",
                'X-Access-Token': token
            },
            json: data,
            uri: 'https://app.tradingdive.com/api/v1/import-trades',
            method: 'POST'
        }, function (err, res, body) {
            if(err) {
                callback(err, null);
            } else {
                callback(null, body);
            }
        });
    }
}