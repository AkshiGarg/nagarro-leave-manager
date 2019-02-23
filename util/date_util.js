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
}

module.exports.DateUtil = DateUtil;