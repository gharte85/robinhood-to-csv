const http = require('http');
const https = require('https');
const request = require('request');
const path = require('path');
var _token = '';

module.exports = {
    // Authenticate with Robinhood API and get authentication token
    authenticate: function (credentials, callback) {
        var credentials = {
            username: credentials.username,
            password: credentials.password
        };

        var Robinhood = require('robinhood')(credentials, function () {

            //Robinhood is connected and you authenticated. Begin sending commands to the api.
            if (Robinhood.auth_token()) {
                callback(null, Robinhood.auth_token());
            } else {
                //Invalid login
                callback("Invalid username or password", null);
            }
        });
    },

    // Set token if user has previously logged in
    setToken: function (token) {
        _token = token;

        var Robinhood = require('robinhood')({ "token": token }, function () {
            Robinhood.setToken(token);
        });
    },

    // Gets all trades
    getAllOrders: function (mainWindow, callback) {
        // Tell Robinhood to paginate through all trades
        var nextUri = null;
        var results = [];

        function next() {
            request({
                headers: {
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate',
                    'Accept-Language': 'en;q=1, fr;q=0.9, de;q=0.8, ja;q=0.7, nl;q=0.6, it;q=0.5',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                    'Connection': 'keep-alive',
                    'X-Robinhood-API-Version': '1.152.0',
                    'User-Agent': 'Robinhood/5.32.0 (com.robinhood.release.Robinhood; build:3814; iOS 10.3.3)',
                    'json': true,
                    'gzip': true,
                    'Authorization': 'Token ' + _token
                },
                uri: nextUri ? nextUri : 'https://api.robinhood.com/orders/',
                method: 'GET'
            }, function (err, res, body) {

                if (err) {
                    if (typeof body === 'string') {
                        var err = JSON.parse(err);
                        callback(err, null);
                    } else {
                        callback(err, null);
                    }
                }

                if (typeof body === 'string') {
                    var data = JSON.parse(body);
                } else {
                    var data = body;
                }

                nextUri = data.next;

                if (data.next) {
                    var count = data.results.length;

                    for (var i = 0; i < data.results.length; i++) {
                        module.exports.getInstrument(data.results[i].instrument, i, function (e, symbol, index) {
                            count--;
                            
                            if(!e && symbol) {
                                data.results[index].symbol = symbol;
                            }

                            results.push(data.results[index]);

                            if (count === 0) {
                                next();
                            }
                        });
                    }
                } else {
                    if (results > 0) {
                        data.results = results;
                        callback(null, data.results);
                    } else {
                        var count = data.results.length;

                        for (var i = 0; i < data.results.length; i++) {
                            module.exports.getInstrument(data.results[i].instrument, i, function (e, symbol, index) {
                                count--;

                                if(!e && symbol) {
                                    data.results[index].symbol = symbol;
                                }
                                
                                results.push(data.results[index]);

                                if (count === 0) {
                                    callback(null, results);
                                }
                            });
                        }
                    }
                }
            });
        }

        next();

    },

    // Get Account Balance to sync with portfolio
    getBalance(token, callback) {
        request({
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en;q=1, fr;q=0.9, de;q=0.8, ja;q=0.7, nl;q=0.6, it;q=0.5',
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                'Connection': 'keep-alive',
                'X-Robinhood-API-Version': '1.152.0',
                'User-Agent': 'Robinhood/5.32.0 (com.robinhood.release.Robinhood; build:3814; iOS 10.3.3)',
                'json': true,
                'gzip': true,
                'Authorization': 'Token ' + token
            },
            uri: 'https://api.robinhood.com/accounts/',
            method: 'GET'
        }, function (err, res, body) {
            if (typeof body === 'string') {
                var data = JSON.parse(body);
            } else {
                var data = body;
            }

            request({
                headers: {
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate',
                    'Accept-Language': 'en;q=1, fr;q=0.9, de;q=0.8, ja;q=0.7, nl;q=0.6, it;q=0.5',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                    'Connection': 'keep-alive',
                    'X-Robinhood-API-Version': '1.152.0',
                    'User-Agent': 'Robinhood/5.32.0 (com.robinhood.release.Robinhood; build:3814; iOS 10.3.3)',
                    'json': true,
                    'gzip': true,
                    'Authorization': 'Token ' + token
                },
                uri: data.results[0].portfolio,
                method: 'GET'
            }, function (e, res, b) {
                if (typeof body === 'string') {
                    var data = JSON.parse(b);
                } else {
                    var data = b;
                }
                if (e) {
                    callback(e, null);
                } else {
                    callback(null, data.last_core_equity);
                }
            });
        });
    },

    // Get only recent trades
    getRecentOrders(callback) {
        var Robinhood = require('robinhood')({ "token": _token }, function () {
            // Grab trades
            Robinhood.orders(function (err, response, body) {
                if (err) {
                    callback(err, null);
                } else {
                    var count = body.results.length;
                    
                    for (var i = 0; i < body.results.length; i++) {
                        module.exports.getInstrument(body.results[i].instrument, i, function (e, symbol, index) {
                            count--;

                            if(!e && symbol) {
                                body.results[index].symbol = symbol;
                            }

                            if (count == 0) {
                                callback(null, body.results);
                            }
                        });
                    }

                }
            });
        });
    },

    //Get instrument symbol
    getInstrument: function (url, index, callback) {
        request(
            {
                headers: {
                    "content-type": "application/json"
                },
                uri: url,
                method: 'GET'
            },
            function (err, res, body) {
                if(err) {
                    callback(err, null, index);
                } else {
                    if(typeof body === 'string') {
                        var data = JSON.parse(body);
                        callback(null, data.symbol, index);
                    } else {
                        var data = body;
                        callback(null, data.symbol, index);
                    }
                }
            });
    }
}