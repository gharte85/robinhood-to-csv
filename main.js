const electron = require('electron');
const {appUpdater} = require('./updater');
const fs = require('fs');
const url = require('url');
const path = require('path');
const robinhood = require(path.join(__dirname, 'assets/robinhood'));
const td = require(path.join(__dirname, 'assets/tradingdive'));
const Store = require('./store.js');
const dialog = electron.dialog;
const isDev = require('electron-is-dev');  // this is required to check if the app is running in development mode. 

const { app, BrowserWindow, ipcMain, ipcRenderer, shell } = electron;

let mainWindow;

// Funtion to check the current OS. As of now there is no proper method to add auto-updates to linux platform.
function isWindowsOrmacOS() {
	return process.platform === 'darwin' || process.platform === 'win32';
}

// Set environment
process.env.NODE_ENV = "production";

// Instantiate Store class for authentication tokens. 
// DO NOT store any usernames or passwords here
const store = new Store({
    configName: 'user-authentication',
    defaults: {
        rhToken: '',
        tdToken: ''
    }
});

// Store CSV Data
var _csvContent = null;

// Store current balance
var currentBalance = null;


// Listen for app to be ready
app.on('ready', function () {

    // Create new window
    mainWindow = new BrowserWindow({ width: 1024, height: 750, resizable: false});

    // load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'main.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.show();

        if (store.get('rhToken')) {

            // Set RH token for future API requests
            robinhood.setToken(store.get('rhToken'));

            // Send authentication success to main window
            mainWindow.webContents.send("authenticated", true);
        }

        if (store.get('tdToken')) {

            // Let main window know we're authenticated with Trading Dive
            mainWindow.webContents.send("tdAuthenticated", true);

            // Get User's portfolios
            td.getPortfolios(store.get('tdToken'), function (err, portfolios) {
                mainWindow.webContents.send("tdPortfolios", portfolios);
            });
        }

        mainWindow.webContents.send("finishedLoad", true);

        const checkOS = isWindowsOrmacOS();
        if (checkOS && !isDev) {
          // Initate auto-updates on macOs and windows
          appUpdater();
        }

    });
});


// Catch login events
ipcMain.on('robinhoodLogin', function (e, login) {

    // Authenticate with Robinhood and get trade history
    robinhood.authenticate(login, function (err, token) {
        if (err) {
            // Return Error
            mainWindow.webContents.send("error", err);
        } else {

            // Store RH token locally
            store.set('rhToken', token);

            // Set RH token for future API requests
            robinhood.setToken(store.get('rhToken'));

            // Send authentication success to main window
            mainWindow.webContents.send("authenticated", true);
        }
    });
});

ipcMain.on('tradingDiveLogin', function (e, login) {

    // Authenticate with Trading Dive
    td.authenticate(login.username, login.password, function (err, token) {
        if (err) {
            mainWindow.webContents.send("tdLoginError", err);
        } else {
            // Let main window know we're authenticated with Trading Dive
            mainWindow.webContents.send("tdAuthenticated", true);

            // Store TD token locally
            store.set('tdToken', token);

            // Get User's portfolios
            td.getPortfolios(token, function (err, portfolios) {
                mainWindow.webContents.send("tdPortfolios", portfolios);
            });
        }
    });
});

// Listen for get data events
ipcMain.on('getAll', function () {
    // Populate trade data
    _populateCSVData('all');
});

ipcMain.on('getRecent', function () {
    // Populate trade data
    _populateCSVData('recent');
});

// Listen for download CVS button click event
ipcMain.on('downloadCSV', function (e, download) {
    _saveFile();
});

ipcMain.on('tdSync', function (e, portfolio) {
    portfolio.currentValue =
        td.import(store.get('tdToken'), portfolio, _csvContent, function (e, status) {


            // Sync balance with portfolio
            robinhood.getBalance(store.get('rhToken'), function (err, balance) {
                portfolio.currentValue = parseFloat(balance);

                td.updatePortfolioBalance(store.get('tdToken'), portfolio, function () {
                    mainWindow.webContents.send("syncFinish", status);
                });
            });

            
        });
});

// Listen for logouts
ipcMain.on('rhLogout', function (e, download) {
    store.set('rhToken', '');
});

ipcMain.on('tdLogout', function (e, download) {
    store.set('tdToken', '');
});

function _populateCSVData(filter) {
    if (filter === 'all') {
        robinhood.getAllOrders(mainWindow, function (err, data) {
            _generateCSV(data);
            // Let main window know when file is finished generating
            mainWindow.webContents.send("csvReady", true);
        });
    } else {
        robinhood.getRecentOrders(function (err, data) {
            _generateCSV(data);
            // Let main window know when file is finished generating
            mainWindow.webContents.send("csvReady", true);
        });
    }
}

ipcMain.on('openRegisterPage', function () {
    shell.openExternal('https://app.tradingdive.com/users/register');
});

function _saveFile() {
    dialog.showSaveDialog({ filters: [{
        name: 'csv',
        extensions: ['csv']
      }] }, (fileName) => {
        if (fileName === undefined) {
            console.log("You didn't save the file");
            return;
        }

        // fileName is a string that contains the path and filename created in the save file dialog.  
        fs.writeFile(fileName, _csvContent, (err) => {
            if (err) {
                dialog.showMessageBox({
                    message: "There was an error saving your file.",

                    buttons: ["OK"]
                });
            }

            dialog.showMessageBox({
                message: "The file has been saved! :-)",

                buttons: ["OK"]
            });
        });
    });
}

function _generateCSV(data) {
    // Create CSV headers
    var csvContent = 'created,symbol,side,quantity,price,fees \r\n';

    // Loop through trades and create csv structure
    for (var i = 0; i < data.length; i++) {

        if (data[i].cumulative_quantity > 0)
            csvContent += data[i].created_at + ','
                + data[i].symbol + ','
                + data[i].side + ','
                + data[i].cumulative_quantity + ','
                + data[i].average_price + ','
                + data[i].fees
                + '\r\n';
    }
    _csvContent = csvContent;
}