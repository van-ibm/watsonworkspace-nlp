require('dotenv').config()

// creates a bot server with a single bot
const botFramework = require('watsonworkspace-bot')
botFramework.level('info')
botFramework.startServer()

const bot = botFramework.create(
  process.env.NLP_APP_ID,
  process.env.NLP_APP_SECRET,
  process.env.NLP_WEBHOOK_SECRET
)

// bind the QA bot's behavior
const qa = require('./index.js')
qa.bind(bot)

bot.authenticate()
