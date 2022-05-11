require('dotenv').config();

// const ccxt = require('ccxt');
const axios = require('axios');

const conf = require('./getConf');


const Binance = require('node-binance-api');
const binance = new Binance().options({
    APIKEY: process.env.API_KEY,
    APISECRET: process.env.API_SECRET
});

const init = async () => {

    const { asset, base, allocation, spread, tickInterval } = conf;
    const market = `${asset}${base}`;

    const tick = async () => {
        let ticker = await binance.bookTickers('BTCUSDT');

        binance.prices('BTCUSDT', (error, ticker) => {
            console.info("Price of BTC: ", ticker.BTCUSDT);
        });

        binance.bookTickers('BTCUSDT', (error, ticker) => {
            console.info("bookTickers", ticker);
        });
        const results = await Promise.all([
            axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
            axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')
        ]);
        const geckoPrice = results[0].data.bitcoin.usd / results[1].data.tether.usd;
        console.log(`Price of BTC from Coingecko: ${geckoPrice}`);


        //cancelling previously open orders before opening a new order
        const orders = await binance.openOrders("BTCUSDT");
        orders.forEach(async order => {
            await binance.cancel(order.id);
        });


        const sellPrice = ticker.askPrice * (1 + spread);
        const buyPrice = ticker.bidPrice * (1 - spread);
        const balances = await binance.balance();
        const assetBalance = balances.BTC.available;
        const baseBalance = balances.USDT.available;
        const sellVolume = assetBalance * allocation;
        const buyVolume = (baseBalance * allocation) / sellPrice;

        // Placing limit orders
        // await binance.buy("BTCUSDT", buyVolume, buyPrice);
        // await binance.sell("BTCUSDT", sellVolume, sellPrice);

        await binance.buy("BTCUSDT", buyVolume, buyPrice, { type: 'LIMIT' }, (error, response) => {
            console.info("Limit Buy response", response);
            console.info("order id: " + response.orderId);
        });
        await binance.sell("BTCUSDT", sellVolume, sellPrice, { type: 'STOP' }, (error, response) => {
            console.info("Limit Sell response", response);
            console.info("order id: " + response.orderId);
        });

        // await binance.createLimitSellOrder("BTCUSDT", sellVolume, sellPrice);
        // await binance.createLimitBuyOrder("BTCUSDT", buyVolume, buyPrice);

        console.log(`
        New tick for ${market} ...
        Created limit sell order for ${sellVolume}@${sellPrice}
        Created limit buy order for ${buyVolume}@${buyPrice}
    `)


    }

    // tick();
    // setInterval(tick, tickInterval);
    tick(conf, binance);
    setInterval(tick, tickInterval, conf, binance);

}

init();


