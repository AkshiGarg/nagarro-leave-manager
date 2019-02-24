const Recognizers = require('@microsoft/recognizers-text-suite');

class DateUtil {
    static validateDate(input) {
        try {
            const results = Recognizers.recognizeDateTime(input, Recognizers.Culture.English);
            const now = new Date();
            const earliest = now.getTime();
            let output;
            results.forEach(function (result) {
                result.resolution['values'].forEach(function (resolution) {
                    const datevalue = resolution['value'] || resolution['start'];
                    const datetime = new Date(datevalue);
                    if ([0, 6].includes(datetime.getDay())) {
                        output = { success: false, message: "The date you have mentioned falls on weekend." };
                        return;
                    }

                    if (datetime && earliest < datetime.getTime()) {
                        output = { success: true, date: result, startDate: datetime.toLocaleDateString() };
                        return;
                    }
                });
            });
            return output || { success: false, message: "I'm sorry, please enter an upcoming date." };
        } catch (error) {
            return {
                success: false,
                message: "I'm sorry, I could not interpret that as an appropriate date. Please enter an upcoming date."
            };
        }
    }

    static fetchDateFilterFromLuisDate(luisDate) {
        const results = Recognizers.recognizeDateTime(luisDate[0].entity, Recognizers.Culture.English);
        let output = [];
        results.forEach(function (result) {
            result.resolution['values'].forEach(function (resolution) {
                const now = new Date();
                const earliest = now.getTime();
                if (resolution.type === 'daterange') {
                    const start = resolution['start'];
                    const end = resolution['end'];
                    const startDate = new Date(start);
                    startDate.setHours(0,0,0,0);
                    const endDate = new Date(end);
                    endDate.setHours(0,0,0,0);
                    if (earliest < endDate.getTime()) {
                        let date = startDate;
                        while (date < endDate) {
                            output.push(new Date(date).getTime());
                            date.setDate(date.getDate() + 1);
                        }
                        return;
                    }
                } else {
                    const datevalue = resolution['value'];
                    const datetime = new Date(datevalue);
                    datetime.setHours(0,0,0,0);
                    if (datetime && earliest < datetime.getTime()) {
                        output.push(datetime.getTime());
                        return;
                    }
                }
            });
        });
        return output;
    }
}

module.exports.DateUtil = DateUtil;