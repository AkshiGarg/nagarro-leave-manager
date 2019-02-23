var fs = require('fs');
const USER_LEAVE_RECORDS_FILE = './resources/user_leave_record.json';

class LeaveSubmissionForm {

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