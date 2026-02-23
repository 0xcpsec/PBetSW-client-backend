const fs = require('fs');
import { Telegraf } from 'telegraf';
import { telegramBot } from './constant';
import { v4 as uuidv4 } from 'uuid';
import { SportsType } from './enum';

const bot = new Telegraf(telegramBot.token);

export const leaveLog = (message: string) => {
    // fs.appendFile('./log.txt', `${new Date().toISOString()} => ${message}\n`, (error: any) => {})
}

export const generateAPIKey = () => {
    return uuidv4();
};
    
export const leaveRMQLog = (type: SportsType, header: any, event: any) => {
    // fs.appendFile(`./rmq_${type == SportsType.PREMATCH ? 'prematch' : 'inplay'}_logs/${event.FixtureId}.txt`, `${new Date().toISOString()} => ${JSON.stringify(header)} : ${JSON.stringify(event)}\n`, (error: any) => {})
}

export const notifyTelegramChannel = (message: string) => {
    bot.telegram.sendMessage(telegramBot.chatid, message).then((result: any) => {
        
    })
    .catch((error: any) => {
        console.log("Telegram message error");
    });
}