# robinhood-to-csv
Connect to your Robinhood account and export your trading history as a csv file. This app is also compatible with [Trading Dive](https://tradingdive.com). After connecting with Robinhood you can automatically upload your trades to start tracking your performance.

You can read about how to use the app on my [blog](https://tradingdive.com/how-to-export-robinhood-trades-to-a-csv/).

## Important Note
I don’t have official developer certificates from Apple and Microsoft so after downloading and running the app, you will get a security alert that the app is not from an approved developer. In order to use it you will need to approve the app. If you haven’t done this yet, you can read how to do it for [windows](https://www.addictivetips.com/windows-tips/stop-windows-10-from-asking-for-admin-rights-to-run-unknown-apps/) and [mac](https://www.howtogeek.com/205393/gatekeeper-101-why-your-mac-only-allows-apple-approved-software-by-default/).

## Installation
```bash
npm install
```

## Build for Windows and Mac
```bash
npm run dist
```

## Build for Linux
```bash
npm run package-linux
```