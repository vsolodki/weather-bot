import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';
import schedule from 'node-schedule';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY as string;
const NEWS_API_KEY = process.env.NEWS_API_KEY as string;
const EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY as string;
const BITCOIN_RATE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=czk';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userChats: Record<number, number> = {};

const getWeather = async (city: string = 'Prague'): Promise<string> => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=ru`;
    try {
        const response = await axios.get(url);
        const data = response.data;

        const temperature = data.main.temp;
        const weatherDescription = data.weather[0].description;

        let clothingRecommendation: string;
        if (temperature < -5) {
            clothingRecommendation = "Верх: зимняя куртка, Низ: теплые штаны, Обувь: зимние ботинки.";
        } else if (temperature >= -5 && temperature < 5) {
            clothingRecommendation = "Верх: теплая куртка, Низ: джинсы, Обувь: утепленные ботинки.";
        } else if (temperature >= 5 && temperature < 10) {
            clothingRecommendation = "Верх: легкая куртка, Низ: джинсы, Обувь: осенние ботинки.";
        } else if (temperature >= 10 && temperature < 15) {
            clothingRecommendation = "Верх: толстовка, Низ: джинсы, Обувь: кроссовки.";
        } else if (temperature >= 15 && temperature < 20) {
            clothingRecommendation = "Верх: свитер, Низ: легкие брюки, Обувь: легкие кроссовки.";
        } else if (temperature >= 20 && temperature < 25) {
            clothingRecommendation = "Верх: футболка, Низ: легкие штаны, Обувь: легкие кроссовки или шлёпанцы.";
        } else {
            clothingRecommendation = "Верх: майка, Низ: шорты, Обувь: легкие кроссовки или шлёпанцы.";
        }

        return `Погода в ${city}:\nТемпература: ${temperature}°C\n${weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1)}\nРекомендуемая одежда:\n${clothingRecommendation}`;
    } catch (error) {
        console.error(`Ошибка при запросе к OpenWeather: ${error}`);
        return "Не удалось получить данные о погоде.";
    }
};

const getMainNews = async (): Promise<string> => {
    const url = `https://newsapi.org/v2/top-headlines?apiKey=${NEWS_API_KEY}`;
    try {
        const response = await axios.get(url);
        const articles = response.data.articles;

        if (articles.length === 0) {
            return "На данный момент нет новостей по всему миру.";
        }

        const topArticle = articles[0];
        return `Главная мировая новость дня: ${topArticle.title}`;
    } catch (error) {
        console.error(`Ошибка при запросе к News API: ${error}`);
        return "Не удалось получить новость дня.";
    }
};

const getExchangeRates = async (): Promise<string> => {
    try {
        const exchangeResponse = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/EUR`);
        const czkRate = exchangeResponse.data.conversion_rates.CZK;

        const bitcoinResponse = await axios.get(BITCOIN_RATE_URL);
        const bitcoinCZK = bitcoinResponse.data.bitcoin.czk;

        return `Курс евро к чешской кроне: ${czkRate} CZK\nКурс биткоина: ${bitcoinCZK} CZK`;
    } catch (error) {
        console.error(`Ошибка при запросе курса: ${error}`);
        return "Не удалось получить курсы валют.";
    }
};

const sendWeatherUpdate = async (chatId: number): Promise<void> => {
    const weather = await getWeather();
    const news = await getMainNews();
    const exchangeRates = await getExchangeRates();

    const message = `${weather}\n\n${news}\n\n${exchangeRates}`;
    try {
        await bot.sendMessage(chatId, message);
        console.info(`Weather, news, and exchange rate message sent to user with chat_id: ${chatId}.`);
    } catch (error) {
        console.error(`Error sending message: ${error}`);
    }
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (userId) userChats[userId] = chatId;

    console.info(`User ${msg.from?.first_name} started the bot.`);

    await bot.sendMessage(chatId, `Привет, ${msg.from?.first_name}! Я твой бот для прогноза погоды в Праге. Я буду присылать новую информацию каждое утро.`);
    await sendWeatherUpdate(chatId);
});

bot.onText(/\/weather/, async (msg) => {
    const chatId = msg.chat.id;
    await sendWeatherUpdate(chatId);
});

const dailyWeatherUpdate = async (): Promise<void> => {
    for (const chatId of Object.values(userChats)) {
        await sendWeatherUpdate(chatId);
    }
};

// Schedule daily updates at 8:00 AM
const pragueTimeZone = 'Europe/Prague';
schedule.scheduleJob('0 8 * * *', pragueTimeZone, dailyWeatherUpdate);
