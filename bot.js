// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { WelcomeUser } = require('./welcome_user');
const { HolidayCalendar } = require('./holiday_calendar');
const { LeaveRequestManager } = require('./leave_request_manager');
const { DateUtil } = require('./util/date_util');

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
                                    await this.fetchLeavesByActionType(userProfile.id, entities, turnContext, conversationFlow);
                                } else {
                                    await turnContext.sendActivity("Do you want to apply for a leave or Do you want me to show your leaves.");
                                }
                                break;
                            case NONE:
                                await turnContext.sendActivity("I didn't understand your query.");
                                break;
                        }
                    } else {
                        // If the user wants to apply for a leave, (s)he is required to enter some related information, after that process the intent.
                        const input = turnContext.activity.text;
                        await this.getDetailsToApplyForLeave(input, userProfile, conversationFlow, turnContext);
                        await this.conversationStateAccessor.set(turnContext, conversationFlow);
                        await this.conversationState.saveChanges(turnContext);
                        await this.userStateAccessor.set(turnContext, userProfile);
                        await this.userState.saveChanges(turnContext);
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
    async fetchLeavesByActionType(userId, entities, turnContext, conversationFlow) {
        const userRecord = this.getUserRecordFromFile(userId);
        const actionTypes = entities[Action_Types][0];
        if (!userRecord) {
            await turnContext.sendActivity("No user found with id: " + userId);
        } else if (actionTypes.includes(APPLY_ACTION)) {
            await this.applyForLeave(userRecord, entities, conversationFlow, turnContext);
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

    async applyForLeave(userLeaveRecord, entities, conversationFlow, turnContext) {
        if (userLeaveRecord.leavesTaken === 27) {
            await turnContext.sendActivity("You have taken all your leaves. You can not apply for more.");
        } else {
            if (entities[DATE_TIME]) {
                await turnContext.sendActivity("date already mentioned" + new TimexProperty(entities[DATE_TIME][0].timex.toString()));
            } else {
                await this.askForDate(conversationFlow, turnContext);
            }
        }
    }

    async askForDate(conversationFlow, turnContext) {
        await turnContext.sendActivity("When do you want to take leave(s)?");
        conversationFlow.promptedForLeaveRequestDetails = detail.date;
        await this.conversationStateAccessor.set(turnContext, conversationFlow);
        await this.conversationState.saveChanges(turnContext);
    }

    getUserRecordFromFile(userId) {
        const records = JSON.parse(fs.readFileSync(USER_LEAVE_RECORDS_FILE));
        var userRecord = records.find(leaveRecord => leaveRecord.employeeId === userId);
        return userRecord;
    }


    async getDetailsToApplyForLeave(input, userProfile, conversationFlow, turnContext) {
        let result;
        switch (conversationFlow.promptedForLeaveRequestDetails) {
            case detail.date:
                result = DateUtil.validateDate(input);
                if (result.success) {
                    userProfile.leaveDate = result.startDate;
                    await turnContext.sendActivity("What is the reason for applying the leave?");
                    conversationFlow.promptedForLeaveRequestDetails = detail.reason;
                } else {
                    await turnContext.sendActivity(
                        result.message || "Please provide a correct date.");
                }
                break;
            case detail.reason:
                userProfile.reason = input;
                await turnContext.sendActivity("Any other comment regarding this leave application?");
                conversationFlow.promptedForLeaveRequestDetails = detail.confirm;
                break;
            case detail.confirm:
                userProfile.comment = input;
                await turnContext.sendActivity("Please verify your details");
                await turnContext.sendActivity("Date: " + userProfile.leaveDate + "\nReason: " + userProfile.reason + "\nComment: " + userProfile.comment);
                await turnContext.sendActivity("Do you confirm (Y/N)?")
                conversationFlow.promptedForLeaveRequestDetails = detail.submitted;
                break;
            case detail.submitted:
                if (input.toLowerCase() === 'y') {
                    var jsonString = fs.readFileSync(USER_LEAVE_RECORDS_FILE);
                    var leaveRecords = JSON.parse(jsonString);
                    for (let i = 0; i < leaveRecords.length; i++) {
                        if (leaveRecords[i].employeeId === userProfile.id) {
                            let new_leave_request = {
                                "reason": userProfile.reason,
                                "type": "leave",
                                "date": userProfile.leaveDate,
                                "comments": userProfile.comment
                            }
                            leaveRecords[i].leaveRequests.push(new_leave_request);
                            leaveRecords[i].leavesTaken += 1;
                            break;
                        }
                    }
                    var updatedData = JSON.stringify(leaveRecords, null, 4);
                    fs.writeFileSync(USER_LEAVE_RECORDS_FILE, updatedData);
                    conversationFlow.promptedForLeaveRequestDetails = detail.none;

                    await turnContext.sendActivity("Leave record updated");

                } else if (input.toLowerCase() === 'n') {
                    // clear all the data
                    conversationFlow.promptedForLeaveRequestDetails = detail.none;
                    userProfile.leaveDate = undefined;
                    userProfile.reason = undefined;
                    userProfile.comment = undefined;
                    await turnContext.sendActivity("Cancelling your request.")
                } else {
                    // prompt again
                    await turnContext.sendActivity("Please enter y or n.")
                }

        }
    }
}

module.exports.NagarroLeaveManagerBot = NagarroLeaveManagerBot;
