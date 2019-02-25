const { CardFactory, ActivityTypes } = require('botbuilder');
const { DateUtil } = require('./util/date_util')

// entities defined in LUIS
const REQUEST_TYPES = "request_types";

class LeaveRequestManager {
    async viewSubmittedRequests(userRecord, context, entities, dateRange, date) {
        let dateFilter = [];
        let upcomingDate;
        if (dateRange && dateRange.length != 0) {
            dateFilter = DateUtil.fetchDateFilterFromLuisDate(dateRange);
        } else if (date && date.length != 0) {
            dateFilter = DateUtil.fetchDateFilterFromLuisDate(date);
        } else {
            upcomingDate = new Date();
        }

        if (upcomingDate) {
            var leaveRequests = userRecord.leaveRequests.filter(
                leaveRequest => entities[REQUEST_TYPES][0].includes(leaveRequest.type)
                    && (dateFilter< new Date(leaveRequest.date)));

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
        } else if (dateFilter.length == 0) {
            await context.sendActivity("Please provide upcoming dates.");
        } else {

            var leaveRequests = userRecord.leaveRequests.filter(
                leaveRequest => entities[REQUEST_TYPES][0].includes(leaveRequest.type)
                    && (dateFilter.includes(new Date(leaveRequest.date).getTime())));

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
