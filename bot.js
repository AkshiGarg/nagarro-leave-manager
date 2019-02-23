// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { WelcomeUser } = require('./welcome_user');
const { HolidayCalendar } = require('./holiday_calendar');
const { LeaveRequestManager } = require('./leave_request_manager');

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
const DATE_TIME = "datetime";

const detail = {
    none: 'none',
    date: 'date',
    reason: 'reason',
    comment: 'comment',
    confirm: 'confirm'
};
var fs = require('fs');
const USER_LEAVE_RECORDS_FILE = './resources/user_leave_record.json';

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
                                await holidayCalendar.listHolidays(turnContext, entities);
                                break;
                            case LEAVE_REQUESTS:
                                if (entities[Action_Types]) {
                                    await this.fetchLeavesByActionType(userProfile.id, entities, turnContext);
                                } else {
                                    await turnContext.sendActivity("Do you want to apply for a leave or Do you want me to show your leaves.");
                                }
                                break;
                            case NONE:
                                await turnContext.sendActivity("I didn't understand your query.");
                                break;
                        }
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

    // Two action types are acceptable (show to list / apply to apply for leave)
    async fetchLeavesByActionType(userId, entities, turnContext) {
        const userRecord = this.getUserRecordFromFile(userId);
        const actionTypes = entities[Action_Types][0];
        if (!userRecord) {
            await turnContext.sendActivity("No user found with id: " + userId);
        } else if (actionTypes.includes(APPLY_ACTION)) {
            return this.applyForLeave(userRecord, entities, conversationFlow);
        } else if (actionTypes.includes(SHOW_ACTION)) {
            const leaveRequestManager = new LeaveRequestManager();
            await leaveRequestManager.viewSubmittedRequests(userRecord, turnContext, entities);
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

    async applyForLeave(userLeaveRecord, entities, conversationFlow) {
        // const records = fs.readFileSync(USER_LEAVE_RECORDS_FILE);
        // const leaveRecords = JSON.parse(records);
        // var userLeaveRecord = leaveRecords.find(leaveRecord => leaveRecord.employeeId === userId);
        // if (!userLeaveRecord) {
        // await turnContext.sendActivity("No record found for employee with id: " + userId);
        // } else 
        if (userLeaveRecord.leavesTaken === 27) {
            return "You have taken all your leaves. You can not apply for more.";
        } else {
            if (entities[DATE_TIME]) {
                return "date already mentioned" + new TimexProperty(entities[DATE_TIME][0].timex.toString());
            } else {
                return this.askForDate(conversationFlow, turnContext);
            }
        }
    }

    getUserRecordFromFile(userId) {
        const records = JSON.parse(fs.readFileSync(USER_LEAVE_RECORDS_FILE));
        var userRecord = records.find(leaveRecord => leaveRecord.employeeId === userId);
        return userRecord;
    }
}

module.exports.NagarroLeaveManagerBot = NagarroLeaveManagerBot;
