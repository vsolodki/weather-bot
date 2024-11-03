import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';
import schedule from 'node-schedule';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY as string;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userChats: Record<number, number> = {};

const getWeather = async (city: string = 'Prague'): Promise<string> => {
    const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
    try {
        const response = await axios.get(url);
        const data = response.data;

        const temperature = data.main.temp;
        const weatherDescription = data.weather[0].description;

        let clothingRecommendation: string;
        if (temperature < 10) {
            clothingRecommendation = "Теплая одежда, шапка и перчатки.";
        } else if (temperature >= 10 && temperature < 20) {
            clothingRecommendation = "Легкая куртка или свитер.";
        } else {
            clothingRecommendation = "Легкая одежда, шорты и футболка.";
        }

        return `Погода в ${city}:\nТемпература: ${temperature}°C\n${weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1)}\nРекомендуемая одежда: ${clothingRecommendation}`;
    } catch (error) {
        console.error(`Ошибка при запросе к OpenWeather: ${error}`);
        return "Не удалось получить данные о погоде.";
    }
};

const sendWeatherUpdate = async (chatId: number): Promise<void> => {
    const message = await getWeather();
    try {
        await bot.sendMessage(chatId, message);
        console.info(`Weather message sent to user with chat_id: ${chatId}.`);
    } catch (error) {
        console.error(`Error sending message: ${error}`);
    }
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (userId) userChats[userId] = chatId;

    console.info(`User ${msg.from?.first_name} started the bot.`);

    await bot.sendMessage(chatId, `Привет, ${msg.from?.first_name}! Я твой бот для прогноза погоды. Ты можешь получать ежедневные уведомления о погоде.`);
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
schedule.scheduleJob('0 8 * * *', dailyWeatherUpdate);
