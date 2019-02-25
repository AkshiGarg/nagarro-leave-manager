const { ActivityTypes, CardFactory, ActionTypes } = require('botbuilder')
const { DateUtil } = require('./util/date_util')

const holidays = require('./resources/holidays.json');
const FLEXIBLE_HOLIDAY_TYPE = "flexible holidays";
const REQUEST_TYPES = "request_types";
const PUBLIC_HOLIDAY = "Public";
const FLEXIBLE_HOLIDAY = "flexible"

class HolidayCalendar {

    async listHolidays(context, entities, dateRange, date) {
        // If date is mentioned in message filter by date
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
            if (entities[REQUEST_TYPES] && entities[REQUEST_TYPES][0].includes(FLEXIBLE_HOLIDAY_TYPE)) {
                await this.sendAllUpcomingFlexibleHolidays(context,upcomingDate);
            } else {
                await this.sendAllUpcomindPublicHolidays(context, upcomingDate);
            }
            const reply = {
                type: ActivityTypes.Message,
                attachments: [this.holidayCard]
            };
            await context.sendActivity(reply);
        } else if (dateFilter.length == 0) {
            await context.sendActivity("Please provide upcoming dates.");
        } else {
            if (entities[REQUEST_TYPES] && entities[REQUEST_TYPES][0].includes(FLEXIBLE_HOLIDAY_TYPE)) {
                await this.sendUpcomingFlexibleHolidays(context, dateFilter);
            } else {
                await this.sendUpcomindPublicHolidays(context, dateFilter);
            }
            const reply = {
                type: ActivityTypes.Message,
                attachments: [this.holidayCard]
            };
            await context.sendActivity(reply);
        }
    }

    async sendUpcomindPublicHolidays(context, dateFilter) {
        var publicHolidays = this.filterHolidaysByTypeAndDate(PUBLIC_HOLIDAY, dateFilter);
        // If public holidays are left, show in adaptive card
        if (publicHolidays.length > 0) {
            this.holidayCard = this.createAdaptiveCard(publicHolidays);
        }
        else {
            await context.sendActivity("No public holidays.");
        }
    }

    async sendUpcomingFlexibleHolidays(context, dateFilter) {
        var flexibleHolidays = this.filterHolidaysByTypeAndDate(FLEXIBLE_HOLIDAY, dateFilter);
        // If flexible holidays are left, show in hero card.
        if (flexibleHolidays.length > 0) {
            this.holidayCard = this.createHeroCard(flexibleHolidays);
        }
        else {
            await context.sendActivity("No flexible holidays.");
        }
    }

    async sendAllUpcomindPublicHolidays(context, upcomingDate) {
        var publicHolidays = holidays.filter(function (calendarHoliday) {
            return calendarHoliday.type === PUBLIC_HOLIDAY && (upcomingDate < new Date(calendarHoliday.date));
        });
        // If public holidays are left, show in adaptive card
        if (publicHolidays.length > 0) {
            this.holidayCard = this.createAdaptiveCard(publicHolidays);
        }
        else {
            await context.sendActivity("No public holidays.");
        }
    }

    async sendAllUpcomingFlexibleHolidays(context, upcomingDate) {
        var flexibleHolidays = holidays.filter(function (calendarHoliday) {
            return calendarHoliday.type === FLEXIBLE_HOLIDAY && (upcomingDate < new Date(calendarHoliday.date));
        });
        // If flexible holidays are left, show in hero card.
        if (flexibleHolidays.length > 0) {
            this.holidayCard = this.createHeroCard(flexibleHolidays);
        }
        else {
            await context.sendActivity("No flexible holidays.");
        }
    }

    filterHolidaysByTypeAndDate(holidayTypeFilter, dateFilter) {
        return holidays.filter(function (calendarHoliday) {
            return calendarHoliday.type === holidayTypeFilter && (dateFilter.includes(new Date(calendarHoliday.date).getTime()));
        });
    }
    createHeroCard(flexibleHolidays) {
        let flexibleHolidayButtons = [];
        for (var i = 0; i < flexibleHolidays.length; i++) {
            const button = {
                type: ActionTypes.PostBack,
                title: flexibleHolidays[i].day + ", " + flexibleHolidays[i].date + " - " + flexibleHolidays[i].name,
                value: {
                    date: flexibleHolidays[i].date,
                    name: flexibleHolidays[i].name
                }
            }
            flexibleHolidayButtons.push(button);
        }

        const flexibleHolidayHeroCard = CardFactory.heroCard(
            'Flexible Holidays',
            undefined,
            flexibleHolidayButtons,
            {
                text: 'You may avail for the flexible leave by selecting it.'
            }
        );

        return flexibleHolidayHeroCard;
    }


    createAdaptiveCard(publicHolidays) {
        var card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.0",
            "body": []
        };

        var textBlocks = [];
        for (var i = 0; i < publicHolidays.length; i++) {
            let textBlock = {
                "type": "TextBlock",
                "color": "dark",
                "wrap": true,
                "text": publicHolidays[i].day + ", " + publicHolidays[i].date + " - " + publicHolidays[i].name
            }
            textBlocks.push(textBlock);
        }
        card.body = textBlocks;

        return CardFactory.adaptiveCard(card);
    }
}

module.exports.HolidayCalendar = HolidayCalendar;