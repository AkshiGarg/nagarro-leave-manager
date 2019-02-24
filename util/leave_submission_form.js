var fs = require('fs');
const USER_LEAVE_RECORDS_FILE = './resources/user_leave_record.json';

class LeaveSubmissionForm {

    submitMultipleLeaveRequests(empId, dates) {
        var jsonString = fs.readFileSync(USER_LEAVE_RECORDS_FILE);
        var leaveRecords = JSON.parse(jsonString);
        for (let i = 0; i < leaveRecords.length; i++) {
            if (leaveRecords[i].employeeId === empId) {
                for(let j = 0 ; j < dates.length; j++) {
                    const new_leave_request = {
                        "reason": "not mentioned",
                        "type": "leave",
                        "date": new Date(dates[j]).toLocaleDateString(),
                        "comments": "no comment mentioned"
                    }
                    leaveRecords[i].leaveRequests.push(new_leave_request);
                }
                    leaveRecords[i].leavesTaken += dates.length;
                break;
            }
        }
        var updatedData = JSON.stringify(leaveRecords, null, 4);
        fs.writeFileSync(USER_LEAVE_RECORDS_FILE, updatedData);
    }

    submitLeaveRequest(empId, date, type, reason, comment) {
        var jsonString = fs.readFileSync(USER_LEAVE_RECORDS_FILE);
        var leaveRecords = JSON.parse(jsonString);
        for (let i = 0; i < leaveRecords.length; i++) {
            if (leaveRecords[i].employeeId === empId) {
                let new_leave_request = {
                    "reason": reason,
                    "type": type,
                    "date": date,
                    "comments": comment
                }
                leaveRecords[i].leaveRequests.push(new_leave_request);
                if(type === "leave") {
                    leaveRecords[i].leavesTaken += 1;
                }
                break;
            }
        }
        var updatedData = JSON.stringify(leaveRecords, null, 4);
        fs.writeFileSync(USER_LEAVE_RECORDS_FILE, updatedData);
    }

    getUserRecordFromFile(userId) {
        const records = JSON.parse(fs.readFileSync(USER_LEAVE_RECORDS_FILE));
        var userRecord = records.find(leaveRecord => leaveRecord.employeeId === userId);
        return userRecord;
    }
}

module.exports.LeaveSubmissionForm = LeaveSubmissionForm;