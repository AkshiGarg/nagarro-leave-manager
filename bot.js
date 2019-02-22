// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer} = require('botbuilder-ai');
const { WelcomeUser } = require('./welcome_user');
// State Accessor Properties
const CONVERSATION_STATE_ACCESSOR = 'conversationData';
const USER_STATE_ACCESSOR = 'userData';

// Luis Intents
const GREETING = "Greeting";
const NONE = "None";
const HOLIDAY = "Upcoming Holidays";
const HELP = "Help";
// Luis Result Entities
const LEAVE_REQUESTS = "leave_requests";
const APPLY_ACTION = "apply";
const SHOW_ACTION = "show";
const Action_Types = "action_types";

const detail = {
    none: 'none',
    date: 'date',
    reason: 'reason',
    comment: 'comment',
    confirm: 'confirm'
};

class NagarroLeaveManagerBot {

    constructor(application, luisPredictionOptions, conversationState, userState) {
        this.luisRecognizer = new LuisRecognizer(
            application,
            luisPredictionOptions,
            true
        );
        this.conversationStateAccessor = conversationState.createProperty(CONVERSATION_STATE_ACCESSOR);
        this.userStateAccessor = userState.createProperty(USER_STATE_ACCESSOR);
        this.conversationState = conversationState;
        this.userState = userState;

        this.greet = new WelcomeUser();
    }

    async onTurn(turnContext) {
        const activityType = turnContext.activity.type;

        switch (activityType) {
            case ActivityTypes.Message:
                const userProfile = await this.userStateAccessor.get(turnContext, {});

                const conversationFlow = await this.conversationStateAccessor.get(turnContext, {
                    luisResultForAskedQuestion: [],
                    promptedForEmployeeId: false,
                    promptedForLeaveRequestDetails: detail.none
                });

                // If this is not the first message from the user, prompt user for employee id else process the message by its intent. 
                if (conversationFlow.promptedForEmployeeId) {
                    // If the user wants to apply for a leave, (s)he is required to enter some related information, after that process the intent.
                    // If the user wants to do anything other than applying for the leave, process the intent. 
                    if (conversationFlow.promptedForLeaveRequestDetails === detail.none) {
                        userProfile.id = userProfile.id || turnContext.activity.text;
                        await this.userStateAccessor.set(turnContext, userProfile);
                        await this.userState.saveChanges(turnContext);

                        // fetch the information of Luis result from conversation state (if present) otherwise, call LUIS api.
                        const { topIntent, entities } = await this.fetchLuisResult(conversationFlow, turnContext);

                        await this.conversationStateAccessor.set(turnContext, conversationFlow);
                        await this.conversationState.saveChanges(turnContext);

                        switch (topIntent) {
                            case GREETING:
                                await turnContext.sendActivity("Hi!! How may I help you?");
                                break;
                            case HELP:
                                await this.greet.giveIntroduction(turnContext);
                                break;
                            case HOLIDAY:
                                const holidayCalendar = new HolidayCalendar();
                                await turnContext.sendActivity(holidayCalendar.listHolidays(turnContext, entities));
                                break;
                            case LEAVE_REQUESTS:
                                const leaveRequestManager = new LeaveRequestManager(this.userStateAccessor);
                                if (entities[Action_Types]) {
                                    if (entities[Action_Types][0].includes(APPLY_ACTION)) {
                                        return await this.applyForLeave(userProfile, entities, turnContext, conversationFlow);
                                    } else if (entities[Action_Types][0].includes(SHOW_ACTION)) {
                                        return turnContext.sendActivity(leaveRequestManager.viewSubmittedRequests(userProfile, turnContext, entities));
                                    }
                                } else {
                                    await turnContext.sendActivity("I didn't understand your query.");
                                }
                                break;
                            case NONE:
                                await turnContext.sendActivity("I didn't understand your query.");
                                break;
                        }
                        // if (topIntent === GREETING || topIntent === HELP) {
                        //     await this.welcomeUser.giveIntroduction(turnContext);
                        // } else if (topIntent === HOLIDAY) {
                        //     const holidayCalendar = new HolidayCalendar();
                        //     await turnContext.sendActivity(holidayCalendar.listHolidays(turnContext, result.entities));
                        // }
                        // else if (topIntent === LEAVE_REQUESTS) {
                        //     const leaveRequestManager = new LeaveRequestManager(this.userStateAccessor);
                        //     if (result.entities[Action_Types]) {
                        //         if (result.entities[Action_Types][0].includes(APPLY_ACTION)) {
                        //             return await this.applyForLeave(userProfile, result.entities, turnContext, conversationFlow);
                        //         } else if (result.entities[Action_Types][0].includes(SHOW_ACTION)) {
                        //             return turnContext.sendActivity(leaveRequestManager.viewSubmittedRequests(userProfile, turnContext, result.entities));
                        //         }
                        //     } else {
                        //         await turnContext.sendActivity("I didn't understand your query.");
                        //     }
                        // } else if (topIntent === NONE) {
                        //     await turnContext.sendActivity("I didn't understand your query.");
                        // }
                    } else {

                    }

                } else {
                    await this.promptForEmployeeId(conversationFlow, turnContext);
                }
                break;

            case ActivityTypes.ConversationUpdate:
                await this.welcomeUser(turnContext);
                break;
        }
    }

    async fetchLuisResult(conversationFlow, turnContext) {
        const result = conversationFlow.luisResultForAskedQuestion[0] || await this.luisRecognizer.recognize(turnContext);
        const topIntent = result.luisResult.topScoringIntent.intent;
        const entities = result.entities;
        conversationFlow.luisResultForAskedQuestion.length = [];
        return { topIntent, entities };
    }

    async welcomeUser(turnContext) {
        await this.greet.welcomeUser(turnContext);
    }

    async promptForEmployeeId(conversationFlow, turnContext) {
        const result = await this.luisRecognizer.recognize(turnContext);
        conversationFlow.luisResultForAskedQuestion.push(result);
        conversationFlow.promptedForEmployeeId = true;
        await turnContext.sendActivity('Please provide your employee id.');
        await this.conversationStateAccessor.set(turnContext, conversationFlow);
        await this.conversationState.saveChanges(turnContext);
    }
}

module.exports.NagarroLeaveManagerBot = NagarroLeaveManagerBot;
