'use strict'

const bot = require('watsonworkspace-bot')
const logger = require('winston')
const ww = require('watsonworkspace-sdk')

const action = 'explore'  // the actionId used to create the initial UI of buttons

ww.logger.level = 'info'
logger.level = 'verbose'

/**
 * Based on an annotation, adds a message focus with the NLP data.
 * A message focus shows up in Moments and also adds the underlined text to the message.
 */
bot.webhooks.on('message-annotation-added', (message, annotation) => {
  const annotationType = message.annotationType

  logger.info(`Received message-annotation-added:${annotationType}`)
  logger.debug(message)
  logger.debug(annotation)

  // only NLP events are of interest
  if (annotationType.indexOf('message-nlp-') > -1) {
    ww.getMessage(message.messageId, ['id', 'content', 'annotations'])
    .then(message => {
      switch (annotationType) {
        case 'message-nlp-keywords':
          annotation.keywords.forEach(keyword =>
            ww.addMessageFocus(message, keyword.text, 'Keyword', '', action))
          break
        case 'message-nlp-entities':
          annotation.entities.forEach(entity =>
            ww.addMessageFocus(message, entity.text, entity.type, '', action))
          break
        case 'message-nlp-concepts':
          annotation.concepts.forEach(concept =>
            ww.addMessageFocus(message, concept.text, 'Concept', '', action))
          break
        case 'message-nlp-taxonomy':
          annotation.taxonomy.forEach(category =>
            ww.addMessageFocus(message, category.label, 'Taxonomy', '', action))
          break
        case 'message-nlp-dates':
          annotation.dates.forEach(date =>
            ww.addMessageFocus(message, date.text, 'Date', '', action))
          break
        case 'message-nlp-docSentiment':
          // docSentiment == the entire message, but don't add a phrase because it would
          // underline the entire message and obscure the other foci
          ww.addMessageFocus(message, '', 'Sentiment', '', action)
          break
      }
    })
    .catch(error => logger.error(error))
  }
})

/**
 * An 'actionSelected' event signals the user has initiated actionFulfillment from Workspace.
 * Set up the resulting UI to be sent back to the user.
 */
bot.webhooks.on(`actionSelected`, (message, annotation) => {
  // get the original message that created this actionSelected annotation
  const referralMessageId = annotation.referralMessageId
  const userId = message.userId
  const actionId = annotation.actionId

  logger.info(`${actionId} selected from message ${referralMessageId} by user ${userId}`)
  logger.debug(message)
  logger.debug(annotation)

  ww.getMessage(referralMessageId, ['id', 'created', 'annotations'])
  .then(message => {
    logger.verbose(`Successfully retrieved message ${message.id} created on ${message.created}`)

    if (actionId === action) {
      sendExploreDialog(userId, message, annotation)
    } else {
      // find the annotation given the user's selection (matches the annotation type)
      let selectedAnnotation = message.annotations.find(annotation => annotation.type === actionId)
      sendCardDialog(userId, annotation, selectedAnnotation, Date.parse(message.created))
    }
  })
  .catch(error => logger.error(error))
})

function sendCardDialog (userId, annotation, selectedAnnotation, date) {
  let cards = []

  switch (selectedAnnotation.type) {
    case 'message-nlp-keywords':
      selectedAnnotation.keywords.forEach(keyword => cards.push(
        ww.ui.card(keyword.text, `${keyword.relevance.toString()} relevance`, '', [], date)
      ))
      break
    case 'message-nlp-entities':
      selectedAnnotation.entities.forEach(entity => cards.push(
        ww.ui.card(entity.type, `${entity.relevance.toString()} relevance`, entity.text, [], date)
      ))
      break
    case 'message-nlp-concepts':
      selectedAnnotation.concepts.forEach(concept => cards.push(
        ww.ui.card(concept.text, `${concept.relevance.toString()} relevance`, `[Find out more.](${concept.dbpedia})`, [], date)
      ))
      break
    case 'message-nlp-taxonomy':
      selectedAnnotation.taxonomy.forEach(category => cards.push(
        ww.ui.card(category.label, `${category.score.toString()} score`, '', [], date)
      ))
      break
    case 'message-nlp-dates':
      selectedAnnotation.dates.forEach(date => cards.push(
        ww.ui.card(date.date, '', date.text, [], date)
      ))
      break
    case 'message-nlp-docSentiment':
      const sentiment = selectedAnnotation.docSentiment
      cards.push(
        ww.ui.card(sentiment.type, `${sentiment.score.toString()} score`, '', [], date)
      )
      break
  }

  ww.sendTargetedMessage(userId, annotation, cards)
}

function sendExploreDialog (userId, message, annotation) {
  let buttons = []

  // create a button for each nlp type
  message.annotations.forEach(annotation => {
    // only look for nlp annotations
    if (annotation.type.indexOf('message-nlp-') > -1) {
      // 'message-nlp-concepts' becomes 'concepts'
      const buttonTitle = annotation.type.substring('message-nlp-'.length)

      // use the annotation type as the actionId
      buttons.push(ww.ui.button(annotation.type, buttonTitle))
    }
  })

  // build the dialog of nlp buttons
  const dialog = ww.ui.generic('Below the surface, a cognitive world awaits.', '', buttons)

  // create the action fulfillment dialog in Workspace
  ww.sendTargetedMessage(userId, annotation, dialog)
}

// the most important part - start the bot so it listens for Workspace events
bot.start()
