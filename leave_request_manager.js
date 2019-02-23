const { CardFactory, ActivityTypes } = require('botbuilder');
const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');

const Recognizers = require('@microsoft/recognizers-text-suite');


// entities defined in LUIS
const DATE_TIME = "datetime";
const REQUEST_TYPES = "request_types";

class LeaveRequestManager {
    async viewSubmittedRequests(userRecord, context, entities) {

        const dateFilter = entities[DATE_TIME] ?
            this.getDateFilter(entities[DATE_TIME])
            : new Date();

        var leaveRequests = userRecord.leaveRequests.filter(
            leaveRequest => entities[REQUEST_TYPES][0].includes(leaveRequest.type)
                && (dateFilter < new Date(leaveRequest.date)));

        if (leaveRequests.length === 0) {
            await context.sendActivity("No upcoming leave requests found for employee: " + userRecord.employeeId);
        } else {
            this.leaveCard = this.createAdaptiveCard(leaveRequests);
            const reply = {
                type: ActivityTypes.Message,
                text: "You have submitted following requests: ",
                attachments: [this.leaveCard]
            };
            await context.sendActivity(reply);
        }

    }

    getDateFilter(dateTimeFilter) {
        // const dateFilterType = dateTimeFilter[0].type;
        // if (dateFilterType === 'date') {
        //     var luisDuration = new Date(dateFilterType.timex[0].toLocaleString());
        //     var luisDate = luisDuration.getDate();
        //     var luisMonth = luisDuration.getMonth();
        //     var leaveDate = new Date(leaveRequest.date)
        //     return entities[REQUEST_TYPES][0].includes(leaveRequest.type)
        //         && (luisDate === leaveDate.getDate() && luisMonth === leaveDate.getMonth());
        // } else if (dateFilterType.type === 'daterange') {
        //     new TimexProperty(dateTimeFilter);
        // }
        return new Date();
    }

    createAdaptiveCard(leaveRequests) {
        var card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.0",
            "body": []
        };

        var textBlocks = [];
        for (var i = 0; i < leaveRequests.length; i++) {
            let textBlock = {
                "type": "TextBlock",
                "color": "dark",
                "wrap": true,
                "text": leaveRequests[i].date + " ( " + leaveRequests[i].reason + " )"
            }
            textBlocks.push(textBlock);
        }
        card.body = textBlocks;

        return CardFactory.adaptiveCard(card);
    }
}

module.exports.LeaveRequestManager = LeaveRequestManager;
