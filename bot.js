// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { WelcomeUser } = require('./welcome_user');
const { HolidayCalendar } = require('./holiday_calendar');
const { LeaveRequestManager } = require('./leave_request_manager');
const { DateUtil } = require('./util/date_util');
const { LeaveSubmissionForm } = require("./util/leave_submission_form")

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
        this.leaveSubmissionForm = new LeaveSubmissionForm();
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

                        if (turnContext.activity.channelData.postback) {
                            const flexibleHoliday = turnContext.activity.value;
                            this.leaveSubmissionForm.submitLeaveRequest(userProfile.id,
                                flexibleHoliday.date,
                                "flexible holidays",
                                flexibleHoliday.name + " - Flexible Holiday",
                                "flexible holiday");

                            await turnContext.sendActivity(flexibleHoliday.date + " is recorded as your leave.");
                        } else {
                            // fetch the information of Luis result from conversation state (if present) otherwise, call LUIS api.

                            const { topIntent, entities, dateRange, date } = await this.fetchLuisResult(conversationFlow, turnContext);
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
                                    await holidayCalendar.listHolidays(turnContext, entities, dateRange, date);
                                    break;
                                case LEAVE_REQUESTS:
                                    if (entities[Action_Types]) {
                                        await this.fetchLeavesByActionType(userProfile.id, entities, dateRange, date, turnContext, conversationFlow);
                                    } else {
                                        await turnContext.sendActivity("Do you want to apply for a leave or Do you want me to show your leaves.");
                                    }
                                    break;
                                case NONE:
                                    await turnContext.sendActivity("I didn't understand your query.");
                                    break;
                            }
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
    async fetchLeavesByActionType(userId, entities, dateRange, date, turnContext, conversationFlow) {
        const userRecord = this.leaveSubmissionForm.getUserRecordFromFile(userId);
        const actionTypes = entities[Action_Types][0];
        if (!userRecord) {
            await turnContext.sendActivity("No user found with id: " + userId);
        } else if (actionTypes.includes(APPLY_ACTION)) {
            await this.applyForLeave(userRecord, entities, dateRange, date, conversationFlow, turnContext);
        } else if (actionTypes.includes(SHOW_ACTION)) {
            const leaveRequestManager = new LeaveRequestManager();
            await leaveRequestManager.viewSubmittedRequests(userRecord, turnContext, entities, dateRange, date);
        }
    }

    async fetchLuisResult(conversationFlow, turnContext) {
        const result = conversationFlow.luisResultForAskedQuestion[0] || await this.luisRecognizer.recognize(turnContext);
        const topIntent = result.luisResult.topScoringIntent.intent;
        const entities = result.entities;
        const dateRange = result.luisResult.entities.filter(entity => entity.type === "builtin.datetimeV2.daterange")
        const date = result.luisResult.entities.filter(entity => entity.type === "builtin.datetimeV2.date")
        conversationFlow.luisResultForAskedQuestion.length = [];
        return { topIntent, entities, dateRange, date };
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

    async applyForLeave(userLeaveRecord, entities, dateRange, date, conversationFlow, turnContext) {
        if (userLeaveRecord.leavesTaken === 27) {
            await turnContext.sendActivity("You have taken all your leaves. You can not apply for more.");
        } else {
            let dateFilter = [];
            if (dateRange && dateRange.length != 0) {
                dateFilter = DateUtil.fetchDateFilterFromLuisDate(dateRange);
                dateFilter = DateUtil.removeSatAndSun(dateFilter);
                if (userLeaveRecord.leavesTaken + dateFilter.length > 27) {
                    await turnContext.sendActivity("You can avail only " + (27 - userLeaveRecord.leavesTaken) + " leaves");
                } else {
                    await this.leaveSubmissionForm.submitMultipleLeaveRequests(userLeaveRecord.employeeId, dateFilter, "leave");
                }
            } else if (date && date.length != 0) {
                dateFilter = DateUtil.fetchDateFilterFromLuisDate(date);
                await this.leaveSubmissionForm
                    .submitLeaveRequest(
                        userLeaveRecord.employeeId,
                        new Date(dateFilter[0]).toString(),
                        "leave",
                        "no reason mentioned",
                        "no comment mentioned");
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
                    this.leaveSubmissionForm.submitLeaveRequest(userProfile.id,
                        userProfile.leaveDate,
                        "leave",
                        userProfile.reason,
                        userProfile.comment);
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
