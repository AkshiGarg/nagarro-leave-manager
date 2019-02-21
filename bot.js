// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { WelcomeUser } = require('./welcome_user');


class NagarroLeaveManagerBot {
    /**
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(turnContext) {
        const activityType = turnContext.activity.type;

        switch (activityType) {
            case ActivityTypes.Message:
                await turnContext.sendActivity(`You said '${turnContext.activity.text}'`);
                break;
            case ActivityTypes.ConversationUpdate:
                this.welcomeUser = new WelcomeUser();
                await this.welcomeUser.welcomeUser(turnContext);
                break;
        }
    }
}

module.exports.NagarroLeaveManagerBot = NagarroLeaveManagerBot;
